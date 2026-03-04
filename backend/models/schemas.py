from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# --- Patient Schemas ---
class SymptomEntry(BaseModel):
    symptom_id: str
    severity: int = Field(ge=1, le=10, default=5)
    onset_date: Optional[str] = None


class PatientCreate(BaseModel):
    age_group: str
    sex: str
    ethnicity: str
    ses: str = "Unknown"
    chief_complaint: Optional[str] = None
    symptoms: List[SymptomEntry] = []
    heart_rate: Optional[float] = None
    bp_systolic: Optional[float] = None
    bp_diastolic: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respiratory_rate: Optional[float] = None
    pre_existing_conditions: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    surgical_history: Optional[str] = None


class PatientUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    symptoms: Optional[List[SymptomEntry]] = None
    heart_rate: Optional[float] = None
    bp_systolic: Optional[float] = None
    bp_diastolic: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respiratory_rate: Optional[float] = None
    pre_existing_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    surgical_history: Optional[str] = None


class SymptomOut(BaseModel):
    id: str
    name: str
    body_system: str
    severity_weight: float

    class Config:
        from_attributes = True


class PatientSymptomOut(BaseModel):
    symptom_id: str
    symptom_name: str
    severity: int
    onset_date: Optional[str] = None


class DiseaseOut(BaseModel):
    id: str
    name: str
    icd10_code: str
    category: str
    prevalence: float

    class Config:
        from_attributes = True


class PatientDiseaseOut(BaseModel):
    disease_id: str
    disease_name: str
    icd10_code: str
    confidence: float
    predicted_by: str


class PatientOut(BaseModel):
    id: str
    hospital_id: str
    age_group: str
    sex: str
    ethnicity: str
    ses: str
    chief_complaint: Optional[str] = None
    heart_rate: Optional[float] = None
    bp_systolic: Optional[float] = None
    bp_diastolic: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    respiratory_rate: Optional[float] = None
    pre_existing_conditions: Optional[List[str]] = []
    current_medications: Optional[List[str]] = []
    allergies: Optional[List[str]] = []
    surgical_history: Optional[str] = None
    symptoms: List[PatientSymptomOut] = []
    diseases: List[PatientDiseaseOut] = []
    fairness_flag: Optional[str] = "green"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class HospitalOut(BaseModel):
    id: str
    name: str
    location: str
    patient_count: int

    class Config:
        from_attributes = True


# --- Graph Schemas ---
class GraphNode(BaseModel):
    id: str
    type: str  # patient, symptom, disease, treatment
    label: str
    properties: dict = {}


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


# --- Federation Schemas ---
class FederationStartRequest(BaseModel):
    model: str = "FedFairGNN"
    rounds: int = Field(ge=5, le=50, default=10)
    hospitals: List[str] = ["H1", "H2", "H3"]


class FederationStatusOut(BaseModel):
    is_running: bool
    current_round: int
    total_rounds: int
    active_model: str
    hospitals: List[str]
    global_accuracy: Optional[float] = None
    global_f1: Optional[float] = None
    sp_difference: Optional[float] = None
    eo_difference: Optional[float] = None


class RoundMetricOut(BaseModel):
    model_name: str
    round_num: int
    hospital_id: str
    accuracy: float
    f1_score: float
    loss: Optional[float] = None
    sp_difference: float
    eo_difference: float
    nodes_trained: Optional[int] = None
    timestamp: str


class ModelComparisonOut(BaseModel):
    model: str
    accuracy: Optional[float] = None
    f1_score: Optional[float] = None
    sp_difference: Optional[float] = None
    eo_difference: Optional[float] = None
    privacy: str = "None"
    comm_cost: str = "N/A"


# --- Decision Support Schemas ---
class DiagnosisPrediction(BaseModel):
    disease_id: str
    disease_name: str
    icd10_code: str
    confidence: float
    contributing_symptoms: List[str] = []


class TreatmentRecommendation(BaseModel):
    treatment_id: str
    treatment_name: str
    type: str
    evidence_level: str
    efficacy: float
    contraindications: List[str] = []


class DecisionSupportOut(BaseModel):
    patient_id: str
    diagnoses: List[DiagnosisPrediction]
    treatments: dict  # disease_id -> List[TreatmentRecommendation]
    fairness_check: str  # "passed" or "warning"
    fairness_explanation: str
    model_confidence: float
    uncertainty: Optional[float] = None
    disclaimer: str = "This recommendation is generated by an AI model. Clinical judgment required."


# --- Demographics ---
class DemographicBreakdown(BaseModel):
    hospital_id: str
    age_groups: dict  # group -> count
    ethnicities: dict  # ethnicity -> count
    per_group_accuracy: dict = {}  # group -> accuracy
    fairness_gap: Optional[float] = None


class TreatmentOut(BaseModel):
    id: str
    name: str
    type: str
    evidence_level: str

    class Config:
        from_attributes = True
