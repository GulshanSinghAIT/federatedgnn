import React from 'react';
import { Handle, Position } from 'reactflow';
import { useFederationStore } from '../../store/federationStore';

export default function AggregatorNode() {
    const { isRunning, activeModel, globalMetrics, currentRound, totalRounds } = useFederationStore();

    return (
        <div className="glass-card p-5 min-w-[220px] text-center" style={{ borderColor: isRunning ? '#38bdf840' : '#33415540' }}>
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />

            {isRunning && (
                <div className="w-12 h-12 mx-auto mb-2 border-2 border-[var(--color-accent-blue)] border-t-transparent rounded-full animate-spin-ring" />
            )}

            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Global Aggregator</div>
            <div className="text-sm font-bold text-[var(--color-accent-blue)] mt-1">{activeModel}</div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-[var(--color-text-muted)]">Round</span>
                    <div className="font-bold">{currentRound}/{totalRounds}</div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">Accuracy</span>
                    <div className="font-bold text-[var(--color-accent-green)] animate-count-up">
                        {globalMetrics.accuracy ? `${(globalMetrics.accuracy * 100).toFixed(1)}%` : '—'}
                    </div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">ΔSP</span>
                    <div className="font-bold animate-count-up">
                        {globalMetrics.sp_difference != null ? globalMetrics.sp_difference.toFixed(3) : '—'}
                    </div>
                </div>
                <div>
                    <span className="text-[var(--color-text-muted)]">ΔEO</span>
                    <div className="font-bold animate-count-up">
                        {globalMetrics.eo_difference != null ? globalMetrics.eo_difference.toFixed(3) : '—'}
                    </div>
                </div>
            </div>
        </div>
    );
}
