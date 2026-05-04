import React from 'react';
import { STATUS_CONFIG } from '../../types';
import type { LeadStatus } from '../../types';

interface StatusBadgeProps {
    status: LeadStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['Prospecto'];
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-full ${config.bgColor} ${config.color} border border-current opacity-90`}>
            <span>{config.icon}</span>
            {config.label}
        </span>
    );
};
