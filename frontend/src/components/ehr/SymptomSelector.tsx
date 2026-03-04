import React, { useState, useEffect, useMemo } from 'react';
import { fetchSymptoms } from '../../api/client';

interface Symptom {
    id: string;
    name: string;
    body_system: string;
    severity_weight: number;
}

interface SelectedSymptom {
    symptom_id: string;
    name: string;
    severity: number;
    onset_date: string;
}

interface Props {
    selected: SelectedSymptom[];
    onChange: (symptoms: SelectedSymptom[]) => void;
}

const BODY_SYSTEMS = ['All', 'Respiratory', 'Cardiovascular', 'Neurological', 'Gastrointestinal', 'Musculoskeletal', 'Dermatological', 'Psychiatric', 'General'];

export default function SymptomSelector({ selected, onChange }: Props) {
    const [symptoms, setSymptoms] = useState<Symptom[]>([]);
    const [search, setSearch] = useState('');
    const [activeSystem, setActiveSystem] = useState('All');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchSymptoms().then(setSymptoms);
    }, []);

    const filtered = useMemo(() => {
        let list = symptoms;
        if (activeSystem !== 'All') list = list.filter(s => s.body_system === activeSystem);
        if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [symptoms, search, activeSystem]);

    const toggle = (sym: Symptom) => {
        const exists = selected.find(s => s.symptom_id === sym.id);
        if (exists) {
            onChange(selected.filter(s => s.symptom_id !== sym.id));
        } else {
            onChange([...selected, { symptom_id: sym.id, name: sym.name, severity: 5, onset_date: new Date().toISOString().split('T')[0] }]);
        }
    };

    const updateSeverity = (symptomId: string, severity: number) => {
        onChange(selected.map(s => s.symptom_id === symptomId ? { ...s, severity } : s));
    };

    const updateOnset = (symptomId: string, date: string) => {
        onChange(selected.map(s => s.symptom_id === symptomId ? { ...s, onset_date: date } : s));
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search symptoms..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    className="w-full px-4 py-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none transition-colors"
                />
                <div className="flex gap-1 mt-2 flex-wrap">
                    {BODY_SYSTEMS.map(sys => (
                        <button key={sys} onClick={() => setActiveSystem(sys)}
                            className={`px-2 py-1 text-xs rounded-full transition-all ${activeSystem === sys ? 'bg-[var(--color-accent-blue)] text-white' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'}`}>
                            {sys}
                        </button>
                    ))}
                </div>
                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl">
                        {filtered.map(sym => {
                            const isSelected = selected.some(s => s.symptom_id === sym.id);
                            return (
                                <button key={sym.id} onClick={() => toggle(sym)}
                                    className={`w-full px-4 py-2 text-left text-sm flex justify-between items-center hover:bg-[var(--color-bg-tertiary)] transition-colors ${isSelected ? 'bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)]' : 'text-[var(--color-text-primary)]'}`}>
                                    <span>{sym.name}</span>
                                    <span className="text-xs text-[var(--color-text-muted)]">{sym.body_system}</span>
                                </button>
                            );
                        })}
                        {filtered.length === 0 && <div className="px-4 py-3 text-[var(--color-text-muted)] text-sm">No symptoms found</div>}
                    </div>
                )}
            </div>

            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}

            {selected.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">Selected Symptoms ({selected.length})</h4>
                    {selected.map(sym => (
                        <div key={sym.symptom_id} className="glass-card p-3 space-y-2 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">{sym.name}</span>
                                <button onClick={() => toggle({ id: sym.symptom_id, name: sym.name, body_system: '', severity_weight: 0 })}
                                    className="text-[var(--color-accent-red)] hover:text-red-400 text-xs">✕ Remove</button>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-[var(--color-text-muted)] w-16">Severity</label>
                                <input type="range" min="1" max="10" value={sym.severity}
                                    onChange={e => updateSeverity(sym.symptom_id, parseInt(e.target.value))}
                                    className="flex-1 accent-[var(--color-accent-blue)]" />
                                <span className={`text-sm font-bold w-6 text-center ${sym.severity >= 8 ? 'text-[var(--color-accent-red)]' : sym.severity >= 5 ? 'text-[var(--color-accent-yellow)]' : 'text-[var(--color-accent-green)]'}`}>
                                    {sym.severity}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-[var(--color-text-muted)] w-16">Onset</label>
                                <input type="date" value={sym.onset_date}
                                    onChange={e => updateOnset(sym.symptom_id, e.target.value)}
                                    className="flex-1 px-2 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text-primary)]" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
