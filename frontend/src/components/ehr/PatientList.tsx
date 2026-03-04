import React, { useEffect, useState, useMemo } from 'react';
import { fetchPatients } from '../../api/client';
import { usePatientStore, Patient } from '../../store/patientStore';
import { Search, Filter, Users } from 'lucide-react';

interface Props {
    hospitalId: string;
    onSelectPatient: (id: string) => void;
}

export default function PatientList({ hospitalId, onSelectPatient }: Props) {
    const { patients, setPatients, setLoading, loading } = usePatientStore();
    const [search, setSearch] = useState('');
    const [filterAge, setFilterAge] = useState('');
    const [filterEthnicity, setFilterEthnicity] = useState('');

    useEffect(() => {
        setLoading(true);
        fetchPatients(hospitalId).then(data => {
            setPatients(data);
            setLoading(false);
        });
    }, [hospitalId]);

    const filtered = useMemo(() => {
        let list = patients;
        if (filterAge) list = list.filter(p => p.age_group === filterAge);
        if (filterEthnicity) list = list.filter(p => p.ethnicity === filterEthnicity);
        if (search) list = list.filter(p => p.id.includes(search) || p.chief_complaint?.toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [patients, search, filterAge, filterEthnicity]);

    const fairnessColor = (flag: string) => {
        if (flag === 'green') return 'bg-[var(--color-accent-green)]';
        if (flag === 'yellow') return 'bg-[var(--color-accent-yellow)]';
        return 'bg-[var(--color-accent-red)]';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-blue)] focus:outline-none"
                        placeholder="Search by ID or complaint..." />
                </div>
                <select value={filterAge} onChange={e => setFilterAge(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                    <option value="">All Ages</option>
                    <option value="Pediatric (<18)">Pediatric</option>
                    <option value="Young Adult (18-35)">Young Adult</option>
                    <option value="Middle-Aged (36-60)">Middle-Aged</option>
                    <option value="Senior (60+)">Senior</option>
                </select>
                <select value={filterEthnicity} onChange={e => setFilterEthnicity(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                    <option value="">All Ethnicities</option>
                    <option value="Asian">Asian</option>
                    <option value="Black / African American">Black</option>
                    <option value="Hispanic / Latino">Hispanic</option>
                    <option value="White / Caucasian">White</option>
                    <option value="Mixed">Mixed</option>
                </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Users size={14} />
                <span>{filtered.length} patients</span>
            </div>

            {loading ? (
                <div className="text-center py-8 text-[var(--color-text-muted)]">Loading patients...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Patient ID</th>
                                <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Age Group</th>
                                <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Ethnicity</th>
                                <th className="text-center py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Symptoms</th>
                                <th className="text-left py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Predicted Disease</th>
                                <th className="text-center py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Confidence</th>
                                <th className="text-center py-3 px-3 text-[var(--color-text-muted)] font-medium text-xs uppercase tracking-wider">Fairness</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => {
                                const topDisease = p.diseases?.[0];
                                return (
                                    <tr key={p.id} onClick={() => onSelectPatient(p.id)}
                                        className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg-tertiary)]/50 cursor-pointer transition-colors">
                                        <td className="py-3 px-3 font-mono text-xs text-[var(--color-accent-blue)]">{p.id.slice(0, 8)}...</td>
                                        <td className="py-3 px-3">{p.age_group}</td>
                                        <td className="py-3 px-3">{p.ethnicity}</td>
                                        <td className="py-3 px-3 text-center">{p.symptoms?.length || 0}</td>
                                        <td className="py-3 px-3">{topDisease?.disease_name || '-'}</td>
                                        <td className="py-3 px-3 text-center">
                                            {topDisease ? (
                                                <span className={`font-bold ${topDisease.confidence > 0.8 ? 'text-[var(--color-accent-green)]' : topDisease.confidence > 0.5 ? 'text-[var(--color-accent-yellow)]' : 'text-[var(--color-accent-orange)]'}`}>
                                                    {(topDisease.confidence * 100).toFixed(1)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto ${fairnessColor(p.fairness_flag)}`} title={p.fairness_flag} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
