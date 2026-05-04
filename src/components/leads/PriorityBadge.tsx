import React from 'react';
import { PRIORITY_CONFIG } from '../../types';
import type { LeadPriority } from '../../types';

interface PriorityBadgeProps {
    priority: LeadPriority;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
    // Typecast to avoid TS error on internal config object
    const config = (PRIORITY_CONFIG as any)[priority] || (PRIORITY_CONFIG as any)['medium'];
    
    const icons: Record<string, string> = {
        very_high: '🔥',
        high: '⚡',
        medium: '🕑',
        low: '💤'
    };
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md ${config.color} ${config.textColor} shadow-sm`}>
            <span>{icons[priority]}</span>
            {config.label}
        </span>
    );
};
