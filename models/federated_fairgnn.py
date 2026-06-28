"""
Federated FairGNN: FairGNN + Federated Learning + Secure Aggregation.

Training pipeline: each hospital trains FairGNN locally with
  L_total = L_prediction − α * L_adversary + β * fairness_regularization.
Only model weights are sent to aggregator; secure average then broadcast.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import HeteroData

from ml.models.fair_gnn import FairGNN


class FederatedFairGNN(nn.Module):
    """
    Federated FairGNN: same architecture as FairGNN, with optional
    fairness regularization in the local loss for federated rounds.
    L_total = L_prediction − α * L_adversary + β * fairness_regularization.
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_channels: int = 64,
        out_channels: int = 32,
        num_diseases: int = 10,
        num_sensitive_classes: int = 3,
        alpha_adv: float = 0.1,
        beta_fair: float = 0.3,
    ):
        super().__init__()
        self.fairgnn = FairGNN(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_diseases=num_diseases,
            num_sensitive_classes=num_sensitive_classes,
            alpha_adv=alpha_adv,
        )
        self.beta_fair = beta_fair

    def forward(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor | None = None,
        disease_idx: torch.Tensor | None = None,
        return_embeddings: bool = False,
    ):
        return self.fairgnn.forward(
            data, patient_idx, disease_idx, return_embeddings=return_embeddings
        )

    def _fairness_regularization(
        self,
        logits: torch.Tensor,
        sensitive_attr: torch.Tensor,
    ) -> torch.Tensor:
        """Approximate Statistical Parity penalty: |P(ŷ=1|A) - P(ŷ=1|B)|."""
        if sensitive_attr is None or self.beta_fair <= 0:
            return torch.tensor(0.0, device=logits.device)
        probs = torch.sigmoid(logits)
        group_a = sensitive_attr == 0
        group_b = sensitive_attr == 2
        if group_b.sum() == 0:
            group_b = sensitive_attr == 1
        if group_a.sum() == 0 or group_b.sum() == 0:
            return torch.tensor(0.0, device=logits.device)
        p_a = probs[group_a].mean()
        p_b = probs[group_b].mean()
        return (p_a - p_b).abs()

    def loss_function(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor,
        disease_idx: torch.Tensor,
        y: torch.Tensor,
        sensitive_attr: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """
        L_total = L_prediction − α * L_adversary + β * fairness_regularization.
        """
        base_loss = self.fairgnn.loss_function(
            data, patient_idx, disease_idx, y, sensitive_attr
        )
        if sensitive_attr is None or self.beta_fair <= 0:
            return base_loss
        logits = self.forward(data, patient_idx, disease_idx)
        fair_reg = self._fairness_regularization(logits, sensitive_attr.to(logits.device))
        return base_loss + self.beta_fair * fair_reg

    def train_step(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor,
        disease_idx: torch.Tensor,
        y: torch.Tensor,
        sensitive_attr: torch.Tensor | None,
        optimizer: torch.optim.Optimizer,
    ) -> float:
        """Single local training step; returns scalar loss."""
        self.train()
        optimizer.zero_grad()
        loss = self.loss_function(data, patient_idx, disease_idx, y, sensitive_attr)
        loss.backward()
        optimizer.step()
        return loss.item()
