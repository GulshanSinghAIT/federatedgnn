import { create } from 'zustand';

export interface PatientSymptom {
  symptom_id: string;
  symptom_name: string;
  severity: number;
  onset_date?: string;
}

export interface PatientDisease {
  disease_id: string;
  disease_name: string;
  icd10_code: string;
  confidence: number;
  predicted_by: string;
}

export interface Patient {
  id: string;
  hospital_id: string;
  age_group: string;
  sex: string;
  ethnicity: string;
  ses: string;
  chief_complaint?: string;
  heart_rate?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  temperature?: number;
  spo2?: number;
  respiratory_rate?: number;
  pre_existing_conditions: string[];
  current_medications: string[];
  allergies: string[];
  surgical_history?: string;
  symptoms: PatientSymptom[];
  diseases: PatientDisease[];
  fairness_flag: string;
  created_at?: string;
  updated_at?: string;
}

export interface PatientStore {
  patients: Patient[];
  currentPatient: Patient | null;
  currentHospitalId: string;
  loading: boolean;

  setPatients: (patients: Patient[]) => void;
  setCurrentPatient: (patient: Patient | null) => void;
  setCurrentHospitalId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  addPatient: (patient: Patient) => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  patients: [],
  currentPatient: null,
  currentHospitalId: 'H1',
  loading: false,

  setPatients: (patients) => set({ patients }),
  setCurrentPatient: (patient) => set({ currentPatient: patient }),
  setCurrentHospitalId: (id) => set({ currentHospitalId: id }),
  setLoading: (loading) => set({ loading }),
  addPatient: (patient) => set((s) => ({ patients: [...s.patients, patient] })),
}));
