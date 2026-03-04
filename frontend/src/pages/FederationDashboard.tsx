import React, { useState } from 'react';
import HospitalNetwork from '../components/federation/HospitalNetwork';
import MetricsFeed from '../components/federation/MetricsFeed';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useFederationStore } from '../store/federationStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { startFederation, stopFederation, resetFederation } from '../api/client';
import { Play, Square, RotateCcw, Zap } from 'lucide-react';

const MODELS = ['FedFairGNN', 'FairGCN', 'FairGNN', 'SMPC-LP', 'all'];

export default function FederationDashboard() {
    useWebSocket();
    const { isRunning, currentRound, totalRounds, activeModel, setRunning, setRound, resetHistory } = useFederationStore();

    const [selectedModel, setSelectedModel] = useState('FedFairGNN');
    const [rounds, setRounds] = useState(10);

    const handleStart = async () => {
        try {
            resetHistory();
            setRunning(true);
            setRound(0, rounds);
            await startFederation({ model: selectedModel, rounds, hospitals: ['H1', 'H2', 'H3'] });
        } catch (err) {
            setRunning(false);
            console.error('Failed to start:', err);
        }
    };

    const handleStop = async () => {
        await stopFederation();
        setRunning(false);
    };

    const handleReset = async () => {
        await resetFederation();
        resetHistory();
        setRunning(false);
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
            {/* Top Bar */}
            <header className="border-b border-[var(--color-border)] px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Zap size={20} className="text-[var(--color-accent-blue)]" />
                            Federated Learning Network
                        </h1>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-[var(--color-text-muted)]">Round</span>
                            <span className="font-bold text-[var(--color-accent-blue)] text-lg animate-count-up">{currentRound}</span>
                            <span className="text-[var(--color-text-muted)]">/ {totalRounds || '—'}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isRunning ? 'bg-green-500/20 text-green-400' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'}`}>
                            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                            {isRunning ? 'Training' : 'Idle'}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={isRunning}
                            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] disabled:opacity-50">
                            {MODELS.map(m => <option key={m} value={m}>{m === 'all' ? 'Train All Models' : m}</option>)}
                        </select>
                        <input type="number" min={5} max={50} value={rounds} onChange={e => setRounds(parseInt(e.target.value) || 10)}
                            disabled={isRunning}
                            className="w-20 px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] disabled:opacity-50"
                            placeholder="Rounds" />

                        {!isRunning ? (
                            <button onClick={handleStart}
                                className="flex items-center gap-1 px-4 py-2 bg-[var(--color-accent-green)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-green)]/80 transition-colors">
                                <Play size={14} /> Start Federation
                            </button>
                        ) : (
                            <button onClick={handleStop}
                                className="flex items-center gap-1 px-4 py-2 bg-[var(--color-accent-red)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-red)]/80 transition-colors">
                                <Square size={14} /> Stop
                            </button>
                        )}
                        <button onClick={handleReset} disabled={isRunning}
                            className="flex items-center gap-1 px-3 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg text-sm hover:bg-[var(--color-bg-tertiary)]/80 disabled:opacity-30 transition-colors">
                            <RotateCcw size={14} /> Reset
                        </button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-4">
                {/* Top: Network + Metrics Feed */}
                <div className="grid grid-cols-12 gap-4" style={{ height: '420px' }}>
                    <div className="col-span-9 glass-card overflow-hidden">
                        <HospitalNetwork />
                    </div>
                    <div className="col-span-3">
                        <MetricsFeed />
                    </div>
                </div>

                {/* Privacy Callouts */}
                <div className="flex gap-3 text-xs">
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-[var(--color-accent-yellow)]">
                        🔒 No raw patient data transmitted — only model weights
                    </div>
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-[var(--color-accent-yellow)]">
                        🔒 SMPC simulation: σ=0.01 Gaussian noise on shared gradients
                    </div>
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-[var(--color-accent-yellow)]">
                        🔒 Sensitive attributes never leave the hospital
                    </div>
                </div>

                {/* Bottom: Charts */}
                <TrainingCharts />
            </div>
        </div>
    );
}
