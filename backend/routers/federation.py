"""Federation control router."""
from fastapi import APIRouter, HTTPException
import asyncio

from models.schemas import FederationStartRequest, FederationStatusOut, RoundMetricOut
from gnn.federated_engine import federation_state, start_federation, stop_federation
from database import get_session
from models.db_models import Patient

router = APIRouter(prefix="/api/federate", tags=["federation"])


@router.post("/start")
async def start_fed(request: FederationStartRequest):
    """Start federated training."""
    # Get patient counts per hospital
    patient_counts = {}
    for hid in request.hospitals:
        session = get_session(hid)
        try:
            count = session.query(Patient).filter(Patient.hospital_id == hid).count()
            patient_counts[hid] = max(count, 1)
        finally:
            session.close()
    
    loop = asyncio.get_event_loop()
    
    train_all = request.model == "all"
    success, msg = start_federation(
        model=request.model,
        rounds=request.rounds,
        hospitals=request.hospitals,
        patient_counts=patient_counts,
        loop=loop,
        train_all=train_all
    )
    
    if not success:
        raise HTTPException(status_code=409, detail=msg)
    
    return {"status": "started", "message": msg, "model": request.model, "rounds": request.rounds}


@router.post("/stop")
async def stop_fed():
    """Stop federated training."""
    success, msg = stop_federation()
    return {"status": "stopped", "message": msg}


@router.post("/reset")
async def reset_fed():
    """Reset federation state."""
    stop_federation()
    federation_state.reset()
    return {"status": "reset"}


@router.get("/status")
def get_status():
    """Current federation status."""
    return FederationStatusOut(
        is_running=federation_state.is_running,
        current_round=federation_state.current_round,
        total_rounds=federation_state.total_rounds,
        active_model=federation_state.active_model_name,
        hospitals=federation_state.hospitals,
        global_accuracy=federation_state.global_metrics.get("accuracy"),
        global_f1=federation_state.global_metrics.get("f1_score"),
        sp_difference=federation_state.global_metrics.get("sp_difference"),
        eo_difference=federation_state.global_metrics.get("eo_difference")
    )


@router.get("/history")
def get_history(model_name: str = None, hospital_id: str = None):
    """Get all round metrics history."""
    history = federation_state.history
    
    if model_name:
        history = [h for h in history if h.get("model_name") == model_name]
    if hospital_id:
        history = [h for h in history if h.get("hospital_id") == hospital_id]
    
    return history
