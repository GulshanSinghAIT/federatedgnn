import React from 'react';
import ModelComparison from '../components/metrics/ModelComparison';
import DemographicHeatmap from '../components/metrics/DemographicHeatmap';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useWebSocket } from '../hooks/useWebSocket';
import PageHeader from '../components/layout/PageHeader';

export default function MetricsDashboard() {
    useWebSocket();

    return (
        <div className="h-full flex flex-col shadow-xl rounded-tl-2xl bg-bg-primary">
            <PageHeader
                title="Research Metrics & Evaluation"
                subtitle="Compare model performance, fairness metrics, and demographic breakdowns across federated training"
            />

            <main className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                <ModelComparison />
                <TrainingCharts />
                <DemographicHeatmap />
            </main>
        </div>
    );
}
