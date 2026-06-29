"""
FairGCN: Fairness-aware Graph Convolutional Network.

Paper inspiration: FairGCN - Fairness-aware Graph Convolutional Network.
Architecture: GCN Encoder -> node embeddings -> classifier.
Loss = prediction_loss + λ * fairness_penalty, where fairness_penalty
approximates Statistical Parity Difference so that predictions are
independent of sensitive group when possible.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import HeteroData


class FairGCN(nn.Module):
    """
    FairGCN: GCN-style encoder + MLP classifier with Statistical Parity regularization.

    - encoder: graph convolution (neighbor aggregation + linear) to produce node embeddings.
    - classifier: MLP mapping (patient_emb, disease_emb) -> link logit.
    - Loss = BCE(prediction) + λ * |P(ŷ=1|A) - P(ŷ=1|B)| (approximate SPD penalty).
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_channels: int = 64,
        out_channels: int = 32,
        num_diseases: int = 10,
        lambda_fair: float = 0.5,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.num_diseases = num_diseases
        self.lambda_fair = lambda_fair

        # GCN-style encoder: linear transforms per node type + neighbor aggregation
        self.lin_p = nn.Linear(in_channels, hidden_channels)
        self.lin_s = nn.Linear(in_channels, hidden_channels)
        self.lin_d = nn.Linear(in_channels, hidden_channels)
        self.lin_t = nn.Linear(in_channels, hidden_channels)

        # Classifier: MLP from (patient_emb, disease_emb) to single link logit
        self.classifier = nn.Sequential(
            nn.Linear(hidden_channels * 2, hidden_channels),
            nn.ReLU(),
            nn.Linear(hidden_channels, 1),
        )

    def _agg_symptom_to_patient(
        self, p_emb: torch.Tensor, s_emb: torch.Tensor, edge_index: torch.Tensor
    ) -> torch.Tensor:
        """Aggregate symptom embeddings to patient nodes (GCN-style mean aggregation)."""
        if edge_index is None or edge_index.numel() == 0:
            return p_emb
        src, dst = edge_index[0], edge_index[1]
        num_p = p_emb.size(0)
        agg = torch.zeros_like(p_emb, device=p_emb.device)
        for i in range(src.size(0)):
            agg[src[i].item()] += s_emb[dst[i]]
        counts = (
            torch.bincount(src, minlength=num_p).float().clamp(min=1).unsqueeze(1).to(p_emb.device)
        )
        agg = agg / counts
        return p_emb + agg

    def forward(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor | None = None,
        disease_idx: torch.Tensor | None = None,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass.

        Returns
        -------
        If patient_idx and disease_idx are provided: link logits (n_edges,).
        Else: (p_emb, d_emb) for use in loss with fairness penalty.
        """
        device = next(self.parameters()).device

        def _feat(store, key="x"):
            x = getattr(store, key, None)
            if x is None:
                return None
            x = x.float() if x.dtype != torch.float32 else x
            return x.to(device).unsqueeze(1) if x.dim() == 1 else x.to(device)

        p_x = _feat(data["patient"])
        s_x = _feat(data["symptom"])
        d_x = _feat(data["disease"])
        if p_x is None or s_x is None or d_x is None:
            raise ValueError("patient, symptom, disease must have .x")

        # GCN encoder: transform + aggregate
        p_emb = torch.relu(self.lin_p(p_x))
        s_emb = torch.relu(self.lin_s(s_x))
        d_emb = torch.relu(self.lin_d(d_x))

        for edge_type in data.edge_types:
            if edge_type[0] == "patient" and edge_type[2] == "symptom":
                ei = data[edge_type].edge_index.to(device)
                p_emb = self._agg_symptom_to_patient(p_emb, s_emb, ei)
                break

        if patient_idx is not None and disease_idx is not None:
            patient_idx = patient_idx.to(device)
            disease_idx = disease_idx.to(device)
            p_e = p_emb[patient_idx]
            d_e = d_emb[disease_idx]
            if p_e.dim() == 1:
                p_e = p_e.unsqueeze(0)
            if d_e.dim() == 1:
                d_e = d_e.unsqueeze(0)
            logits = self.classifier(torch.cat([p_e, d_e], dim=-1)).squeeze(-1)
            return logits
        return p_emb, d_emb

    def loss_function(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor,
        disease_idx: torch.Tensor,
        y: torch.Tensor,
        sensitive_attr: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        Loss = prediction_loss + λ * fairness_penalty.

        Fairness penalty approximates Statistical Parity Difference:
        SPD = P(ŷ=1 | group A) - P(ŷ=1 | group B).
        We penalize |SPD| so that predictions are similar across groups.
        """
        logits = self.forward(data, patient_idx, disease_idx)
        y = y.to(logits.device).float()
        prediction_loss = F.binary_cross_entropy_with_logits(logits, y, reduction="mean")

        if sensitive_attr is None or self.lambda_fair <= 0:
            return prediction_loss

        # Approximate SPD from batch: group A vs group B (e.g. low vs high)
        sensitive_attr = sensitive_attr.to(logits.device)
        probs = torch.sigmoid(logits)
        # Use two groups: 0 vs 2 (low vs high) if present; else 0 vs 1
        group_a = sensitive_attr == 0
        group_b = sensitive_attr == 2
        if group_b.sum() == 0:
            group_b = sensitive_attr == 1
        if group_a.sum() == 0 or group_b.sum() == 0:
            return prediction_loss

        p_pred_a = probs[group_a].mean()
        p_pred_b = probs[group_b].mean()
        fairness_penalty = (p_pred_a - p_pred_b).abs()
        return prediction_loss + self.lambda_fair * fairness_penalty

    def train_step(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor,
        disease_idx: torch.Tensor,
        y: torch.Tensor,
        sensitive_attr: torch.Tensor | None,
        optimizer: torch.optim.Optimizer,
    ) -> float:
        """Single training step; returns scalar loss."""
        self.train()
        optimizer.zero_grad()
        loss = self.loss_function(data, patient_idx, disease_idx, y, sensitive_attr)
        loss.backward()
        optimizer.step()
        return loss.item()
