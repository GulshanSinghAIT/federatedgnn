import React, { useEffect, useState } from 'react';
import { fetchModelComparison, fetchDatasets, exportCSV } from '../../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';

interface Model {
    model: string;
    dataset?: string;
    accuracy?: number;
    f1_score?: number;
    auc?: number;
    sp_difference?: number;
    eo_difference?: number;
    privacy: string;
    comm_cost: string;
    is_proposed?: boolean;
    source?: string; // 'live' | 'benchmark'
}

interface Dataset {
    id: string;
    name: string;
    description: string;
}

export default function ModelComparison() {
    const [models, setModels] = useState<Model[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [dataset, setDataset] = useState<string>('MedGraph-S');

    useEffect(() => {
        fetchDatasets().then(setDatasets).catch(() => {});
    }, []);

    useEffect(() => {
        fetchModelComparison(dataset).then(setModels);
        const int = setInterval(() => fetchModelComparison(dataset).then(setModels), 3000);
        return () => clearInterval(int);
    }, [dataset]);

    const fmt = (v?: number, pct = true) => {
        if (v == null) return <span className="text-[var(--color-text-muted)]">—</span>;
        return pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
    };

    const isLive = models.some(m => m.source === 'live');

    return (
        <div className="glass-card p-4">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Model Comparison</h3>
                    <Badge variant="dot" size="sm" color={isLive ? 'blue' : 'gray'}>
                        {isLive ? 'live (this session)' : 'paper benchmark'}
                    </Badge>
                </div>
                <Button size="sm" variant="tertiary" leadingIcon={Download} onClick={() => exportCSV()}>
                    Export CSV
                </Button>
            </div>

            {/* Dataset selector */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                <span className="eyebrow mr-1">Dataset</span>
                {datasets.map(d => (
                    <Button
                        key={d.id}
                        variant="tertiary"
                        size="sm"
                        onClick={() => setDataset(d.id)}
                        title={d.description}
                        className={
                            dataset === d.id
                                ? 'bg-[var(--color-cobalt-tint)] border-[var(--color-cobalt)] text-[var(--color-cobalt-deep)]'
                                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-cobalt)]'
                        }>
                        {d.name}
                    </Button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[var(--color-border)]">
                            {['Model', 'Accuracy', 'F1-Score', 'AUC', 'ΔSP', 'ΔEO', 'Privacy', 'Comm. Cost'].map((h, i) => (
                                <th key={h} className={`${i === 0 ? 'text-left' : 'text-center'} py-2 px-3 text-[var(--color-text-muted)] text-xs uppercase tracking-wide`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {models.map(m => (
                            <tr key={m.model} className={`border-b border-[var(--color-border)]/40 ${m.is_proposed ? 'bg-[var(--color-cobalt-tint)]/60' : ''}`}>
                                <td className="py-2 px-3 font-medium">
                                    {m.model}{' '}
                                    {m.is_proposed && <span className="text-[var(--color-cobalt)] text-xs" title="Proposed model">★</span>}
                                </td>
                                <td className="py-2 px-3 text-center font-bold animate-count-up">{fmt(m.accuracy)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.f1_score)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.auc)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.sp_difference, false)}</td>
                                <td className="py-2 px-3 text-center animate-count-up">{fmt(m.eo_difference, false)}</td>
                                <td className="py-2 px-3 text-center">
                                    <Badge variant="solid" size="sm" color={m.privacy === 'High' ? 'teal' : 'gray'}>
                                        {m.privacy}
                                    </Badge>
                                </td>
                                <td className="py-2 px-3 text-center text-xs text-[var(--color-text-muted)]">{m.comm_cost}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 space-y-2 text-xs text-[var(--color-text-muted)]">
                <div className="glass-card p-3">
                    <strong>ΔSP</strong> = |P(Ŷ=1 | A=0) − P(Ŷ=1 | A=1)| — Statistical Parity Difference (lower is fairer; target {'<'} 0.05)
                </div>
                <div className="glass-card p-3">
                    <strong>ΔEO</strong> = |TPR(A=0) − TPR(A=1)| — Equal Opportunity Difference (lower is fairer; target {'<'} 0.05)
                </div>
                <p className="px-1">
                    Values are this session's live results once a model has been trained on {dataset}; otherwise the
                    paper's reported Table&nbsp;1 benchmark for the selected dataset.
                </p>
            </div>
        </div>
    );
}
