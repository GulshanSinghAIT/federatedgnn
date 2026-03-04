from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_DIR = os.path.join(os.path.dirname(__file__), "db_files")
os.makedirs(DATABASE_DIR, exist_ok=True)


class Base(DeclarativeBase):
    pass


def get_engine(hospital_id: str = "global"):
    db_path = os.path.join(DATABASE_DIR, f"{hospital_id}.db")
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    return engine


def get_session(hospital_id: str = "global"):
    engine = get_engine(hospital_id)
    Session = sessionmaker(bind=engine)
    return Session()


# Global engine for shared data (diseases, symptoms, treatments, federation rounds)
global_engine = get_engine("global")
GlobalSession = sessionmaker(bind=global_engine)


def init_db(hospital_id: str = "global"):
    from models.db_models import (
        Hospital, Patient, Symptom, PatientSymptom,
        Disease, Treatment, FederationRound,
        SymptomDisease, TreatmentDisease, DiseaseComorbidity,
        PatientDisease
    )
    engine = get_engine(hospital_id)
    Base.metadata.create_all(engine)
