"""
Real (numpy) fairness-aware federated trainer - trains on the generated
MedGraph-S dataset (data/synthetic_dataset.py) with actual gradient descent.

This is NOT the convergence-curve simulation: every number comes from training
a model on data. It implements, from scratch in numpy:
  * a 1-hidden-layer encoder + logistic classifier head,
  * an adversary head that predicts the sensitive attribute from the embedding,
    trained against the encoder via GRADIENT REVERSAL (adversarial debiasing,
    the FairGNN idea), and
  * a statistical-parity penalty (FairGCN), and
  * FEDERATED training across the 3 hospitals (local SGD + weighted FedAvg +
    optional secure-aggregation noise).

Model variants (per the paper's comparison):
  GCN / GraphSAGE / SMPC-LP : no fairness objective  (high disparity)
  FairGCN                   : statistical-parity penalty (lambda)
  FairGNN                   : adversarial debiasing (alpha)
  FedFairGNN                : adversarial debiasing + federated + secure agg

Only numpy is required, so it runs anywhere (no torch / PyG).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np

from data.synthetic_dataset import load_csv, standardize, N_FEATURES

HOSPITALS = ["H1", "H2", "H3"]

# Per-variant fairness knobs.
VARIANTS = {
    "GCN":        {"alpha": 0.0, "lam": 0.0, "federated": True,  "noise": 0.0},
    "GraphSAGE":  {"alpha": 0.0, "lam": 0.0, "federated": True,  "noise": 0.0},
    "FairGCN":    {"alpha": 0.0, "lam": 4.0, "federated": False, "noise": 0.0},
    "FairGNN":    {"alpha": 3.0, "lam": 0.0, "federated": False, "noise": 0.0},
    "SMPC-LP":    {"alpha": 0.0, "lam": 0.0, "federated": True,  "noise": 0.01},
    "FedFairGNN": {"alpha": 3.0, "lam": 1.0, "federated": True,  "noise": 0.01},
}


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def _bce(p, t):
    p = np.clip(p, 1e-7, 1 - 1e-7)
    return float(-np.mean(t * np.log(p) + (1 - t) * np.log(1 - p)))


@dataclass
class FairNet:
    """Encoder(d→h) + classifier head + adversary head, trained with numpy SGD."""
    d: int = N_FEATURES
    h: int = 16
    alpha: float = 0.0   # adversarial debiasing strength
    lam: float = 0.0     # statistical-parity penalty strength
    seed: int = 0
    p: Dict[str, np.ndarray] = field(default_factory=dict)

    def __post_init__(self):
        rng = np.random.default_rng(self.seed)
        sc = 1.0 / np.sqrt(self.d)
        self.p = {
            "W1": rng.normal(0, sc, (self.d, self.h)), "b1": np.zeros(self.h),
            "wc": rng.normal(0, 0.1, (self.h, 1)),     "bc": np.zeros(1),
            "wa": rng.normal(0, 0.1, (self.h, 1)),     "ba": np.zeros(1),
        }

    # --- forward ---
    def _encode(self, X):
        z1 = X @ self.p["W1"] + self.p["b1"]
        e = np.maximum(z1, 0.0)          # ReLU
        return e, (z1 > 0.0)

    def predict_proba(self, X):
        e, _ = self._encode(X)
        return _sigmoid(e @ self.p["wc"] + self.p["bc"]).ravel()

    # --- one full-batch training step on local data ---
    def train_step(self, X, y, s, lr=0.1):
        n = X.shape[0]
        y = y.reshape(-1, 1).astype(np.float64)
        s = s.reshape(-1, 1).astype(np.float64)
        e, relu_mask = self._encode(X)

        # Classifier forward/backward.
        py = _sigmoid(e @ self.p["wc"] + self.p["bc"])
        dlogit_y = (py - y) / n                       # dLc/dlogit_y
        # Statistical-parity penalty: ( mean(py|s=0) - mean(py|s=1) )^2
        if self.lam > 0:
            m0 = py[s == 0].mean() if (s == 0).any() else 0.0
            m1 = py[s == 1].mean() if (s == 1).any() else 0.0
            diff = m0 - m1
            n0, n1 = max((s == 0).sum(), 1), max((s == 1).sum(), 1)
            coef = np.where(s == 0, 1.0 / n0, -1.0 / n1)
            dlogit_y = dlogit_y + self.lam * 2 * diff * coef * py * (1 - py)
        gwc = e.T @ dlogit_y
        gbc = dlogit_y.sum(axis=0)
        de_c = dlogit_y @ self.p["wc"].T              # dLc/de

        # Adversary forward/backward (predict s from embedding).
        ps = _sigmoid(e @ self.p["wa"] + self.p["ba"])
        dlogit_s = (ps - s) / n
        gwa = e.T @ dlogit_s
        gba = dlogit_s.sum(axis=0)
        de_a = dlogit_s @ self.p["wa"].T              # dLa/de

        # Encoder gradient: minimize Lc, MAXIMISE La (gradient reversal × alpha).
        de = de_c - self.alpha * de_a
        dz1 = de * relu_mask
        gW1 = X.T @ dz1
        gb1 = dz1.sum(axis=0)

        # SGD updates. Adversary descends its own loss (normal sign).
        self.p["W1"] -= lr * gW1
        self.p["b1"] -= lr * gb1
        self.p["wc"] -= lr * gwc
        self.p["bc"] -= lr * gbc
        self.p["wa"] -= lr * gwa
        self.p["ba"] -= lr * gba

    def get(self):
        return {k: v.copy() for k, v in self.p.items()}

    def set(self, params):
        self.p = {k: v.copy() for k, v in params.items()}


def secure_average(param_list: List[dict], weights: List[float], noise: float = 0.0,
                   rng=None) -> dict:
    """Weighted FedAvg over client params, with optional secure-agg noise on
    floating-point weights (only model weights are combined - never raw data)."""
    total = float(sum(weights)) or 1.0
    fracs = [w / total for w in weights]
    avg = {}
    for k in param_list[0]:
        acc = np.zeros_like(param_list[0][k], dtype=np.float64)
        for f, params in zip(fracs, param_list):
            acc += f * params[k]
        if noise > 0 and rng is not None:
            acc = acc + rng.normal(0, noise, acc.shape)
        avg[k] = acc
    return avg


def _metrics(model: FairNet, X, y, s) -> Dict[str, float]:
    proba = model.predict_proba(X)
    pred = (proba >= 0.5).astype(int)
    acc = float((pred == y).mean())
    tp = int(((pred == 1) & (y == 1)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    auc = _auc(y, proba)
    # ΔSP = |P(ŷ=1|s=0) − P(ŷ=1|s=1)|
    sp = abs(pred[s == 0].mean() - pred[s == 1].mean()) if (s == 0).any() and (s == 1).any() else 0.0
    # ΔEO = |TPR(s=0) − TPR(s=1)|
    eo = _tpr_gap(pred, y, s)
    return {"accuracy": round(acc, 4), "f1_score": round(f1, 4), "auc": round(auc, 4),
            "sp_difference": round(float(sp), 4), "eo_difference": round(float(eo), 4)}


def _auc(y, score):
    pos, neg = score[y == 1], score[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return 0.5
    # Rank-based (Mann–Whitney U) AUC.
    order = np.argsort(score)
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(score) + 1)
    return float((ranks[y == 1].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def _tpr_gap(pred, y, s):
    def tpr(mask):
        m = mask & (y == 1)
        return pred[m].mean() if m.any() else 0.0
    return abs(tpr(s == 0) - tpr(s == 1))


def train(model_name: str, rounds: int = 15, local_epochs: int = 5, lr: float = 0.3,
          seed: int = 0):
    """Train one variant federally on MedGraph-S. Returns per-round + per-hospital
    metrics histories (round metrics on a held-out global test split)."""
    cfg = VARIANTS.get(model_name, VARIANTS["FedFairGNN"])
    data = load_csv()
    X = standardize(data["X"]); y = data["y"]; s = data["s"]; hosp = data["hospital"]
    rng = np.random.default_rng(seed)

    # Stratified-ish 75/25 train/test split.
    idx = rng.permutation(len(y))
    cut = int(0.75 * len(y))
    tr, te = idx[:cut], idx[cut:]
    Xte, yte, ste = X[te], y[te], s[te]

    # Local hospital partitions of the training set.
    parts = {h: tr[hosp[tr] == h] for h in HOSPITALS}
    parts = {h: ix for h, ix in parts.items() if len(ix) > 0}

    global_model = FairNet(alpha=cfg["alpha"], lam=cfg["lam"], seed=seed)
    per_round, per_hospital = [], {h: [] for h in parts}

    federated = cfg["federated"]
    for r in range(1, rounds + 1):
        if federated:
            client_params, weights = [], []
            for h, ix in parts.items():
                local = FairNet(alpha=cfg["alpha"], lam=cfg["lam"], seed=seed)
                local.set(global_model.get())
                for _ in range(local_epochs):
                    local.train_step(X[ix], y[ix], s[ix], lr=lr)
                client_params.append(local.get()); weights.append(len(ix))
                per_hospital[h].append({"round_num": r, **_metrics(local, X[ix], y[ix], s[ix])})
            global_model.set(secure_average(client_params, weights, cfg["noise"], rng))
        else:
            # Centralized training (FairGCN/FairGNN baselines).
            for _ in range(local_epochs):
                global_model.train_step(X[tr], y[tr], s[tr], lr=lr)
            for h, ix in parts.items():
                per_hospital[h].append({"round_num": r, **_metrics(global_model, X[ix], y[ix], s[ix])})

        m = _metrics(global_model, Xte, yte, ste)
        per_round.append({"round_num": r, **m})

    return {"model": model_name, "rounds": rounds, "history": per_round,
            "per_hospital": per_hospital, "final": per_round[-1]}


def is_available() -> bool:
    """numpy trainer is always runnable (no torch)."""
    return True
