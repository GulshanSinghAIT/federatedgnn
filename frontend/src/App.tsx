import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import HospitalDashboard from './pages/HospitalDashboard';
import FederationDashboard from './pages/FederationDashboard';
import MetricsDashboard from './pages/MetricsDashboard';
import { Stethoscope, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

/** Brand node-glyph: a cobalt core linked to three satellite nodes
 *  (the federated-aggregation motif from frontend/brand.html). */
function BrandGlyph({ size = 26 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
            <line x1="50" y1="50" x2="50" y2="20" stroke="var(--color-cobalt)" strokeWidth="3" />
            <line x1="50" y1="50" x2="24" y2="72" stroke="var(--color-cobalt)" strokeWidth="3" />
            <line x1="50" y1="50" x2="76" y2="72" stroke="var(--color-cobalt)" strokeWidth="3" />
            <circle cx="50" cy="20" r="8" fill="#fff" stroke="var(--color-cobalt)" strokeWidth="3" />
            <circle cx="24" cy="72" r="8" fill="#fff" stroke="var(--color-cobalt)" strokeWidth="3" />
            <circle cx="76" cy="72" r="8" fill="#fff" stroke="var(--color-cobalt)" strokeWidth="3" />
            <circle cx="50" cy="50" r="11" fill="var(--color-cobalt)" />
        </svg>
    );
}

function NavBar() {
    const location = useLocation();
    const navigate = useNavigate();
    const isActive = (path: string) => location.pathname.startsWith(path);

    const links = [
        { path: '/hospital/H1/dashboard', label: 'Hospital EHR', icon: <Stethoscope size={16} />, color: 'var(--color-hospital-h1)' },
        { path: '/federation/dashboard', label: 'Federation', icon: <Zap size={16} />, color: 'var(--color-hospital-h2)' },
        { path: '/research/metrics', label: 'Metrics', icon: <BarChart3 size={16} />, color: 'var(--color-hospital-h3)' },
    ];

    return (
        <nav className="left-0 top-0 bottom-0 w-16 bg-transparent flex flex-col items-center py-4 z-50">
            <Link to="/" title="FedFairGNN" className="w-10 h-10 rounded-xl flex items-center justify-center mb-6">
                <BrandGlyph size={26} />
            </Link>

            <div className="flex flex-col gap-3 flex-1">
                {links.map(link => {
                    const active = isActive(link.path.split('/').slice(0, 2).join('/'));
                    return (
                        <Tooltip delayDuration={0} key={link.path} content={link.label} side="right">
                            <Button variant="ghost" size="icon"
                                onClick={() => navigate(link.path)}
                                className={active ? 'bg-bg-tertiary' : ''}
                                style={{ color: active ? link.color : 'var(--color-white)' }}>
                                {link.icon}
                            </Button>
                        </Tooltip>
                    );
                })}
            </div>

            <div className="font-display text-[8px] text-text-muted text-center leading-tight tracking-tight">
                Fed<br />Fair<br />GNN
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex h-screen overflow-hidden text-foreground bg-linear-to-b from-cobalt/70 via-cobalt/30 to-cobalt/0 dark:from-primary/5 dark:to-background">
                <NavBar />
                <main className="flex-1 min-h-0 mt-2">
                    <Routes>
                        <Route path="/" element={<Navigate to="/hospital/H1/dashboard" replace />} />
                        <Route path="/hospital/:hospitalId/dashboard" element={<HospitalDashboard />} />
                        <Route path="/hospital/:hospitalId/patients/new" element={<HospitalDashboard />} />
                        <Route path="/hospital/:hospitalId/patients/:patientId" element={<HospitalDashboard />} />
                        <Route path="/federation/dashboard" element={<FederationDashboard />} />
                        <Route path="/research/metrics" element={<MetricsDashboard />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
