"""
FairGNN: Eliminating Bias in Graph Neural Networks (adversarial debiasing).

Paper inspiration: FairGNN — Eliminating Bias in Graph Neural Networks.
Architecture: Encoder -> Embedding; Embedding -> Predictor (disease/link);
              Embedding -> Adversary (sensitive attribute).
Goal: Minimize prediction loss while maximizing adversary loss via gradient reversal.
Loss: L_total = L_prediction − α * L_adversary
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import HeteroData

from .base_gnn import MedicalGNN
from .gradient_reversal import gradient_reverse


class FairGNN(nn.Module):
    """
    FairGNN: Encoder -> Predictor (link) + Adversary (sensitive attr).
    Gradient reversal on embedding before adversary so encoder is encouraged
    to produce embeddings that do not predict sensitive attribute.
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_channels: int = 64,
        out_channels: int = 32,
        num_diseases: int = 10,
        num_sensitive_classes: int = 3,
        alpha_adv: float = 0.1,
    ):
        super().__init__()
        self.encoder = MedicalGNN(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_diseases=num_diseases,
        )
        # Predictor: (patient_emb, disease_emb) -> link logit (1 per edge)
        self.predictor = nn.Linear(hidden_channels * 2, 1)
        self.adversary = nn.Sequential(
            nn.Linear(hidden_channels, hidden_channels),
            nn.ReLU(),
            nn.Linear(hidden_channels, num_sensitive_classes),
        )
        self.num_sensitive_classes = num_sensitive_classes
        self.alpha_adv = alpha_adv

    def forward(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor | None = None,
        disease_idx: torch.Tensor | None = None,
        return_embeddings: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor | None, torch.Tensor | None]:
        """
        Forward pass.

        Returns
        -------
        If patient_idx and disease_idx given: link logits (n_edges,).
        Optionally (logits, adv_logits, p_emb) when return_embeddings=True for loss.
        """
        p_emb, d_emb = self.encoder(data, patient_idx=None, disease_idx=None)
        if patient_idx is not None and disease_idx is not None:
            patient_idx = patient_idx.to(p_emb.device)
            disease_idx = disease_idx.to(d_emb.device)
            p_e = p_emb[patient_idx]
            d_e = d_emb[disease_idx]
            if p_e.dim() == 1:
                p_e = p_e.unsqueeze(0)
            if d_e.dim() == 1:
                d_e = d_e.unsqueeze(0)
            logits = self.predictor(torch.cat([p_e, d_e], dim=-1)).squeeze(-1)
            if return_embeddings:
                adv_logits = self.adversary(p_e)
                return logits, adv_logits, p_e
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
        L_total = L_prediction − α * L_adversary.
        Adversary tries to predict sensitive attribute; we reverse gradient
        so encoder learns to fool the adversary.
        """
        logits, adv_logits, p_emb = self.forward(
            data, patient_idx, disease_idx, return_embeddings=True
        )
        y = y.to(logits.device).float()
        L_pred = F.binary_cross_entropy_with_logits(logits, y, reduction="mean")

        if sensitive_attr is None or self.alpha_adv <= 0:
            return L_pred

        sensitive_attr = sensitive_attr.to(p_emb.device).long()
        # Gradient reversal: pass patient embedding through rev so adversary loss
        # backprops with negated gradient to encoder
        p_rev = gradient_reverse(p_emb, self.alpha_adv)
        adv_logits = self.adversary(p_rev)
        L_adv = F.cross_entropy(adv_logits, sensitive_attr, reduction="mean")
        return L_pred - self.alpha_adv * L_adv

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
