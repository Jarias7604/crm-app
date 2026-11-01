import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown, Check, X } from 'lucide-react';

interface CustomTimePickerProps {
    value: string; // 24h format "HH:mm", e.g. "09:00", "15:30"
    onChange: (time24: string) => void;
    className?: string;
    placeholder?: string;
}

// Convert "HH:mm" (24h) to { hour: 1..12, minute: "00", period: 'AM'|'PM', formatted: "09:00 AM" }
function parse24to12(time24: string) {
    if (!time24 || !time24.includes(':')) {
        return { hour: 9, minute: '00', period: 'AM' as const, formatted: '09:00 AM' };
    }
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr ? mStr.slice(0, 2).padStart(2, '0') : '00';
    if (isNaN(h)) h = 9;

    const period = h >= 12 ? 'PM' : 'AM';
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;

    const formatted = `${String(hour12).padStart(2, '0')}:${m} ${period}`;
    return { hour: hour12, minute: m, period: period as 'AM' | 'PM', formatted };
}

// Convert 12h parts back to "HH:mm" (24h)
function format12to24(hour12: number, minute: string, period: 'AM' | 'PM'): string {
    let h = hour12 % 12;
    if (period === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '15', '30', '45'];
const PRESETS = [
    { label: '09:00 AM', time24: '09:00' },
    { label: '11:00 AM', time24: '11:00' },
    { label: '02:00 PM', time24: '14:00' },
    { label: '04:00 PM', time24: '16:00' },
];

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
    value,
    onChange,
    className = '',
    placeholder = 'Seleccionar hora',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { hour, minute, period, formatted } = parse24to12(value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelectHour = (newHour: number) => {
        onChange(format12to24(newHour, minute, period));
    };

    const handleSelectMinute = (newMinute: string) => {
        onChange(format12to24(hour, newMinute, period));
    };

    const handleSelectPeriod = (newPeriod: 'AM' | 'PM') => {
        onChange(format12to24(hour, minute, newPeriod));
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* Trigger Button - Identical height & look to CustomDatePicker */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full h-10 px-3.5 bg-white border rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs transition-all cursor-pointer ${
                    isOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-100 text-slate-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-800'
                } ${className}`}
            >
                <div className="flex items-center gap-2 truncate">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{value ? formatted : placeholder}</span>
                </div>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-indigo-600' : ''
                    }`}
                />
            </button>

            {/* Custom Dropdown Popover - Opens UPWARDS inside phone frame, 100% contained */}
            {isOpen && (
                <div className="absolute right-0 bottom-full mb-1.5 w-64 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[9999] p-3 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                                {formatted}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="grid grid-cols-4 gap-1 mb-2.5">
                        {PRESETS.map((p) => {
                            const isMatch = value === p.time24;
                            return (
                                <button
                                    key={p.time24}
                                    type="button"
                                    onClick={() => {
                                        onChange(p.time24);
                                    }}
                                    className={`py-1 px-1 rounded-lg text-[9px] font-bold transition-all text-center cursor-pointer ${
                                        isMatch
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {p.label.replace(':00', '')}
                                </button>
                            );
                        })}
                    </div>

                    {/* 3 Columns: Hour | Minute | Period */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                        {/* Hours Column */}
                        <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase text-center mb-1">
                                Hora
                            </span>
                            <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
                                {HOURS.map((h) => {
                                    const isSelected = hour === h;
                                    return (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleSelectHour(h)}
                                            className={`w-full py-1 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                    : 'text-slate-700 hover:bg-white'
                                            }`}
                                        >
                                            {String(h).padStart(2, '0')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Minutes Column */}
                        <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase text-center mb-1">
                                Min
                            </span>
                            <div className="space-y-1">
                                {MINUTES.map((m) => {
                                    const isSelected = minute === m;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleSelectMinute(m)}
                                            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                    : 'text-slate-700 hover:bg-white'
                                            }`}
                                        >
                                            :{m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Period Column (AM / PM) */}
                        <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase text-center mb-1">
                                Modo
                            </span>
                            <div className="space-y-1">
                                {(['AM', 'PM'] as const).map((p) => {
                                    const isSelected = period === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleSelectPeriod(p)}
                                            className={`w-full py-2.5 rounded-lg text-xs font-black transition-all text-center cursor-pointer ${
                                                isSelected
                                                    ? 'bg-[#4449AA] text-white shadow-xs'
                                                    : 'text-slate-700 hover:bg-white'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bottom confirm button */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="w-full mt-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Aceptar ({formatted})
                    </button>
                </div>
            )}
        </div>
    );
};
