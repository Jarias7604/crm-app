import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
const MINUTES = ['00', '15', '30', '45', '05', '10', '20', '25', '35', '40', '50', '55'];
const PRESETS = [
    { label: '08:00 AM', time24: '08:00' },
    { label: '09:00 AM', time24: '09:00' },
    { label: '10:00 AM', time24: '10:00' },
    { label: '11:00 AM', time24: '11:00' },
    { label: '02:00 PM', time24: '14:00' },
    { label: '03:00 PM', time24: '15:00' },
    { label: '04:00 PM', time24: '16:00' },
    { label: '05:00 PM', time24: '17:00' },
];

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
    value,
    onChange,
    className = '',
    placeholder = 'Seleccionar hora',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);

    const { hour, minute, period, formatted } = parse24to12(value);

    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const POPOVER_WIDTH = Math.min(300, window.innerWidth - 16);
        const POPOVER_HEIGHT = 340;
        const MARGIN = 8;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUpward = spaceBelow < POPOVER_HEIGHT + MARGIN && spaceAbove > spaceBelow;

        // Horizontal alignment: prefer aligning right edge with trigger right edge if near right side, clamped to screen
        let left = rect.right - POPOVER_WIDTH;
        if (left < MARGIN) left = MARGIN;
        if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
            left = window.innerWidth - POPOVER_WIDTH - MARGIN;
        }

        if (openUpward) {
            const idealBottom = window.innerHeight - rect.top + 6;
            const maxBottom = window.innerHeight - MARGIN - POPOVER_HEIGHT;
            setPopoverStyle({
                position: 'fixed',
                bottom: `${Math.max(MARGIN, Math.min(idealBottom, maxBottom))}px`,
                left: `${left}px`,
                width: `${POPOVER_WIDTH}px`,
                zIndex: 10005,
            });
        } else {
            const idealTop = rect.bottom + 6;
            const maxTop = window.innerHeight - POPOVER_HEIGHT - MARGIN;
            setPopoverStyle({
                position: 'fixed',
                top: `${Math.max(MARGIN, Math.min(idealTop, maxTop))}px`,
                left: `${left}px`,
                width: `${POPOVER_WIDTH}px`,
                zIndex: 10005,
            });
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    // Close on click outside (checks both trigger and portal)
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const inTrigger = containerRef.current?.contains(e.target as Node);
            const inPortal = portalRef.current?.contains(e.target as Node);
            if (!inTrigger && !inPortal) {
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

            {/* Portal Popover - Never clipped by overflow-hidden or modal scroll containers */}
            {isOpen &&
                createPortal(
                    <div
                        ref={portalRef}
                        style={popoverStyle}
                        className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.25)] border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none font-sans"
                    >
                        {/* Header with Selected Time & AM/PM Switch */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-black text-slate-900 tracking-wide">
                                    {formatted}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                                    {(['AM', 'PM'] as const).map((p) => {
                                        const isSelected = period === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => handleSelectPeriod(p)}
                                                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                                        : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                                    title="Cerrar"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Quick Presets (1-click) */}
                        <div className="mb-2.5">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                Horas frecuentes
                            </span>
                            <div className="grid grid-cols-4 gap-1">
                                {PRESETS.map((p) => {
                                    const isMatch = value === p.time24;
                                    return (
                                        <button
                                            key={p.time24}
                                            type="button"
                                            onClick={() => {
                                                onChange(p.time24);
                                                setIsOpen(false);
                                            }}
                                            className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer border ${
                                                isMatch
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                            }`}
                                        >
                                            {p.label.replace(':00 ', ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* All 12 Hours Visible at Once (4x3 Grid - Zero Hidden Scroll) */}
                        <div className="mb-2.5">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                Hora (1 - 12)
                            </span>
                            <div className="grid grid-cols-6 gap-1 bg-slate-50/80 p-1.5 rounded-xl border border-slate-100">
                                {HOURS.map((h) => {
                                    const isSelected = hour === h;
                                    return (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleSelectHour(h)}
                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                                    : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/60'
                                            }`}
                                        >
                                            {String(h).padStart(2, '0')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Minutes Grid (00, 15, 30, 45 highlighted + 5-min intervals) */}
                        <div className="mb-3">
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                Minutos
                            </span>
                            <div className="grid grid-cols-6 gap-1 bg-slate-50/80 p-1.5 rounded-xl border border-slate-100">
                                {MINUTES.map((m) => {
                                    const isSelected = minute === m;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleSelectMinute(m)}
                                            className={`py-1 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white shadow-2xs font-black'
                                                    : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/60'
                                            }`}
                                        >
                                            :{m}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bottom Confirm Button */}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer"
                        >
                            <Check className="w-3.5 h-3.5" />
                            <span>Listo ({formatted})</span>
                        </button>
                    </div>,
                    document.body
                )}
        </div>
    );
};
