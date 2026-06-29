# Backend - FedFairGNN API

FastAPI service for the **Privacy-First / Federated FairGNN** final-year project.
Serves a multi-hospital medical knowledge graph, runs federated fairness-aware
GNN training (simulated by default, real PyTorch optional), and exposes metrics
+ clinical decision support to the React frontend.

Run: `uvicorn main:app --reload` from `backend/` (host serves frontend separately via Vite).

## Golden rules (read before editing)
- **Two `models` packages exist - do not confuse them.**
  - `backend/models/` = Pydantic schemas (`schemas.py`) + SQLAlchemy ORM (`db_models.py`). Imported as `models.*` because `backend/` is on `sys.path` (added in `main.py`).
  - repo-root `models/` = the **real** PyTorch Geometric model classes (FairGCN, FairGNN, SMPC-LP, FederatedFairGNN, gradient reversal, secure_avg). Loaded only by `gnn/real_engine.py`, under the alias **`fedgnn_models`** via importlib (to avoid the name clash). Never `import models` expecting the torch ones from inside the backend.
- **The default engine is a simulation. There is no torch dependency in the default path.** Don't "fix" `gnn/models.py` to use torch - that's intentional (see report Ch.7).
- Per-hospital data lives in **separate SQLite files** (`db_files/H1.db`, `H2.db`, `H3.db`, `global.db`). Shared KG (diseases/symptoms/treatments/edges) is in `global.db`; patients + sensitive attributes stay in each hospital's DB. This mirrors the paper's privacy constraint - never centralize patient data.

## Layout
```
main.py                 app + lifespan DB seeding; /api/hospitals,/symptoms,/diseases,/treatments
database.py             per-hospital SQLite engines/sessions (get_session(hospital_id))
data/
  datasets.py           ★ source of truth: 3 benchmark datasets + paper Table 1 targets (sim engine)
  synthetic_dataset.py  ★ generates the 1000-record MedGraph-S tabular dataset (real engine trains on this)
  medgraph_s.csv        the generated dataset (regenerate via `python -m data.synthetic_dataset`)
  real_results.json     output of `train_real.py` (data-driven results table)
  synthetic_patients.py per-hospital skewed demographic generator (for the EHR/demo DBs)
  seed_*.json           15 diseases, 85 symptoms, 33 treatments, graph edges
models/
  schemas.py            Pydantic request/response models
  db_models.py          SQLAlchemy tables
gnn/
  models.py             ★ SIMULATION engine (default). Dataset-aware convergence to Table 1.
  fair_trainer.py       ★ REAL numpy engine. MLP + adversarial debiasing + FedAvg on MedGraph-S. No torch.
  real_engine.py        optional torch/PyG engine (NOT wired to engine="real" - superseded by fair_trainer)
  federated_engine.py   ★ orchestration: background thread, sim|real switch w/ fallback, WS broadcast
  fairness_metrics.py   ΔSP / ΔEO / per-group accuracy (used by demographics endpoint)
  graph_builder.py      NetworkX KG builder for /api/graph endpoints
routers/
  patients.py  graph.py  federation.py  metrics.py  websocket.py
train_real.py           ★ CLI: train all variants on MedGraph-S, print + save real results
eval_smoke.py           end-to-end eval harness (CRUD + sim + real engine); run to verify GREEN
```

## Hybrid engine (the key design)
`FederationStartRequest.engine` is `"sim"` (default) or `"real"`.
- **`engine="sim"`** - `gnn/models.py`: dependency-free convergence curves that approach `data/datasets.target_metrics(dataset, model)` (the paper's Table 1). Good for the live demo / hitting published numbers.
- **`engine="real"`** - `gnn/fair_trainer.py`: a **real numpy model trained on the generated MedGraph-S dataset** (`data/synthetic_dataset.py`, 1000 records). MLP encoder + logistic classifier + adversary head trained via **gradient reversal** (adversarial debiasing) + **statistical-parity penalty** + **federated FedAvg** with secure-agg noise. Real gradient descent → real, data-driven accuracy/F1/AUC/ΔSP/ΔEO. Numpy-only, so it always runs (no torch). `federated_engine` trains it up front then replays per-round history through the WS path.
- `fair_trainer.is_available()` is always True; on any training error the round falls back to sim and emits `engine_fallback`. `federation_state.engine` = requested; `effective_engine` = what ran.
- `gnn/real_engine.py` (torch/PyG HeteroData) still exists as an optional heavier path but is **not** wired to `engine="real"` anymore - the numpy trainer replaced it so the real engine needs no torch.
- Standalone: **`python train_real.py`** trains every variant on the dataset and writes `data/real_results.json` + prints a results table (the data-driven Table 1 for the report). The real numbers differ from the paper's sim targets - that's expected; they're learned.

## Datasets (`data/datasets.py`)
Three benchmarks from the paper: **MedGraph-S** (default, == the live demo graph), **Hetionet**, **DiseaseNet**. `BENCHMARK[dataset][model]` holds `accuracy, f1_score, auc, sp_difference, eo_difference` for all 6 methods (GCN, GraphSAGE baselines + the 4 trainable: FairGCN, FairGNN, SMPC-LP, FedFairGNN). Lower ΔSP/ΔEO = fairer. `MODELS` = the 4 trainable; `BASELINES` = the 2 reference-only.

## Key endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/api/hospitals` `/symptoms` `/diseases` `/treatments` | reference lists |
| GET | `/api/patients/{hid}` , `/{hid}/{pid}` | filterable patient list / detail |
| POST/PUT | `/api/patients/{hid}[/{pid}]` | create/update; runs `model.predict` to store diagnoses |
| GET | `/api/graph/knowledge` `/patient/{pid}` `/disease/{did}` `/stats` | KG JSON `{nodes,edges}` |
| POST | `/api/federate/start` | body adds `dataset` + `engine`; `model:"all"` trains all 4 |
| POST | `/api/federate/stop` `/reset` ; GET `/status` `/history` | status now includes `dataset/engine/effective_engine` |
| GET | `/api/metrics/compare?dataset=` | live-or-benchmark row per model (`source: live\|benchmark`) |
| GET | `/api/metrics/benchmark?dataset=` | full Table 1 (all datasets+baselines) |
| GET | `/api/metrics/datasets` | dataset selector data |
| GET | `/api/metrics/demographics/{hid}` ; `/export/csv` | per-group breakdown; CSV |
| GET | `/api/predict/{hid}/{pid}` | clinical decision support (diagnoses+treatments+fairness) |
| WS  | `/ws/federation` | events below |

## WebSocket events (broadcast from the training thread)
`model_training_start{model,total_rounds,dataset,engine}`, `hospital_round_complete{hospital_id,round,accuracy,f1_score,auc,loss,sp_difference,eo_difference,nodes_trained}`, `global_aggregation_complete{round,global_accuracy,global_f1,sp_difference,eo_difference}`, `engine_fallback{round,reason}`, `model_training_complete{model}`, `federation_complete`.

## Metric field names (keep stable - frontend depends on them)
`accuracy, f1_score, auc, loss, sp_difference, eo_difference, nodes_trained`. History rows also carry `model_name, round_num, hospital_id, dataset, timestamp`.

## Sensitive attribute
Demographics on `Patient`: `age_group, sex, ethnicity, ses`. The real engine binarizes **age_group** into a 2-class sensitive attribute (`real_engine._SENSITIVE_BUCKET`); demographics endpoint groups by `age_group|ethnicity`. The paper frames the sensitive attribute as binary.

## Gotchas
- DBs are **seeded on startup** (`main.py` lifespan). Delete `db_files/*.db` to reseed.
- `model.predict()` (symptom-overlap link prediction) is the per-patient inference path used by patients/decision routers - distinct from `simulate_round` (training-curve metrics). Both live on the sim model classes.
- `gnn/real_engine.py` imports torch lazily **inside functions**, never at module top - so importing the module is always safe.
