# FedFairGNN — Federated Fair Graph Neural Network

A full-stack research prototype for **privacy-preserving medical decision support** using federated learning and graph neural networks.

## Quick Start

### Backend
```bash
cd backend
pip3 install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```
The backend auto-seeds 3 hospital databases with ~60 synthetic patients each on first launch.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Tailwind CSS v4, Recharts, React Flow, D3.js |
| Backend | FastAPI (Python), SQLAlchemy, SQLite |
| GNN Engine | Simulated PyG models with realistic convergence curves |
| Federation | Background threading, FedAvg aggregation, WebSocket streaming |

## Modules

- **Hospital EHR Dashboard** — Patient CRUD, symptom selector, vitals, fairness flags
- **Knowledge Graph** — D3.js force-directed graph with disease-symptom-treatment relationships
- **Federation Dashboard** — React Flow hospital network, live metrics feed, training controls
- **Clinical Decision Support** — GNN-based differential diagnosis, treatment recommendations, fairness audit
- **Research Metrics** — Model comparison table, per-demographic heatmap, training convergence charts

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/hospitals` | List all hospitals |
| `GET /api/patients/{hospital_id}` | List patients |
| `GET /api/graph/knowledge` | Full knowledge graph |
| `POST /api/federate/start` | Start federated training |
| `GET /api/metrics/compare` | Model comparison |
| `GET /api/predict/{hospital_id}/{patient_id}` | Clinical decision support |
| `WS /ws/federation` | Real-time training events |
