import React, { useEffect, useState } from 'react';
import { fetchDemographics } from '../../api/client';

interface DemoData {
    hospital_id: string;
    per_group_accuracy: Record<string, number>;
    fairness_gap: number;
}

export default function DemographicHeatmap() {
    const [data, setData] = useState<DemoData[]>([]);

    useEffect(() => {
        Promise.all(['H1', 'H2', 'H3'].map(h => fetchDemographics(h))).then(setData);
    }, []);

    const allGroups = [...new Set(data.flatMap(d => Object.keys(d.per_group_accuracy)))].sort();

    const colorScale = (v: number) => {
        if (v >= 0.7) return 'bg-accent-green/30 text-accent-green';
        if (v >= 0.5) return 'bg-accent-yellow/30 text-accent-yellow';
        return 'bg-accent-red/30 text-accent-red';
    };

    return (
        <div className="glass-card p-4">
            <h3 className="text-sm font-bold text-text-primary mb-4">Per-Demographic Accuracy Heatmap</h3>
            {allGroups.length === 0 ? (
                <div className="text-center text-text-muted py-4 text-sm">No demographic data available yet</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 text-text-muted">Group</th>
                                {data.map(d => (
                                    <th key={d.hospital_id} className="text-center py-2 px-2 text-text-muted">{d.hospital_id}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allGroups.map(group => (
                                <tr key={group} className="border-b border-border/20">
                                    <td className="py-1.5 px-2 text-text-secondary">{group.replace('|', ' / ')}</td>
                                    {data.map(d => {
                                        const val = d.per_group_accuracy[group];
                                        return (
                                            <td key={d.hospital_id} className="py-1.5 px-2 text-center">
                                                {val != null ? (
                                                    <span className={`px-2 py-0.5 rounded ${colorScale(val)} font-bold`}>
                                                        {(val * 100).toFixed(1)}%
                                                    </span>
                                                ) : <span className="text-text-muted">—</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data.map(d => d.fairness_gap > 0.1 && (
                <div key={d.hospital_id} className="mt-2 text-xs text-accent-red">
                    ⚠️ {d.hospital_id} has fairness gap of {d.fairness_gap.toFixed(4)} — above 0.1 threshold
                </div>
            ))}
        </div>
    );
}
