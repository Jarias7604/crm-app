import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay,
    eachDayOfInterval, addWeeks, subWeeks, addDays, isToday, isBefore
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, Clock, Plus, Phone, Mail,
    CalendarDays, MessageSquare, Video, FileText
} from 'lucide-react';
import { leadsService } from '../services/leads';
import { useAuth } from '../auth/AuthProvider';
import { useTimezone } from '../hooks/useTimezone';
import { formatTimeInZone, utcToLocalDate, DEFAULT_TIMEZONE } from '../utils/timezone';

type CalendarEvent = Awaited<ReturnType<typeof leadsService.getCalendarFollowUps>>[number];

/* ─── Action type config ──────────────────────────── */
const ACTION_CONFIG: Record<string, {
    label: string;
    pill: string;       // classes for event pill in grid
    badge: string;      // classes for summary badge background
    badgeText: string;  // classes for badge count text
    dotColor: string;   // dot color for mobile
    Icon: React.ElementType;
}> = {
    call: { label: 'Llamada', pill: 'bg-emerald-50 text-emerald-800 border-l-2 border-emerald-400 hover:bg-emerald-100', badge: 'bg-emerald-50 border border-emerald-200', badgeText: 'text-emerald-700', dotColor: 'bg-emerald-500', Icon: Phone },
    email: { label: 'Email', pill: 'bg-blue-50 text-blue-800 border-l-2 border-blue-400 hover:bg-blue-100', badge: 'bg-blue-50 border border-blue-200', badgeText: 'text-blue-700', dotColor: 'bg-blue-500', Icon: Mail },
    whatsapp: { label: 'WhatsApp', pill: 'bg-teal-50 text-teal-800 border-l-2 border-teal-400 hover:bg-teal-100', badge: 'bg-teal-50 border border-teal-200', badgeText: 'text-teal-700', dotColor: 'bg-teal-500', Icon: MessageSquare },
    telegram: { label: 'Telegram', pill: 'bg-sky-50 text-sky-800 border-l-2 border-sky-400 hover:bg-sky-100', badge: 'bg-sky-50 border border-sky-200', badgeText: 'text-sky-700', dotColor: 'bg-sky-500', Icon: MessageSquare },
    meeting: { label: 'Reunión', pill: 'bg-violet-50 text-violet-800 border-l-2 border-violet-400 hover:bg-violet-100', badge: 'bg-violet-50 border border-violet-200', badgeText: 'text-violet-700', dotColor: 'bg-violet-500', Icon: Video },
    quote: { label: 'Cotización', pill: 'bg-amber-50 text-amber-800 border-l-2 border-amber-400 hover:bg-amber-100', badge: 'bg-amber-50 border border-amber-200', badgeText: 'text-amber-700', dotColor: 'bg-amber-500', Icon: FileText },
};
const getActionCfg = (type: string) => ACTION_CONFIG[type] ?? {
    label: type, pill: 'bg-gray-50 text-gray-700 border-l-2 border-gray-300 hover:bg-gray-100',
    badge: 'bg-gray-50 border border-gray-200', badgeText: 'text-gray-700',
    dotColor: 'bg-gray-400', Icon: CalendarDays,
};

/* ─── Mini Calendar Component ─────────────────────── */
function MiniCalendar({ currentDate, onSelect }: { currentDate: Date; onSelect: (d: Date) => void }) {
    const [mini, setMini] = useState(currentDate);
    useEffect(() => setMini(currentDate), [currentDate]);

    const monthStart = startOfMonth(mini);
    const days = eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
    });
    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    return (
        <div className="select-none">
            <div className="flex items-center justify-between mb-3">
                <button onClick={() => setMini(subMonths(mini, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-black text-gray-700 capitalize">
                    {format(mini, 'MMMM yyyy', { locale: es })}
                </span>
                <button onClick={() => setMini(addMonths(mini, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
                {weekDays.map((d, i) => (
                    <div key={i} className="text-center text-[9px] font-black text-gray-400 uppercase">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {days.map(day => {
                    const inMonth = isSameMonth(day, mini);
                    const today = isToday(day);
                    const sel = isSameDay(day, currentDate);
                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => { onSelect(day); setMini(day); }}
                            className={`
                                text-[11px] py-0.5 rounded-full font-semibold transition-all mx-auto w-6 h-6 flex items-center justify-center
                                ${sel ? 'bg-indigo-600 text-white shadow-sm' : ''}
                                ${today && !sel ? 'text-indigo-600 font-black ring-1 ring-indigo-400' : ''}
                                ${!inMonth ? 'text-gray-300' : !sel && !today ? 'text-gray-600 hover:bg-gray-100' : ''}
                            `}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Main Component ──────────────────────────────── */
export default function Calendar() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { timezone: rawTimezone } = useTimezone(profile?.company_id);
    const companyTimezone = rawTimezone || DEFAULT_TIMEZONE;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [rawTimezone]);

    const loadData = async () => {
        try {
            setLoading(true);
            setCalendarEvents(await leadsService.getCalendarFollowUps());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextWeek = () => { setCurrentDate(addWeeks(currentDate, 1)); setSelectedDate(addWeeks(selectedDate, 1)); };
    const prevWeek = () => { setCurrentDate(subWeeks(currentDate, 1)); setSelectedDate(subWeeks(selectedDate, 1)); };

    const getDailyEvents = (date: Date): CalendarEvent[] =>
        calendarEvents
            .filter(ev => ev.date && isSameDay(utcToLocalDate(ev.date, companyTimezone), date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    /* Summary: count per action type across all UPCOMING events */
    const actionSummary = useMemo(() => {
        const today = new Date();
        const counts: Record<string, CalendarEvent[]> = {};
        calendarEvents
            .filter(ev => ev.date && !isBefore(utcToLocalDate(ev.date, companyTimezone), today))
            .forEach(ev => {
                const t = ev.action_type || 'call';
                if (!counts[t]) counts[t] = [];
                counts[t].push(ev);
            });
        return counts;
    }, [calendarEvents, companyTimezone]);

    const handleMiniSelect = (d: Date) => {
        setCurrentDate(d);
        setSelectedDate(d);
    };

    /* ─── DESKTOP HEADER ──────────────────────────── */
    const renderHeader = () => (
        <div className="hidden md:flex items-center justify-between mb-5">
            <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Calendario</h1>
                <p className="text-sm text-gray-400 font-medium capitalize mt-0.5">
                    {format(currentDate, "MMMM yyyy", { locale: es })}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                    className="px-4 h-9 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
                >
                    Hoy
                </button>
                <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <button onClick={prevMonth} className="p-2.5 hover:bg-gray-50 text-gray-500 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-sm font-bold text-gray-700 capitalize min-w-[130px] text-center">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </span>
                    <button onClick={nextMonth} className="p-2.5 hover:bg-gray-50 text-gray-500 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <button
                    onClick={() => navigate('/leads')}
                    className="flex items-center gap-2 px-4 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo Seguimiento
                </button>
            </div>
        </div>
    );

    /* ─── MOBILE HEADER ─────────────────────────────── */
    const renderMobileHeader = () => (
        <div className="md:hidden flex items-center justify-between mb-4">
            <div>
                <h1 className="text-xl font-black text-gray-900">Mi Agenda</h1>
                <p className="text-xs text-gray-400 capitalize">
                    {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                </p>
            </div>
            <button
                onClick={() => navigate('/leads')}
                className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200"
            >
                <Plus className="w-4 h-4 text-white" />
            </button>
        </div>
    );

    /* ─── DESKTOP SIDEBAR ───────────────────────────── */
    const renderSidebar = () => (
        <div className="hidden md:flex flex-col gap-4 w-48 shrink-0">
            {/* Mini Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <MiniCalendar currentDate={currentDate} onSelect={handleMiniSelect} />
            </div>

            {/* Leyenda + Resumen del día seleccionado */}
            {(() => {
                const dayEvts = getDailyEvents(selectedDate);
                const grouped: Record<string, CalendarEvent[]> = {};
                dayEvts.forEach(ev => {
                    const t = ev.action_type || 'call';
                    if (!grouped[t]) grouped[t] = [];
                    grouped[t].push(ev);
                });
                return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Leyenda</p>
                        <p className="text-xs font-bold text-indigo-600 capitalize mb-3">
                            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        <div className="space-y-1.5 overflow-y-auto max-h-[128px] pr-0.5">
                            {Object.entries(ACTION_CONFIG)
                                .filter(([type]) => (grouped[type] || []).length > 0)
                                .map(([type, cfg]) => {
                                    const evs = grouped[type] || [];
                                    const leadIds = evs.map(e => e.lead?.id).filter(Boolean);
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => navigate('/leads', { state: { leadIds, fromCalendar: true } })}
                                            title={`Ver ${evs.length} ${cfg.label}(s) del d\u00eda`}
                                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer group transition-all"
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} shrink-0`} />
                                            <span className="flex-1 text-xs font-medium text-gray-700 text-left">
                                                {cfg.label}
                                            </span>
                                            <span className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-semibold bg-indigo-100 text-indigo-700 group-hover:scale-110 transition-transform">
                                                {evs.length}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                );
            })()}
            {/* Asignados del día */}
            {(() => {
                const dayEvts = getDailyEvents(selectedDate);
                // Group by assigned profile
                const assignedMap: Record<string, {
                    id: string;
                    full_name: string;
                    avatar_url: string | null;
                    count: number;
                    leadIds: string[];
                }> = {};

                dayEvts.forEach(ev => {
                    const p = ev.assigned_profile;
                    if (!p) return;
                    if (!assignedMap[p.id]) {
                        assignedMap[p.id] = {
                            id: p.id,
                            full_name: p.full_name || 'Sin nombre',
                            avatar_url: p.avatar_url,
                            count: 0,
                            leadIds: [],
                        };
                    }
                    assignedMap[p.id]!.count += 1;
                    if (ev.lead?.id) assignedMap[p.id]!.leadIds.push(ev.lead.id);
                });

                const assignees = Object.values(assignedMap);
                if (assignees.length === 0) return null;

                return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Asignados</p>
                        <div className="space-y-1.5 overflow-y-auto max-h-[104px] pr-0.5">
                            {assignees.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => navigate('/leads', { state: { leadIds: a.leadIds, fromCalendar: true } })}
                                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all group cursor-pointer"
                                    title={`Ver ${a.count} seguimiento${a.count !== 1 ? 's' : ''} de ${a.full_name}`}
                                >
                                    {a.avatar_url ? (
                                        <img
                                            src={a.avatar_url}
                                            alt={a.full_name}
                                            className="w-7 h-7 rounded-full object-cover shrink-0 ring-2 ring-gray-100"
                                        />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-[10px] font-black">
                                            {a.full_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="flex-1 text-xs font-medium text-gray-700 text-left truncate group-hover:text-indigo-700 transition-colors">
                                        {a.full_name}
                                    </span>
                                    <span className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                                        {a.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );

    /* ─── DESKTOP MONTH GRID ────────────────────────── */
    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const days = eachDayOfInterval({
            start: startOfWeek(monthStart, { weekStartsOn: 0 }),
            end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
        });
        const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

        return (
            <div className="hidden md:flex flex-1 flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Week day headers */}
                <div className="grid grid-cols-7 border-b border-gray-100">
                    {weekDays.map(d => (
                        <div key={d} className="py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-gray-100">
                    {days.map((day) => {
                        const dayEvents = getDailyEvents(day);
                        const inMonth = isSameMonth(day, monthStart);
                        const isDayToday = isToday(day);
                        const MAX_VISIBLE = 4;

                        const isDaySelected = isSameDay(day, selectedDate);
                        return (
                            <div
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className={`min-h-[130px] p-2 flex flex-col transition-colors cursor-pointer
                                    ${!inMonth ? 'bg-gray-50/60' : 'bg-white'}
                                    ${isDayToday && !isDaySelected ? 'bg-indigo-50/30' : ''}
                                    ${isDaySelected ? 'ring-1 ring-inset ring-indigo-200 bg-indigo-50/20' : 'hover:bg-indigo-50/10'}
                                `}
                            >
                                {/* Date number + total badge */}
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className={`
                                        text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                                        ${isDayToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : ''}
                                        ${isDaySelected && !isDayToday ? 'text-indigo-600' : ''}
                                        ${!inMonth ? 'text-gray-300' : !isDayToday && !isDaySelected ? 'text-gray-700' : ''}
                                    `}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <button
                                            onClick={() => navigate('/leads', { state: { leadIds: dayEvents.map(e => e.lead?.id).filter(Boolean), fromCalendar: true } })}
                                            title={`Ver ${dayEvents.length} seguimiento${dayEvents.length !== 1 ? 's' : ''} del día`}
                                            className="min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-semibold transition-all hover:scale-110 flex items-center justify-center"
                                        >
                                            {dayEvents.length}
                                        </button>
                                    )}
                                </div>

                                {/* Event pills */}
                                <div className="flex flex-col gap-0.5 flex-1">
                                    {dayEvents.slice(0, MAX_VISIBLE).map(ev => {
                                        const cfg = getActionCfg(ev.action_type);
                                        const timeStr = formatTimeInZone(ev.date, companyTimezone);
                                        return (
                                            <button
                                                key={ev.id}
                                                onClick={(e) => { e.stopPropagation(); ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } }); }}
                                                title={`${ev.lead?.name ?? 'Lead'} · ${timeStr}`}
                                                className={`w-full text-left px-1.5 py-1 rounded-md transition-all ${cfg.pill} flex items-center gap-1`}
                                            >
                                                <span className="text-[10px] font-medium leading-tight flex-1 truncate">
                                                    {ev.lead?.name ?? 'Lead'}
                                                </span>
                                                <span className="text-[9px] opacity-60 shrink-0 leading-tight">
                                                    {timeStr}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {dayEvents.length > MAX_VISIBLE && (
                                        <button
                                            onClick={() => navigate('/leads', { state: { leadIds: dayEvents.map(e => e.lead?.id).filter(Boolean), fromCalendar: true } })}
                                            className="text-[9px] text-indigo-500 font-bold hover:text-indigo-700 text-left pl-1 mt-0.5 transition-colors"
                                        >
                                            + {dayEvents.length - MAX_VISIBLE} más
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    /* ─── MOBILE: summary badges ──────────────────── */
    const renderMobileSummary = () => {
        const hasSummary = Object.values(actionSummary).some(v => v.length > 0);
        if (!hasSummary) return null;
        return (
            <div className="md:hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Mis Seguimientos</p>
                <div className="flex flex-wrap gap-2">
                    {Object.keys(ACTION_CONFIG).map(type => {
                        const cfg = getActionCfg(type);
                        const events = actionSummary[type] || [];
                        if (events.length === 0) return null;
                        const Icon = cfg.Icon;
                        const leadIds = events.map(e => e.lead?.id).filter(Boolean);
                        return (
                            <button
                                key={type}
                                onClick={() => navigate('/leads', { state: { leadIds, fromCalendar: true } })}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${cfg.badge} hover:shadow-md transition-all`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${cfg.badgeText}`} />
                                <span className={`text-xs font-bold ${cfg.badgeText}`}>{cfg.label}</span>
                                <span className={`min-w-[20px] h-5 rounded-full ${cfg.dotColor} text-white text-[10px] font-black flex items-center justify-center px-1`}>
                                    {events.length}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    /* ─── MOBILE: Week strip + Timeline ──────────── */
    const renderTimelineView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(start, i));
        const todaysEvents = getDailyEvents(selectedDate);

        return (
            <div className="md:hidden space-y-4 animate-in slide-in-from-right duration-300">
                {/* Week navigation header */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Month nav */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                        <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-black text-gray-700 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </span>
                        <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day pills */}
                    <div className="flex justify-between px-2 py-3">
                        {weekDays.map(day => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isDayToday = isToday(day);
                            const hasEvents = getDailyEvents(day).length > 0;

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-all ${isSelected
                                        ? 'bg-indigo-600 shadow-lg shadow-indigo-200 scale-105'
                                        : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <span className={`text-[10px] font-black uppercase ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                                        {format(day, 'EEE', { locale: es })}
                                    </span>
                                    <span className={`text-base font-black ${isSelected ? 'text-white' : isDayToday ? 'text-indigo-600' : 'text-gray-800'
                                        }`}>
                                        {format(day, 'd')}
                                    </span>
                                    {hasEvents && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-200' : 'bg-indigo-500'}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Events count header */}
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-gray-800 text-sm">
                        {todaysEvents.length > 0
                            ? `${todaysEvents.length} Evento${todaysEvents.length !== 1 ? 's' : ''}`
                            : 'Sin eventos'}
                    </h3>
                </div>

                {/* Timeline */}
                {todaysEvents.length > 0 ? (
                    <div className="relative space-y-3 pb-24">
                        {/* Vertical line */}
                        <div className="absolute left-4 top-2 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-gray-100 to-transparent" />

                        {todaysEvents.map(ev => {
                            const cfg = getActionCfg(ev.action_type);
                            const timeStr = formatTimeInZone(ev.date, companyTimezone);
                            const Icon = cfg.Icon;

                            return (
                                <div key={ev.id} className="relative pl-10">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-2 top-4 w-4 h-4 rounded-full ${cfg.dotColor} shadow-md ring-2 ring-white z-10 flex items-center justify-center`}>
                                        <Icon className="w-2.5 h-2.5 text-white" />
                                    </div>

                                    {/* Card */}
                                    <div
                                        onClick={() => ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } })}
                                        className="relative bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                                    >
                                        {/* Top row */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`
                                                inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide
                                                ${cfg.badge} ${cfg.badgeText}
                                            `}>
                                                <Icon className="w-2.5 h-2.5" />
                                                {cfg.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    {timeStr}
                                                </span>
                                                {ev.assigned_profile ? (
                                                    ev.assigned_profile.avatar_url ? (
                                                        <img
                                                            src={ev.assigned_profile.avatar_url}
                                                            alt={ev.assigned_profile.full_name ?? ''}
                                                            title={ev.assigned_profile.full_name ?? ''}
                                                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                                                        />
                                                    ) : (
                                                        <div
                                                            title={ev.assigned_profile.full_name ?? ''}
                                                            className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black ring-2 ring-white shadow-sm shrink-0"
                                                        >
                                                            {(ev.assigned_profile.full_name ?? '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Lead info */}
                                        <h4 className="font-black text-gray-900 text-base leading-tight mb-0.5">
                                            {ev.lead?.name ?? '—'}
                                        </h4>
                                        {ev.lead?.company_name && (
                                            <p className="text-xs text-gray-400 font-medium mb-2">{ev.lead.company_name}</p>
                                        )}
                                        {ev.notes && (
                                            <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg px-2.5 py-1.5 mt-2 truncate">
                                                "{ev.notes}"
                                            </p>
                                        )}

                                        {/* Quick actions */}
                                        {(ev.lead?.phone || ev.lead?.email) && (
                                            <div className="flex gap-2 mt-3">
                                                {ev.lead.phone && (
                                                    <a
                                                        href={`tel:${ev.lead.phone}`}
                                                        onClick={e => e.stopPropagation()}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        Llamar
                                                    </a>
                                                )}
                                                {ev.lead.email && (
                                                    <a
                                                        href={`mailto:${ev.lead.email}`}
                                                        onClick={e => e.stopPropagation()}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors"
                                                    >
                                                        <Mail className="w-3 h-3" />
                                                        Email
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {/* Avatar asignado — esquina inferior derecha */}
                                        {ev.assigned_profile && (
                                            ev.assigned_profile.avatar_url ? (
                                                <img
                                                    src={ev.assigned_profile.avatar_url}
                                                    alt={ev.assigned_profile.full_name ?? ''}
                                                    title={ev.assigned_profile.full_name ?? ''}
                                                    className="absolute bottom-3 right-3 w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-md"
                                                />
                                            ) : (
                                                <div
                                                    title={ev.assigned_profile.full_name ?? ''}
                                                    className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black ring-2 ring-white shadow-md"
                                                >
                                                    {(ev.assigned_profile.full_name ?? '?').charAt(0).toUpperCase()}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
                            <CalendarDays className="w-8 h-8 text-indigo-300" />
                        </div>
                        <p className="text-gray-600 font-bold">¡Día libre!</p>
                        <p className="text-sm text-gray-400 mt-1">No hay seguimientos para hoy</p>
                    </div>
                )}
            </div>
        );
    };

    /* ─── ROOT ──────────────────────────────────────── */
    return (
        <div className="max-w-7xl mx-auto">
            {/* Mobile header */}
            {renderMobileHeader()}

            {/* Desktop header */}
            {renderHeader()}

            {loading ? (
                <div className="flex justify-center p-20">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-indigo-100" />
                        <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin absolute inset-0" />
                    </div>
                </div>
            ) : (
                <>
                    {/* Mobile summary badges */}
                    {renderMobileSummary()}

                    {/* Desktop layout: sidebar + grid */}
                    <div className="hidden md:flex gap-5 items-start">
                        {renderSidebar()}
                        {renderMonthView()}
                    </div>

                    {/* Mobile: timeline */}
                    {renderTimelineView()}
                </>
            )}
        </div>
    );
}
