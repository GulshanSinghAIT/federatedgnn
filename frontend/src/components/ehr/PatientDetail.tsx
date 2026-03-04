import React, { useEffect, useState } from 'react';
import { fetchPatient, fetchPrediction } from '../../api/client';
import { Patient } from '../../store/patientStore';
import PatientSubgraph from '../graph/PatientSubgraph';
import DiagnosisPanel from '../decision/DiagnosisPanel';
import TreatmentPanel from '../decision/TreatmentPanel';
import FairnessAudit from '../decision/FairnessAudit';
import { Lock, Heart, Thermometer, Wind, Activity } from 'lucide-react';

interface Props {
    hospitalId: string;
    patientId: string;
    onBack: () => void;
}

export default function PatientDetail({ hospitalId, patientId, onBack }: Props) {
    const [patient, setPatient] = useState<Patient | null>(null);
    const [prediction, setPrediction] = useState<any>(null);

    useEffect(() => {
        fetchPatient(hospitalId, patientId).then(setPatient);
        fetchPrediction(hospitalId, patientId).then(setPrediction).catch(() => { });
    }, [hospitalId, patientId]);

    if (!patient) return <div className="text-center py-8 text-[var(--color-text-muted)]">Loading patient...</div>;

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="text-sm text-[var(--color-accent-blue)] hover:underline">← Back to Patient List</button>

            <div className="grid grid-cols-12 gap-4">
                {/* Left Panel - Demographics */}
                <div className="col-span-3 space-y-4">
                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Lock size={14} className="text-[var(--color-accent-yellow)]" />
                            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Demographics</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                            <p><span className="text-[var(--color-text-muted)]">ID:</span> <span className="font-mono text-[var(--color-accent-blue)]">{patient.id.slice(0, 12)}...</span></p>
                            <p><span className="text-[var(--color-text-muted)]">Age:</span> {patient.age_group}</p>
                            <p><span className="text-[var(--color-text-muted)]">Sex:</span> {patient.sex}</p>
                            <p><span className="text-[var(--color-text-muted)]">Ethnicity:</span> {patient.ethnicity}</p>
                            <p><span className="text-[var(--color-text-muted)]">SES:</span> {patient.ses}</p>
                        </div>
                    </div>

                    <div className="glass-card p-4">
                        <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Vital Signs</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2"><Heart size={12} className="text-[var(--color-accent-red)]" /> <span>{patient.heart_rate || '-'} bpm</span></div>
                            <div className="flex items-center gap-2"><Activity size={12} className="text-[var(--color-accent-blue)]" /> <span>{patient.bp_systolic || '-'}/{patient.bp_diastolic || '-'} mmHg</span></div>
                            <div className="flex items-center gap-2"><Thermometer size={12} className="text-[var(--color-accent-orange)]" /> <span>{patient.temperature || '-'} °C</span></div>
                            <div className="flex items-center gap-2"><Wind size={12} className="text-[var(--color-accent-teal)]" /> <span>SpO₂: {patient.spo2 || '-'}%</span></div>
                            <div className="flex items-center gap-2"><Wind size={12} className="text-[var(--color-accent-green)]" /> <span>RR: {patient.respiratory_rate || '-'}/min</span></div>
                        </div>
                    </div>

                    {patient.chief_complaint && (
                        <div className="glass-card p-4">
                            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Chief Complaint</h3>
                            <p className="text-sm">{patient.chief_complaint}</p>
                        </div>
                    )}

                    <div className="glass-card p-4">
                        <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Symptoms ({patient.symptoms.length})</h3>
                        <div className="space-y-1">
                            {patient.symptoms.map(s => (
                                <div key={s.symptom_id} className="flex justify-between text-xs">
                                    <span className="text-[var(--color-node-symptom)]">{s.symptom_name}</span>
                                    <span className="text-[var(--color-text-muted)]">{s.severity}/10</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center Panel - Knowledge Graph */}
                <div className="col-span-5">
                    <div className="glass-card p-4 h-[500px]">
                        <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Patient Knowledge Graph</h3>
                        <PatientSubgraph patientId={patientId} hospitalId={hospitalId} />
                    </div>
                </div>

                {/* Right Panel - Decision Support */}
                <div className="col-span-4 space-y-4">
                    {prediction && (
                        <>
                            <FairnessAudit
                                fairnessCheck={prediction.fairness_check}
                                explanation={prediction.fairness_explanation}
                                confidence={prediction.model_confidence}
                                uncertainty={prediction.uncertainty}
                            />
                            <DiagnosisPanel diagnoses={prediction.diagnoses} />
                            <TreatmentPanel treatments={prediction.treatments} diagnoses={prediction.diagnoses} />
                            <div className="glass-card p-3">
                                <p className="text-xs text-[var(--color-accent-yellow)] italic">{prediction.disclaimer}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
