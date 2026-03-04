import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Diagnosis {
    disease_id: string;
    disease_name: string;
    icd10_code: string;
    confidence: number;
    contributing_symptoms: string[];
}

export default function DiagnosisPanel({ diagnoses }: { diagnoses: Diagnosis[] }) {
    const [expanded, setExpanded] = useState<string | null>(null);

    const confColor = (c: number) => {
        if (c >= 0.8) return 'var(--color-accent-green)';
        if (c >= 0.5) return 'var(--color-accent-yellow)';
        return 'var(--color-accent-orange)';
    };

    return (
        <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Differential Diagnosis</h3>
            <div className="space-y-2">
                {diagnoses.map((d, i) => (
                    <div key={d.disease_id} className="bg-[var(--color-bg-tertiary)]/50 rounded-lg p-3 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[var(--color-text-muted)] w-5">#{i + 1}</span>
                                <div>
                                    <span className="text-sm font-medium">{d.disease_name}</span>
                                    <span className="text-xs text-[var(--color-text-muted)] ml-2">{d.icd10_code}</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold animate-count-up" style={{ color: confColor(d.confidence) }}>
                                {(d.confidence * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000"
                                style={{ width: `${d.confidence * 100}%`, backgroundColor: confColor(d.confidence) }} />
                        </div>
                        {d.contributing_symptoms.length > 0 && (
                            <button onClick={() => setExpanded(expanded === d.disease_id ? null : d.disease_id)}
                                className="flex items-center gap-1 mt-2 text-xs text-[var(--color-accent-blue)] hover:underline">
                                {expanded === d.disease_id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                Why this prediction?
                            </button>
                        )}
                        {expanded === d.disease_id && (
                            <div className="mt-2 p-2 bg-[var(--color-bg-primary)]/50 rounded text-xs animate-fade-in">
                                <span className="text-[var(--color-text-muted)]">Contributing symptoms:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {d.contributing_symptoms.map(s => (
                                        <span key={s} className="px-2 py-0.5 bg-[var(--color-node-symptom)]/20 text-[var(--color-node-symptom)] rounded-full">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
