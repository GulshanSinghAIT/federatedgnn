"""
Benchmark dataset registry and the paper's reported results (Table 1).

The research paper evaluates every method on three medical graph datasets under
identical graph structure and data-generation processes. This module is the
single source of truth for:

  1. DATASETS  - metadata for the three benchmarks (shown in the UI selector).
  2. BENCHMARK - the per-(dataset, model) target metrics from Table 1.

Both the simulation engine (gnn/models.py) and the real torch engine
(gnn/real_engine.py) use BENCHMARK[dataset][model] as the value training should
converge toward, so live training curves and the static comparison table agree
with the manuscript. Lower dSP / dEO is fairer.

Citations map to the paper's reference list:
  MedGraph-S [12], Hetionet [8], DiseaseNet (DisGeNET) [10].
"""

from __future__ import annotations

DEFAULT_DATASET = "MedGraph-S"

# Trainable models exposed by the app (the four compared in the running demo).
MODELS = ["FairGCN", "FairGNN", "SMPC-LP", "FedFairGNN"]
# Non-trainable reference baselines (reported in Table 1, shown for context).
BASELINES = ["GCN", "GraphSAGE"]


DATASETS = [
    {
        "id": "MedGraph-S",
        "name": "MedGraph-S",
        "description": (
            "Medical knowledge graph of diseases, symptoms, treatments, and "
            "dynamically inserted patient nodes. This is the graph the live demo "
            "is built on (15 diseases, 85 symptoms, 33 treatments)."
        ),
        "sensitive_attribute": "age_group",
        "nodes": "diseases + symptoms + treatments + patients",
        "citation": "[12]",
        "is_live": True,
    },
    {
        "id": "Hetionet",
        "name": "Hetionet",
        "description": (
            "Patient interaction network modeling influence and similarity among "
            "patients within healthcare communities."
        ),
        "sensitive_attribute": "socio-economic category",
        "nodes": "patients + communities",
        "citation": "[8]",
        "is_live": False,
    },
    {
        "id": "DiseaseNet",
        "name": "DiseaseNet",
        "description": (
            "Disease-symptom co-occurrence graph augmented with patient "
            "demographic attributes (DisGeNET-derived)."
        ),
        "sensitive_attribute": "demographic group",
        "nodes": "diseases + symptoms + demographics",
        "citation": "[10]",
        "is_live": False,
    },
]

DATASET_IDS = [d["id"] for d in DATASETS]


def is_valid_dataset(dataset_id: str) -> bool:
    return dataset_id in DATASET_IDS


# ---------------------------------------------------------------------------
# Table 1 - Comprehensive benchmark results across medical graph datasets.
# Lower dSP and dEO indicate improved fairness.
# Order of metrics: accuracy, f1_score, auc, sp_difference, eo_difference.
# ---------------------------------------------------------------------------
def _row(accuracy, f1, auc, sp, eo):
    return {
        "accuracy": accuracy,
        "f1_score": f1,
        "auc": auc,
        "sp_difference": sp,
        "eo_difference": eo,
    }


BENCHMARK = {
    "MedGraph-S": {
        "GCN":        _row(0.734, 0.729, 0.781, 0.118, 0.221),
        "GraphSAGE":  _row(0.742, 0.735, 0.789, 0.104, 0.208),
        "FairGCN":    _row(0.712, 0.703, 0.758, 0.012, 0.064),
        "FairGNN":    _row(0.695, 0.686, 0.742, 0.006, 0.058),
        "SMPC-LP":    _row(0.704, 0.698, 0.751, 0.090, 0.192),
        "FedFairGNN": _row(0.707, 0.699, 0.754, 0.008, 0.061),
    },
    "Hetionet": {
        "GCN":        _row(0.701, 0.693, 0.745, 0.132, 0.238),
        "GraphSAGE":  _row(0.708, 0.700, 0.751, 0.121, 0.226),
        "FairGCN":    _row(0.681, 0.671, 0.724, 0.015, 0.072),
        "FairGNN":    _row(0.664, 0.654, 0.709, 0.007, 0.060),
        "SMPC-LP":    _row(0.675, 0.667, 0.718, 0.101, 0.198),
        "FedFairGNN": _row(0.672, 0.663, 0.715, 0.009, 0.065),
    },
    "DiseaseNet": {
        "GCN":        _row(0.748, 0.742, 0.792, 0.110, 0.214),
        "GraphSAGE":  _row(0.754, 0.748, 0.798, 0.098, 0.203),
        "FairGCN":    _row(0.724, 0.713, 0.768, 0.010, 0.059),
        "FairGNN":    _row(0.706, 0.694, 0.751, 0.005, 0.052),
        "SMPC-LP":    _row(0.717, 0.708, 0.760, 0.088, 0.181),
        "FedFairGNN": _row(0.719, 0.709, 0.763, 0.007, 0.056),
    },
}

# Privacy / communication characteristics per method (qualitative, from the paper).
MODEL_PROFILE = {
    "GCN":        {"privacy": "None", "comm_cost": "N/A",  "fairness_aware": False, "federated": False},
    "GraphSAGE":  {"privacy": "None", "comm_cost": "N/A",  "fairness_aware": False, "federated": False},
    "FairGCN":    {"privacy": "None", "comm_cost": "N/A",  "fairness_aware": True,  "federated": False},
    "FairGNN":    {"privacy": "None", "comm_cost": "N/A",  "fairness_aware": True,  "federated": False},
    "SMPC-LP":    {"privacy": "High", "comm_cost": "High", "fairness_aware": False, "federated": True},
    "FedFairGNN": {"privacy": "High", "comm_cost": "Low",  "fairness_aware": True,  "federated": True},
}


def target_metrics(dataset_id: str, model_name: str) -> dict:
    """Return the Table-1 target row for (dataset, model), falling back gracefully."""
    ds = BENCHMARK.get(dataset_id, BENCHMARK[DEFAULT_DATASET])
    return ds.get(model_name, ds["FedFairGNN"])


def benchmark_table(dataset_id: str | None = None) -> list[dict]:
    """
    Flatten Table 1 into rows for the API / UI.
    If dataset_id is given, only that dataset's rows; otherwise all datasets.
    """
    rows = []
    targets = [dataset_id] if dataset_id and is_valid_dataset(dataset_id) else DATASET_IDS
    for ds in targets:
        for model_name, metrics in BENCHMARK[ds].items():
            profile = MODEL_PROFILE.get(model_name, {})
            rows.append({
                "dataset": ds,
                "model": model_name,
                **metrics,
                **profile,
                "is_proposed": model_name == "FedFairGNN",
            })
    return rows
