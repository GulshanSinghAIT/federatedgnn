"""Graph API router."""
from fastapi import APIRouter, HTTPException
from database import get_session
from models.db_models import (
    Disease, Symptom, Treatment, Patient, PatientSymptom, PatientDisease,
    SymptomDisease, TreatmentDisease, DiseaseComorbidity
)
from gnn.graph_builder import build_knowledge_graph, graph_to_json, get_patient_subgraph, get_disease_neighborhood

router = APIRouter(prefix="/api/graph", tags=["graph"])


def _load_graph(hospital_id: str = None):
    """Load the full knowledge graph, optionally including patients from a specific hospital."""
    global_session = get_session("global")
    try:
        diseases = global_session.query(Disease).all()
        symptoms = global_session.query(Symptom).all()
        treatments = global_session.query(Treatment).all()
        symptom_diseases = global_session.query(SymptomDisease).all()
        treatment_diseases = global_session.query(TreatmentDisease).all()
        disease_comorbidities = global_session.query(DiseaseComorbidity).all()
    finally:
        global_session.close()
    
    patients = []
    patient_symptoms = []
    patient_diseases = []
    
    if hospital_id:
        hospital_ids = [hospital_id]
    else:
        hospital_ids = ["H1", "H2", "H3"]
    
    for hid in hospital_ids:
        h_session = get_session(hid)
        try:
            patients.extend(h_session.query(Patient).all())
            patient_symptoms.extend(h_session.query(PatientSymptom).all())
            patient_diseases.extend(h_session.query(PatientDisease).all())
        finally:
            h_session.close()
    
    G = build_knowledge_graph(
        diseases, symptoms, treatments,
        symptom_diseases, treatment_diseases, disease_comorbidities,
        patients, patient_symptoms, patient_diseases
    )
    return G


@router.get("/knowledge")
def get_knowledge_graph(hospital_id: str = None):
    """Full knowledge graph as JSON."""
    G = _load_graph(hospital_id)
    return graph_to_json(G)


@router.get("/patient/{patient_id}")
def get_patient_graph(patient_id: str, hospital_id: str = None):
    """Subgraph around a patient node."""
    # Find which hospital the patient belongs to
    for hid in ([hospital_id] if hospital_id else ["H1", "H2", "H3"]):
        session = get_session(hid)
        try:
            p = session.query(Patient).filter(Patient.id == patient_id).first()
            if p:
                hospital_id = hid
                break
        finally:
            session.close()
    
    if not hospital_id:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    G = _load_graph(hospital_id)
    return get_patient_subgraph(G, patient_id)


@router.get("/disease/{disease_id}")
def get_disease_graph(disease_id: str):
    """Disease neighborhood (symptoms + treatments)."""
    G = _load_graph()
    return get_disease_neighborhood(G, disease_id)


@router.get("/stats")
def get_graph_stats():
    """Node/edge counts per hospital."""
    stats = {}
    for hid in ["H1", "H2", "H3"]:
        session = get_session(hid)
        try:
            patient_count = session.query(Patient).count()
            symptom_edges = session.query(PatientSymptom).count()
            disease_edges = session.query(PatientDisease).count()
            stats[hid] = {
                "patients": patient_count,
                "symptom_edges": symptom_edges,
                "disease_edges": disease_edges,
                "total_edges": symptom_edges + disease_edges
            }
        finally:
            session.close()
    
    global_session = get_session("global")
    try:
        stats["global"] = {
            "diseases": global_session.query(Disease).count(),
            "symptoms": global_session.query(Symptom).count(),
            "treatments": global_session.query(Treatment).count(),
            "indicates_edges": global_session.query(SymptomDisease).count(),
            "treats_edges": global_session.query(TreatmentDisease).count()
        }
    finally:
        global_session.close()
    
    return stats
