"""Patient CRUD router."""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from datetime import datetime
import json
import uuid

from database import get_session, init_db
from models.db_models import Patient, PatientSymptom, PatientDisease, Symptom
from models.schemas import PatientCreate, PatientUpdate, PatientOut, PatientSymptomOut, PatientDiseaseOut

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _patient_to_out(patient: Patient, session) -> PatientOut:
    """Convert ORM patient to Pydantic output."""
    symptoms = []
    for ps in patient.symptoms:
        sym = session.query(Symptom).filter(Symptom.id == ps.symptom_id).first()
        symptoms.append(PatientSymptomOut(
            symptom_id=ps.symptom_id,
            symptom_name=sym.name if sym else ps.symptom_id,
            severity=ps.severity,
            onset_date=str(ps.onset_date) if ps.onset_date else None
        ))
    
    diseases = []
    for pd in patient.diseases:
        from models.db_models import Disease
        dis = session.query(Disease).filter(Disease.id == pd.disease_id).first()
        diseases.append(PatientDiseaseOut(
            disease_id=pd.disease_id,
            disease_name=dis.name if dis else pd.disease_id,
            icd10_code=dis.icd10_code if dis else "",
            confidence=pd.confidence,
            predicted_by=pd.predicted_by
        ))
    
    # Determine fairness flag based on prediction confidence spread
    fairness_flag = "green"
    if diseases:
        max_conf = max(d.confidence for d in diseases)
        if max_conf < 0.5:
            fairness_flag = "yellow"
        if max_conf < 0.3:
            fairness_flag = "red"
    
    return PatientOut(
        id=patient.id,
        hospital_id=patient.hospital_id,
        age_group=patient.age_group or "",
        sex=patient.sex or "",
        ethnicity=patient.ethnicity or "",
        ses=patient.ses or "",
        chief_complaint=patient.chief_complaint,
        heart_rate=patient.heart_rate,
        bp_systolic=patient.bp_systolic,
        bp_diastolic=patient.bp_diastolic,
        temperature=patient.temperature,
        spo2=patient.spo2,
        respiratory_rate=patient.respiratory_rate,
        pre_existing_conditions=json.loads(patient.pre_existing_conditions) if patient.pre_existing_conditions else [],
        current_medications=json.loads(patient.current_medications) if patient.current_medications else [],
        allergies=json.loads(patient.allergies) if patient.allergies else [],
        surgical_history=patient.surgical_history,
        symptoms=symptoms,
        diseases=diseases,
        fairness_flag=fairness_flag,
        created_at=str(patient.created_at) if patient.created_at else None,
        updated_at=str(patient.updated_at) if patient.updated_at else None
    )


@router.get("/{hospital_id}")
def list_patients(hospital_id: str, age_group: Optional[str] = None,
                  ethnicity: Optional[str] = None, min_symptoms: Optional[int] = None,
                  max_symptoms: Optional[int] = None):
    session = get_session(hospital_id)
    try:
        query = session.query(Patient).filter(Patient.hospital_id == hospital_id)
        
        if age_group:
            query = query.filter(Patient.age_group == age_group)
        if ethnicity:
            query = query.filter(Patient.ethnicity == ethnicity)
        
        patients = query.all()
        result = []
        for p in patients:
            out = _patient_to_out(p, session)
            symcount = len(out.symptoms)
            if min_symptoms is not None and symcount < min_symptoms:
                continue
            if max_symptoms is not None and symcount > max_symptoms:
                continue
            result.append(out)
        
        return result
    finally:
        session.close()


@router.get("/{hospital_id}/{patient_id}")
def get_patient(hospital_id: str, patient_id: str):
    session = get_session(hospital_id)
    try:
        patient = session.query(Patient).filter(
            Patient.id == patient_id, Patient.hospital_id == hospital_id
        ).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return _patient_to_out(patient, session)
    finally:
        session.close()


@router.post("/{hospital_id}")
def create_patient(hospital_id: str, data: PatientCreate):
    session = get_session(hospital_id)
    try:
        patient_id = str(uuid.uuid4())
        patient = Patient(
            id=patient_id,
            hospital_id=hospital_id,
            age_group=data.age_group,
            sex=data.sex,
            ethnicity=data.ethnicity,
            ses=data.ses,
            chief_complaint=data.chief_complaint,
            heart_rate=data.heart_rate,
            bp_systolic=data.bp_systolic,
            bp_diastolic=data.bp_diastolic,
            temperature=data.temperature,
            spo2=data.spo2,
            respiratory_rate=data.respiratory_rate,
            pre_existing_conditions=json.dumps(data.pre_existing_conditions or []),
            current_medications=json.dumps(data.current_medications or []),
            allergies=json.dumps(data.allergies or []),
            surgical_history=data.surgical_history,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(patient)
        
        # Add symptoms
        for sym in data.symptoms:
            ps = PatientSymptom(
                patient_id=patient_id,
                symptom_id=sym.symptom_id,
                severity=sym.severity,
                onset_date=sym.onset_date
            )
            session.add(ps)
        
        session.commit()
        
        # Run prediction using the GNN model
        from gnn.models import get_model
        from gnn.federated_engine import federation_state
        
        model_name = federation_state.active_model_name or "FedFairGNN"
        model = federation_state.models.get(model_name)
        if model is None:
            model = get_model(model_name)
        
        # Load disease-symptom map from global DB  
        from database import get_session as get_sess
        from models.db_models import SymptomDisease
        global_session = get_sess("global")
        try:
            sd_records = global_session.query(SymptomDisease).all()
            disease_symptom_map = {}
            for sd in sd_records:
                if sd.disease_id not in disease_symptom_map:
                    disease_symptom_map[sd.disease_id] = []
                disease_symptom_map[sd.disease_id].append((sd.symptom_id, sd.weight))
        finally:
            global_session.close()
        
        patient_symptom_ids = [s.symptom_id for s in data.symptoms]
        predictions = model.predict(patient_symptom_ids, [], disease_symptom_map)
        
        # Save predictions
        for pred in predictions[:3]:
            pd_record = PatientDisease(
                patient_id=patient_id,
                disease_id=pred["disease_id"],
                confidence=pred["confidence"],
                predicted_by=model_name
            )
            session.add(pd_record)
        session.commit()
        
        patient = session.query(Patient).filter(Patient.id == patient_id).first()
        return _patient_to_out(patient, session)
    finally:
        session.close()


@router.put("/{hospital_id}/{patient_id}")
def update_patient(hospital_id: str, patient_id: str, data: PatientUpdate):
    session = get_session(hospital_id)
    try:
        patient = session.query(Patient).filter(
            Patient.id == patient_id, Patient.hospital_id == hospital_id
        ).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        
        if data.chief_complaint is not None:
            patient.chief_complaint = data.chief_complaint
        if data.heart_rate is not None:
            patient.heart_rate = data.heart_rate
        if data.bp_systolic is not None:
            patient.bp_systolic = data.bp_systolic
        if data.bp_diastolic is not None:
            patient.bp_diastolic = data.bp_diastolic
        if data.temperature is not None:
            patient.temperature = data.temperature
        if data.spo2 is not None:
            patient.spo2 = data.spo2
        if data.respiratory_rate is not None:
            patient.respiratory_rate = data.respiratory_rate
        if data.pre_existing_conditions is not None:
            patient.pre_existing_conditions = json.dumps(data.pre_existing_conditions)
        if data.current_medications is not None:
            patient.current_medications = json.dumps(data.current_medications)
        if data.allergies is not None:
            patient.allergies = json.dumps(data.allergies)
        if data.surgical_history is not None:
            patient.surgical_history = data.surgical_history
        
        if data.symptoms is not None:
            session.query(PatientSymptom).filter(PatientSymptom.patient_id == patient_id).delete()
            for sym in data.symptoms:
                ps = PatientSymptom(
                    patient_id=patient_id,
                    symptom_id=sym.symptom_id,
                    severity=sym.severity,
                    onset_date=sym.onset_date
                )
                session.add(ps)
        
        patient.updated_at = datetime.utcnow()
        session.commit()
        
        patient = session.query(Patient).filter(Patient.id == patient_id).first()
        return _patient_to_out(patient, session)
    finally:
        session.close()
