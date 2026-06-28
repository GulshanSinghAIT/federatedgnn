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
        <div className={`glass-card p-4 border-l-4 ${passed ? 'border-l-accent-green' : 'border-l-accent-red'}`}>
            <div className="flex items-center gap-2 mb-2">
                {passed ? (
                    <ShieldCheck size={18} className="text-accent-green" />
                ) : (
                    <AlertTriangle size={18} className="text-accent-red" />
                )}
                <span className={`text-sm font-medium ${passed ? 'text-accent-green' : 'text-accent-red'}`}>
                    {passed ? 'Fairness Check Passed ✓' : 'Potential Bias Detected ⚠️'}
                </span>
            </div>
            <p className="text-xs text-text-secondary mb-2">{explanation}</p>
            <div className="flex gap-4 text-xs">
                <div>
                    <span className="text-text-muted">Model Confidence: </span>
                    <span className="font-medium text-text-primary">{(confidence * 100).toFixed(1)}%</span>
                </div>
                {uncertainty != null && (
                    <div>
                        <span className="text-text-muted">Uncertainty: </span>
                        <span className="font-medium text-text-primary">{(uncertainty * 100).toFixed(1)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}
