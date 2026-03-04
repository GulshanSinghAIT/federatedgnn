import React from 'react';
import { Handle, Position } from 'reactflow';
import { useFederationStore } from '../../store/federationStore';

interface HospitalNodeData {
    hospitalId: string;
    name: string;
    color: string;
    onClick?: (id: string) => void;
}

const COLORS: Record<string, string> = {
    H1: '#38bdf8', H2: '#a78bfa', H3: '#2dd4bf'
};

export default function HospitalNode({ data }: { data: HospitalNodeData }) {
    const metrics = useFederationStore(s => s.hospitalMetrics[data.hospitalId]);
    const isRunning = useFederationStore(s => s.isRunning);
    const color = COLORS[data.hospitalId] || data.color;

    const status = metrics?.status || 'idle';
    const statusLabel = isRunning ? 'Training' : status === 'completed' ? 'Ready' : 'Idle';
    const statusColor = isRunning ? 'bg-green-500' : status === 'completed' ? 'bg-blue-500' : 'bg-gray-500';

    return (
        <div className="glass-card p-4 min-w-[200px] cursor-pointer hover:border-white/20 transition-all"
            style={{ borderColor: `${color}40` }}
            onClick={() => data.onClick?.(data.hospitalId)}>
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />

            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="text-sm font-bold" style={{ color }}>{data.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{data.hospitalId}</div>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColor} ${isRunning ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] text-[var(--color-text-muted)]">{statusLabel}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-[var(--color-text-muted)]">Accuracy</span>
                    <div className="font-bold text-[var(--color-text-primary)] animate-count-up">
                        {metrics?.accuracy ? `${(metrics.accuracy * 100).toFixed(1)}%` : '—'}
                    </div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">ΔSP</span>
                    <div className="font-bold text-[var(--color-text-primary)] animate-count-up">
                        {metrics?.sp_difference != null ? metrics.sp_difference.toFixed(3) : '—'}
                    </div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">Nodes</span>
                    <div className="font-bold text-[var(--color-text-primary)]">
                        {metrics?.nodes_trained || '—'}
                    </div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">ΔEO</span>
                    <div className="font-bold text-[var(--color-text-primary)]">
                        {metrics?.eo_difference != null ? metrics.eo_difference.toFixed(3) : '—'}
                    </div>
                </div>
            </div>
        </div>
    );
}
