import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CustomDatePicker } from '../../ui/CustomDatePicker';

interface DateRangeDropdownProps {
    startDate: string | null;
    endDate: string | null;
    setStartDate: (val: string | null) => void;
    setEndDate: (val: string | null) => void;
}

export const DateRangeDropdown: React.FC<DateRangeDropdownProps> = ({
    startDate,
    endDate,
    setStartDate,
    setEndDate
}) => {
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
                className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 ${(startDate || endDate) ? 'border-teal-300 text-teal-700 bg-teal-50/40' : 'border-gray-200 text-gray-600 bg-white'}`}
            >
                <Calendar className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                <span>
                    {startDate || endDate
                        ? `${startDate ? format(new Date(startDate + 'T12:00:00'), 'dd MMM', { locale: es }) : '…'} – ${endDate ? format(new Date(endDate + 'T12:00:00'), 'dd MMM', { locale: es }) : '…'}`
                        : 'Período'}
                </span>
                {(startDate || endDate) ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); setStartDate(null); setEndDate(null); }}
                        className="ml-0.5 text-teal-400 hover:text-teal-700 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                ) : (
                    <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200" style={{ minWidth: '320px' }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Rango de fechas</span>
                        <button onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-50">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {[
                            { label: 'Hoy', days: 0 },
                            { label: 'Últ. 7 días', days: 7 },
                            { label: 'Últ. 30 días', days: 30 },
                            { label: 'Este mes', days: -1 },
                        ].map(({ label, days }) => (
                            <button
                                key={label}
                                onClick={() => {
                                    const today = new Date();
                                    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
                                    if (days === 0) {
                                        setStartDate(fmt(today));
                                        setEndDate(fmt(today));
                                    } else if (days === -1) {
                                        const start = new Date(today.getFullYear(), today.getMonth(), 1);
                                        setStartDate(fmt(start));
                                        setEndDate(fmt(today));
                                    } else {
                                        const start = new Date(today);
                                        start.setDate(today.getDate() - days);
                                        setStartDate(fmt(start));
                                        setEndDate(fmt(today));
                                    }
                                    setIsOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-all"
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-gray-50 my-3" />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block">Desde</label>
                            <CustomDatePicker
                                value={startDate || ''}
                                onChange={(d) => setStartDate(d || null)}
                                placeholder="Inicio"
                                variant="light"
                                forceOpenDown
                                alignRight
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block">Hasta</label>
                            <CustomDatePicker
                                value={endDate || ''}
                                onChange={(d) => setEndDate(d || null)}
                                placeholder="Fin"
                                variant="light"
                                minDate={startDate || undefined}
                                forceOpenDown
                                alignRight
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setIsOpen(false)}
                        className="mt-3 w-full py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shadow-teal-100"
                    >
                        Aplicar
                    </button>
                </div>
            )}
        </div>
    );
};
