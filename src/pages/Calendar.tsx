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
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, MapPin, Phone, Mail } from 'lucide-react';
import { leadsService } from '../services/leads';
import type { Lead } from '../types';
import { Button } from '../components/ui/Button';

export default function Calendar() {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date()); // Controls the visible range (Month/Week)
    const [selectedDate, setSelectedDate] = useState(new Date()); // Controls the specific day selected in Week view
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

    useEffect(() => {
        loadData();

        // Auto-detect mobile to switch to week view
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setViewMode('week');
            } else {
                setViewMode('month');
            }
        };
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    const next = () => {
        if (viewMode === 'month') {
            setCurrentDate(addMonths(currentDate, 1));
        } else {
            setCurrentDate(addWeeks(currentDate, 1));
        }
    };

    const prev = () => {
        if (viewMode === 'month') {
            setCurrentDate(subMonths(currentDate, 1));
        } else {
            setCurrentDate(subWeeks(currentDate, 1));
        }
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
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {viewMode === 'week' ? 'Mi Agenda' : 'Calendario'}
                </h1>
                <p className="text-sm text-gray-500">
                    {viewMode === 'week'
                        ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
                        : 'Vista General del Mes'}
                </p>
            </div>

            <div className="flex items-center justify-between bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
                <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-bold text-gray-800 capitalize min-w-[120px] text-center">
                    {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM yyyy', { locale: es })}
                </span>
                <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="grid grid-cols-7 mb-4">
                    {weekDays.map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {days.map((day) => {
                        const dayLeads = getDailyLeads(day);
                        const isCurrent = isSameMonth(day, monthStart);
                        const isDayToday = isToday(day);

                        return (
                            <div key={day.toISOString()} className={`min-h-[100px] bg-white p-2 ${!isCurrent ? 'bg-gray-50/50' : ''}`}>
                                <div className="flex justify-between">
                                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isDayToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayLeads.length > 0 && (
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                            {dayLeads.length}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 space-y-1">
                                    {dayLeads.slice(0, 3).map(lead => (
                                        <div key={lead.id} className="text-[9px] truncate px-1 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                                            {lead.name}
                                        </div>
                                    ))}
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
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
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
                            {todaysLeads.map((lead, idx) => (
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
                                                {format(new Date(), 'h:00 a')} {/* Mock time */}
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
                viewMode === 'month' ? renderMonthView() : renderTimelineView()
            )}
        </div>
    );
}
