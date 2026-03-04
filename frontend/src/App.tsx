import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import HospitalDashboard from './pages/HospitalDashboard';
import FederationDashboard from './pages/FederationDashboard';
import MetricsDashboard from './pages/MetricsDashboard';
import { Stethoscope, Zap, BarChart3, Shield } from 'lucide-react';

function NavBar() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname.startsWith(path);

    const links = [
        { path: '/hospital/H1/dashboard', label: 'Hospital EHR', icon: <Stethoscope size={16} />, color: '#38bdf8' },
        { path: '/federation/dashboard', label: 'Federation', icon: <Zap size={16} />, color: '#a78bfa' },
        { path: '/research/metrics', label: 'Metrics', icon: <BarChart3 size={16} />, color: '#2dd4bf' },
    ];

    return (
        <nav className="left-0 top-0 bottom-0 w-16 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col items-center py-4 z-50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] flex items-center justify-center mb-6">
                <Shield size={20} className="text-white" />
            </div>

            <div className="flex flex-col gap-3 flex-1">
                {links.map(link => (
                    <Link key={link.path} to={link.path}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${isActive(link.path.split('/').slice(0, 2).join('/')) ? 'bg-[var(--color-bg-tertiary)]' : 'hover:bg-[var(--color-bg-tertiary)]/50'}`}
                        style={{ color: isActive(link.path.split('/').slice(0, 2).join('/')) ? link.color : '#64748b' }}>
                        {link.icon}
                        <div className="absolute left-14 px-2 py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                            style={{ color: link.color }}>
                            {link.label}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="text-[8px] text-[var(--color-text-muted)] text-center leading-tight">
                Fed<br />Fair<br />GNN
            </div>
        </nav>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="flex min-h-screen">
                <NavBar />
                <main className="ml-16 flex-1">
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
