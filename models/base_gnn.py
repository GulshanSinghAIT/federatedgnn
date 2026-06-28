"""Base heterogeneous GNN for medical KG link prediction (patient -> disease)."""
import torch
import torch.nn as nn
from torch_geometric.data import HeteroData


class MedicalGNN(nn.Module):
    """
    Simple heterogeneous GNN for link prediction on medical graph.
    Node types: patient, symptom, disease, treatment.
    Predicts patient -> disease (diagnosis).
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_channels: int = 64,
        out_channels: int = 32,
        num_diseases: int = 10,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        self.num_diseases = num_diseases
        self.lin_p = nn.Linear(in_channels, hidden_channels)
        self.lin_s = nn.Linear(in_channels, hidden_channels)
        self.lin_d = nn.Linear(in_channels, hidden_channels)
        self.lin_t = nn.Linear(in_channels, hidden_channels)
        # One logit per (patient, disease) link for binary link prediction
        self.lin_out = nn.Linear(hidden_channels * 2, 1)

    def _agg_symptom_to_patient(self, p_emb, s_emb, edge_index):
        if edge_index is None or edge_index.numel() == 0:
            return p_emb
        src, dst = edge_index[0], edge_index[1]
        num_p = p_emb.size(0)
        agg = torch.zeros_like(p_emb)
        for i in range(src.size(0)):
            agg[src[i].item()] += s_emb[dst[i]]
        counts = torch.bincount(src, minlength=num_p).float().clamp(min=1).unsqueeze(1)
        agg = agg / counts
        return p_emb + agg

    def forward(self, data: HeteroData, patient_idx=None, disease_idx=None):
        device = next(self.parameters()).device
        p_x = getattr(data["patient"].x, "float", lambda: data["patient"].x)()
        if p_x.dim() == 1:
            p_x = p_x.unsqueeze(1)
        s_x = getattr(data["symptom"].x, "float", lambda: data["symptom"].x)()
        if s_x.dim() == 1:
            s_x = s_x.unsqueeze(1)
        d_x = getattr(data["disease"].x, "float", lambda: data["disease"].x)()
        if d_x.dim() == 1:
            d_x = d_x.unsqueeze(1)

        p_emb = torch.relu(self.lin_p(p_x.to(device)))
        s_emb = torch.relu(self.lin_s(s_x.to(device)))
        d_emb = torch.relu(self.lin_d(d_x.to(device)))

        for edge_type in data.edge_types:
            if edge_type[0] == "patient" and edge_type[2] == "symptom":
                ei = data[edge_type].edge_index.to(device)
                p_emb = self._agg_symptom_to_patient(p_emb, s_emb, ei)
                break

        if patient_idx is not None and disease_idx is not None:
            p_e = p_emb[patient_idx]
            d_e = d_emb[disease_idx]
            if p_e.dim() == 1:
                p_e = p_e.unsqueeze(0)
            if d_e.dim() == 1:
                d_e = d_e.unsqueeze(0)
            logits = self.lin_out(torch.cat([p_e, d_e], dim=-1)).squeeze(-1)
            return logits
        return p_emb, d_emb
