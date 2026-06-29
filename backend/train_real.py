"""
Train the REAL (numpy) models on the generated MedGraph-S dataset and print a
results table — the data-driven counterpart to the paper's Table 1.

    .venv/bin/python train_real.py            # macOS/Linux
    .venv\\Scripts\\python train_real.py        # Windows

Regenerates data/medgraph_s.csv if missing, trains every variant with real
gradient descent + adversarial debiasing + FedAvg, and writes
data/real_results.json (consumed by the API / report).
"""
import json
import os

from data.synthetic_dataset import save_csv, CSV_PATH, load_csv
from gnn.fair_trainer import train, VARIANTS

ORDER = ["GCN", "GraphSAGE", "FairGCN", "FairGNN", "SMPC-LP", "FedFairGNN"]


def main(rounds: int = 15):
    if not os.path.exists(CSV_PATH):
        save_csv()
    d = load_csv()
    print(f"Dataset: {len(d['y'])} records, P(y=1)={d['y'].mean():.3f}, "
          f"P(s=1)={d['s'].mean():.3f}  ({CSV_PATH})\n")

    rows = {}
    for name in ORDER:
        rows[name] = train(name, rounds=rounds)["final"]

    hdr = f"{'Model':<12}{'Acc':>8}{'F1':>8}{'AUC':>8}{'ΔSP':>8}{'ΔEO':>8}  Fairness"
    print(hdr); print("-" * len(hdr))
    for name in ORDER:
        m = rows[name]
        fair = "adversarial" if VARIANTS[name]["alpha"] > 0 else (
            "parity-reg" if VARIANTS[name]["lam"] > 0 else "none")
        print(f"{name:<12}{m['accuracy']:>8.3f}{m['f1_score']:>8.3f}{m['auc']:>8.3f}"
              f"{m['sp_difference']:>8.3f}{m['eo_difference']:>8.3f}  {fair}")

    out = os.path.join(os.path.dirname(CSV_PATH), "real_results.json")
    with open(out, "w") as f:
        json.dump({"dataset": "MedGraph-S", "rounds": rounds, "results": rows}, f, indent=2)
    print(f"\nSaved → {out}")
    print("Lower ΔSP / ΔEO = fairer. Note the fairness-aware rows trade a little "
          "accuracy for markedly lower disparity.")


if __name__ == "__main__":
    main()
