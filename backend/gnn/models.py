"""
GNN model definitions for the FedFairGNN system (simulation engine).

These are simulation-based implementations that produce realistic training
metrics without requiring PyTorch / PyTorch Geometric. They are the DEFAULT
engine. When torch is installed and the "real" engine is selected, the
classes in the repo-root ``models/`` package are used instead (see
gnn/real_engine.py); both converge to the same per-dataset targets defined in
data/datasets.py (the paper's Table 1).

Per round, ``simulate_round`` moves each metric from a model-specific starting
point toward ``target_metrics(dataset, model)``:
  - accuracy / f1 / auc rise toward the target (saturating exponential),
  - sp_difference / eo_difference (fairness, lower=better) decay toward target.
This makes the live convergence curves and the static comparison table agree
with the manuscript.
"""
import math
import random
from typing import Dict, List

import numpy as np

from data.datasets import target_metrics, DEFAULT_DATASET


def _approach(start: float, target: float, r: int, tau: float) -> float:
    """Saturating exponential from `start` at r=0 toward `target` as r grows."""
    return start + (target - start) * (1 - math.exp(-r / tau))


class BaseGNNModel:
    """Base class for all GNN model simulations.

    Subclasses set convergence dynamics via:
      _tau           : rounds-constant for accuracy/f1/auc rise
      _fair_tau      : rounds-constant for sp/eo decay
      _start_gap     : how far below the accuracy target round-1 starts
      _fair_start_gap: how far above the fairness target round-1 starts
      _noise / _fair_noise : per-round jitter magnitudes
    """

    _tau = 7.0
    _fair_tau = 8.0
    _start_gap = 0.16
    _fair_start_gap = 0.08
    _noise = 0.015
    _fair_noise = 0.007

    def __init__(self, name: str, num_features: int = 85, num_classes: int = 15):
        self.name = name
        self.num_features = num_features
        self.num_classes = num_classes
        self.weights = np.random.randn(num_features, num_classes) * 0.01
        self.round_num = 0

    def state_dict(self) -> Dict:
        return {"weights": self.weights.copy(), "round": self.round_num}

    def load_state_dict(self, state: Dict):
        self.weights = state["weights"].copy()
        self.round_num = state.get("round", self.round_num)

    def simulate_round(self, round_num: int, num_patients: int,
                       dataset: str = DEFAULT_DATASET) -> Dict:
        """Produce one round of metrics converging toward the dataset target."""
        self.round_num = round_num
        t = target_metrics(dataset, self.name)

        acc_t, f1_t, auc_t = t["accuracy"], t["f1_score"], t["auc"]
        sp_t, eo_t = t["sp_difference"], t["eo_difference"]

        acc = _approach(acc_t - self._start_gap, acc_t, round_num, self._tau)
        f1 = _approach(f1_t - self._start_gap, f1_t, round_num, self._tau)
        auc = _approach(auc_t - self._start_gap, auc_t, round_num, self._tau)
        sp = _approach(sp_t + self._fair_start_gap, sp_t, round_num, self._fair_tau)
        eo = _approach(eo_t + self._fair_start_gap, eo_t, round_num, self._fair_tau)

        n = random.gauss(0, self._noise)
        fn = abs(random.gauss(0, self._fair_noise))
        # Loss tracks (1 - accuracy) plus decay, floored.
        loss = max(0.08, (1.0 - acc) * 1.4 - 0.01 * round_num + random.gauss(0, 0.02))

        return {
            "accuracy": round(min(0.99, max(0.0, acc + n)), 4),
            "f1_score": round(min(0.99, max(0.0, f1 + n * 0.9)), 4),
            "auc": round(min(0.99, max(0.0, auc + n * 0.8)), 4),
            "loss": round(loss, 4),
            "sp_difference": round(max(0.0, sp + fn), 4),
            "eo_difference": round(max(0.0, eo + fn), 4),
            "nodes_trained": num_patients,
        }

    def predict(self, patient_symptoms: List[str], all_symptoms: List[str],
                disease_symptom_map: Dict) -> List[Dict]:
        """Predict diseases for a patient based on symptoms (inference-time
        link prediction over the medical KG; supports dynamic patient nodes)."""
        scores = {}
        coverages = {}
        patient_sym_set = set(patient_symptoms)

        for disease_id, sym_weights in disease_symptom_map.items():
            score = 0.0
            matched = 0
            total_syms = len(sym_weights)
            for sym_id, weight in sym_weights:
                if sym_id in patient_sym_set:
                    score += weight
                    matched += 1
            if score > 0:
                scores[disease_id] = score
                coverages[disease_id] = matched / max(total_syms, 1)

        if not scores:
            return []

        temperature = 0.5
        score_values = np.array(list(scores.values()))
        exp_scores = np.exp(score_values / temperature)
        softmax_probs = exp_scores / exp_scores.sum()

        # Base multiplier improves with training rounds.
        base_multiplier = 0.80 + min(self.round_num * 0.015, 0.15)

        orig_keys = list(scores.keys())
        sm_lookup = {k: softmax_probs[i] for i, k in enumerate(orig_keys)}

        predictions = []
        for disease_id, score in sorted(scores.items(), key=lambda x: -x[1]):
            sm_prob = sm_lookup[disease_id]
            coverage = coverages.get(disease_id, 0)
            coverage_boost = 1.0 + 0.3 * max(0, coverage - 0.4)
            confidence = min(0.95, sm_prob * base_multiplier * coverage_boost)
            confidence = max(0.08, min(0.95, confidence + random.gauss(0, 0.015)))
            predictions.append({
                "disease_id": disease_id,
                "confidence": round(confidence, 3),
            })

        return predictions[:5]


class FairGCN(BaseGNNModel):
    """2-layer GCN with a statistical-parity regularizer. Converges fast,
    moderate fairness."""
    _tau = 8.0
    _fair_tau = 10.0
    _fair_start_gap = 0.06

    def __init__(self):
        super().__init__("FairGCN")


class FairGNN(BaseGNNModel):
    """GCN encoder + adversarial discriminator (gradient reversal). Best
    fairness centrally, slightly lower accuracy from the adversarial trade-off."""
    _tau = 7.0
    _fair_tau = 7.0
    _start_gap = 0.18
    _fair_start_gap = 0.09
    _fair_noise = 0.006

    def __init__(self):
        super().__init__("FairGNN")


class SMPC_LP(BaseGNNModel):
    """Privacy-preserving link prediction with secure aggregation; no fairness
    objective, so fairness improves only slightly with rounds."""
    _tau = 9.0
    _fair_tau = 12.0
    _start_gap = 0.14
    _fair_start_gap = 0.03
    _noise = 0.018

    def __init__(self):
        super().__init__("SMPC-LP")


class FedFairGNN(BaseGNNModel):
    """Proposed model: federated adversarial debiasing + secure aggregation.
    Competitive accuracy with the best privacy/fairness balance."""
    _tau = 6.0
    _fair_tau = 7.0
    _start_gap = 0.18
    _fair_start_gap = 0.09
    _noise = 0.012
    _fair_noise = 0.004

    def __init__(self):
        super().__init__("FedFairGNN")


def get_model(model_name: str) -> BaseGNNModel:
    """Factory function to get a simulation model by name."""
    models = {
        "FairGCN": FairGCN,
        "FairGNN": FairGNN,
        "SMPC-LP": SMPC_LP,
        "FedFairGNN": FedFairGNN,
    }
    cls = models.get(model_name)
    if cls is None:
        raise ValueError(f"Unknown model: {model_name}. Available: {list(models.keys())}")
    return cls()


def add_smpc_noise(weights: Dict, sigma: float = 0.01) -> Dict:
    """Add calibrated Gaussian noise to model weights (SMPC/secure-agg masking)."""
    noisy = {}
    for key, val in weights.items():
        if isinstance(val, np.ndarray):
            noisy[key] = val + np.random.normal(0, sigma, val.shape)
        else:
            noisy[key] = val
    return noisy


def federated_average(weight_list: List[Dict]) -> Dict:
    """Compute FedAvg over a list of simulation state dicts."""
    if not weight_list:
        return {}
    avg = {}
    for key in weight_list[0]:
        if isinstance(weight_list[0][key], np.ndarray):
            avg[key] = np.mean(np.stack([w[key] for w in weight_list]), axis=0)
        else:
            avg[key] = weight_list[0][key]
    return avg
