import React, { useEffect, useState } from 'react';
import { fetchModelComparison, exportCSV } from '../../api/client';
import { Download } from 'lucide-react';

interface Model {
    model: string;
    accuracy?: number;
    f1_score?: number;
    sp_difference?: number;
    eo_difference?: number;
    privacy: string;
    comm_cost: string;
}

export default function ModelComparison() {
    const [models, setModels] = useState<Model[]>([]);

    useEffect(() => {
        fetchModelComparison().then(setModels);
        const int = setInterval(() => fetchModelComparison().then(setModels), 3000);
        return () => clearInterval(int);
    }, []);

    const fmt = (v?: number, pct = true) => {
        if (v == null) return <span className="text-[var(--color-text-muted)]">—</span>;
        return pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
    };

    return (
        <div className="glass-card p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Model Comparison</h3>
                <button onClick={() => exportCSV()} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-accent-blue)] text-white rounded-lg hover:bg-[var(--color-accent-blue)]/80">
                    <Download size={12} /> Export CSV
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--color-border)]">
                            <th className="text-left py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">Model</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">Accuracy</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">F1-Score</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">ΔSP</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">ΔEO</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">Privacy</th>
                            <th className="text-center py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase">Comm. Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map(m => (
                            <tr key={m.model} className={`border-b border-[var(--color-border)]/30 ${m.model === 'FedFairGNN' ? 'bg-[var(--color-accent-blue)]/5' : ''}`}>
                                <td className="py-2 px-3 font-medium">{m.model} {m.model === 'FedFairGNN' && <span className="text-[var(--color-accent-yellow)] text-xs">★</span>}</td>
                                <td className="py-2 px-3 text-center font-bold animate-count-up">{fmt(m.accuracy)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.f1_score)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.sp_difference, false)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.eo_difference, false)}</td>
                                <td className="py-2 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${m.privacy === 'High' ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'}`}>
                                        {m.privacy}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-center text-xs text-[var(--color-text-muted)]">{m.comm_cost}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 space-y-2 text-xs text-[var(--color-text-muted)]">
                <div className="glass-card p-3">
                    <strong>ΔSP</strong> = |P(Ŷ=1 | A=0) − P(Ŷ=1 | A=1)| — Statistical Parity Difference (threshold: {'<'} 0.05)
                </div>
                <div className="glass-card p-3">
                    <strong>ΔEO</strong> = |TPR(A=0) − TPR(A=1)| — Equal Opportunity Difference (threshold: {'<'} 0.05)
                </div>
            </div>
        </div>
    );
}
