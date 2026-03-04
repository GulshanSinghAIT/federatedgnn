import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchKnowledgeGraph } from '../../api/client';

const NODE_COLORS: Record<string, string> = {
    patient: '#38bdf8', disease: '#ef4444', symptom: '#4ade80', treatment: '#a78bfa',
};

export default function KnowledgeGraph({ hospitalId }: { hospitalId?: string }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [filters, setFilters] = useState({ patient: true, disease: true, symptom: true, treatment: true });
    const [tooltip, setTooltip] = useState<any>(null);
    const dataRef = useRef<any>(null);

    useEffect(() => {
        fetchKnowledgeGraph(hospitalId).then(data => {
            dataRef.current = data;
            renderGraph(data);
        });
    }, [hospitalId]);

    useEffect(() => {
        if (dataRef.current) renderGraph(dataRef.current);
    }, [filters]);

    const renderGraph = (raw: any) => {
        if (!svgRef.current) return;
        const data = {
            nodes: raw.nodes.filter((n: any) => filters[n.type as keyof typeof filters]),
            edges: raw.edges.filter((e: any) => {
                const src = raw.nodes.find((n: any) => n.id === e.source || n.id === e.source?.id);
                const tgt = raw.nodes.find((n: any) => n.id === e.target || n.id === e.target?.id);
                return src && tgt && filters[src.type as keyof typeof filters] && filters[tgt.type as keyof typeof filters];
            })
        };

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const g = svg.append('g');

        svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on('zoom', (e) => g.attr('transform', e.transform)) as any);

        const degreesMap: Record<string, number> = {};
        data.edges.forEach((e: any) => {
            const srcId = typeof e.source === 'object' ? e.source.id : e.source;
            const tgtId = typeof e.target === 'object' ? e.target.id : e.target;
            degreesMap[srcId] = (degreesMap[srcId] || 0) + 1;
            degreesMap[tgtId] = (degreesMap[tgtId] || 0) + 1;
        });

        const sim = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.edges).id((d: any) => d.id).distance(60))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = g.append('g').selectAll('line').data(data.edges).enter().append('line')
            .attr('stroke', '#334155').attr('stroke-width', (d: any) => Math.max(0.5, (d.weight || 0.3) * 2)).attr('stroke-opacity', 0.4);

        const node = g.append('g').selectAll('circle').data(data.nodes).enter().append('circle')
            .attr('r', (d: any) => Math.max(4, Math.min(16, 4 + (degreesMap[d.id] || 0) * 0.8)))
            .attr('fill', (d: any) => NODE_COLORS[d.type] || '#64748b')
            .attr('stroke', 'transparent').attr('stroke-width', 1.5).style('cursor', 'pointer')
            .on('mouseover', function (event, d: any) {
                d3.select(this).attr('stroke', '#fff');
                setTooltip({ x: event.pageX, y: event.pageY, node: d });
            })
            .on('mouseout', function () { d3.select(this).attr('stroke', 'transparent'); setTooltip(null); })
            .call(d3.drag<SVGCircleElement, any>()
                .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }) as any);

        sim.on('tick', () => {
            link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
            node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
        });
    };

    return (
        <div className="relative w-full h-full">
            <div className="absolute top-2 right-2 z-10 glass-card p-2 flex gap-2">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <button key={type} onClick={() => setFilters(f => ({ ...f, [type]: !f[type as keyof typeof filters] }))}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${filters[type as keyof typeof filters] ? 'opacity-100' : 'opacity-30'}`}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {type}
                    </button>
                ))}
            </div>
            <svg ref={svgRef} className="w-full h-full" />
            {tooltip && (
                <div className="fixed z-50 px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-xs shadow-lg pointer-events-none"
                    style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}>
                    <div className="font-bold" style={{ color: NODE_COLORS[tooltip.node.type] }}>{tooltip.node.type.toUpperCase()}</div>
                    <div>{tooltip.node.label}</div>
                    {tooltip.node.properties && Object.entries(tooltip.node.properties).slice(0, 3).map(([k, v]) => (
                        <div key={k} className="text-[var(--color-text-muted)]">{k}: {String(v)}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
