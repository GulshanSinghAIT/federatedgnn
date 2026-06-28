import React, { useState } from 'react';
import SymptomSelector from './SymptomSelector';
import { createPatient } from '../../api/client';
import { usePatientStore } from '../../store/patientStore';
import { Lock, ChevronRight, ChevronLeft, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputField } from '@/components/ui/input-group';

const AGE_GROUPS = ['Pediatric (<18)', 'Young Adult (18-35)', 'Middle-Aged (36-60)', 'Senior (60+)'];
const SEXES = ['Male', 'Female', 'Non-binary / Other', 'Prefer not to say'];
const ETHNICITIES = ['Asian', 'Black / African American', 'Hispanic / Latino', 'White / Caucasian', 'Mixed', 'Other', 'Prefer not to say'];
const SES_OPTIONS = ['Low', 'Middle', 'High', 'Unknown'];

interface Props {
    hospitalId: string;
    onComplete: () => void;
}

const STEPS = ['Demographics', 'Clinical Presentation', 'History & Comorbidities', 'Review & Submit'];

export default function PatientForm({ hospitalId, onComplete }: Props) {
    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const { addPatient } = usePatientStore();

    const [form, setForm] = useState({
        age_group: '', sex: '', ethnicity: '', ses: 'Unknown',
        chief_complaint: '',
        symptoms: [] as any[],
        heart_rate: '', bp_systolic: '', bp_diastolic: '',
        temperature: '', spo2: '', respiratory_rate: '',
        pre_existing_conditions: [] as string[],
        current_medications: [] as string[],
        allergies: [] as string[],
        surgical_history: '',
    });

    const [tagInput, setTagInput] = useState({ conditions: '', medications: '', allergies: '' });

    const update = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

    const addTag = (field: 'pre_existing_conditions' | 'current_medications' | 'allergies', inputKey: 'conditions' | 'medications' | 'allergies') => {
        const val = tagInput[inputKey].trim();
        if (val && !form[field].includes(val)) {
            update(field, [...form[field], val]);
            setTagInput(t => ({ ...t, [inputKey]: '' }));
        }
    };

    const removeTag = (field: 'pre_existing_conditions' | 'current_medications' | 'allergies', val: string) => {
        update(field, form[field].filter((t: string) => t !== val));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                heart_rate: form.heart_rate ? parseFloat(form.heart_rate) : null,
                bp_systolic: form.bp_systolic ? parseFloat(form.bp_systolic) : null,
                bp_diastolic: form.bp_diastolic ? parseFloat(form.bp_diastolic) : null,
                temperature: form.temperature ? parseFloat(form.temperature) : null,
                spo2: form.spo2 ? parseFloat(form.spo2) : null,
                respiratory_rate: form.respiratory_rate ? parseFloat(form.respiratory_rate) : null,
                symptoms: form.symptoms.map((s: any) => ({
                    symptom_id: s.symptom_id, severity: s.severity, onset_date: s.onset_date
                })),
            };
            const result = await createPatient(hospitalId, payload);
            addPatient(result);
            onComplete();
        } catch (err) {
            console.error('Failed to create patient:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const renderTagInput = (label: string, field: 'pre_existing_conditions' | 'current_medications' | 'allergies', inputKey: 'conditions' | 'medications' | 'allergies') => (
        <div>
            <div className="flex gap-2 items-end">
                <InputGroup className="flex-1 w-auto">
                    <InputField label={label} index={0}
                        value={tagInput[inputKey]} onChange={v => setTagInput(t => ({ ...t, [inputKey]: v }))}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag(field, inputKey))}
                        placeholder={`Add ${label.toLowerCase()}...`} />
                </InputGroup>
                <Button variant="ghost" onClick={() => addTag(field, inputKey)} className="text-white" style={{ backgroundColor: 'var(--color-accent-blue)' }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
                {form[field].map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-xs rounded-full flex items-center gap-1">
                        {tag}
                        <Button size="icon-sm" variant="ghost" onClick={() => removeTag(field, tag)} className="text-[var(--color-accent-red)] hover:text-red-400">✕</Button>
                    </span>
                ))}
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto">
            {/* Step Indicator */}
            <div className="flex items-center mb-8">
                {STEPS.map((s, i) => (
                    <React.Fragment key={s}>
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => i <= step && setStep(i)}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i < step ? 'bg-[var(--color-accent-green)] text-white' : i === step ? 'bg-[var(--color-accent-blue)] text-white animate-pulse-glow' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'}`}>
                                {i < step ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`text-xs hidden sm:block ${i === step ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{s}</span>
                        </div>
                        {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-[var(--color-accent-green)]' : 'bg-[var(--color-border)]'}`} />}
                    </React.Fragment>
                ))}
            </div>

            <div className="glass-card p-6 animate-fade-in">
                {/* Step 1: Demographics */}
                {step === 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Lock size={16} className="text-[var(--color-accent-yellow)]" />
                            <span className="text-xs text-[var(--color-accent-yellow)]">Demographic fields are used only for fairness evaluation. They are never transmitted during federated learning.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Age Group *</label>
                                <Select value={form.age_group} onValueChange={v => update('age_group', v)}>
                                    <SelectTrigger placeholder="Select..." className="w-full" />
                                    <SelectContent>
                                        <SelectItem index={0} value="">Select...</SelectItem>
                                        {AGE_GROUPS.map((a, i) => <SelectItem key={a} index={i + 1} value={a}>{a}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Sex *</label>
                                <Select value={form.sex} onValueChange={v => update('sex', v)}>
                                    <SelectTrigger placeholder="Select..." className="w-full" />
                                    <SelectContent>
                                        <SelectItem index={0} value="">Select...</SelectItem>
                                        {SEXES.map((s, i) => <SelectItem key={s} index={i + 1} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Ethnicity *</label>
                                <Select value={form.ethnicity} onValueChange={v => update('ethnicity', v)}>
                                    <SelectTrigger placeholder="Select..." className="w-full" />
                                    <SelectContent>
                                        <SelectItem index={0} value="">Select...</SelectItem>
                                        {ETHNICITIES.map((e, i) => <SelectItem key={e} index={i + 1} value={e}>{e}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Socioeconomic Status</label>
                                <Select value={form.ses} onValueChange={v => update('ses', v)}>
                                    <SelectTrigger placeholder="Select..." className="w-full" />
                                    <SelectContent>
                                        {SES_OPTIONS.map((s, i) => <SelectItem key={s} index={i} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Clinical Presentation */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <InputGroup className="w-full">
                                <InputField label="Chief Complaint" index={0}
                                    value={form.chief_complaint} onChange={v => update('chief_complaint', v.slice(0, 200))}
                                    placeholder="Describe the chief complaint..." maxLength={200} />
                            </InputGroup>
                            <span className="text-xs text-[var(--color-text-muted)]">{form.chief_complaint.length}/200</span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Symptoms</label>
                            <SymptomSelector selected={form.symptoms} onChange={s => update('symptoms', s)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Vital Signs</label>
                            <InputGroup className="grid grid-cols-3 gap-3 w-full">
                                {[
                                    { key: 'heart_rate', label: 'Heart Rate (bpm)', ph: '72' },
                                    { key: 'bp_systolic', label: 'BP Systolic (mmHg)', ph: '120' },
                                    { key: 'bp_diastolic', label: 'BP Diastolic (mmHg)', ph: '80' },
                                    { key: 'temperature', label: 'Temperature (°C)', ph: '36.8' },
                                    { key: 'spo2', label: 'SpO₂ (%)', ph: '97' },
                                    { key: 'respiratory_rate', label: 'Resp. Rate (/min)', ph: '16' },
                                ].map((v, i) => (
                                    <InputField key={v.key} label={v.label} index={i}
                                        type="number" value={(form as any)[v.key]} onChange={val => update(v.key, val)}
                                        placeholder={v.ph} />
                                ))}
                            </InputGroup>
                        </div>
                    </div>
                )}

                {/* Step 3: History */}
                {step === 2 && (
                    <div className="space-y-4">
                        {renderTagInput('Pre-existing Conditions', 'pre_existing_conditions', 'conditions')}
                        {renderTagInput('Current Medications', 'current_medications', 'medications')}
                        {renderTagInput('Allergies', 'allergies', 'allergies')}
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Surgical History</label>
                            <textarea value={form.surgical_history} onChange={e => update('surgical_history', e.target.value)}
                                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-blue)] focus:outline-none h-24 resize-none"
                                placeholder="Describe prior surgeries..." />
                        </div>
                    </div>
                )}

                {/* Step 4: Review */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-[var(--color-accent-blue)]">Review Patient Data</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="glass-card p-3">
                                <h4 className="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1"><Lock size={10} /> Demographics</h4>
                                <p><strong>Age:</strong> {form.age_group}</p>
                                <p><strong>Sex:</strong> {form.sex}</p>
                                <p><strong>Ethnicity:</strong> {form.ethnicity}</p>
                                <p><strong>SES:</strong> {form.ses}</p>
                            </div>
                            <div className="glass-card p-3">
                                <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Vitals</h4>
                                <p><strong>HR:</strong> {form.heart_rate || '-'} bpm</p>
                                <p><strong>BP:</strong> {form.bp_systolic || '-'}/{form.bp_diastolic || '-'} mmHg</p>
                                <p><strong>Temp:</strong> {form.temperature || '-'} °C</p>
                                <p><strong>SpO₂:</strong> {form.spo2 || '-'}%</p>
                            </div>
                        </div>
                        {form.chief_complaint && (
                            <div className="glass-card p-3">
                                <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Chief Complaint</h4>
                                <p className="text-sm">{form.chief_complaint}</p>
                            </div>
                        )}
                        <div className="glass-card p-3">
                            <h4 className="text-xs text-[var(--color-text-muted)] mb-1">Symptoms ({form.symptoms.length})</h4>
                            <div className="flex flex-wrap gap-1">
                                {form.symptoms.map((s: any) => (
                                    <span key={s.symptom_id} className="px-2 py-1 bg-[var(--color-node-symptom)]/20 text-[var(--color-node-symptom)] text-xs rounded-full">
                                        {s.name} (severity: {s.severity})
                                    </span>
                                ))}
                            </div>
                        </div>
                        {(form.pre_existing_conditions.length > 0 || form.current_medications.length > 0 || form.allergies.length > 0) && (
                            <div className="glass-card p-3">
                                <h4 className="text-xs text-[var(--color-text-muted)] mb-1">History</h4>
                                {form.pre_existing_conditions.length > 0 && <p className="text-sm"><strong>Conditions:</strong> {form.pre_existing_conditions.join(', ')}</p>}
                                {form.current_medications.length > 0 && <p className="text-sm"><strong>Medications:</strong> {form.current_medications.join(', ')}</p>}
                                {form.allergies.length > 0 && <p className="text-sm"><strong>Allergies:</strong> {form.allergies.join(', ')}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
                    <Button variant="tertiary" leadingIcon={ChevronLeft} onClick={() => setStep(s => s - 1)} disabled={step === 0}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        Back
                    </Button>
                    {step < 3 ? (
                        <Button variant="ghost" trailingIcon={ChevronRight} onClick={() => setStep(s => s + 1)}
                            disabled={step === 0 && (!form.age_group || !form.sex || !form.ethnicity)}
                            className="text-white font-medium" style={{ backgroundColor: 'var(--color-accent-blue)' }}>
                            Next
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={handleSubmit} disabled={submitting}
                            className="text-white font-medium" style={{ backgroundColor: 'var(--color-accent-green)' }}>
                            {submitting ? 'Submitting...' : '✓ Submit Patient'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
