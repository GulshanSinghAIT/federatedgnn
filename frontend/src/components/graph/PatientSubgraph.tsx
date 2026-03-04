import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchPatientGraph } from '../../api/client';

interface Props {
    patientId: string;
    hospitalId: string;
}

const NODE_COLORS: Record<string, string> = {
    patient: '#38bdf8',
    disease: '#ef4444',
    symptom: '#4ade80',
    treatment: '#a78bfa',
};

export default function PatientSubgraph({ patientId, hospitalId }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    useEffect(() => {
        fetchPatientGraph(patientId, hospitalId).then(data => {
            if (!svgRef.current || !data.nodes?.length) return;
            renderGraph(data);
        });
    }, [patientId, hospitalId]);

    const renderGraph = (data: { nodes: any[]; edges: any[] }) => {
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = svgRef.current!.clientWidth;
        const height = svgRef.current!.clientHeight;

        const g = svg.append('g');

        // Zoom
        svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on('zoom', (event) => {
            g.attr('transform', event.transform);
        }) as any);

        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.edges).id((d: any) => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(25));

        const link = g.append('g')
            .selectAll('line')
            .data(data.edges)
            .enter().append('line')
            .attr('stroke', '#334155')
            .attr('stroke-width', (d: any) => Math.max(1, (d.weight || 0.5) * 3))
            .attr('stroke-opacity', 0.6);

        const nodeGroup = g.append('g')
            .selectAll('g')
            .data(data.nodes)
            .enter().append('g')
            .call(d3.drag<SVGGElement, any>()
                .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }) as any
            );

        nodeGroup.append('circle')
            .attr('r', (d: any) => d.id === patientId ? 18 : 12)
            .attr('fill', (d: any) => NODE_COLORS[d.type] || '#64748b')
            .attr('stroke', (d: any) => d.id === patientId ? '#fff' : 'transparent')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d: any) {
                d3.select(this).transition().duration(200).attr('r', d.id === patientId ? 22 : 16);
                setTooltip({ x: event.pageX, y: event.pageY, content: `${d.type.toUpperCase()}: ${d.label}` });
            })
            .on('mouseout', function (_event, d: any) {
                d3.select(this).transition().duration(200).attr('r', d.id === patientId ? 18 : 12);
                setTooltip(null);
            });

        nodeGroup.append('text')
            .text((d: any) => d.label?.length > 15 ? d.label.slice(0, 15) + '…' : d.label)
            .attr('text-anchor', 'middle')
            .attr('dy', 28)
            .attr('font-size', '9px')
            .attr('fill', '#94a3b8');

        simulation.on('tick', () => {
            link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
            nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        });
    };

    return (
        <div className="relative w-full h-full">
            <svg ref={svgRef} className="w-full h-full" />
            {tooltip && (
                <div className="fixed z-50 px-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-xs shadow-lg pointer-events-none"
                    style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}>
                    {tooltip.content}
                </div>
            )}
            <div className="absolute bottom-2 left-2 flex gap-3 text-xs text-[var(--color-text-muted)]">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {type}
                    </div>
                ))}
            </div>
        </div>
    );
}
