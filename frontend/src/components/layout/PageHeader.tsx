import React, { type ReactNode } from 'react';

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    icon?: ReactNode;
    titleColor?: string;
    actions?: ReactNode;
    children?: ReactNode;
}

/**
 * Shared page header used across all dashboards for a consistent look:
 * text-2xl display title + optional subtitle beneath, comfortable padding,
 * and right-aligned actions.
 */
export default function PageHeader({
    title, subtitle, icon, titleColor, actions, children,
}: PageHeaderProps) {
    return (
        <header className="shrink-0 border-b border-border bg-white rounded-tl-2xl px-6 py-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1
                        className="font-display text-2xl tracking-tight flex items-center gap-2 truncate"
                        style={titleColor ? { color: titleColor } : undefined}
                    >
                        {icon}
                        <span className="truncate">{title}</span>
                    </h1>
                    {subtitle && (
                        <div className="mt-1 text-sm text-text-muted">{subtitle}</div>
                    )}
                </div>
                {actions && (
                    <div className="flex items-center gap-3 shrink-0">{actions}</div>
                )}
            </div>
            {children && <div className="mt-4">{children}</div>}
        </header>
    );
}
