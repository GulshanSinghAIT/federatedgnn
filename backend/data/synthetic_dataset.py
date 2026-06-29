"""
Synthetic medical dataset generator (the "MedGraph-S" tabular dataset).

No public dataset with this exact disease/fairness structure exists, so we
generate one with a KNOWN, biased data-generating process so that:
  * a vanilla classifier achieves decent accuracy but HIGH group disparity, and
  * fairness-aware training (adversarial debiasing) measurably lowers ΔSP / ΔEO.

Each record is a patient with clinical-ish features, a BINARY sensitive
attribute `s` (e.g. age/socio-economic group), and a BINARY outcome label `y`
(high-risk / positive diagnosis). The label depends mostly on legitimate
clinical signal but is deliberately entangled with `s` (direct effect + proxy
features correlated with `s`) so the fairness–utility tradeoff is real and
learnable - not hand-drawn curves.

Run directly to (re)write the CSV:
    python -m data.synthetic_dataset           # writes data/medgraph_s.csv
"""
from __future__ import annotations

import csv
import os
from typing import Dict

import numpy as np

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(DATA_DIR, "medgraph_s.csv")

N_LEGIT = 8     # legitimate clinical features (drive the true risk)
N_PROXY = 4     # features correlated with the sensitive attribute (bias proxies)
N_FEATURES = N_LEGIT + N_PROXY
FEATURE_NAMES = [f"clin_{i}" for i in range(N_LEGIT)] + [f"proxy_{i}" for i in range(N_PROXY)]


def generate(n: int = 1000, seed: int = 42) -> Dict[str, np.ndarray]:
    """Generate the dataset. Returns dict with X (n,d), y (n,), s (n,), hospital (n,)."""
    rng = np.random.default_rng(seed)

    # Sensitive attribute: ~40% in the protected group.
    s = (rng.random(n) < 0.40).astype(np.int64)

    # Legitimate clinical features - independent of s.
    X_legit = rng.normal(0.0, 1.0, size=(n, N_LEGIT))
    # Proxy features - correlated with s (so s is recoverable from features → bias risk).
    X_proxy = rng.normal(0.0, 1.0, size=(n, N_PROXY)) + 1.6 * s[:, None]
    X = np.concatenate([X_legit, X_proxy], axis=1)

    # True risk: legitimate signal + a strong DIRECT unfair effect of s (so an
    # unconstrained model leans on the sensitive attribute → high disparity).
    w_legit = rng.normal(0.0, 0.8, size=N_LEGIT)
    logits = X_legit @ w_legit + 1.6 * s + rng.normal(0.0, 0.5, size=n)
    p = 1.0 / (1.0 + np.exp(-logits))
    y = (p > 0.5).astype(np.int64)

    # Assign to 3 hospitals with DIFFERENT sensitive-group skews (non-IID, like
    # the real federated setting): H1 balanced, H2 mostly s=0, H3 mostly s=1.
    hospital = np.empty(n, dtype=object)
    skew = {0: [0.34, 0.45, 0.21], 1: [0.34, 0.18, 0.48]}  # P(hospital | s)
    hosp_ids = np.array(["H1", "H2", "H3"])
    for i in range(n):
        hospital[i] = rng.choice(hosp_ids, p=skew[int(s[i])])

    return {"X": X.astype(np.float32), "y": y, "s": s, "hospital": hospital}


def standardize(X: np.ndarray) -> np.ndarray:
    mu = X.mean(axis=0, keepdims=True)
    sd = X.std(axis=0, keepdims=True) + 1e-8
    return (X - mu) / sd


def save_csv(path: str = CSV_PATH, n: int = 1000, seed: int = 42) -> str:
    d = generate(n, seed)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "hospital", *FEATURE_NAMES, "sensitive", "label"])
        for i in range(n):
            w.writerow([
                f"P{i:04d}", d["hospital"][i],
                *[f"{v:.4f}" for v in d["X"][i]],
                int(d["s"][i]), int(d["y"][i]),
            ])
    return path


def load_csv(path: str = CSV_PATH) -> Dict[str, np.ndarray]:
    """Load the dataset from CSV, generating it first if missing."""
    if not os.path.exists(path):
        save_csv(path)
    ids, hosp, X, s, y = [], [], [], [], []
    with open(path) as f:
        for row in csv.DictReader(f):
            ids.append(row["id"])
            hosp.append(row["hospital"])
            X.append([float(row[name]) for name in FEATURE_NAMES])
            s.append(int(row["sensitive"]))
            y.append(int(row["label"]))
    return {
        "id": np.array(ids), "hospital": np.array(hosp, dtype=object),
        "X": np.array(X, dtype=np.float32), "s": np.array(s), "y": np.array(y),
    }


if __name__ == "__main__":
    p = save_csv()
    d = load_csv(p)
    print(f"Wrote {len(d['y'])} records → {p}")
    print(f"  positive rate: {d['y'].mean():.3f}  |  sensitive rate: {d['s'].mean():.3f}")
    for h in ["H1", "H2", "H3"]:
        m = d["hospital"] == h
        print(f"  {h}: n={m.sum():4d}  P(s=1)={d['s'][m].mean():.2f}  P(y=1)={d['y'][m].mean():.2f}")
    # Demonstrate the baked-in bias: positive rate differs across groups.
    for g in [0, 1]:
        print(f"  group s={g}: P(y=1)={d['y'][d['s'] == g].mean():.3f}")
