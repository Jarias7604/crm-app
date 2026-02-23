import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    isBefore,
    startOfDay,
    eachDayOfInterval,
    parseISO,
    isValid
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { brandingService } from '../../services/branding';
import type { Company } from '../../types';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    variant?: 'light' | 'dark' | 'transparent';
    minDate?: string;
    forceOpenUp?: boolean;
    forceOpenDown?: boolean;
    alignRight?: boolean; // Open calendar rightward (extends left) — use when trigger is near right edge
}

export function CustomDatePicker({
    value,
    onChange,
    placeholder = "Seleccionar fecha",
    className = "",
    variant = "dark",
    minDate,
    forceOpenUp,
    forceOpenDown,
    alignRight
}: CustomDatePickerProps) {
    const parsedMinDate = minDate ? parseISO(minDate) : null;
    const [isOpen, setIsOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const [fixedPos, setFixedPos] = useState<{ top?: number; bottom?: number; left: number; maxWidth: number } | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [company, setCompany] = useState<Company | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const calendarPortalRef = useRef<HTMLDivElement>(null);

    // Initial date parsing
    const selectedDate = value ? parseISO(value) : null;
    const activeDate = selectedDate && isValid(selectedDate) ? selectedDate : null;

    useEffect(() => {
        const loadCompany = async () => {
            try {
                const data = await brandingService.getMyCompany();
                setCompany(data);
            } catch (error) {
                console.error('Error loading company for date format:', error);
            }
        };
        loadCompany();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const inContainer = containerRef.current?.contains(event.target as Node);
            const inPortal = calendarPortalRef.current?.contains(event.target as Node);
            if (!inContainer && !inPortal) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleCalendar = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const calWidth = Math.min(310, window.innerWidth - 16);
            const calLeft = Math.max(8, Math.min(rect.left, window.innerWidth - calWidth - 8));
            const CAL_HEIGHT = 460; // approx calendar height in px (p-5 padding + header + 6 rows + footer)
            const MARGIN = 8;

            if (forceOpenDown) {
                // Explicit downward — uses absolute positioning (legacy mode)
                setOpenUp(false);
                setFixedPos(null);
            } else {
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const shouldOpenUp = forceOpenUp || (spaceBelow < CAL_HEIGHT + MARGIN && spaceAbove > spaceBelow);
                setOpenUp(shouldOpenUp);

                if (shouldOpenUp) {
                    // Open above: bottom edge of calendar aligns above the trigger
                    // Clamp so calendar doesn't go above the viewport
                    const idealBottom = window.innerHeight - rect.top + MARGIN;
                    const calTop = window.innerHeight - idealBottom - CAL_HEIGHT;
                    const clampedBottom = calTop < MARGIN
                        ? window.innerHeight - MARGIN - CAL_HEIGHT  // clamp to top edge
                        : idealBottom;
                    setFixedPos({
                        bottom: Math.max(MARGIN, clampedBottom),
                        left: calLeft,
                        maxWidth: calWidth,
                    });
                } else {
                    // Open below: top edge of calendar aligns below the trigger
                    // Clamp so calendar doesn't go below the viewport
                    const idealTop = rect.bottom + MARGIN;
                    const clampedTop = Math.min(idealTop, window.innerHeight - CAL_HEIGHT - MARGIN);
                    setFixedPos({
                        top: Math.max(MARGIN, clampedTop),
                        left: calLeft,
                        maxWidth: calWidth,
                    });
                }
            }
        }
        setIsOpen(!isOpen);
    };

    const handleDateSelect = (date: Date) => {
        onChange(format(date, 'yyyy-MM-dd'));
        setIsOpen(false);
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const displayFormat = company?.date_format
        ? company.date_format.replace(/DD/g, 'dd').replace(/YYYY/g, 'yyyy')
        : 'dd/MM/yyyy';

    const renderCalendar = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

        // Always render 6 rows (42 cells) for consistent height
        const naturalDays = eachDayOfInterval({ start: startDate, end: endDate });
        const totalCells = 42; // 6 rows × 7 cols
        let calendarDays = naturalDays;
        if (calendarDays.length < totalCells) {
            const extraEnd = new Date(endDate);
            extraEnd.setDate(extraEnd.getDate() + (totalCells - calendarDays.length));
            calendarDays = eachDayOfInterval({ start: startDate, end: extraEnd });
        }

        const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        const calendarStyle = fixedPos ? {
            position: 'fixed' as const,
            ...(fixedPos.top !== undefined
                ? { top: `${fixedPos.top}px` }
                : { bottom: `${fixedPos.bottom}px` }),
            left: `${fixedPos.left}px`,
            width: `${fixedPos.maxWidth}px`,
        } : undefined;

        return (
            <div
                ref={calendarPortalRef}
                style={calendarStyle}
                className={`${fixedPos ? '' : alignRight ? 'absolute right-0' : 'absolute right-0 md:right-auto md:left-0'} z-[10001] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 p-5 w-[310px] animate-in fade-in zoom-in duration-200 transform ${!fixedPos && openUp ? 'bottom-full mb-2 origin-bottom-left' : !fixedPos ? 'top-full mt-2 origin-top-left' : 'origin-bottom-left'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </h4>
                    <div className="flex gap-0.5">
                        <button type="button" onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-blue-600">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-blue-600">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((day, idx) => {
                        const isSelected = activeDate && isSameDay(day, activeDate);
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isTodayDate = isSameDay(day, new Date());
                        const isDisabled = parsedMinDate ? isBefore(startOfDay(day), startOfDay(parsedMinDate)) : false;

                        return (
                            <button
                                type="button"
                                key={idx}
                                onClick={() => !isDisabled && handleDateSelect(day)}
                                disabled={isDisabled}
                                className={`
                                    h-9 w-9 flex flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-all relative
                                    ${isDisabled
                                        ? 'text-slate-200 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 z-10'
                                            : isCurrentMonth
                                                ? 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                                                : 'text-slate-300 hover:bg-slate-50'
                                    }
                                `}
                            >
                                {format(day, 'd')}
                                {isTodayDate && !isSelected && (
                                    <div className="absolute bottom-1 w-1 h-1 bg-blue-500 rounded-full"></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center px-1">
                    <button
                        type="button"
                        onClick={() => handleDateSelect(new Date())}
                        className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors"
                    >
                        Hoy
                    </button>
                    {activeDate && (
                        <button
                            type="button"
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-colors"
                        >
                            Borrar
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const triggerClasses = {
        dark: "bg-white/10 border-white/20 text-white hover:bg-white/20",
        light: "bg-indigo-50/50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/50",
        transparent: "bg-transparent border-transparent text-gray-700 hover:bg-gray-50"
    };

    const iconClasses = {
        dark: "text-white opacity-60",
        light: "text-indigo-500",
        transparent: "text-gray-400"
    };

    const textClasses = {
        dark: activeDate ? "text-white" : "text-white/40",
        light: activeDate ? "text-indigo-700" : "text-indigo-300",
        transparent: activeDate ? "text-gray-700" : "text-gray-400"
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={toggleCalendar}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-between cursor-pointer transition-all outline-none ${triggerClasses[variant]}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <CalendarIcon className={`w-4 h-4 flex-shrink-0 ${iconClasses[variant]}`} />
                    <span className={`truncate ${textClasses[variant]}`}>
                        {activeDate ? format(activeDate, displayFormat, { locale: es }) : placeholder}
                    </span>
                </div>
                {activeDate && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onChange(''); }}
                        className={`p-1 rounded-full transition-colors flex-shrink-0 ${variant === 'dark' ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-indigo-100/50 text-indigo-300 hover:text-indigo-600'}`}
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
            {isOpen && !fixedPos && renderCalendar()}
            {isOpen && fixedPos && createPortal(renderCalendar(), document.body)}
        </div>
    );
}
