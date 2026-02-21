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
import { ChevronLeft, ChevronRight, Clock, Plus, Phone, Mail, CalendarDays, MessageSquare } from 'lucide-react';
import { leadsService } from '../services/leads';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import { useTimezone } from '../hooks/useTimezone';
import { formatTimeInZone, utcToLocalDate } from '../utils/timezone';

type CalendarEvent = Awaited<ReturnType<typeof leadsService.getCalendarFollowUps>>[number];

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    call: { label: 'Llamada', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    email: { label: 'Email', color: 'text-blue-700', bg: 'bg-blue-50' },
    whatsapp: { label: 'WhatsApp', color: 'text-green-700', bg: 'bg-green-50' },
    telegram: { label: 'Telegram', color: 'text-sky-700', bg: 'bg-sky-50' },
    meeting: { label: 'Reunión', color: 'text-purple-700', bg: 'bg-purple-50' },
    quote: { label: 'Cotización', color: 'text-amber-700', bg: 'bg-amber-50' },
};
const getActionMeta = (type: string) => ACTION_LABELS[type] ?? { label: type, color: 'text-gray-700', bg: 'bg-gray-50' };

export default function Calendar() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { timezone: companyTimezone } = useTimezone(profile?.company_id);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const events = await leadsService.getCalendarFollowUps();
            setCalendarEvents(events);
        } catch (error) {
            console.error('Error loading follow-ups for calendar:', error);
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

    // Get follow-ups for a given day (in company timezone), sorted ascending by exact time
    const getDailyEvents = (date: Date): CalendarEvent[] => {
        return calendarEvents
            .filter(ev => {
                if (!ev.date) return false;
                // Convert the UTC timestamp to a local date in company timezone
                return isSameDay(utcToLocalDate(ev.date, companyTimezone), date);
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
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
                        const dayEvents = getDailyEvents(day);
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
                                    <span className="text-[10px] font-bold text-gray-300 uppercase hidden lg:block">
                                        {format(day, 'EEEE', { locale: es })}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span
                                            className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tight cursor-pointer hover:bg-blue-600 hover:text-white transition-all"
                                            onClick={() => navigate('/leads', { state: { leadIds: dayEvents.map(e => e.lead?.id).filter(Boolean), fromCalendar: true } })}
                                        >
                                            {dayEvents.length} {dayEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
                                        </span>
                                    )}
                                </div>

                                {/* Event Cards - sorted by time (already sorted) */}
                                <div className="space-y-1 mt-1 flex-1">
                                    {dayEvents.slice(0, 4).map(ev => {
                                        const meta = getActionMeta(ev.action_type);
                                        const timeStr = formatTimeInZone(ev.date, companyTimezone);
                                        return (
                                            <button
                                                key={ev.id}
                                                onClick={() => ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } })}
                                                className="w-full text-left text-[10px] p-1.5 rounded bg-gray-50 hover:bg-white hover:shadow-md hover:text-blue-700 hover:border-blue-200 transition-all border border-gray-100 border-l-2 border-l-blue-500 overflow-hidden"
                                            >
                                                <span className="font-bold block truncate">{ev.lead?.name ?? 'Lead'}</span>
                                                <span className="text-gray-400">{timeStr} · {meta.label}</span>
                                            </button>
                                        );
                                    })}
                                    {dayEvents.length > 4 && (
                                        <div className="text-[9px] text-center text-gray-400 font-medium pt-1">
                                            + {dayEvents.length - 4} más
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
        const todaysEvents = getDailyEvents(selectedDate);

        return (
            <div className="md:hidden space-y-6 animate-in slide-in-from-right duration-300">
                {/* Week Strip */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hide-scrollbar">
                    <div className="flex justify-between md:justify-around min-w-max gap-4 md:gap-0">
                        {weekDays.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isDayToday = isToday(day);
                            const hasEvents = getDailyEvents(day).length > 0;

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
                            {todaysEvents.length} Evento{todaysEvents.length !== 1 ? 's' : ''}
                        </h3>
                        <Button size="sm" onClick={() => navigate('/leads')} className="text-xs h-8">
                            <Plus className="w-3 h-3 mr-1" /> Nuevo
                        </Button>
                    </div>

                    {todaysEvents.length > 0 ? (
                        <div className="relative space-y-4 before:absolute before:left-4 before:top-2 before:bottom-0 before:w-0.5 before:bg-gray-200">
                            {todaysEvents.map((ev) => {
                                const meta = getActionMeta(ev.action_type);
                                const timeStr = formatTimeInZone(ev.date, companyTimezone);

                                return (
                                    <div key={ev.id} className="relative pl-10">
                                        {/* Timeline Dot */}
                                        <span className="absolute left-[11px] top-4 w-3 h-3 bg-white border-[3px] border-blue-600 rounded-full z-10" />

                                        {/* Card */}
                                        <div
                                            onClick={() => ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } })}
                                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${meta.bg} ${meta.color}`}>
                                                    {ev.action_type === 'call' && <Phone className="w-3 h-3" />}
                                                    {(ev.action_type === 'whatsapp' || ev.action_type === 'telegram') && <MessageSquare className="w-3 h-3" />}
                                                    {ev.action_type === 'email' && <Mail className="w-3 h-3" />}
                                                    {(ev.action_type === 'meeting' || ev.action_type === 'quote') && <CalendarDays className="w-3 h-3" />}
                                                    {meta.label}
                                                </span>
                                                {/* Real time - sorted ascending */}
                                                <span className="flex items-center gap-1 text-xs font-bold text-gray-500">
                                                    <Clock className="w-3 h-3" />
                                                    {timeStr}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-gray-900 text-base mb-1">{ev.lead?.name ?? '—'}</h4>
                                            {ev.lead?.company_name && <p className="text-sm text-gray-500 mb-2">{ev.lead.company_name}</p>}
                                            {ev.notes && <p className="text-xs text-gray-400 italic truncate mb-2">{ev.notes}</p>}

                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {ev.lead?.phone && (
                                                    <a href={`tel:${ev.lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-2 bg-green-50 text-green-600 rounded-lg">
                                                        <Phone className="w-4 h-4" />
                                                    </a>
                                                )}
                                                {ev.lead?.email && (
                                                    <a href={`mailto:${ev.lead.email}`} onClick={(e) => e.stopPropagation()} className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                                        <Mail className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
