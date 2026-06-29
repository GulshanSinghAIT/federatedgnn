import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import HospitalDashboard from './pages/HospitalDashboard';
import FederationDashboard from './pages/FederationDashboard';
import MetricsDashboard from './pages/MetricsDashboard';
import { Stethoscope, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import GlobalSearch from './components/layout/GlobalSearch';

/** Brand node-glyph: a cobalt core linked to three satellite nodes
 *  (the federated-aggregation motif from frontend/brand.html). */
function BrandGlyph({ size = 26 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M60 14.4L99.48 37.2V82.8L60 105.6L20.52 82.8V37.2L60 14.4Z" stroke="#A0DEFF" stroke-width="2" stroke-linejoin="round" />
            <path d="M60 60V14.4" stroke="#A0DEFF" stroke-width="2" />
            <path d="M60 60L99.48 82.8" stroke="#A0DEFF" stroke-width="2" />
            <path d="M60 60L20.52 82.8" stroke="#A0DEFF" stroke-width="2" />
            <path d="M60 21C63.6451 21 66.6 18.0451 66.6 14.4C66.6 10.7549 63.6451 7.8 60 7.8C56.3549 7.8 53.4 10.7549 53.4 14.4C53.4 18.0451 56.3549 21 60 21Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M99.4801 43.8C103.125 43.8 106.08 40.8451 106.08 37.2C106.08 33.5549 103.125 30.6 99.4801 30.6C95.835 30.6 92.8801 33.5549 92.8801 37.2C92.8801 40.8451 95.835 43.8 99.4801 43.8Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M99.4801 89.4C103.125 89.4 106.08 86.4451 106.08 82.8C106.08 79.1549 103.125 76.2 99.4801 76.2C95.835 76.2 92.8801 79.1549 92.8801 82.8C92.8801 86.4451 95.835 89.4 99.4801 89.4Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M60 112.2C63.6451 112.2 66.6 109.245 66.6 105.6C66.6 101.955 63.6451 99 60 99C56.3549 99 53.4 101.955 53.4 105.6C53.4 109.245 56.3549 112.2 60 112.2Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M20.52 89.4C24.1651 89.4 27.12 86.4451 27.12 82.8C27.12 79.1549 24.1651 76.2 20.52 76.2C16.875 76.2 13.92 79.1549 13.92 82.8C13.92 86.4451 16.875 89.4 20.52 89.4Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M20.52 43.8C24.1651 43.8 27.12 40.8451 27.12 37.2C27.12 33.5549 24.1651 30.6 20.52 30.6C16.875 30.6 13.92 33.5549 13.92 37.2C13.92 40.8451 16.875 43.8 20.52 43.8Z" fill="white" stroke="#A0DEFF" stroke-width="2" />
            <path d="M60 70.2C65.6334 70.2 70.2001 65.6333 70.2001 60C70.2001 54.3667 65.6334 49.8 60 49.8C54.3667 49.8 49.8 54.3667 49.8 60C49.8 65.6333 54.3667 70.2 60 70.2Z" fill="#A0DEFF" />
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
        <nav className="left-0 top-0 bottom-0 w-16 bg-transparent flex flex-col items-center py-2.5 z-50">
            <Link to="/" title="FedFairGNN" className="w-10 h-10 rounded-xl flex items-center justify-center mb-2">
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
                <main className="flex-1 min-h-0 mt-2 flex flex-col">
                    {/* Global search bar */}
                    <div className="shrink-0 flex items-center justify-center px-4 pb-2">
                        <GlobalSearch />
                    </div>
                    <div className="flex-1 min-h-0">
                        <Routes>
                            <Route path="/" element={<Navigate to="/hospital/H1/dashboard" replace />} />
                            <Route path="/hospital/:hospitalId/dashboard" element={<HospitalDashboard />} />
                            <Route path="/hospital/:hospitalId/patients/new" element={<HospitalDashboard />} />
                            <Route path="/hospital/:hospitalId/patients/:patientId" element={<HospitalDashboard />} />
                            <Route path="/federation/dashboard" element={<FederationDashboard />} />
                            <Route path="/research/metrics" element={<MetricsDashboard />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </BrowserRouter>
    );
}
