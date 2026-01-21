import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    eachDayOfInterval,
    addWeeks,
    subWeeks,
    addDays,
    isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Plus, MapPin, Phone, Mail } from 'lucide-react';
import { leadsService } from '../services/leads';
import type { Lead } from '../types';
import { Button } from '../components/ui/Button';

export default function Calendar() {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date()); // Shared state for both views, though they might diverge in UX usually.
    // For simplicity, Month View uses currentDate as the month anchor.
    // Timeline View uses currentDate as the week anchor.

    const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the specific day selected in Week view
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data } = await leadsService.getLeads(1, 1000);
            setLeads(data || []);
        } catch (error) {
            console.error('Error loading leads for calendar:', error);
        } finally {
            setLoading(false);
        }
    };

    // Desktop Navigation (Month)
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Mobile Navigation (Week)
    const nextWeek = () => {
        const newDate = addWeeks(currentDate, 1);
        setCurrentDate(newDate);
        setSelectedDate(addWeeks(selectedDate, 1));
    };
    const prevWeek = () => {
        const newDate = subWeeks(currentDate, 1);
        setCurrentDate(newDate);
        setSelectedDate(subWeeks(selectedDate, 1));
    };

    // Helper to parse "YYYY-MM-DD" safely in LOCAL time
    const parseLocal = (dateStr: string | null) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
    };

    const getDailyLeads = (date: Date) => {
        return leads.filter(lead => {
            const d = parseLocal(lead.next_followup_date);
            return d && isSameDay(d, date);
        });
    };

    // --- RENDERERS ---

    const renderHeader = () => (
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
                {/* Mobile Title */}
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 md:hidden">
                    Mi Agenda
                </h1>
                {/* Desktop Title */}
                <h1 className="hidden md:flex text-2xl font-bold text-gray-900 items-center gap-2">
                    Calendario
                </h1>

                <p className="text-sm text-gray-500">
                    <span className="md:hidden capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
                    <span className="hidden md:inline">Vista General del Mes</span>
                </p>
            </div>

            <div className="flex items-center justify-between bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
                {/* Desktop Buttons */}
                <button onClick={prevMonth} className="hidden md:block p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Mes Anterior">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                {/* Mobile Buttons */}
                <button onClick={prevWeek} className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Semana Anterior">
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Date Label (Desktop Month / Mobile Month) */}
                <span className="text-sm font-bold text-gray-800 capitalize min-w-[120px] text-center">
                    {format(currentDate, 'MMMM yyyy', { locale: es })}
                </span>

                {/* Desktop Buttons */}
                <button onClick={nextMonth} className="hidden md:block p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Mes Siguiente">
                    <ChevronRight className="w-5 h-5" />
                </button>
                {/* Mobile Buttons */}
                <button onClick={nextWeek} className="md:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600" title="Semana Siguiente">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        return (
            <div className="hidden md:block bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in">
                {/* Desktop Headers */}
                <div className="grid grid-cols-7 mb-2 border-b border-gray-100 pb-2">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-xs font-black text-gray-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 bg-gray-200 gap-px border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {days.map((day) => {
                        const dayLeads = getDailyLeads(day);
                        const isCurrent = isSameMonth(day, monthStart);
                        const isDayToday = isToday(day);

                        return (
                            <div
                                key={day.toISOString()}
                                className={`min-h-[140px] bg-white p-3 transition-colors flex flex-col gap-2 ${!isCurrent ? 'bg-gray-50 text-gray-400' : 'text-gray-900'} ${isDayToday ? 'bg-blue-50/20' : ''}`}
                            >
                                {/* Date Header Row */}
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-bold ${isDayToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-sm' : ''}`}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Day Name (Faint) - Visible on larger cells */}
                                    <span className="text-[10px] font-bold text-gray-300 uppercase hidden lg:block">
                                        {format(day, 'EEEE', { locale: es })}
                                    </span>

                                    {/* Lead Count Badge */}
                                    {dayLeads.length > 0 && (
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tight">
                                            {dayLeads.length} {dayLeads.length === 1 ? 'LEAD' : 'LEADS'}
                                        </span>
                                    )}
                                </div>

                                {/* Lead Cards List */}
                                <div className="space-y-1 mt-1 flex-1">
                                    {dayLeads.slice(0, 4).map(lead => (
                                        <button
                                            key={lead.id}
                                            onClick={() => navigate('/leads', { state: { priority: lead.priority } })}
                                            className="w-full text-left text-[10px] p-1.5 rounded bg-gray-50 hover:bg-white hover:shadow-md hover:text-blue-700 hover:border-blue-200 transition-all border border-gray-100 border-l-2 border-l-blue-500 overflow-hidden group"
                                        >
                                            <span className="font-bold block truncate">{lead.name}</span>
                                        </button>
                                    ))}
                                    {dayLeads.length > 4 && (
                                        <div className="text-[9px] text-center text-gray-400 font-medium pt-1">
                                            + {dayLeads.length - 4} más
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTimelineView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
        const todaysLeads = getDailyLeads(selectedDate);

        return (
            <div className="md:hidden space-y-6 animate-in slide-in-from-right duration-300">
                {/* Week Strip */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hide-scrollbar">
                    <div className="flex justify-between md:justify-around min-w-max gap-4 md:gap-0">
                        {weekDays.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isDayToday = isToday(day);
                            const hasEvents = getDailyLeads(day).length > 0;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`flex flex-col items-center min-w-[3rem] p-2 rounded-2xl transition-all ${isSelected
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 transform scale-105'
                                            : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <span className={`text-[10px] font-bold uppercase mb-1 ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                                        {format(day, 'EEE', { locale: es })}
                                    </span>
                                    <span className={`text-lg font-bold ${isSelected ? 'text-white' : isDayToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {hasEvents && (
                                        <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Timeline Events */}
                <div className="space-y-4 pb-20">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-bold text-gray-800">
                            {todaysLeads.length} Eventos
                        </h3>
                        <Button size="sm" onClick={() => navigate('/leads')} className="text-xs h-8">
                            <Plus className="w-3 h-3 mr-1" /> Nuevo
                        </Button>
                    </div>

                    {todaysLeads.length > 0 ? (
                        <div className="relative space-y-4 before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                            {todaysLeads.map((lead) => (
                                <div key={lead.id} className="relative pl-10">
                                    {/* Timeline Dot */}
                                    <span className="absolute left-[11px] top-4 w-3 h-3 bg-white border-[3px] border-blue-600 rounded-full z-10" />

                                    {/* Card */}
                                    <div
                                        onClick={() => navigate('/leads', { state: { priority: lead.priority } })}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wide">
                                                Reunión / Llamada
                                            </span>
                                            <span className="text-xs font-bold text-gray-400">
                                                {format(new Date(), 'h:00 a')} {/* Mock time, real apps would use lead.time */}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 text-base mb-1">{lead.name}</h4>
                                        {lead.company_name && <p className="text-sm text-gray-500 mb-2">{lead.company_name}</p>}

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {lead.phone && (
                                                <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-2 bg-green-50 text-green-600 rounded-lg">
                                                    <Phone className="w-4 h-4" />
                                                </a>
                                            )}
                                            {lead.email && (
                                                <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                                    <Mail className="w-4 h-4" />
                                                </a>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                                                <MapPin className="w-3 h-3" />
                                                San Salvador
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                            <Clock className="w-12 h-12 text-gray-200 mb-2" />
                            <p className="text-gray-500 font-medium">No hay eventos para hoy</p>
                            <p className="text-sm text-gray-400">¡Disfruta tu día libre!</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto">
            {renderHeader()}
            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
            ) : (
                <>
                    {renderMonthView()}
                    {renderTimelineView()}
                </>
            )}
        </div>
    );
}
