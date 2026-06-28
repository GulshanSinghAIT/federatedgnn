"""
SMPC-LP: Secure Multi-Party Computation for Link Prediction.

Paper inspiration: Secure Multi-Party Computation for Link Prediction.
Hospitals train local GNN; only model weights are shared; aggregation server
averages weights. Node features, embeddings, and sensitive attributes are never shared.
"""

from __future__ import annotations

import copy
from collections import OrderedDict
from typing import Callable

import torch
from torch_geometric.data import HeteroData

from .base_gnn import MedicalGNN
from .secure_avg import secure_average


def train_local_model(
    model: torch.nn.Module,
    data: HeteroData,
    patient_idx: torch.Tensor,
    disease_idx: torch.Tensor,
    y: torch.Tensor,
    num_epochs: int = 20,
    lr: float = 1e-3,
    seed: int | None = None,
) -> torch.nn.Module:
    """
    Train the given model on local (hospital) data.
    Only the model is updated; no data or embeddings leave the hospital.

    Parameters
    ----------
    model : nn.Module
        Local GNN (e.g. MedicalGNN or SMPC_LP wrapper).
    data : HeteroData
        This hospital's subgraph (patient, symptom, disease, treatment).
    patient_idx, disease_idx, y : Tensor
        Link prediction labels: edge (patient_idx[i], disease_idx[i]) has label y[i].
    num_epochs, lr, seed : optional
        Training config; seed for reproducibility.

    Returns
    -------
    nn.Module
        Trained model (same object, state updated). Never share data/embeddings.
    """
    if seed is not None:
        torch.manual_seed(seed)
    model.train()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    device = next(model.parameters()).device
    data = data.to(device)
    patient_idx = patient_idx.to(device)
    disease_idx = disease_idx.to(device)
    y = y.to(device).float()

    for _ in range(num_epochs):
        optimizer.zero_grad()
        logits = model(data, patient_idx, disease_idx)
        if logits.dim() == 0:
            logits = logits.unsqueeze(0)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, y)
        loss.backward()
        optimizer.step()
    return model


def send_model_weights(model: torch.nn.Module) -> OrderedDict:
    """
    Export model weights for secure aggregation.
    Only state_dict is shared; no node features, embeddings, or sensitive attributes.

    Returns
    -------
    OrderedDict
        model.state_dict() (copy).
    """
    return OrderedDict((k, v.cpu().clone()) for k, v in model.state_dict().items())


def secure_aggregate(weights_list: list[OrderedDict]) -> OrderedDict:
    """
    Securely aggregate local model weights (e.g. FedAvg / simulated SMPC).
    Only weights are combined; no raw data.

    Parameters
    ----------
    weights_list : list[OrderedDict]
        state_dict from each hospital.

    Returns
    -------
    OrderedDict
        Averaged weights.
    """
    return secure_average(weights_list)


def update_global_model(model: torch.nn.Module, global_weights: OrderedDict) -> torch.nn.Module:
    """
    Update model with aggregated global weights (broadcast from server).

    Parameters
    ----------
    model : nn.Module
        Local model to update.
    global_weights : OrderedDict
        Aggregated state_dict from secure_aggregate().

    Returns
    -------
    nn.Module
        Model with loaded global weights.
    """
    device = next(model.parameters()).device
    global_weights_device = OrderedDict((k, v.to(device)) for k, v in global_weights.items())
    model.load_state_dict(global_weights_device, strict=False)
    return model


class SMPC_LP(torch.nn.Module):
    """
    SMPC-LP: Same architecture as MedicalGNN for privacy-preserving federated link prediction.
    Used with train_local_model(), send_model_weights(), secure_aggregate(), update_global_model().
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_channels: int = 64,
        out_channels: int = 32,
        num_diseases: int = 10,
    ):
        super().__init__()
        self.gnn = MedicalGNN(
            in_channels=in_channels,
            hidden_channels=hidden_channels,
            out_channels=out_channels,
            num_diseases=num_diseases,
        )

    def forward(
        self,
        data: HeteroData,
        patient_idx: torch.Tensor | None = None,
        disease_idx: torch.Tensor | None = None,
    ):
        return self.gnn(data, patient_idx, disease_idx)
