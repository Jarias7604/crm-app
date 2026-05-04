import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown } from 'lucide-react';

interface AssignedDropdownProps {
    value: string | 'all' | string[];
    onChange: (value: string | 'all') => void;
    teamMembers: any[];
}

export const AssignedDropdown: React.FC<AssignedDropdownProps> = ({ value, onChange, teamMembers }) => {
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
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[130px] justify-between ${value !== 'all' ? 'border-indigo-300 text-indigo-600 bg-indigo-50/30' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 opacity-60" />
                    <span>{value === 'all' ? 'Responsable' : value === 'unassigned' ? 'Sin asignar' : teamMembers.find(m => m.id === value)?.full_name?.split(' ')[0] || 'Agente'}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { onChange('all'); setIsOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${value === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todos los responsables
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {teamMembers.map(member => (
                        <button
                            key={member.id}
                            onClick={() => { onChange(member.id); setIsOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${value === member.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                            </div>
                            {member.full_name || member.email}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
