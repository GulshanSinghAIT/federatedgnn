import React, { useRef, useEffect } from 'react';
import { useFederationStore } from '../../store/federationStore';

export default function MetricsFeed() {
    const events = useFederationStore(s => s.wsEvents);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events.length]);

    const eventColor = (type: string) => {
        if (type === 'global') return 'text-accent-blue';
        if (type === 'hospital') return 'text-accent-green';
        return 'text-accent-yellow';
    };

    return (
        <div className="glass-card p-4 h-full flex flex-col">
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Live Metrics Feed</h3>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-xs">
                {events.length === 0 && (
                    <div className="text-text-muted text-center py-4">Waiting for training events...</div>
                )}
                {events.map((e, i) => (
                    <div key={i} className={`animate-slide-in ${eventColor(e.type)}`}>
                        <span className="text-text-muted">[{e.timestamp}]</span> {e.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
