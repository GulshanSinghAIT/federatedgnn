"""
End-to-end smoke/eval harness for FedFairGNN.

Run from backend/ with the project venv:
    .venv/bin/python eval_smoke.py            (macOS/Linux)
    .venv\\Scripts\\python eval_smoke.py       (Windows)

Uses FastAPI TestClient so app startup seeds the SQLite DBs in-process — no
separate server needed. Exits non-zero if any check fails. Does NOT mutate the
product code; it only asserts observable behavior.

Checks:
  - Patient CRUD with string + null onset dates (the SQLite Date bug)
  - Each model trains and its global metrics actually change + converge toward
    the paper's Table-1 target (no flat lines)
  - /metrics/compare flips to source="live" after training
"""
import sys
import time
import traceback

from fastapi.testclient import TestClient

import main
from data.datasets import target_metrics

MODELS = ["FairGCN", "FairGNN", "SMPC-LP", "FedFairGNN"]
DATASET = "MedGraph-S"
ROUNDS = 15
results = []  # (check, ok, detail)


def record(check, ok, detail=""):
    results.append((check, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {check}" + (f" — {detail}" if detail else ""))


def wait_idle(client, timeout=180.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        st = client.get("/api/federate/status").json()
        if not st["is_running"]:
            return st
        time.sleep(0.4)
    return None


def main_run():
    with TestClient(main.app) as client:
        # ---------------- CRUD ----------------
        try:
            payload = {
                "age_group": "Senior (60+)", "sex": "Male",
                "ethnicity": "Asian", "ses": "Middle",
                "chief_complaint": "eval smoke test",
                "symptoms": [
                    {"symptom_id": "S001", "severity": 7, "onset_date": "2026-06-28"},
                    {"symptom_id": "S005", "severity": 4, "onset_date": "2026-06-01"},
                    {"symptom_id": "S010", "severity": 3, "onset_date": None},
                ],
            }
            r = client.post("/api/patients/H1", json=payload)
            ok = r.status_code == 200
            pid = r.json().get("id") if ok else None
            record("CRUD insert (string + null dates)", ok,
                   "" if ok else f"HTTP {r.status_code}: {r.text[:200]}")

            if pid:
                g = client.get(f"/api/patients/H1/{pid}")
                got = g.json() if g.status_code == 200 else {}
                ok2 = g.status_code == 200 and len(got.get("symptoms", [])) == 3
                record("CRUD read-back (symptoms persisted)", ok2,
                       "" if ok2 else f"HTTP {g.status_code}, symptoms={len(got.get('symptoms', []))}")

                upd = {"symptoms": [{"symptom_id": "S002", "severity": 9, "onset_date": "2026-05-15"}],
                       "chief_complaint": "updated"}
                u = client.put(f"/api/patients/H1/{pid}", json=upd)
                ok3 = u.status_code == 200 and len(u.json().get("symptoms", [])) == 1
                record("CRUD update (string date)", ok3,
                       "" if ok3 else f"HTTP {u.status_code}: {u.text[:200]}")
            else:
                record("CRUD read-back (symptoms persisted)", False, "no patient id")
                record("CRUD update (string date)", False, "no patient id")
        except Exception as e:
            record("CRUD insert (string + null dates)", False, f"exception: {e}")
            traceback.print_exc()

        # ---------------- Training per model ----------------
        for model in MODELS:
            try:
                client.post("/api/federate/reset")
                s = client.post("/api/federate/start", json={
                    "model": model, "rounds": ROUNDS,
                    "hospitals": ["H1", "H2", "H3"],
                    "dataset": DATASET, "engine": "sim",
                })
                if s.status_code != 200:
                    record(f"{model}: training runs", False, f"start HTTP {s.status_code}: {s.text[:160]}")
                    continue
                if wait_idle(client) is None:
                    record(f"{model}: training runs", False, "did not finish (timeout)")
                    continue

                hist = client.get("/api/federate/history",
                                  params={"model_name": model, "hospital_id": "global"}).json()
                accs = [h["accuracy"] for h in hist]
                sps = [h["sp_difference"] for h in hist]
                eos = [h["eo_difference"] for h in hist]

                if len(accs) < ROUNDS:
                    record(f"{model}: per-round metrics recorded", False, f"only {len(accs)} global rows")
                    continue

                changed = len(set(accs)) > 1 and len(set(sps)) > 1
                rises = accs[-1] - accs[0] > 0.02
                fairer = sps[-1] < sps[0] and eos[-1] < eos[0]
                record(f"{model}: metrics change across rounds", changed and rises and fairer,
                       f"acc {accs[0]:.3f}->{accs[-1]:.3f}, ΔSP {sps[0]:.3f}->{sps[-1]:.3f}, ΔEO {eos[0]:.3f}->{eos[-1]:.3f}")

                t = target_metrics(DATASET, model)
                converged = (abs(accs[-1] - t["accuracy"]) <= 0.05
                             and abs(sps[-1] - t["sp_difference"]) <= 0.03)
                record(f"{model}: converges to paper target", converged,
                       f"acc {accs[-1]:.3f} vs {t['accuracy']}, ΔSP {sps[-1]:.3f} vs {t['sp_difference']}")
            except Exception as e:
                record(f"{model}: training runs", False, f"exception: {e}")
                traceback.print_exc()

        # ---------------- REAL engine (numpy, trained on dataset) ----------------
        try:
            real_sp = {}
            for model in ["SMPC-LP", "FedFairGNN"]:
                client.post("/api/federate/reset")
                client.post("/api/federate/start", json={
                    "model": model, "rounds": 12, "hospitals": ["H1", "H2", "H3"],
                    "dataset": DATASET, "engine": "real",
                })
                st = wait_idle(client)
                eng = st.get("effective_engine") if st else None
                hist = client.get("/api/federate/history",
                                  params={"model_name": model, "hospital_id": "global"}).json()
                accs = [h["accuracy"] for h in hist]
                sps = [h["sp_difference"] for h in hist]
                ok = (eng == "real" and len(accs) >= 12 and len(set(accs)) > 1 and accs[-1] > 0.7)
                real_sp[model] = sps[-1] if sps else 1.0
                record(f"REAL engine: {model} trains on data", ok,
                       f"engine={eng}, acc {accs[0]:.3f}->{accs[-1]:.3f}, ΔSP last {sps[-1]:.3f}")
            # Fairness ordering: debiased FedFairGNN should be fairer than the unfair SMPC-LP baseline.
            record("REAL engine: FedFairGNN fairer than baseline",
                   real_sp.get("FedFairGNN", 1) < real_sp.get("SMPC-LP", 0),
                   f"ΔSP FedFairGNN {real_sp.get('FedFairGNN'):.3f} < SMPC-LP {real_sp.get('SMPC-LP'):.3f}")
        except Exception as e:
            record("REAL engine: trains on data", False, f"exception: {e}")
            traceback.print_exc()

        # ---------------- compare shows live ----------------
        try:
            comp = client.get("/api/metrics/compare", params={"dataset": DATASET}).json()
            live = [m for m in comp if m.get("source") == "live"]
            record("/metrics/compare shows live after training", len(live) >= 1,
                   f"{len(live)}/{len(comp)} rows live")
        except Exception as e:
            record("/metrics/compare shows live after training", False, f"exception: {e}")

    # ---------------- summary ----------------
    print("\n================ SUMMARY ================")
    width = max(len(c) for c, _, _ in results)
    for check, ok, _ in results:
        print(f"  {check.ljust(width)}  {'PASS' if ok else 'FAIL'}")
    n_pass = sum(1 for _, ok, _ in results if ok)
    print(f"  {'-' * (width + 8)}")
    print(f"  {n_pass}/{len(results)} passed")
    return all(ok for _, ok, _ in results)


if __name__ == "__main__":
    ok = main_run()
    sys.exit(0 if ok else 1)
