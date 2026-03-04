from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid


class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    location = Column(String)
    patient_count = Column(Integer, default=0)


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    hospital_id = Column(String, nullable=False)
    age_group = Column(String)
    sex = Column(String)
    ethnicity = Column(String)
    ses = Column(String)
    chief_complaint = Column(Text)
    heart_rate = Column(Float)
    bp_systolic = Column(Float)
    bp_diastolic = Column(Float)
    temperature = Column(Float)
    spo2 = Column(Float)
    respiratory_rate = Column(Float)
    pre_existing_conditions = Column(Text)  # JSON string
    current_medications = Column(Text)  # JSON string
    allergies = Column(Text)  # JSON string
    surgical_history = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    symptoms = relationship("PatientSymptom", back_populates="patient", cascade="all, delete-orphan")
    diseases = relationship("PatientDisease", back_populates="patient", cascade="all, delete-orphan")


class Symptom(Base):
    __tablename__ = "symptoms"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    body_system = Column(String)
    severity_weight = Column(Float, default=1.0)


class PatientSymptom(Base):
    __tablename__ = "patient_symptoms"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    symptom_id = Column(String, ForeignKey("symptoms.id"), nullable=False)
    severity = Column(Integer, default=5)
    onset_date = Column(Date)

    patient = relationship("Patient", back_populates="symptoms")
    symptom = relationship("Symptom")


class Disease(Base):
    __tablename__ = "diseases"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    icd10_code = Column(String)
    category = Column(String)
    prevalence = Column(Float, default=0.01)


class Treatment(Base):
    __tablename__ = "treatments"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String)  # pharmacological, surgical, lifestyle
    evidence_level = Column(String)  # A, B, C


class PatientDisease(Base):
    __tablename__ = "patient_diseases"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    disease_id = Column(String, ForeignKey("diseases.id"), nullable=False)
    confidence = Column(Float, default=0.0)
    predicted_by = Column(String, default="FedFairGNN")
    predicted_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="diseases")
    disease = relationship("Disease")


class SymptomDisease(Base):
    __tablename__ = "symptom_diseases"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symptom_id = Column(String, ForeignKey("symptoms.id"), nullable=False)
    disease_id = Column(String, ForeignKey("diseases.id"), nullable=False)
    weight = Column(Float, default=0.5)  # co-occurrence probability

    symptom = relationship("Symptom")
    disease = relationship("Disease")


class TreatmentDisease(Base):
    __tablename__ = "treatment_diseases"
    id = Column(Integer, primary_key=True, autoincrement=True)
    treatment_id = Column(String, ForeignKey("treatments.id"), nullable=False)
    disease_id = Column(String, ForeignKey("diseases.id"), nullable=False)
    efficacy = Column(Float, default=0.7)

    treatment = relationship("Treatment")
    disease = relationship("Disease")


class DiseaseComorbidity(Base):
    __tablename__ = "disease_comorbidities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    disease_id_1 = Column(String, ForeignKey("diseases.id"), nullable=False)
    disease_id_2 = Column(String, ForeignKey("diseases.id"), nullable=False)
    correlation = Column(Float, default=0.3)


class FederationRound(Base):
    __tablename__ = "federation_rounds"
    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String, nullable=False)
    round_num = Column(Integer, nullable=False)
    hospital_id = Column(String, nullable=False)
    accuracy = Column(Float)
    f1_score = Column(Float)
    loss = Column(Float)
    sp_difference = Column(Float)
    eo_difference = Column(Float)
    nodes_trained = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)
