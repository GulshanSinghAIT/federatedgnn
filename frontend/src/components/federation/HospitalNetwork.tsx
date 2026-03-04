import React, { useCallback, useState } from 'react';
import ReactFlow, { Controls, Background, Node, Edge, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import HospitalNode from './HospitalNode';
import AggregatorNode from './AggregatorNode';
import { useFederationStore } from '../../store/federationStore';
import { fetchDemographics } from '../../api/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const nodeTypes = { hospital: HospitalNode, aggregator: AggregatorNode };

const DEMO_COLORS = ['#38bdf8', '#a78bfa', '#2dd4bf', '#fbbf24', '#ef4444', '#fb923c', '#4ade80'];

export default function HospitalNetwork() {
    const { isRunning } = useFederationStore();
    const [demoPanel, setDemoPanel] = useState<any>(null);

    const handleHospitalClick = async (hospitalId: string) => {
        try {
            const data = await fetchDemographics(hospitalId);
            setDemoPanel(data);
        } catch (err) {
            console.error('Failed to load demographics:', err);
        }
    };

    const nodes: Node[] = [
        { id: 'H1', type: 'hospital', position: { x: 50, y: 20 }, data: { hospitalId: 'H1', name: 'City General Hospital', color: '#38bdf8', onClick: handleHospitalClick } },
        { id: 'H2', type: 'hospital', position: { x: 300, y: 20 }, data: { hospitalId: 'H2', name: 'Metro Regional Medical Center', color: '#a78bfa', onClick: handleHospitalClick } },
        { id: 'H3', type: 'hospital', position: { x: 550, y: 20 }, data: { hospitalId: 'H3', name: 'Community Health Clinic', color: '#2dd4bf', onClick: handleHospitalClick } },
        { id: 'aggregator', type: 'aggregator', position: { x: 275, y: 250 }, data: {} },
    ];

    const edges: Edge[] = [
        { id: 'H1-agg', source: 'H1', target: 'aggregator', animated: isRunning, style: { stroke: '#38bdf8', strokeWidth: 2, strokeDasharray: isRunning ? '5 5' : 'none' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' } },
        { id: 'H2-agg', source: 'H2', target: 'aggregator', animated: isRunning, style: { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: isRunning ? '5 5' : 'none' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' } },
        { id: 'H3-agg', source: 'H3', target: 'aggregator', animated: isRunning, style: { stroke: '#2dd4bf', strokeWidth: 2, strokeDasharray: isRunning ? '5 5' : 'none' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#2dd4bf' } },
    ];

    return (
        <div className="relative h-full">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}>
                <Background color="#334155" gap={20} size={1} />
                <Controls style={{ background: '#1e293b', borderColor: '#334155' }} />
            </ReactFlow>

            {/* Demographics Slide-out Panel */}
            {demoPanel && (
                <div className="absolute top-0 right-0 w-80 h-full glass-card p-4 overflow-y-auto animate-slide-in z-50">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            🔒 Demographics — {demoPanel.hospital_id}
                        </h3>
                        <button onClick={() => setDemoPanel(null)} className="text-[var(--color-text-muted)] hover:text-white">✕</button>
                    </div>

                    <p className="text-[10px] text-[var(--color-accent-yellow)] mb-3 italic">
                        Sensitive attributes are stored locally. Only model weights are transmitted.
                    </p>

                    {/* Age Groups Pie */}
                    <div className="mb-4">
                        <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Age Distribution</h4>
                        <ResponsiveContainer width="100%" height={140}>
                            <PieChart>
                                <Pie data={Object.entries(demoPanel.age_groups || {}).map(([k, v]) => ({ name: k, value: v as number }))}
                                    cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({ name, percent }) => `${(name as string).split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                                    labelLine={false} style={{ fontSize: '8px' }}>
                                    {Object.keys(demoPanel.age_groups || {}).map((_, i) => (
                                        <Cell key={i} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Ethnicity Pie */}
                    <div className="mb-4">
                        <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Ethnicity Distribution</h4>
                        <ResponsiveContainer width="100%" height={140}>
                            <PieChart>
                                <Pie data={Object.entries(demoPanel.ethnicities || {}).map(([k, v]) => ({ name: k, value: v as number }))}
                                    cx="50%" cy="50%" outerRadius={50} dataKey="value" label={({ name, percent }) => `${(name as string).split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                                    labelLine={false} style={{ fontSize: '8px' }}>
                                    {Object.keys(demoPanel.ethnicities || {}).map((_, i) => (
                                        <Cell key={i} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Per-group accuracy */}
                    {Object.keys(demoPanel.per_group_accuracy || {}).length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Per-Group Prediction Accuracy</h4>
                            <ResponsiveContainer width="100%" height={120}>
                                <BarChart data={Object.entries(demoPanel.per_group_accuracy).map(([k, v]) => ({ group: k.split('|')[0], accuracy: v as number }))}>
                                    <XAxis dataKey="group" tick={{ fill: '#64748b', fontSize: 8 }} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 8 }} domain={[0, 1]} />
                                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 10 }} />
                                    <Bar dataKey="accuracy" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {demoPanel.fairness_gap != null && (
                        <div className="text-xs text-[var(--color-text-muted)]">
                            <strong>Fairness Gap:</strong> <span className={`font-bold ${demoPanel.fairness_gap > 0.1 ? 'text-[var(--color-accent-red)]' : 'text-[var(--color-accent-green)]'}`}>
                                {demoPanel.fairness_gap.toFixed(4)}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
