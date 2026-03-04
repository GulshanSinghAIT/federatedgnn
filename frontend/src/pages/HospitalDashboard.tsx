import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PatientList from '../components/ehr/PatientList';
import PatientForm from '../components/ehr/PatientForm';
import PatientDetail from '../components/ehr/PatientDetail';
import KnowledgeGraph from '../components/graph/KnowledgeGraph';
import { fetchHospitals } from '../api/client';
import { Plus, Users, Network, X } from 'lucide-react';

export default function HospitalDashboard() {
    const { hospitalId = 'H1' } = useParams();
    const navigate = useNavigate();
    const [view, setView] = useState<'list' | 'form' | 'detail' | 'graph'>('list');
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [hospitals, setHospitals] = useState<any[]>([]);

    useEffect(() => {
        fetchHospitals().then(setHospitals);
    }, []);

    const handleSelectPatient = (id: string) => {
        setSelectedPatientId(id);
        setView('detail');
    };

    const hospital = hospitals.find(h => h.id === hospitalId);
    const HOSPITAL_COLORS: Record<string, string> = { H1: '#38bdf8', H2: '#a78bfa', H3: '#2dd4bf' };

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
            {/* Header */}
            <header className="border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: HOSPITAL_COLORS[hospitalId] }}>
                            {hospital?.name || hospitalId}
                        </h1>
                        <p className="text-xs text-[var(--color-text-muted)]">{hospital?.location} • {hospital?.patient_count || 0} patients</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Hospital Selector */}
                        <select value={hospitalId} onChange={e => navigate(`/hospital/${e.target.value}/dashboard`)}
                            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                            {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                        <button onClick={() => setView('graph')}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${view === 'graph' ? 'bg-[var(--color-accent-blue)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80'}`}>
                            <Network size={14} /> Knowledge Graph
                        </button>
                        <button onClick={() => setView(view === 'form' ? 'list' : 'form')}
                            className="flex items-center gap-1 px-4 py-2 bg-[var(--color-accent-green)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-green)]/80 transition-colors">
                            {view === 'form' ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Patient</>}
                        </button>
                    </div>
                </div>
                {/* Tab Bar */}
                <div className="flex gap-4 mt-3">
                    {[
                        { key: 'list', label: 'Patient List', icon: <Users size={14} /> },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setView(tab.key as any)}
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${view === tab.key ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
                {view === 'list' && <PatientList hospitalId={hospitalId} onSelectPatient={handleSelectPatient} />}
                {view === 'form' && <PatientForm hospitalId={hospitalId} onComplete={() => setView('list')} />}
                {view === 'detail' && selectedPatientId && (
                    <PatientDetail hospitalId={hospitalId} patientId={selectedPatientId} onBack={() => setView('list')} />
                )}
                {view === 'graph' && (
                    <div className="h-[calc(100vh-200px)]">
                        <KnowledgeGraph hospitalId={hospitalId} />
                    </div>
                )}
            </main>
        </div>
    );
}
