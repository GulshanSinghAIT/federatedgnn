import React, { useEffect, useState } from 'react';
import HospitalNetwork from '../components/federation/HospitalNetwork';
import MetricsFeed from '../components/federation/MetricsFeed';
import TrainingCharts from '../components/federation/TrainingCharts';
import { useFederationStore } from '../store/federationStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { startFederation, stopFederation, resetFederation, fetchDatasets } from '../api/client';
import { Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputField } from '@/components/ui/input-group';
import PageHeader from '../components/layout/PageHeader';

const MODELS = ['FedFairGNN', 'FairGCN', 'FairGNN', 'SMPC-LP', 'all'];
const ENGINES = [{ id: 'sim', label: 'Simulation' }, { id: 'real', label: 'Real (trained on data)' }];

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
        <div className="h-full flex flex-col shadow-xl rounded-tl-2xl bg-bg-primary">
            <PageHeader
                title="Federated Learning Network"
                subtitle={
                    <span className="flex items-center gap-3">
                        <span>Round <b className="font-medium text-accent-blue animate-count-up">{currentRound}</b> / {totalRounds || '—'}</span>
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${isRunning ? 'bg-green-500/20 text-green-600' : 'bg-bg-tertiary text-text-muted'}`}>
                            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            {isRunning ? 'Training' : 'Idle'}
                        </span>
                    </span>
                }
                actions={
                    <>
                        <Select value={dataset} onValueChange={setDataset} disabled={isRunning}>
                            <SelectTrigger title="Benchmark dataset" />
                            <SelectContent>
                                {datasets.map((d, i) => <SelectItem key={d.id} index={i} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={engine} onValueChange={setEngine} disabled={isRunning}>
                            <SelectTrigger title="Training engine — Simulation (convergence curves) or Real (numpy model trained on the MedGraph-S dataset)" />
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
                            className="text-text-secondary">
                            Reset
                        </Button>
                    </>
                }
            />

            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {/* Top: Network + Metrics Feed */}
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-9 h-full max-h-120 glass-card overflow-hidden">
                        <HospitalNetwork />
                    </div>
                    <div className="col-span-3 h-full min-h-120 max-h-120">
                        <MetricsFeed />
                    </div>
                </div>

                {/* Privacy Callouts */}
                <div className="flex gap-3 text-xs">
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-accent-yellow">
                        🔒 No raw patient data transmitted — only model weights
                    </div>
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-accent-yellow">
                        🔒 SMPC simulation: σ=0.01 Gaussian noise on shared gradients
                    </div>
                    <div className="glass-card px-3 py-2 flex items-center gap-2 text-accent-yellow">
                        🔒 Sensitive attributes never leave the hospital
                    </div>
                </div>

                {/* Bottom: Charts */}
                <TrainingCharts />
            </div>
        </div>
    );
}
