import React from 'react';
import ModelComparison from '../components/metrics/ModelComparison';
import DemographicHeatmap from '../components/metrics/DemographicHeatmap';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useWebSocket } from '../hooks/useWebSocket';
import { BarChart3 } from 'lucide-react';

export default function MetricsDashboard() {
    useWebSocket();

    return (
        <div className="h-full flex flex-col shadow-xl rounded-tl-2xl bg-bg-primary">
            <header className="shrink-0 border-b pl-4 p-2 bg-white rounded-tl-2xl">
                <h1 className="text-xl font-medium tracking-tighter text-text-primary flex items-center gap-2">
                    <BarChart3 size={20} className="text-accent-blue" />
                    Research Metrics & Evaluation
                </h1>
                <p className="text-xs text-text-muted mt-1">
                    Compare model performance, fairness metrics, and demographic breakdowns across federated training
                </p>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <ModelComparison />
                <TrainingCharts />
                <DemographicHeatmap />
            </main>
        </div>
    );
}
