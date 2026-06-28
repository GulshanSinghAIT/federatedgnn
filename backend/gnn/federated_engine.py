"""Federated training engine: orchestrates multi-hospital training.

Default engine is the dependency-free simulation (gnn/models.py). When
``engine="real"`` is requested AND torch/torch_geometric are installed, each
round runs genuine GNN training + secure aggregation via gnn/real_engine.py.
If the real engine is unavailable or errors mid-run, the round transparently
falls back to simulation so the live demo never breaks.
"""
import threading
import time
import asyncio
import json
from datetime import datetime
from typing import Dict, List, Optional, Set
from copy import deepcopy

from gnn.models import get_model, add_smpc_noise, federated_average, BaseGNNModel
from gnn import real_engine
from data.datasets import DEFAULT_DATASET, is_valid_dataset, MODELS

# Per-hospital accuracy offsets so the three clients differ realistically (sim).
_HOSPITAL_NOISE = {"H1": 0.01, "H2": -0.005, "H3": 0.008}


class FederationState:
    """Singleton state for the federation engine."""

    def __init__(self):
        self.is_running = False
        self.current_round = 0
        self.total_rounds = 0
        self.active_model_name = "FedFairGNN"
        self.dataset = DEFAULT_DATASET
        self.engine = "sim"            # requested: "sim" | "real"
        self.effective_engine = "sim"  # what actually ran (after availability check)
        self.hospitals = ["H1", "H2", "H3"]
        self.hospital_patient_counts = {"H1": 0, "H2": 0, "H3": 0}
        self.models: Dict[str, BaseGNNModel] = {}
        self.history: List[Dict] = []
        self.global_metrics: Dict = {}
        self._ws_connections: Set = set()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def reset(self):
        self.is_running = False
        self.current_round = 0
        self.total_rounds = 0
        self.history = []
        self.global_metrics = {}
        self.models = {}


federation_state = FederationState()


async def broadcast_ws(message: dict):
    """Broadcast message to all connected WebSocket clients."""
    if not federation_state._ws_connections:
        return
    msg = json.dumps(message)
    disconnected = set()
    for ws in federation_state._ws_connections:
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.add(ws)
    federation_state._ws_connections -= disconnected


def _broadcast_sync(message: dict):
    """Broadcast WebSocket messages from the background training thread."""
    loop = federation_state._loop
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_ws(message), loop)


def _record_and_broadcast(model_name, round_num, hospital_id, metrics):
    """Append a round metric to history and push it to the frontend."""
    row = {
        "model_name": model_name,
        "round_num": round_num,
        "hospital_id": hospital_id,
        "dataset": federation_state.dataset,
        **metrics,
        "timestamp": datetime.utcnow().isoformat(),
    }
    federation_state.history.append(row)
    if hospital_id == "global":
        federation_state.global_metrics = row
        _broadcast_sync({
            "event": "global_aggregation_complete",
            "model": model_name, "round": round_num,
            "global_accuracy": metrics["accuracy"], "global_f1": metrics["f1_score"],
            "sp_difference": metrics["sp_difference"], "eo_difference": metrics["eo_difference"],
        })
    else:
        _broadcast_sync({
            "event": "hospital_round_complete",
            "hospital_id": hospital_id, "model": model_name,
            "round": round_num, **metrics,
        })


def _train_model(model_name: str, hospitals: List[str], total_rounds: int,
                 patient_counts: Dict[str, int]):
    """Train one model for total_rounds federated rounds (sim or real)."""
    dataset = federation_state.dataset
    use_real = (federation_state.engine == "real" and real_engine.is_available())
    federation_state.effective_engine = "real" if use_real else "sim"

    federation_state.active_model_name = model_name
    sim_model = get_model(model_name)
    federation_state.models[model_name] = sim_model
    real_global = None

    _broadcast_sync({
        "event": "model_training_start", "model": model_name,
        "total_rounds": total_rounds, "dataset": dataset,
        "engine": federation_state.effective_engine,
    })

    for round_num in range(1, total_rounds + 1):
        if federation_state._stop_event.is_set():
            break
        federation_state.current_round = round_num

        ran_real = False
        if use_real:
            try:
                per_hospital, glob, real_global = real_engine.run_round(
                    model_name, round_num, hospitals, patient_counts,
                    dataset=dataset, global_model=real_global)
                for hid in hospitals:
                    if hid in per_hospital:
                        _record_and_broadcast(model_name, round_num, hid, per_hospital[hid])
                        time.sleep(0.15)
                _record_and_broadcast(model_name, round_num, "global", glob)
                ran_real = True
            except Exception as exc:  # fall back to sim for the rest of the run
                use_real = False
                federation_state.effective_engine = "sim"
                _broadcast_sync({
                    "event": "engine_fallback", "model": model_name,
                    "round": round_num, "reason": str(exc)[:200],
                })

        if not ran_real:
            local_updates = []
            for hid in hospitals:
                n = patient_counts.get(hid, 50)
                local = deepcopy(sim_model)
                metrics = local.simulate_round(round_num, n, dataset)
                off = _HOSPITAL_NOISE.get(hid, 0)
                metrics["accuracy"] = round(metrics["accuracy"] + off, 4)
                metrics["f1_score"] = round(metrics["f1_score"] + off * 0.8, 4)
                local_updates.append(add_smpc_noise(local.state_dict()))
                _record_and_broadcast(model_name, round_num, hid, metrics)
                time.sleep(0.3)
            sim_model.load_state_dict(federated_average(local_updates))
            sim_model.round_num = round_num
            glob = sim_model.simulate_round(round_num, sum(patient_counts.values()), dataset)
            _record_and_broadcast(model_name, round_num, "global", glob)
            time.sleep(0.2)

    _broadcast_sync({"event": "model_training_complete", "model": model_name})


def run_training_all_models(hospitals, total_rounds, patient_counts):
    """Train all four models sequentially for comparison."""
    for model_name in MODELS:
        if federation_state._stop_event.is_set():
            break
        _train_model(model_name, hospitals, total_rounds, patient_counts)
    federation_state.is_running = False
    _broadcast_sync({"event": "federation_complete"})


def run_single_model(model_name, hospitals, total_rounds, patient_counts):
    """Train a single specified model."""
    _train_model(model_name, hospitals, total_rounds, patient_counts)
    federation_state.is_running = False
    _broadcast_sync({"event": "federation_complete"})


def start_federation(model: str, rounds: int, hospitals: List[str],
                     patient_counts: Dict[str, int], loop: asyncio.AbstractEventLoop,
                     train_all: bool = False, dataset: str = DEFAULT_DATASET,
                     engine: str = "sim"):
    """Start federated training in a background thread."""
    if federation_state.is_running:
        return False, "Federation already running"

    federation_state.is_running = True
    federation_state.total_rounds = rounds
    federation_state.hospitals = hospitals
    federation_state.hospital_patient_counts = patient_counts
    federation_state.dataset = dataset if is_valid_dataset(dataset) else DEFAULT_DATASET
    federation_state.engine = "real" if engine == "real" else "sim"
    federation_state._stop_event.clear()
    federation_state._loop = loop

    if train_all:
        target, args = run_training_all_models, (hospitals, rounds, patient_counts)
    else:
        target, args = run_single_model, (model, hospitals, rounds, patient_counts)

    federation_state._thread = threading.Thread(target=target, args=args, daemon=True)
    federation_state._thread.start()
    return True, "Federation started"


def stop_federation():
    """Stop the running federation."""
    federation_state._stop_event.set()
    federation_state.is_running = False
    return True, "Federation stopped"
