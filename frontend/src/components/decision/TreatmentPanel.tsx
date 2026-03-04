import React from 'react';
import { Pill, Stethoscope, HeartPulse, AlertCircle } from 'lucide-react';

interface Treatment {
    treatment_id: string;
    treatment_name: string;
    type: string;
    evidence_level: string;
    efficacy: number;
    contraindications: string[];
}

interface Diagnosis {
    disease_id: string;
    disease_name: string;
}

interface Props {
    treatments: Record<string, Treatment[]>;
    diagnoses: Diagnosis[];
}

const typeIcon = (type: string) => {
    if (type === 'pharmacological') return <Pill size={12} />;
    if (type === 'surgical') return <Stethoscope size={12} />;
    return <HeartPulse size={12} />;
};

const evidenceBadge = (level: string) => {
    const colors: Record<string, string> = { A: 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]', B: 'bg-[var(--color-accent-yellow)]/20 text-[var(--color-accent-yellow)]', C: 'bg-[var(--color-accent-orange)]/20 text-[var(--color-accent-orange)]' };
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[level] || colors.C}`}>Level {level}</span>;
};

export default function TreatmentPanel({ treatments, diagnoses }: Props) {
    return (
        <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Treatment Recommendations</h3>
            <div className="space-y-3">
                {diagnoses.slice(0, 3).map(d => {
                    const tList = treatments[d.disease_id] || [];
                    if (!tList.length) return null;
                    return (
                        <div key={d.disease_id}>
                            <h4 className="text-xs text-[var(--color-node-disease)] font-medium mb-1">For: {d.disease_name}</h4>
                            <div className="space-y-1">
                                {tList.slice(0, 3).map(t => (
                                    <div key={t.treatment_id} className="flex items-center gap-2 text-xs p-2 bg-[var(--color-bg-tertiary)]/30 rounded">
                                        <span className="text-[var(--color-node-treatment)]">{typeIcon(t.type)}</span>
                                        <span className="flex-1">{t.treatment_name}</span>
                                        {evidenceBadge(t.evidence_level)}
                                        <span className="text-[var(--color-text-muted)]">{(t.efficacy * 100).toFixed(0)}%</span>
                                        {t.contraindications.length > 0 && (
                                            <span className="text-[var(--color-accent-red)]" title={t.contraindications.join(', ')}>
                                                <AlertCircle size={12} />
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
