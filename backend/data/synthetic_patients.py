"""Synthetic patient generator for federated hospital simulation."""
import random
import uuid
import json
from datetime import datetime, timedelta

# Demographic distributions per hospital (skewed differently for fairness testing)
HOSPITAL_DEMOGRAPHICS = {
    "H1": {  # City General - urban, diverse
        "age_groups": {"Pediatric (<18)": 0.15, "Young Adult (18-35)": 0.35, "Middle-Aged (36-60)": 0.30, "Senior (60+)": 0.20},
        "sex": {"Male": 0.48, "Female": 0.48, "Non-binary / Other": 0.03, "Prefer not to say": 0.01},
        "ethnicity": {"Asian": 0.18, "Black / African American": 0.22, "Hispanic / Latino": 0.25, "White / Caucasian": 0.25, "Mixed": 0.07, "Other": 0.03},
        "ses": {"Low": 0.25, "Middle": 0.45, "High": 0.20, "Unknown": 0.10}
    },
    "H2": {  # Metro Hospital - suburban, older population
        "age_groups": {"Pediatric (<18)": 0.08, "Young Adult (18-35)": 0.18, "Middle-Aged (36-60)": 0.38, "Senior (60+)": 0.36},
        "sex": {"Male": 0.50, "Female": 0.47, "Non-binary / Other": 0.02, "Prefer not to say": 0.01},
        "ethnicity": {"Asian": 0.08, "Black / African American": 0.10, "Hispanic / Latino": 0.12, "White / Caucasian": 0.58, "Mixed": 0.08, "Other": 0.04},
        "ses": {"Low": 0.15, "Middle": 0.40, "High": 0.35, "Unknown": 0.10}
    },
    "H3": {  # Community Clinic - underserved area
        "age_groups": {"Pediatric (<18)": 0.25, "Young Adult (18-35)": 0.30, "Middle-Aged (36-60)": 0.28, "Senior (60+)": 0.17},
        "sex": {"Male": 0.46, "Female": 0.50, "Non-binary / Other": 0.03, "Prefer not to say": 0.01},
        "ethnicity": {"Asian": 0.05, "Black / African American": 0.35, "Hispanic / Latino": 0.38, "White / Caucasian": 0.12, "Mixed": 0.07, "Other": 0.03},
        "ses": {"Low": 0.45, "Middle": 0.35, "High": 0.10, "Unknown": 0.10}
    }
}

# Disease likelihood by age group (rough simulation)
DISEASE_AGE_WEIGHTS = {
    "Pediatric (<18)": {"D005": 2.0, "D006": 1.5, "D014": 1.3},
    "Young Adult (18-35)": {"D004": 1.5, "D014": 1.5, "D007": 1.5, "D005": 1.2},
    "Middle-Aged (36-60)": {"D001": 1.8, "D002": 1.5, "D009": 1.3, "D008": 1.3, "D015": 1.2},
    "Senior (60+)": {"D002": 2.0, "D012": 2.0, "D013": 1.8, "D015": 1.8, "D001": 1.5, "D010": 1.3}
}


def weighted_choice(options: dict) -> str:
    """Select from options dict where values are weights."""
    items = list(options.keys())
    weights = list(options.values())
    return random.choices(items, weights=weights, k=1)[0]


def generate_vital_signs(age_group: str) -> dict:
    """Generate realistic vital signs based on age group."""
    base = {
        "heart_rate": random.gauss(75, 12),
        "bp_systolic": random.gauss(120, 15),
        "bp_diastolic": random.gauss(80, 10),
        "temperature": random.gauss(36.8, 0.4),
        "spo2": min(100, random.gauss(97, 2)),
        "respiratory_rate": random.gauss(16, 3)
    }
    if age_group == "Senior (60+)":
        base["bp_systolic"] += 15
        base["heart_rate"] += 5
        base["spo2"] -= 1
    elif age_group == "Pediatric (<18)":
        base["heart_rate"] += 10
        base["respiratory_rate"] += 4
    return {k: round(v, 1) for k, v in base.items()}


def generate_patients(hospital_id: str, symptom_ids: list, disease_symptom_map: dict, 
                       count: int = None) -> list:
    """Generate synthetic patients for a hospital.
    
    Args:
        hospital_id: Hospital ID (H1, H2, H3)
        symptom_ids: List of all symptom IDs
        disease_symptom_map: Dict mapping disease_id -> list of (symptom_id, weight)
        count: Number of patients to generate (default: random 50-80)
    """
    if count is None:
        count = random.randint(50, 80)
    
    demographics = HOSPITAL_DEMOGRAPHICS.get(hospital_id, HOSPITAL_DEMOGRAPHICS["H1"])
    patients = []
    
    for _ in range(count):
        age_group = weighted_choice(demographics["age_groups"])
        sex = weighted_choice(demographics["sex"])
        ethnicity = weighted_choice(demographics["ethnicity"])
        ses = weighted_choice(demographics["ses"])
        
        # Pick 1-2 diseases weighted by age
        age_weights = DISEASE_AGE_WEIGHTS.get(age_group, {})
        all_diseases = list(disease_symptom_map.keys())
        disease_probs = []
        for d in all_diseases:
            base_prob = 1.0
            if d in age_weights:
                base_prob *= age_weights[d]
            disease_probs.append(base_prob)
        
        total = sum(disease_probs)
        disease_probs = [p / total for p in disease_probs]
        
        n_diseases = random.choices([1, 2], weights=[0.7, 0.3], k=1)[0]
        assigned_diseases = random.choices(all_diseases, weights=disease_probs, k=n_diseases)
        assigned_diseases = list(set(assigned_diseases))
        
        # Collect symptoms from assigned diseases
        patient_symptoms = []
        seen_symptoms = set()
        for disease_id in assigned_diseases:
            if disease_id in disease_symptom_map:
                for sym_id, weight in disease_symptom_map[disease_id]:
                    if sym_id not in seen_symptoms and random.random() < weight:
                        severity = max(1, min(10, int(random.gauss(weight * 8, 2))))
                        onset_days = random.randint(1, 30)
                        onset_date = (datetime.utcnow() - timedelta(days=onset_days)).strftime("%Y-%m-%d")
                        patient_symptoms.append({
                            "symptom_id": sym_id,
                            "severity": severity,
                            "onset_date": onset_date
                        })
                        seen_symptoms.add(sym_id)
        
        # Add 0-2 random symptoms for noise
        noise_count = random.randint(0, 2)
        for _ in range(noise_count):
            rand_sym = random.choice(symptom_ids)
            if rand_sym not in seen_symptoms:
                patient_symptoms.append({
                    "symptom_id": rand_sym,
                    "severity": random.randint(1, 5),
                    "onset_date": (datetime.utcnow() - timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
                })
                seen_symptoms.add(rand_sym)
        
        vitals = generate_vital_signs(age_group)
        
        complaints = [
            "Persistent cough and shortness of breath",
            "Recurring headaches and dizziness",
            "Joint pain and stiffness",
            "Fatigue and general weakness",
            "Chest pain and palpitations",
            "Abdominal pain and nausea",
            "Anxiety and difficulty sleeping",
            "Depressed mood and loss of interest",
            "Skin rash and itching",
            "Frequent urination and thirst"
        ]
        
        patient = {
            "id": str(uuid.uuid4()),
            "hospital_id": hospital_id,
            "age_group": age_group,
            "sex": sex,
            "ethnicity": ethnicity,
            "ses": ses,
            "chief_complaint": random.choice(complaints),
            "symptoms": patient_symptoms,
            "diseases": assigned_diseases,
            "vitals": vitals,
            "pre_existing_conditions": [],
            "current_medications": [],
            "allergies": [],
            "surgical_history": ""
        }
        patients.append(patient)
    
    return patients
