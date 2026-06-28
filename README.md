# FedFairGNN — Federated Fair Graph Neural Network

A full-stack research prototype for **privacy-preserving, fairness-aware medical
decision support** using federated learning and graph neural networks — the
implementation behind the project *"Privacy-First GNN for Cross-Network Link
Prediction in Healthcare."*

Hospitals collaboratively train a fairness-aware GNN over a shared medical
knowledge graph **without sharing patient data, embeddings, labels, or sensitive
attributes** — only model weights are aggregated (SMPC-style secure aggregation).
The app compares **FairGCN, FairGNN, SMPC-LP, and the proposed Federated FairGNN**
and surfaces the fairness–utility tradeoff (ΔSP / ΔEO).

## Quick Start

### Backend (FastAPI)
```bash
cd backend
python3.11 -m venv .venv          # 3.9–3.12; NOTE: system python 3.14 is currently broken (pyexpat)
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Auto-seeds 3 hospital SQLite DBs (~60 synthetic patients each) into `backend/db_files/` on first launch.
API at `http://localhost:8000`, Swagger docs at `http://localhost:8000/docs`.

**Optional — real GNN training engine** (PyTorch). The default engine is a
dependency-free simulation; install these only to run `engine="real"`:
```bash
pip install -r requirements-ml.txt   # torch + torch-geometric
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxies /api and /ws to :8000)
```

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS v4, in-repo `components/ui` design system, Recharts, React Flow, D3.js |
| Backend | FastAPI, SQLAlchemy, per-hospital SQLite |
| GNN Engine | **Hybrid** — dependency-free simulation (default) or real PyTorch Geometric (optional) |
| Federation | Background threading, weighted FedAvg + secure aggregation, WebSocket streaming |

### Hybrid GNN engine
- **Simulation (default):** `backend/gnn/models.py` — dataset-aware convergence curves that approach the paper's Table 1 numbers. No torch required.
- **Real (optional):** `backend/gnn/real_engine.py` — builds a `HeteroData` graph per hospital, runs genuine adversarial debiasing (gradient reversal) + secure aggregation using the models in the repo-root [`models/`](models/) package, and computes real ΔSP / ΔEO.
- Selected per run via the **engine** dropdown (or `engine` in the request body). If torch is absent or a round errors, it **transparently falls back to simulation** — the demo never breaks.

### Datasets
Three benchmarks from the paper, selectable in the UI: **MedGraph-S** (default; the live demo graph), **Hetionet**, **DiseaseNet**. The paper's Table 1 is the single source of truth in `backend/data/datasets.py`; both engines converge to it, and the comparison table shows live results once a model is trained this session (otherwise the published benchmark).

## Modules

- **Hospital EHR Dashboard** — patient CRUD, symptom selector, vitals, fairness flags
- **Knowledge Graph** — D3 force-directed disease–symptom–treatment graph
- **Federation Dashboard** — React Flow hospital network, live metrics feed, dataset/engine/model controls
- **Clinical Decision Support** — differential diagnosis, treatment recommendations, fairness audit
- **Research Metrics** — model comparison (live vs. paper benchmark) per dataset, demographic heatmap, convergence charts

## Key API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/hospitals` `/symptoms` `/diseases` `/treatments` | reference data |
| `GET /api/patients/{hospital_id}` , `/{hospital_id}/{patient_id}` | patient list / detail |
| `POST /api/patients/{hospital_id}` | create patient (runs inference) |
| `GET /api/graph/knowledge` `/patient/{id}` `/disease/{id}` `/stats` | knowledge graph JSON |
| `POST /api/federate/start` | start training (body: `model, rounds, hospitals, dataset, engine`) |
| `POST /api/federate/stop` `/reset` ; `GET /api/federate/status` `/history` | federation control |
| `GET /api/metrics/compare?dataset=` | per-model comparison (live or benchmark) |
| `GET /api/metrics/benchmark?dataset=` | full paper Table 1 |
| `GET /api/metrics/datasets` | available datasets |
| `GET /api/metrics/demographics/{hospital_id}` ; `/export/csv` | fairness breakdown; CSV export |
| `GET /api/predict/{hospital_id}/{patient_id}` | clinical decision support |
| `WS /ws/federation` | real-time training events |

## Repository layout
```
backend/      FastAPI app, hybrid GNN engine, datasets, per-hospital SQLite   (see backend/CLAUDE.md)
frontend/     React SPA, components/ui design system, brand theme             (see frontend/CLAUDE.md)
models/       Real PyTorch Geometric models (FairGCN/FairGNN/SMPC-LP/FedFairGNN, gradient reversal, secure_avg)
report/       Project report + IJITCS research paper (PDF)
```
Per-area architecture notes live in **`backend/CLAUDE.md`** and **`frontend/CLAUDE.md`**.

## Privacy & fairness notes
- Patient data + sensitive attributes stay in each hospital's local DB; only model weights are aggregated.
- Fairness metrics: **ΔSP** (statistical parity) and **ΔEO** (equal opportunity) — lower is fairer.
- Sensitive attribute is binarized from `age_group` in the real engine.

## Status
Research prototype. The bundled display font (Bagoss Standard) is a **trial** file — replace with a licensed copy before any public deployment.
