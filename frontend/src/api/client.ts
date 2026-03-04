import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// --- Hospitals ---
export const fetchHospitals = () => api.get('/hospitals').then(r => r.data);

// --- Symptoms ---
export const fetchSymptoms = () => api.get('/symptoms').then(r => r.data);

// --- Diseases ---
export const fetchDiseases = () => api.get('/diseases').then(r => r.data);

// --- Treatments ---
export const fetchTreatments = () => api.get('/treatments').then(r => r.data);

// --- Patients ---
export const fetchPatients = (hospitalId: string, params?: Record<string, string>) =>
  api.get(`/patients/${hospitalId}`, { params }).then(r => r.data);

export const fetchPatient = (hospitalId: string, patientId: string) =>
  api.get(`/patients/${hospitalId}/${patientId}`).then(r => r.data);

export const createPatient = (hospitalId: string, data: any) =>
  api.post(`/patients/${hospitalId}`, data).then(r => r.data);

export const updatePatient = (hospitalId: string, patientId: string, data: any) =>
  api.put(`/patients/${hospitalId}/${patientId}`, data).then(r => r.data);

// --- Graph ---
export const fetchKnowledgeGraph = (hospitalId?: string) =>
  api.get('/graph/knowledge', { params: hospitalId ? { hospital_id: hospitalId } : {} }).then(r => r.data);

export const fetchPatientGraph = (patientId: string, hospitalId?: string) =>
  api.get(`/graph/patient/${patientId}`, { params: hospitalId ? { hospital_id: hospitalId } : {} }).then(r => r.data);

export const fetchDiseaseGraph = (diseaseId: string) =>
  api.get(`/graph/disease/${diseaseId}`).then(r => r.data);

export const fetchGraphStats = () => api.get('/graph/stats').then(r => r.data);

// --- Federation ---
export const startFederation = (data: { model: string; rounds: number; hospitals: string[] }) =>
  api.post('/federate/start', data).then(r => r.data);

export const stopFederation = () => api.post('/federate/stop').then(r => r.data);

export const resetFederation = () => api.post('/federate/reset').then(r => r.data);

export const fetchFederationStatus = () => api.get('/federate/status').then(r => r.data);

export const fetchFederationHistory = (modelName?: string, hospitalId?: string) =>
  api.get('/federate/history', { params: { model_name: modelName, hospital_id: hospitalId } }).then(r => r.data);

// --- Metrics ---
export const fetchModelComparison = () => api.get('/metrics/compare').then(r => r.data);

export const fetchDemographics = (hospitalId: string) =>
  api.get(`/metrics/demographics/${hospitalId}`).then(r => r.data);

export const exportCSV = () =>
  api.get('/metrics/export/csv', { responseType: 'blob' }).then(r => {
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'federation_metrics.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

// --- Decision Support ---
export const fetchPrediction = (hospitalId: string, patientId: string) =>
  api.get(`/predict/${hospitalId}/${patientId}`).then(r => r.data);

export default api;
