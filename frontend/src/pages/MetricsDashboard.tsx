import React from 'react';
import ModelComparison from '../components/metrics/ModelComparison';
import DemographicHeatmap from '../components/metrics/DemographicHeatmap';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useWebSocket } from '../hooks/useWebSocket';
import { BarChart3 } from 'lucide-react';

export default function MetricsDashboard() {
    useWebSocket();

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
            <header className="border-b border-[var(--color-border)] px-6 py-4">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <BarChart3 size={20} className="text-[var(--color-accent-blue)]" />
                    Research Metrics & Evaluation
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Compare model performance, fairness metrics, and demographic breakdowns across federated training
                </p>
            </header>

            <main className="p-6 space-y-6">
                <ModelComparison />
                <TrainingCharts />
                <DemographicHeatmap />
            </main>
        </div>
    );
}
