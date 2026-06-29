import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { InputGroup, InputField } from '@/components/ui/input-group';
import { searchAll } from '../../api/client';

interface ResultItem {
    id: string;
    title: string;
    subtitle?: string;
    hospital_id?: string;
}
interface ResultGroup {
    type: 'patient' | 'hospital' | 'disease' | 'symptom' | 'treatment';
    label: string;
    items: ResultItem[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Server-driven global search (⌘K / Ctrl+K). Searches patients (across every
 * hospital DB), hospitals, and the knowledge graph (diseases / symptoms /
 * treatments) via GET /api/search, and navigates to the matched entity.
 */
export default function GlobalSearch() {
    const [q, setQ] = useState('');
    const [groups, setGroups] = useState<ResultGroup[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const wrapRef = useRef<HTMLDivElement>(null);

    // Debounced server query.
    useEffect(() => {
        const query = q.trim();
        if (!query) { setGroups([]); setLoading(false); return; }
        setLoading(true);
        const t = setTimeout(() => {
            searchAll(query)
                .then(d => { setGroups(d.groups || []); setOpen(true); })
                .catch(() => setGroups([]))
                .finally(() => setLoading(false));
        }, 200);
        return () => clearTimeout(t);
    }, [q]);

    // ⌘K / Ctrl+K to focus, Esc to close.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                wrapRef.current?.querySelector('input')?.focus();
                if (q.trim()) setOpen(true);
            } else if (e.key === 'Escape') {
                setOpen(false);
                (document.activeElement as HTMLElement)?.blur();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [q]);

    // Close on outside click.
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const go = (type: ResultGroup['type'], item: ResultItem) => {
        setOpen(false);
        setQ('');
        if (type === 'patient') navigate(`/hospital/${item.hospital_id}/patients/${item.id}`);
        else if (type === 'hospital') navigate(`/hospital/${item.hospital_id}/dashboard`);
        else navigate(`/hospital/H1/dashboard?tab=graph`); // KG entities → knowledge graph
    };

    const hasResults = groups.some(g => g.items.length > 0);

    return (
        <div ref={wrapRef} className="relative w-full max-w-xl">
            <div className="relative">
                <InputGroup className="w-full">
                    <InputField
                        hideLabel
                        label="Global search"
                        index={0}
                        icon={Search}
                        value={q}
                        onChange={setQ}
                        onFocus={() => q.trim() && setOpen(true)}
                        placeholder="Search patients, diseases, symptoms, treatments…"
                        className="bg-white hover:bg-accent rounded-md"
                    />
                </InputGroup>
                <kbd className="font-mono absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none select-none text-[11px] text-text-muted border border-border rounded px-1.5 py-0.5 bg-bg-primary">
                    {isMac ? '⌘' : 'Ctrl'} K
                </kbd>
            </div>

            {open && q.trim() && (
                <div className="absolute z-50 mt-2 w-full bg-surface border border-border rounded-lg shadow-surface-3 max-h-96 overflow-y-auto p-1">
                    {loading && <div className="px-3 py-3 text-sm text-text-muted">Searching…</div>}
                    {!loading && !hasResults && (
                        <div className="px-3 py-3 text-sm text-text-muted">No results for "{q}"</div>
                    )}
                    {!loading && groups.map(g => (
                        <div key={g.type} className="mb-1 last:mb-0">
                            <div className="eyebrow px-3 pt-2 pb-1">{g.label}</div>
                            {g.items.map(it => (
                                <button
                                    key={g.type + it.id}
                                    onClick={() => go(g.type, it)}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-hover transition-colors flex flex-col gap-0.5">
                                    <span className="text-sm text-text-primary">{it.title}</span>
                                    {it.subtitle && <span className="text-xs text-text-muted">{it.subtitle}</span>}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
