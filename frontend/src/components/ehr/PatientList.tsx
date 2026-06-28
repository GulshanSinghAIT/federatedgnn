import React, { useEffect, useState, useMemo } from 'react';
import { fetchPatients } from '../../api/client';
import { usePatientStore, Patient } from '../../store/patientStore';
import { Search, Filter, Users } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { InputGroup, InputField } from '@/components/ui/input-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface Props {
    hospitalId: string;
    onSelectPatient: (id: string) => void;
}

export default function PatientList({ hospitalId, onSelectPatient }: Props) {
    const { patients, setPatients, setLoading, loading } = usePatientStore();
    const [search, setSearch] = useState('');
    const [filterAge, setFilterAge] = useState('');
    const [filterEthnicity, setFilterEthnicity] = useState('');

    useEffect(() => {
        setLoading(true);
        fetchPatients(hospitalId).then(data => {
            setPatients(data);
            setLoading(false);
        });
    }, [hospitalId]);

    const filtered = useMemo(() => {
        let list = patients;
        if (filterAge) list = list.filter(p => p.age_group === filterAge);
        if (filterEthnicity) list = list.filter(p => p.ethnicity === filterEthnicity);
        if (search) list = list.filter(p => p.id.includes(search) || p.chief_complaint?.toLowerCase().includes(search.toLowerCase()));
        return list;
    }, [patients, search, filterAge, filterEthnicity]);

    const fairnessColor = (flag: string) => {
        if (flag === 'green') return 'bg-accent-green';
        if (flag === 'yellow') return 'bg-accent-yellow';
        return 'bg-accent-red';
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <InputGroup className="flex-1 w-auto">
                    <InputField hideLabel label="Search" index={0} value={search} onChange={setSearch} placeholder="Search by ID or complaint..." icon={Search} />
                </InputGroup>
                <Select value={filterAge} onValueChange={setFilterAge}>
                    <SelectTrigger placeholder="All Ages" />
                    <SelectContent>
                        <SelectItem index={0} value="">All Ages</SelectItem>
                        <SelectItem index={1} value="Pediatric (<18)">Pediatric</SelectItem>
                        <SelectItem index={2} value="Young Adult (18-35)">Young Adult</SelectItem>
                        <SelectItem index={3} value="Middle-Aged (36-60)">Middle-Aged</SelectItem>
                        <SelectItem index={4} value="Senior (60+)">Senior</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterEthnicity} onValueChange={setFilterEthnicity}>
                    <SelectTrigger placeholder="All Ethnicities" />
                    <SelectContent>
                        <SelectItem index={0} value="">All Ethnicities</SelectItem>
                        <SelectItem index={1} value="Asian">Asian</SelectItem>
                        <SelectItem index={2} value="Black / African American">Black</SelectItem>
                        <SelectItem index={3} value="Hispanic / Latino">Hispanic</SelectItem>
                        <SelectItem index={4} value="White / Caucasian">White</SelectItem>
                        <SelectItem index={5} value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-muted">
                <Users size={14} />
                <span>{filtered.length} patients</span>
            </div>

            {loading ? (
                <div className="text-center py-8 text-text-muted">Loading patients...</div>
            ) : (
                <div className="overflow-x-auto border rounded-lg">
                    <Table>
                        <TableHeader className='bg-muted-foreground/10'>
                            <TableRow>
                                <TableHead className="text-text-muted font-medium text-xs uppercase tracking-wider">Patient ID</TableHead>
                                <TableHead className="text-text-muted font-medium text-xs uppercase tracking-wider">Age Group</TableHead>
                                <TableHead className="text-text-muted font-medium text-xs uppercase tracking-wider">Ethnicity</TableHead>
                                <TableHead className="text-center text-text-muted font-medium text-xs uppercase tracking-wider">Symptoms</TableHead>
                                <TableHead className="text-text-muted font-medium text-xs uppercase tracking-wider">Predicted Disease</TableHead>
                                <TableHead className="text-center text-text-muted font-medium text-xs uppercase tracking-wider">Confidence</TableHead>
                                <TableHead className="text-center text-text-muted font-medium text-xs uppercase tracking-wider">Fairness</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((p, i) => {
                                const topDisease = p.diseases?.[0];
                                return (
                                    <TableRow key={p.id} index={i} onClick={() => onSelectPatient(p.id)}
                                        className="cursor-pointer transition-colors">
                                        <TableCell className="font-mono text-xs text-accent-blue">{p.id.slice(0, 8)}...</TableCell>
                                        <TableCell>{p.age_group}</TableCell>
                                        <TableCell>{p.ethnicity}</TableCell>
                                        <TableCell className="text-center">{p.symptoms?.length || 0}</TableCell>
                                        <TableCell>{topDisease?.disease_name || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            {topDisease ? (
                                                <span className={`font-medium ${topDisease.confidence > 0.8 ? 'text-accent-green' : topDisease.confidence > 0.5 ? 'text-accent-yellow' : 'text-accent-orange'}`}>
                                                    {(topDisease.confidence * 100).toFixed(1)}%
                                                </span>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto ${fairnessColor(p.fairness_flag)}`} title={p.fairness_flag} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
