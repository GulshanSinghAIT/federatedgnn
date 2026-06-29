import React, { useEffect, useState } from 'react';
import { fetchModelComparison, fetchDatasets, exportCSV } from '../../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
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
    engine?: string; // 'sim' | 'real'
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
        fetchDatasets().then(setDatasets).catch(() => { });
    }, []);

    useEffect(() => {
        fetchModelComparison(dataset).then(setModels);
        const int = setInterval(() => fetchModelComparison(dataset).then(setModels), 3000);
        return () => clearInterval(int);
    }, [dataset]);

    const fmt = (v?: number, pct = true) => {
        if (v == null) return <span className="text-text-muted">-</span>;
        return pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
    };

    // Per-row provenance tag: live (trained this session, sim or real) vs paper benchmark.
    const sourceBadge = (m: Model) => m.source === 'live'
        ? <Badge variant="dot" size="sm" color={m.engine === 'real' ? 'green' : 'blue'}
            title={m.engine === 'real' ? 'Live — real model trained on the dataset' : 'Live — simulation'}>
            {m.engine === 'real' ? 'live · real' : 'live · sim'}
        </Badge>
        : <Badge variant="dot" size="sm" color="gray" title="Paper Table-1 benchmark (not trained this session)">benchmark</Badge>;

    return (
        <div className="glass-card p-4">
            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-medium text-text-primary">Model Comparison</h3>
                <Button size="sm" variant="tertiary" leadingIcon={Download} onClick={() => exportCSV()}>
                    Export CSV
                </Button>
            </div>

            {/* Dataset selector */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="eyebrow">Dataset</span>
                {datasets.length > 0 && (
                    <TabsSubtle
                        selectedIndex={Math.max(0, datasets.findIndex(d => d.id === dataset))}
                        onSelect={(i) => setDataset(datasets[i].id)}>
                        {datasets.map((d, i) => (
                            <TabsSubtleItem key={d.id} index={i} label={d.name} title={d.description} />
                        ))}
                    </TabsSubtle>
                )}
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <Table>
                    <TableHeader className='bg-muted-foreground/10'>
                        <TableRow>
                            {['Model', 'Accuracy', 'F1-Score', 'AUC', 'ΔSP', 'ΔEO', 'Privacy', 'Comm. Cost'].map((h, i) => (
                                <TableHead key={h} className={`${i === 0 ? 'text-left' : 'text-center'} text-text-muted text-xs uppercase tracking-wide`}>{h}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {models.map((m, i) => (
                            <TableRow key={m.model} index={i} className={m.is_proposed ? 'bg-cobalt-tint/60' : ''}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>
                                            {m.model}
                                            {m.is_proposed && <span className="text-cobalt text-xs" title="Proposed model"> ★</span>}
                                        </span>
                                        {sourceBadge(m)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-medium animate-count-up">{fmt(m.accuracy)}</TableCell>
                                <TableCell className="text-center animate-count-up">{fmt(m.f1_score)}</TableCell>
                                <TableCell className="text-center animate-count-up">{fmt(m.auc)}</TableCell>
                                <TableCell className="text-center animate-count-up">{fmt(m.sp_difference, false)}</TableCell>
                                <TableCell className="text-center animate-count-up">{fmt(m.eo_difference, false)}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="solid" size="sm" color={m.privacy === 'High' ? 'teal' : 'gray'}>
                                        {m.privacy}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center text-xs text-text-muted">{m.comm_cost}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-4 space-y-2 text-xs text-text-muted">
                <div className="glass-card p-3">
                    <strong>ΔSP</strong> = |P(Ŷ=1 | A=0) − P(Ŷ=1 | A=1)| - Statistical Parity Difference (lower is fairer; target {'<'} 0.05)
                </div>
                <div className="glass-card p-3">
                    <strong>ΔEO</strong> = |TPR(A=0) − TPR(A=1)| - Equal Opportunity Difference (lower is fairer; target {'<'} 0.05)
                </div>
                <p className="px-1">
                    Values are this session's live results once a model has been trained on {dataset}; otherwise the
                    paper's reported Table&nbsp;1 benchmark for the selected dataset.
                </p>
            </div>
        </div>
    );
}
