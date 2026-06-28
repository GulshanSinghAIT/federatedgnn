import React from 'react';
import ModelComparison from '../components/metrics/ModelComparison';
import DemographicHeatmap from '../components/metrics/DemographicHeatmap';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useWebSocket } from '../hooks/useWebSocket';
import { BarChart3 } from 'lucide-react';

export default function MetricsDashboard() {
    useWebSocket();

    return (
        <div className="min-h-screen shadow-xl rounded-tl-2xl bg-[var(--color-bg-primary)]">
            <header className="border-b pl-4 p-2 bg-white rounded-tl-2xl">
                <h1 className="text-xl font-medium tracking-tighter text-[var(--color-text-primary)] flex items-center gap-2">
                    <BarChart3 size={20} className="text-accent-blue" />
                    Research Metrics & Evaluation
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Compare model performance, fairness metrics, and demographic breakdowns across federated training
                </p>
            </header>

            <main className="p-6 space-y-6 overflow-hidden">
                <ModelComparison />
                <TrainingCharts />
                <DemographicHeatmap />
            </main>
        </div>
    );
}
