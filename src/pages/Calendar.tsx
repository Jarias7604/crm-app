import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay,
    eachDayOfInterval, addWeeks, subWeeks, addDays, isToday, isBefore
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft, ChevronRight, Clock, Plus, Phone, Mail,
    CalendarDays, MessageSquare, Video, FileText, SlidersHorizontal,
    CheckCircle2, Circle, RotateCcw, X
} from 'lucide-react';
import { leadsService } from '../services/leads';
import { supabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useTimezone } from '../hooks/useTimezone';
import { formatTimeInZone, utcToLocalDate, DEFAULT_TIMEZONE } from '../utils/timezone';
import toast from 'react-hot-toast';

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
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
    const [showAssigneeFilter, setShowAssigneeFilter] = useState(false);
    const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);
    const queryClient = useQueryClient();

    // Ventana dinámica: 1 mes atrás + 2 meses adelante de la vista actual
    // Así solo cargamos los eventos del periodo visible, no los 1,100+ registros
    const windowStart = useMemo(() =>
        startOfMonth(subMonths(currentDate, 1)).toISOString(),
        [currentDate]
    );
    const windowEnd = useMemo(() =>
        endOfMonth(addMonths(currentDate, 2)).toISOString(),
        [currentDate]
    );

    // React Query — cache 5 min por ventana de mes
    // queryKey incluye fechas: navegar de mes cambia la clave → carga solo lo necesario
    const { data: calendarEventsData, isLoading: loading } = useQuery({
        queryKey: ['calendar-follow-ups', windowStart, windowEnd],
        queryFn: () => leadsService.getCalendarFollowUps(windowStart, windowEnd),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        placeholderData: (previousData) => previousData, // muestra mes anterior mientras carga el nuevo
    });
    const calendarEvents = calendarEventsData ?? [];

    // Realtime: invalidar cache de todas las ventanas cuando cambia un follow-up
    useEffect(() => {
        const channel = supabase.channel('calendar-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' },
                () => queryClient.invalidateQueries({ queryKey: ['calendar-follow-ups'] })
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);


    // Role-based filtering: collaborators see only their own
    const filteredEvents = useMemo(() => {
        if (isAdmin) return calendarEvents;
        return calendarEvents.filter(ev => ev.assigned_to === profile?.id);
    }, [calendarEvents, isAdmin, profile?.id]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextWeek = () => { setCurrentDate(addWeeks(currentDate, 1)); setSelectedDate(addWeeks(selectedDate, 1)); };
    const prevWeek = () => { setCurrentDate(subWeeks(currentDate, 1)); setSelectedDate(subWeeks(selectedDate, 1)); };

    // Toggle completion on a follow-up — optimistic update via React Query cache
    const handleToggleComplete = useCallback(async (evId: string, currentCompleted: boolean) => {
        try {
            await leadsService.markFollowUpCompleted(evId, !currentCompleted);
            // Optimistic update: mutar el cache directamente sin recargar de la DB
            queryClient.setQueryData<CalendarEvent[]>(['calendar-follow-ups'], (prev) =>
                (prev ?? []).map(ev =>
                    ev.id === evId
                        ? { ...ev, completed: !currentCompleted, completed_at: !currentCompleted ? new Date().toISOString() : null }
                        : ev
                )
            );
            toast.success(!currentCompleted ? '✅ Seguimiento completado' : '↩️ Marcado como pendiente');
        } catch (err) {
            toast.error('Error al actualizar seguimiento');
        }
    }, [queryClient]);

    const getDailyEvents = (date: Date): CalendarEvent[] =>
        filteredEvents
            .filter(ev => ev.date && isSameDay(utcToLocalDate(ev.date, companyTimezone), date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    /* Summary: count per action type across all UPCOMING events */
    const actionSummary = useMemo(() => {
        const today = new Date();
        const counts: Record<string, CalendarEvent[]> = {};
        filteredEvents
            .filter(ev => ev.date && !isBefore(utcToLocalDate(ev.date, companyTimezone), today))
            .forEach(ev => {
                const t = ev.action_type || 'call';
                if (!counts[t]) counts[t] = [];
                counts[t].push(ev);
            });
        return counts;
    }, [filteredEvents, companyTimezone]);

    /* Helper: get completion stats for a day */
    const getDayProgress = (date: Date) => {
        const dayEvts = getDailyEvents(date);
        const total = dayEvts.length;
        const completed = dayEvts.filter(ev => ev.completed).length;
        const isPast = isBefore(date, new Date()) && !isToday(date);
        return { total, completed, isPast };
    };

    /* Unique assignees for the selected day — used by mobile filter */
    const dayAssignees = useMemo(() => {
        const map = new Map<string, { id: string; full_name: string | null; avatar_url: string | null; count: number }>();
        getDailyEvents(selectedDate).forEach(ev => {
            if (ev.assigned_profile?.id) {
                const id = ev.assigned_profile.id;
                if (!map.has(id)) map.set(id, { id, full_name: ev.assigned_profile.full_name ?? null, avatar_url: ev.assigned_profile.avatar_url ?? null, count: 0 });
                map.get(id)!.count++;
            }
        });
        return Array.from(map.values());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calendarEvents, selectedDate, companyTimezone]);

    const dayEventsTotal = useMemo(() => getDailyEvents(selectedDate).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [calendarEvents, selectedDate, companyTimezone]);
    const activeAssignee = selectedAssigneeId ? dayAssignees.find(a => a.id === selectedAssigneeId) ?? null : null;

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
            <div className="flex items-center gap-3">
                {dayAssignees.length > 0 && (
                    <>
                        <button
                            onClick={() => setShowAssigneeFilter(true)}
                            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                            style={activeAssignee ? {} : { background: 'rgb(238 242 255)' }}
                        >
                            {activeAssignee ? (
                                <>
                                    {activeAssignee.avatar_url ? (
                                        <img
                                            src={activeAssignee.avatar_url}
                                            alt={activeAssignee.full_name ?? ''}
                                            className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-300"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-xl bg-indigo-200 text-indigo-800 flex items-center justify-center text-sm font-black ring-2 ring-indigo-300">
                                            {(activeAssignee.full_name ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                                        {activeAssignee.count}
                                    </span>
                                </>
                            ) : (
                                <SlidersHorizontal className="w-4 h-4 text-indigo-500" strokeWidth={2.5} />
                            )}
                        </button>
                        <span className="text-gray-300 font-light text-lg select-none">|</span>
                    </>
                )}
                <button
                    onClick={() => navigate('/leads')}
                    className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200"
                >
                    <Plus className="w-4 h-4 text-white" />
                </button>
            </div>
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
                const completedCount = dayEvts.filter(ev => ev.completed).length;
                const totalCount = dayEvts.length;
                const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                const barColor = pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : pct > 0 ? 'bg-red-500' : 'bg-gray-200';
                const textColor = pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-amber-600' : pct > 0 ? 'text-red-600' : 'text-gray-400';

                return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Leyenda</p>
                        <p className="text-xs font-bold text-indigo-600 capitalize mb-3">
                            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                        </p>

                        {/* Progress bar */}
                        {totalCount > 0 && (
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[10px] font-black text-gray-500 uppercase">Cumplimiento</span>
                                    <span className={`text-xs font-black ${textColor}`}>
                                        {completedCount}/{totalCount} ({pct}%)
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5 overflow-y-auto max-h-[128px] pr-0.5">
                            {Object.entries(ACTION_CONFIG)
                                .filter(([type]) => (grouped[type] || []).length > 0)
                                .map(([type, cfg]) => {
                                    const evs = grouped[type] || [];
                                    const doneCount = evs.filter(e => e.completed).length;
                                    const leadIds = evs.map(e => e.lead?.id).filter(Boolean);
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => navigate('/leads', { state: { leadIds, fromCalendar: true } })}
                                            title={`${doneCount}/${evs.length} ${cfg.label}(s) completados`}
                                            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer group transition-all"
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor} shrink-0`} />
                                            <span className="flex-1 text-xs font-medium text-gray-700 text-left">
                                                {cfg.label}
                                            </span>
                                            <span className={`min-w-[28px] h-5 px-1.5 rounded-full flex items-center justify-center text-[9px] font-black group-hover:scale-110 transition-transform ${
                                                doneCount === evs.length ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {doneCount}/{evs.length}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>

                        {/* Status Legend */}
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Estados</p>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-[11px] text-gray-600">Completado</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Circle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span className="text-[11px] text-gray-600">Vencido sin hacer</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shrink-0" />
                                <span className="text-[11px] text-gray-600">Pendiente (agendado)</span>
                            </div>
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
                                {/* Date number + progress badge */}
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className={`
                                        text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                                        ${isDayToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : ''}
                                        ${isDaySelected && !isDayToday ? 'text-indigo-600' : ''}
                                        ${!inMonth ? 'text-gray-300' : !isDayToday && !isDaySelected ? 'text-gray-700' : ''}
                                    `}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayEvents.length > 0 && (() => {
                                        const { total, completed, isPast } = getDayProgress(day);
                                        const pct = total > 0 ? (completed / total) * 100 : 0;
                                        const bgColor = pct === 100 ? 'bg-emerald-100 text-emerald-700' : isPast && pct < 100 ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700';
                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const allLeadIds = dayEvents.map(e => e.lead?.id).filter(Boolean) as string[];
                                                    const completedLeadIds = dayEvents.filter(e => e.completed).map(e => e.lead?.id).filter(Boolean) as string[];
                                                    navigate('/leads', {
                                                        state: {
                                                            leadIds: allLeadIds,
                                                            completedLeadIds,
                                                            fromCalendar: true,
                                                            calendarDate: format(day, "EEEE d 'de' MMMM", { locale: es })
                                                        }
                                                    });
                                                }}
                                                title={`${completed}/${total} completados — click para ver en Leads`}
                                                className={`min-w-[28px] h-5 px-1.5 rounded-full ${bgColor} text-[9px] font-black transition-all hover:scale-110 flex items-center justify-center gap-0.5`}
                                            >
                                                {pct === 100 && <CheckCircle2 className="w-2.5 h-2.5" />}
                                                {completed}/{total}
                                            </button>
                                        );
                                    })()}
                                </div>

                                {/* Event pills */}
                                <div className="flex flex-col gap-0.5 flex-1">
                                    {dayEvents.slice(0, MAX_VISIBLE).map(ev => {
                                        const cfg = getActionCfg(ev.action_type);
                                        const timeStr = formatTimeInZone(ev.date, companyTimezone);
                                        const isOverdue = !ev.completed && isBefore(utcToLocalDate(ev.date, companyTimezone), new Date()) && !isToday(utcToLocalDate(ev.date, companyTimezone));
                                        return (
                                            <button
                                                key={ev.id}
                                                onClick={(e) => { e.stopPropagation(); ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } }); }}
                                                title={`${ev.lead?.name ?? 'Lead'} · ${timeStr}${ev.completed ? ' ✅' : isOverdue ? ' ⚠️ Vencido' : ''}`}
                                                className={`w-full text-left px-1.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                                    ev.completed
                                                        ? 'bg-emerald-50 text-emerald-600 border-l-2 border-emerald-400 opacity-70'
                                                        : isOverdue
                                                            ? 'bg-red-50 text-red-700 border-l-2 border-red-400'
                                                            : cfg.pill
                                                }`}
                                            >
                                                {ev.completed ? (
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                ) : isOverdue ? (
                                                    <Circle className="w-3 h-3 text-red-400 shrink-0" />
                                                ) : null}
                                                <span className={`text-[10px] font-medium leading-tight flex-1 truncate ${ev.completed ? 'line-through' : ''}`}>
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
        const todaysEvents = getDailyEvents(selectedDate)
            .filter(ev => !selectedAssigneeId || ev.assigned_profile?.id === selectedAssigneeId);

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

                {/* Events count header with progress */}
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-gray-800 text-sm">
                        {todaysEvents.length > 0
                            ? `${todaysEvents.length} Evento${todaysEvents.length !== 1 ? 's' : ''}`
                            : 'Sin eventos'}
                    </h3>
                    {todaysEvents.length > 0 && (() => {
                        const completed = todaysEvents.filter(ev => ev.completed).length;
                        const total = todaysEvents.length;
                        const pct = Math.round((completed / total) * 100);
                        const color = pct === 100 ? 'text-emerald-600 bg-emerald-50' : pct > 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                        return (
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${color}`}>
                                {pct === 100 && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {completed}/{total}
                                <span className="font-semibold opacity-70">({pct}%)</span>
                            </span>
                        );
                    })()}
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
                            const isOverdue = !ev.completed && isBefore(utcToLocalDate(ev.date, companyTimezone), new Date()) && !isToday(utcToLocalDate(ev.date, companyTimezone));

                            return (
                                <div key={ev.id} className="relative pl-10">
                                    {/* Timeline dot — green if completed, red if overdue */}
                                    <div className={`absolute left-2 top-4 w-4 h-4 rounded-full shadow-md ring-2 ring-white z-10 flex items-center justify-center ${
                                        ev.completed ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : cfg.dotColor
                                    }`}>
                                        {ev.completed ? (
                                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                        ) : (
                                            <Icon className="w-2.5 h-2.5 text-white" />
                                        )}
                                    </div>

                                    {/* Card */}
                                    <div
                                        onClick={() => ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } })}
                                        className={`relative p-4 rounded-2xl border shadow-sm active:scale-[0.98] transition-transform cursor-pointer ${
                                            ev.completed
                                                ? 'bg-emerald-50/50 border-emerald-200'
                                                : isOverdue
                                                    ? 'bg-red-50/30 border-red-200'
                                                    : 'bg-white border-gray-100'
                                        }`}
                                    >
                                        {/* Top row */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`
                                                    inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide
                                                    ${ev.completed ? 'bg-emerald-100 border border-emerald-200 text-emerald-700' : cfg.badge + ' ' + cfg.badgeText}
                                                `}>
                                                    {ev.completed ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Icon className="w-2.5 h-2.5" />}
                                                    {ev.completed ? 'Hecho' : isOverdue ? '⚠ Vencido' : cfg.label}
                                                </span>
                                            </div>
                                            <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                                                <Clock className="w-3 h-3" />
                                                {timeStr}
                                            </span>
                                        </div>

                                        {/* Lead info */}
                                        <h4 className={`font-black text-base leading-tight mb-0.5 ${ev.completed ? 'text-emerald-800 line-through opacity-70' : 'text-gray-900'}`}>
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

                                        {/* Quick actions row */}
                                        <div className="flex items-center gap-2 mt-3">
                                            {/* Complete / Undo button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleComplete(ev.id, ev.completed); }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                                    ev.completed
                                                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        : 'bg-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600'
                                                }`}
                                            >
                                                {ev.completed ? (
                                                    <><RotateCcw className="w-3 h-3" /> Deshacer</>
                                                ) : (
                                                    <><CheckCircle2 className="w-3 h-3" /> Completar</>
                                                )}
                                            </button>
                                            {!ev.completed && ev.lead?.phone && (
                                                <a
                                                    href={`tel:${ev.lead.phone}`}
                                                    onClick={e => e.stopPropagation()}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                    Llamar
                                                </a>
                                            )}
                                            {!ev.completed && ev.lead?.email && (
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
                                        {/* Avatar asignado — esquina inferior derecha */}
                                        {ev.assigned_profile && (
                                            ev.assigned_profile.avatar_url ? (
                                                <img
                                                    src={ev.assigned_profile.avatar_url}
                                                    alt={ev.assigned_profile.full_name ?? ''}
                                                    title={ev.assigned_profile.full_name ?? ''}
                                                    className="absolute top-3 right-3 w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-md"
                                                />
                                            ) : (
                                                <div
                                                    title={ev.assigned_profile.full_name ?? ''}
                                                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black ring-2 ring-white shadow-md"
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

            {/* Assignee filter — premium iOS sheet */}
            {showAssigneeFilter && (
                <div
                    className="fixed inset-0 z-[9999] flex items-end"
                    style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.45)' }}
                    onClick={() => setShowAssigneeFilter(false)}
                >
                    <div
                        className="w-full rounded-t-[32px] overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-12 h-1.5 rounded-full bg-gray-300/80" />
                        </div>

                        {/* Title */}
                        <div className="px-6 pt-3 pb-4">
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.12em] text-center">Asignado</p>
                        </div>

                        {/* Items */}
                        <div className="px-4 pb-2 space-y-1">
                            {/* Todos */}
                            <button
                                onClick={() => { setSelectedAssigneeId(null); setShowAssigneeFilter(false); }}
                                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                                style={!selectedAssigneeId ? { background: 'rgb(239 246 255)' } : {}}
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="9" cy="7" r="3" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                                        <circle cx="17" cy="7" r="3" opacity=".5" /><path d="M21 21v-2a4 4 0 0 0-3-3.87" opacity=".5" />
                                    </svg>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-[15px] font-semibold text-gray-900 leading-tight">Todos</p>
                                    <p className="text-[12px] text-gray-400 mt-0.5">{dayEventsTotal} seguimiento{dayEventsTotal !== 1 ? 's' : ''}</p>
                                </div>
                                {!selectedAssigneeId && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>

                            {/* Thin separator */}
                            <div className="mx-4 h-px bg-gray-100" />

                            {dayAssignees.map((a, idx) => (
                                <div key={a.id}>
                                    <button
                                        onClick={() => { setSelectedAssigneeId(a.id); setShowAssigneeFilter(false); }}
                                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                                        style={selectedAssigneeId === a.id ? { background: 'rgb(239 246 255)' } : {}}
                                    >
                                        {a.avatar_url ? (
                                            <img
                                                src={a.avatar_url}
                                                alt={a.full_name ?? ''}
                                                className="w-12 h-12 rounded-full object-cover shrink-0 shadow-sm ring-2 ring-gray-100"
                                            />
                                        ) : (
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm text-lg font-bold text-white"
                                                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                            >
                                                {(a.full_name ?? '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 text-left">
                                            <p className="text-[15px] font-semibold text-gray-900 leading-tight">{a.full_name ?? 'Sin nombre'}</p>
                                            <p className="text-[12px] text-gray-400 mt-0.5">{a.count} seguimiento{a.count !== 1 ? 's' : ''}</p>
                                        </div>
                                        {selectedAssigneeId === a.id ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                                        )}
                                    </button>
                                    {idx < dayAssignees.length - 1 && <div className="mx-4 h-px bg-gray-100" />}
                                </div>
                            ))}
                        </div>

                        {/* Safe area bottom + cancel */}
                        <div className="px-4 pt-2 pb-8">
                            <button
                                onClick={() => setShowAssigneeFilter(false)}
                                className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-[15px] active:scale-[0.98] transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}


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

            {/* Day Detail Modal */}
            {dayDetailDate && (() => {
                const dayEvts = getDailyEvents(dayDetailDate);
                const doneCount = dayEvts.filter(e => e.completed).length;
                const totalCount = dayEvts.length;
                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
                const pctColor = pct === 100 ? 'text-emerald-600' : pct > 50 ? 'text-amber-600' : 'text-red-600';
                const barColor = pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDayDetailDate(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                            {/* Header */}
                            <div className="p-5 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-black text-gray-900 capitalize">
                                            {format(dayDetailDate, "EEEE d 'de' MMMM", { locale: es })}
                                        </h2>
                                        <p className="text-sm text-gray-400 mt-0.5">
                                            Seguimientos del día
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-black ${pctColor}`}>{doneCount}/{totalCount}</span>
                                        <button onClick={() => setDayDetailDate(null)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                                            <X className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="mt-3 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>

                            {/* List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {dayEvts.map(ev => {
                                    const cfg = getActionCfg(ev.action_type);
                                    const Icon = cfg.Icon;
                                    const timeStr = formatTimeInZone(ev.date, companyTimezone);
                                    const isOverdue = !ev.completed && isBefore(utcToLocalDate(ev.date, companyTimezone), new Date()) && !isToday(utcToLocalDate(ev.date, companyTimezone));

                                    return (
                                        <div key={ev.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                            ev.completed
                                                ? 'bg-emerald-50/50 border-emerald-200'
                                                : isOverdue
                                                    ? 'bg-red-50/30 border-red-200'
                                                    : 'bg-white border-gray-100'
                                        }`}>
                                            {/* Status icon */}
                                            <button
                                                onClick={() => handleToggleComplete(ev.id, ev.completed)}
                                                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                                    ev.completed
                                                        ? 'bg-emerald-500 text-white'
                                                        : isOverdue
                                                            ? 'bg-red-100 text-red-500 hover:bg-red-200'
                                                            : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-500'
                                                }`}
                                                title={ev.completed ? 'Desmarcar' : 'Marcar como completado'}
                                            >
                                                {ev.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                            </button>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <button
                                                    onClick={() => { setDayDetailDate(null); ev.lead && navigate('/leads', { state: { leadId: ev.lead.id } }); }}
                                                    className={`text-sm font-bold text-left hover:text-indigo-600 transition-colors ${
                                                        ev.completed ? 'text-emerald-700 line-through opacity-70' : 'text-gray-900'
                                                    }`}
                                                >
                                                    {ev.lead?.name ?? '—'}
                                                </button>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${ev.completed ? 'text-emerald-600' : cfg.badgeText}`}>
                                                        <Icon className="w-2.5 h-2.5" />
                                                        {ev.completed ? 'Hecho' : isOverdue ? '⚠ Vencido' : cfg.label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">{timeStr}</span>
                                                    {ev.lead?.company_name && <span className="text-[10px] text-gray-300">• {ev.lead.company_name}</span>}
                                                </div>
                                            </div>

                                            {/* Assignee */}
                                            {ev.assigned_profile && (
                                                ev.assigned_profile.avatar_url ? (
                                                    <img src={ev.assigned_profile.avatar_url} alt={ev.assigned_profile.full_name ?? ''} title={ev.assigned_profile.full_name ?? ''} className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0" />
                                                ) : (
                                                    <div title={ev.assigned_profile.full_name ?? ''} className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black ring-2 ring-white shadow-sm shrink-0">
                                                        {(ev.assigned_profile.full_name ?? '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
