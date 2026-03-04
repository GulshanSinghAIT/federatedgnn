import React from 'react';
import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';

interface Props {
    fairnessCheck: string;
    explanation: string;
    confidence: number;
    uncertainty?: number | null;
}

export default function FairnessAudit({ fairnessCheck, explanation, confidence, uncertainty }: Props) {
    const passed = fairnessCheck === 'passed';

    return (
        <div className={`glass-card p-4 border-l-4 ${passed ? 'border-l-[var(--color-accent-green)]' : 'border-l-[var(--color-accent-red)]'}`}>
            <div className="flex items-center gap-2 mb-2">
                {passed ? (
                    <ShieldCheck size={18} className="text-[var(--color-accent-green)]" />
                ) : (
                    <AlertTriangle size={18} className="text-[var(--color-accent-red)]" />
                )}
                <span className={`text-sm font-bold ${passed ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-red)]'}`}>
                    {passed ? 'Fairness Check Passed ✓' : 'Potential Bias Detected ⚠️'}
                </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">{explanation}</p>
            <div className="flex gap-4 text-xs">
                <div>
                    <span className="text-[var(--color-text-muted)]">Model Confidence: </span>
                    <span className="font-bold text-[var(--color-text-primary)]">{(confidence * 100).toFixed(1)}%</span>
                </div>
                {uncertainty != null && (
                    <div>
                        <span className="text-[var(--color-text-muted)]">Uncertainty: </span>
                        <span className="font-bold text-[var(--color-text-primary)]">{(uncertainty * 100).toFixed(1)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
