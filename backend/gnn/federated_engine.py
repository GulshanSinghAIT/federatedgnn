"""Federated training engine: orchestrates multi-hospital training simulation."""
import threading
import time
import asyncio
import json
import random
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Set
from copy import deepcopy

from gnn.models import get_model, add_smpc_noise, federated_average, BaseGNNModel


class FederationState:
    """Singleton state for the federation engine."""
    
    def __init__(self):
        self.is_running = False
        self.current_round = 0
        self.total_rounds = 0
        self.active_model_name = "FedFairGNN"
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


# Global federation state
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
    """Synchronous wrapper to broadcast WebSocket messages from background thread."""
    loop = federation_state._loop
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_ws(message), loop)


def run_training_all_models(hospitals: List[str], total_rounds: int, 
                             patient_counts: Dict[str, int]):
    """Run training for all 4 models sequentially for comparison."""
    model_names = ["FairGCN", "FairGNN", "SMPC-LP", "FedFairGNN"]
    
    for model_name in model_names:
        if federation_state._stop_event.is_set():
            break
            
        federation_state.active_model_name = model_name
        model = get_model(model_name)
        federation_state.models[model_name] = model
        
        _broadcast_sync({
            "event": "model_training_start",
            "model": model_name,
            "total_rounds": total_rounds
        })
        
        for round_num in range(1, total_rounds + 1):
            if federation_state._stop_event.is_set():
                break
            
            federation_state.current_round = round_num
            local_updates = []
            
            # Each hospital trains locally
            for hospital_id in hospitals:
                num_patients = patient_counts.get(hospital_id, 50)
                
                # Simulate local training with hospital-specific noise
                local_model = deepcopy(model)
                metrics = local_model.simulate_round(round_num, num_patients)
                
                # Add per-hospital variation
                hospital_noise = {"H1": 0.01, "H2": -0.005, "H3": 0.008}.get(hospital_id, 0)
                metrics["accuracy"] = round(metrics["accuracy"] + hospital_noise, 4)
                metrics["f1_score"] = round(metrics["f1_score"] + hospital_noise * 0.8, 4)
                
                local_updates.append(add_smpc_noise(local_model.state_dict()))
                
                # Record hospital round metric
                round_metric = {
                    "model_name": model_name,
                    "round_num": round_num,
                    "hospital_id": hospital_id,
                    **metrics,
                    "timestamp": datetime.utcnow().isoformat()
                }
                federation_state.history.append(round_metric)
                
                # Broadcast hospital round complete
                _broadcast_sync({
                    "event": "hospital_round_complete",
                    "hospital_id": hospital_id,
                    "model": model_name,
                    "round": round_num,
                    **metrics
                })
                
                time.sleep(0.3)  # Simulate computation time
            
            # Global aggregation
            global_weights = federated_average(local_updates)
            model.load_state_dict(global_weights)
            model.round_num = round_num
            
            # Compute global metrics
            global_metrics = model.simulate_round(round_num, sum(patient_counts.values()))
            global_round = {
                "model_name": model_name,
                "round_num": round_num,
                "hospital_id": "global",
                **global_metrics,
                "timestamp": datetime.utcnow().isoformat()
            }
            federation_state.history.append(global_round)
            federation_state.global_metrics = global_round
            
            # Broadcast global aggregation complete
            _broadcast_sync({
                "event": "global_aggregation_complete",
                "model": model_name,
                "round": round_num,
                "global_accuracy": global_metrics["accuracy"],
                "global_f1": global_metrics["f1_score"],
                "sp_difference": global_metrics["sp_difference"],
                "eo_difference": global_metrics["eo_difference"]
            })
            
            time.sleep(0.2)
        
        # Model training complete
        _broadcast_sync({
            "event": "model_training_complete",
            "model": model_name
        })
    
    federation_state.is_running = False
    _broadcast_sync({"event": "federation_complete"})


def run_single_model(model_name: str, hospitals: List[str], total_rounds: int,
                      patient_counts: Dict[str, int]):
    """Run training for a single specified model."""
    federation_state.active_model_name = model_name
    model = get_model(model_name)
    federation_state.models[model_name] = model
    
    _broadcast_sync({
        "event": "model_training_start",
        "model": model_name,
        "total_rounds": total_rounds
    })
    
    for round_num in range(1, total_rounds + 1):
        if federation_state._stop_event.is_set():
            break
        
        federation_state.current_round = round_num
        local_updates = []
        
        for hospital_id in hospitals:
            num_patients = patient_counts.get(hospital_id, 50)
            local_model = deepcopy(model)
            metrics = local_model.simulate_round(round_num, num_patients)
            
            hospital_noise = {"H1": 0.01, "H2": -0.005, "H3": 0.008}.get(hospital_id, 0)
            metrics["accuracy"] = round(metrics["accuracy"] + hospital_noise, 4)
            metrics["f1_score"] = round(metrics["f1_score"] + hospital_noise * 0.8, 4)
            
            local_updates.append(add_smpc_noise(local_model.state_dict()))
            
            round_metric = {
                "model_name": model_name,
                "round_num": round_num,
                "hospital_id": hospital_id,
                **metrics,
                "timestamp": datetime.utcnow().isoformat()
            }
            federation_state.history.append(round_metric)
            
            _broadcast_sync({
                "event": "hospital_round_complete",
                "hospital_id": hospital_id,
                "model": model_name,
                "round": round_num,
                **metrics
            })
            
            time.sleep(0.3)
        
        global_weights = federated_average(local_updates)
        model.load_state_dict(global_weights)
        model.round_num = round_num
        
        global_metrics = model.simulate_round(round_num, sum(patient_counts.values()))
        global_round = {
            "model_name": model_name,
            "round_num": round_num,
            "hospital_id": "global",
            **global_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
        federation_state.history.append(global_round)
        federation_state.global_metrics = global_round
        
        _broadcast_sync({
            "event": "global_aggregation_complete",
            "model": model_name,
            "round": round_num,
            "global_accuracy": global_metrics["accuracy"],
            "global_f1": global_metrics["f1_score"],
            "sp_difference": global_metrics["sp_difference"],
            "eo_difference": global_metrics["eo_difference"]
        })
        
        time.sleep(0.2)
    
    _broadcast_sync({
        "event": "model_training_complete",
        "model": model_name
    })
    
    federation_state.is_running = False
    _broadcast_sync({"event": "federation_complete"})


def start_federation(model: str, rounds: int, hospitals: List[str],
                      patient_counts: Dict[str, int], loop: asyncio.AbstractEventLoop,
                      train_all: bool = False):
    """Start the federated training in a background thread."""
    if federation_state.is_running:
        return False, "Federation already running"
    
    federation_state.is_running = True
    federation_state.total_rounds = rounds
    federation_state.hospitals = hospitals
    federation_state.hospital_patient_counts = patient_counts
    federation_state._stop_event.clear()
    federation_state._loop = loop
    
    if train_all:
        target = run_training_all_models
        args = (hospitals, rounds, patient_counts)
    else:
        target = run_single_model
        args = (model, hospitals, rounds, patient_counts)
    
    federation_state._thread = threading.Thread(target=target, args=args, daemon=True)
    federation_state._thread.start()
    
    return True, "Federation started"


def stop_federation():
    """Stop the running federation."""
    federation_state._stop_event.set()
    federation_state.is_running = False
    return True, "Federation stopped"
