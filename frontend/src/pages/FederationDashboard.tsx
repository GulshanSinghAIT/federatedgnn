import React, { useEffect, useState } from 'react';
import HospitalNetwork from '../components/federation/HospitalNetwork';
import MetricsFeed from '../components/federation/MetricsFeed';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useFederationStore } from '../store/federationStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { startFederation, stopFederation, resetFederation, fetchDatasets } from '../api/client';
import { Play, Square, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputField } from '@/components/ui/input-group';

const MODELS = ['FedFairGNN', 'FairGCN', 'FairGNN', 'SMPC-LP', 'all'];
const ENGINES = [{ id: 'sim', label: 'Simulation' }, { id: 'real', label: 'Real (PyTorch)' }];

export default function FederationDashboard() {
    useWebSocket();
    const {
        isRunning, currentRound, totalRounds, dataset, engine,
        setRunning, setRound, resetHistory, setDataset, setEngine,
    } = useFederationStore();

    const [selectedModel, setSelectedModel] = useState('FedFairGNN');
    const [rounds, setRounds] = useState(10);
    const [datasets, setDatasets] = useState<Array<{ id: string; name: string; description: string }>>([]);

    useEffect(() => {
        fetchDatasets().then(setDatasets).catch(() => {});
    }, []);

    const handleStart = async () => {
        try {
            resetHistory();
            setRunning(true);
            setRound(0, rounds);
            await startFederation({ model: selectedModel, rounds, hospitals: ['H1', 'H2', 'H3'], dataset, engine });
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
        <div className="min-h-screen shadow-xl rounded-tl-2xl bg-[var(--color-bg-primary)]">
            {/* Top Bar */}
            <header className="border-b pl-4 p-2 bg-white rounded-tl-2xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-medium tracking-tighter text-[var(--color-text-primary)] flex items-center gap-2">
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
                        <Select value={dataset} onValueChange={setDataset} disabled={isRunning}>
                            <SelectTrigger title="Benchmark dataset" />
                            <SelectContent>
                                {datasets.map((d, i) => <SelectItem key={d.id} index={i} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={engine} onValueChange={setEngine} disabled={isRunning}>
                            <SelectTrigger title="Training engine — Simulation (default) or Real PyTorch (requires requirements-ml.txt)" />
                            <SelectContent>
                                {ENGINES.map((e, i) => <SelectItem key={e.id} index={i} value={e.id}>{e.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isRunning}>
                            <SelectTrigger />
                            <SelectContent>
                                {MODELS.map((m, i) => <SelectItem key={m} index={i} value={m}>{m === 'all' ? 'Train All Models' : m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <InputGroup className="w-24">
                            <InputField hideLabel label="Rounds" index={0} type="number" min={5} max={50}
                                value={String(rounds)} onChange={v => setRounds(parseInt(v) || 10)}
                                disabled={isRunning} placeholder="Rounds" />
                        </InputGroup>

                        {!isRunning ? (
                            <Button variant="success" size="md" leadingIcon={Play} onClick={handleStart}>
                                Start Federation
                            </Button>
                        ) : (
                            <Button variant="danger" size="md" leadingIcon={Square} onClick={handleStop}>
                                Stop
                            </Button>
                        )}
                        <Button variant="tertiary" size="md" leadingIcon={RotateCcw} onClick={handleReset} disabled={isRunning}
                            className="text-[var(--color-text-secondary)]">
                            Reset
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-4 overflow-auto">
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
