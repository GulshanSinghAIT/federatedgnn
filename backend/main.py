"""FastAPI application entry point with database seeding on startup."""
import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add backend dir to path
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, get_session, get_engine, Base
from models.db_models import (
    Hospital, Disease, Symptom, Treatment,
    SymptomDisease, TreatmentDisease, DiseaseComorbidity,
    Patient, PatientSymptom, PatientDisease
)
from data.synthetic_patients import generate_patients


DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

HOSPITALS = [
    {"id": "H1", "name": "City General Hospital", "location": "Downtown Metro Area"},
    {"id": "H2", "name": "Metro Regional Medical Center", "location": "Northern Suburbs"},
    {"id": "H3", "name": "Community Health Clinic", "location": "South Side District"},
]


def seed_global_db():
    """Seed the global database with diseases, symptoms, treatments, and edges."""
    init_db("global")
    session = get_session("global")

    try:
        # Check if already seeded
        if session.query(Disease).count() > 0:
            print("Global DB already seeded, skipping.")
            return

        # Seed hospitals
        for h in HOSPITALS:
            session.add(Hospital(**h))

        # Seed diseases
        with open(os.path.join(DATA_DIR, "seed_diseases.json")) as f:
            diseases = json.load(f)
        for d in diseases:
            session.add(Disease(**d))

        # Seed symptoms
        with open(os.path.join(DATA_DIR, "seed_symptoms.json")) as f:
            symptoms = json.load(f)
        for s in symptoms:
            session.add(Symptom(**s))

        # Seed treatments
        with open(os.path.join(DATA_DIR, "seed_treatments.json")) as f:
            treatments = json.load(f)
        for t in treatments:
            session.add(Treatment(**t))

        session.commit()

        # Seed graph edges
        with open(os.path.join(DATA_DIR, "seed_graph_edges.json")) as f:
            edges = json.load(f)

        for edge in edges.get("indicates", []):
            session.add(SymptomDisease(**edge))

        for edge in edges.get("treats", []):
            session.add(TreatmentDisease(**edge))

        for edge in edges.get("comorbid_with", []):
            session.add(DiseaseComorbidity(**edge))

        session.commit()
        print(f"Global DB seeded: {len(diseases)} diseases, {len(symptoms)} symptoms, {len(treatments)} treatments")
    finally:
        session.close()


def seed_hospital_patients(hospital_id: str):
    """Seed a hospital database with synthetic patients."""
    init_db(hospital_id)
    session = get_session(hospital_id)

    try:
        if session.query(Patient).count() > 0:
            print(f"Hospital {hospital_id} already seeded, skipping.")
            return

        # Load disease-symptom map from global DB
        global_session = get_session("global")
        try:
            sd_records = global_session.query(SymptomDisease).all()
            disease_symptom_map = {}
            for sd in sd_records:
                if sd.disease_id not in disease_symptom_map:
                    disease_symptom_map[sd.disease_id] = []
                disease_symptom_map[sd.disease_id].append((sd.symptom_id, sd.weight))

            symptom_ids = [s.id for s in global_session.query(Symptom).all()]
        finally:
            global_session.close()

        patients = generate_patients(hospital_id, symptom_ids, disease_symptom_map)

        for p_data in patients:
            patient = Patient(
                id=p_data["id"],
                hospital_id=hospital_id,
                age_group=p_data["age_group"],
                sex=p_data["sex"],
                ethnicity=p_data["ethnicity"],
                ses=p_data["ses"],
                chief_complaint=p_data["chief_complaint"],
                heart_rate=p_data["vitals"]["heart_rate"],
                bp_systolic=p_data["vitals"]["bp_systolic"],
                bp_diastolic=p_data["vitals"]["bp_diastolic"],
                temperature=p_data["vitals"]["temperature"],
                spo2=p_data["vitals"]["spo2"],
                respiratory_rate=p_data["vitals"]["respiratory_rate"],
                pre_existing_conditions=json.dumps(p_data.get("pre_existing_conditions", [])),
                current_medications=json.dumps(p_data.get("current_medications", [])),
                allergies=json.dumps(p_data.get("allergies", [])),
                surgical_history=p_data.get("surgical_history", ""),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(patient)
            session.flush()

            # Add symptoms
            for sym in p_data.get("symptoms", []):
                onset = sym.get("onset_date")
                if isinstance(onset, str):
                    onset = date.fromisoformat(onset)
                ps = PatientSymptom(
                    patient_id=p_data["id"],
                    symptom_id=sym["symptom_id"],
                    severity=sym["severity"],
                    onset_date=onset
                )
                session.add(ps)

            # Add disease predictions (simulated initial predictions)
            from gnn.models import FedFairGNN
            model = FedFairGNN()
            symptom_ids_patient = [s["symptom_id"] for s in p_data.get("symptoms", [])]
            predictions = model.predict(symptom_ids_patient, symptom_ids, disease_symptom_map)

            for pred in predictions[:3]:
                pd_record = PatientDisease(
                    patient_id=p_data["id"],
                    disease_id=pred["disease_id"],
                    confidence=pred["confidence"],
                    predicted_by="FedFairGNN"
                )
                session.add(pd_record)

        session.commit()
        print(f"Hospital {hospital_id} seeded with {len(patients)} patients")

        # Update hospital patient count in global DB
        global_session = get_session("global")
        try:
            hospital = global_session.query(Hospital).filter(Hospital.id == hospital_id).first()
            if hospital:
                hospital.patient_count = len(patients)
                global_session.commit()
        finally:
            global_session.close()

    finally:
        session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Starting FedFairGNN Backend...")
    seed_global_db()
    for h in HOSPITALS:
        seed_hospital_patients(h["id"])
    print("✅ All databases seeded and ready.")
    yield
    print("🛑 Shutting down FedFairGNN Backend.")


app = FastAPI(
    title="FedFairGNN — Federated Fair Graph Neural Network",
    description="Privacy-preserving medical decision support system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from routers.patients import router as patients_router
from routers.graph import router as graph_router
from routers.federation import router as federation_router
from routers.metrics import router as metrics_router, decision_router
from routers.websocket import router as ws_router

app.include_router(patients_router)
app.include_router(graph_router)
app.include_router(federation_router)
app.include_router(metrics_router)
app.include_router(decision_router)
app.include_router(ws_router)


@app.get("/")
def root():
    return {
        "name": "FedFairGNN API",
        "version": "1.0.0",
        "endpoints": {
            "patients": "/api/patients/{hospital_id}",
            "graph": "/api/graph/knowledge",
            "federation": "/api/federate/status",
            "metrics": "/api/metrics/compare",
            "prediction": "/api/predict/{hospital_id}/{patient_id}",
            "websocket": "/ws/federation"
        }
    }


@app.get("/api/hospitals")
def list_hospitals():
    """List all hospitals."""
    session = get_session("global")
    try:
        hospitals = session.query(Hospital).all()
        return [{"id": h.id, "name": h.name, "location": h.location, "patient_count": h.patient_count} for h in hospitals]
    finally:
        session.close()


@app.get("/api/symptoms")
def list_symptoms():
    """List all symptoms (for the symptom selector)."""
    session = get_session("global")
    try:
        symptoms = session.query(Symptom).all()
        return [{"id": s.id, "name": s.name, "body_system": s.body_system, "severity_weight": s.severity_weight} for s in symptoms]
    finally:
        session.close()


@app.get("/api/diseases")
def list_diseases():
    """List all diseases."""
    session = get_session("global")
    try:
        diseases = session.query(Disease).all()
        return [{"id": d.id, "name": d.name, "icd10_code": d.icd10_code, "category": d.category, "prevalence": d.prevalence} for d in diseases]
    finally:
        session.close()


@app.get("/api/treatments")
def list_treatments():
    """List all treatments."""
    session = get_session("global")
    try:
        treatments = session.query(Treatment).all()
        return [{"id": t.id, "name": t.name, "type": t.type, "evidence_level": t.evidence_level} for t in treatments]
    finally:
        session.close()
