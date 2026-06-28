import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PatientList from '../components/ehr/PatientList';
import PatientForm from '../components/ehr/PatientForm';
import PatientDetail from '../components/ehr/PatientDetail';
import KnowledgeGraph from '../components/graph/KnowledgeGraph';
import { fetchHospitals } from '../api/client';
import { Plus, Users, Network, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';

const TABS = [
    { key: 'list' as const, label: 'Patient List', icon: Users },
];

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
                        <Select value={hospitalId} onValueChange={val => navigate(`/hospital/${val}/dashboard`)}>
                            <SelectTrigger />
                            <SelectContent>
                                {hospitals.map((h, i) => <SelectItem key={h.id} index={i} value={h.id}>{h.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="tertiary" size="md" leadingIcon={Network} onClick={() => setView('graph')}
                            className={view === 'graph' ? 'bg-[var(--color-accent-blue)] text-white' : 'text-[var(--color-text-secondary)]'}>
                            Knowledge Graph
                        </Button>
                        <Button variant="ghost" size="md" leadingIcon={view === 'form' ? X : Plus} onClick={() => setView(view === 'form' ? 'list' : 'form')}
                            className="text-white" style={{ backgroundColor: 'var(--color-accent-green)' }}>
                            {view === 'form' ? 'Cancel' : 'Add Patient'}
                        </Button>
                    </div>
                </div>
                {/* Tab Bar */}
                <div className="mt-3">
                    <TabsSubtle
                        selectedIndex={Math.max(0, TABS.findIndex(t => t.key === view))}
                        onSelect={(i) => setView(TABS[i].key)}
                    >
                        {TABS.map((tab, i) => (
                            <TabsSubtleItem key={tab.key} index={i} label={tab.label} icon={tab.icon} />
                        ))}
                    </TabsSubtle>
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
