import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { STATUS_CONFIG } from '../../../types';
import type { LeadStatus } from '../../../types';

interface LossStageDropdownProps {
    value: string | 'all' | string[];
    onChange: (value: string | 'all') => void;
}

export const LossStageDropdown: React.FC<LossStageDropdownProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={filterRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[140px] justify-between ${value !== 'all' ? 'border-rose-300 text-rose-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 opacity-60" />
                    <span>{value === 'all' ? 'Etapa pérdida' : STATUS_CONFIG[value as LeadStatus]?.label || value}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { onChange('all'); setIsOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${value === 'all' ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todas las etapas
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {(Object.entries(STATUS_CONFIG) as [LeadStatus, any][]).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => { onChange(key); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2 ${value === key ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span>{config.icon}</span>
                            {config.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
