import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useFederationStore, RoundMetric } from '../../store/federationStore';

const MODEL_COLORS: Record<string, string> = {
    FairGCN: '#38bdf8',
    FairGNN: '#a78bfa',
    'SMPC-LP': '#2dd4bf',
    FedFairGNN: '#fbbf24',
};

export default function TrainingCharts() {
    const history = useFederationStore(s => s.history);

    const globalHistory = useMemo(() => {
        return history.filter(h => h.hospital_id === 'global');
    }, [history]);

    const chartData = useMemo(() => {
        const byRound: Record<string, any> = {};
        globalHistory.forEach(h => {
            const key = `${h.model_name}-${h.round_num}`;
            if (!byRound[h.round_num]) byRound[h.round_num] = { round: h.round_num };
            byRound[h.round_num][`${h.model_name}_accuracy`] = h.accuracy;
            byRound[h.round_num][`${h.model_name}_f1`] = h.f1_score;
            byRound[h.round_num][`${h.model_name}_sp`] = h.sp_difference;
            byRound[h.round_num][`${h.model_name}_eo`] = h.eo_difference;
        });
        return Object.values(byRound).sort((a: any, b: any) => a.round - b.round);
    }, [globalHistory]);

    const models = useMemo(() => {
        return [...new Set(globalHistory.map(h => h.model_name))];
    }, [globalHistory]);

    const charts = [
        { title: 'Accuracy', suffix: '_accuracy', format: (v: number) => `${(v * 100).toFixed(1)}%` },
        { title: 'F1-Score', suffix: '_f1', format: (v: number) => `${(v * 100).toFixed(1)}%` },
        { title: 'ΔSP (lower = better)', suffix: '_sp', format: (v: number) => v?.toFixed(4) },
        { title: 'ΔEO (lower = better)', suffix: '_eo', format: (v: number) => v?.toFixed(4) },
    ];

    if (chartData.length === 0) {
        return (
            <div className="glass-card p-6 text-center text-[var(--color-text-muted)]">
                Start federation training to see metrics charts
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            {charts.map(chart => (
                <div key={chart.title} className="glass-card p-4">
                    <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{chart.title}</h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="round" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Round', position: 'bottom', fill: '#64748b', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => chart.suffix.includes('sp') || chart.suffix.includes('eo') ? v.toFixed(2) : `${(v * 100).toFixed(0)}%`} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                                formatter={(value: number) => chart.format(value)} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            {models.map(m => (
                                <Line key={m} type="monotone" dataKey={`${m}${chart.suffix}`} name={m}
                                    stroke={MODEL_COLORS[m]} strokeWidth={2} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </div>
    );
}
