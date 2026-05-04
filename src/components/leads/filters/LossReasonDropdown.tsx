import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import type { LossReason } from '../../../types';

interface LossReasonDropdownProps {
    value: string | 'all' | string[];
    onChange: (value: string | 'all') => void;
    lossReasons: LossReason[];
}

export const LossReasonDropdown: React.FC<LossReasonDropdownProps> = ({ value, onChange, lossReasons }) => {
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
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[150px] justify-between ${value !== 'all' ? 'border-amber-300 text-amber-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 opacity-60" />
                    <span className="truncate max-w-[110px]">{value === 'all' ? 'Motivo pérdida' : lossReasons.find(r => r.id === value)?.reason || 'Motivo'}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { onChange('all'); setIsOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${value === 'all' ? 'bg-amber-50 text-amber-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todos los motivos
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {lossReasons.map(reason => (
                        <button
                            key={reason.id}
                            onClick={() => { onChange(reason.id); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${value === reason.id ? 'bg-amber-50 text-amber-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {reason.reason}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
