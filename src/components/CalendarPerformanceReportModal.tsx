import React, { useState, useEffect, useMemo } from 'react';
import {
    format,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    subMonths,
    eachDayOfInterval,
    isAfter,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    X,
    Clock,
    BarChart3,
    Printer,
    ChevronDown,
    Phone,
    MessageSquare,
    Mail,
    Video,
    FileText,
    Award,
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { isAutoWhatsAppCampaignFollowUp } from '../services/leads';
import { formatTimeInZone, localToUtcISO } from '../utils/timezone';

type PeriodMode = 'day' | 'week' | '1m' | '2m' | '3m' | '6m' | '9m' | '12m' | 'custom';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    initialDate: Date;
    companyId: string;
    companyTimezone: string;
    onNavigateLead?: (leadId: string) => void;
}

interface RawFollowUp {
    id: string;
    date: string;
    notes: string | null;
    action_type: string;
    assigned_to: string | null;
    completed: boolean;
    completed_at: string | null;
    lead: { id: string; name: string; company_name: string | null } | null;
}

interface RawCallActivity {
    id: string;
    user_id: string;
    lead_id: string;
    call_date: string;
    duration_seconds: number | null;
    action_type: string;
    outcome: string;
    notes: string | null;
    status_before?: string | null;
    status_after?: string | null;
    lead: {
        id: string;
        name: string;
        company_name: string | null;
        status?: string | null;
        value?: number | null;
        document_path?: string | null;
    } | null;
}

interface RawWonLead {
    id: string;
    name: string;
    company_name: string | null;
    status: string;
    assigned_to: string | null;
    closing_amount: number | null;
    value: number | null;
    internal_won_date: string | null;
    updated_at?: string | null;
}

interface RawQuote {
    id: string;
    lead_id: string | null;
    nombre_cliente: string | null;
    total_anual: number | null;
    estado?: string | null;
    created_by: string | null;
    created_at: string;
    lead?: { id: string; name: string; assigned_to: string | null } | null;
}

interface AdvisorProfile {
    id: string;
    full_name: string;
    role: string;
    avatar_url: string | null;
}

interface TimeGap {
    dayLabel: string;
    fromTime: string;
    toTime: string;
    minutes: number;
}

interface DemoEntry {
    id: string;
    leadId: string | null;
    leadName: string;
    dateStr: string;
    source: string;
    notes: string | null;
    completed: boolean;
}

interface QuoteEntry {
    id: string;
    leadId: string | null;
    clientName: string;
    amount: number;
    dateStr: string;
    isNewInPeriod: boolean;
}

interface AdvisorMetrics {
    advisor: AdvisorProfile;
    scheduledTotal: number;
    scheduledCompleted: number;
    scheduledPending: number;
    agendaPct: number;
    executedTotal: number;
    executedConnected: number;
    executedExtra: number;
    demosCount: number;
    quotesCount: number;
    quotedFollowUpsCount: number;
    quotedFollowUpsAmount: number;
    wonCount: number;
    wonAmount: number;
    effectiveMinutes: number;
    activeSpanMinutes: number;
    unaccountedMinutes: number;
    expectedWorkMinutes: number;
    firstActionTime: string | null;
    lastActionTime: string | null;
    activeDaysCount: number;
    scheduledItems: RawFollowUp[];
    executedItems: RawCallActivity[];
    demosList: DemoEntry[];
    quotesCreatedList: QuoteEntry[];
    quotedFollowUpsList: QuoteEntry[];
    wonLeadsList: RawWonLead[];
    gaps: TimeGap[];
}

const PERIOD_OPTIONS: { id: PeriodMode; label: string }[] = [
    { id: 'day', label: 'Día' },
    { id: 'week', label: 'Semana' },
    { id: '1m', label: '1 Mes' },
    { id: '2m', label: '2 Meses' },
    { id: '3m', label: '3 Meses' },
    { id: '6m', label: '6 Meses' },
    { id: '9m', label: '9 Meses' },
    { id: '12m', label: '1 Año' },
    { id: 'custom', label: 'Rango' },
];

function formatDurationMinutes(totalMins: number): string {
    if (totalMins <= 0) return '0m';
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/**
 * Converts a UTC ISO string into a Date object whose local getters (getFullYear,
 * getMonth, getDate, getHours, getMinutes) reflect the exact wall-clock time
 * in the target IANA timezone.
 */
function utcToZonedDateTime(utcStr: string, ianaTimezone: string): Date {
    try {
        const formatter = new Intl.DateTimeFormat('sv', {
            timeZone: ianaTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const formatted = formatter.format(new Date(utcStr)); // "YYYY-MM-DD HH:mm:ss"
        const [datePart, timePart] = formatted.split(' ');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hr, min, sec] = (timePart || '12:00:00').split(':').map(Number);
        return new Date(y, m - 1, d, hr || 0, min || 0, sec || 0);
    } catch {
        return new Date(utcStr);
    }
}

function getActionLabel(type: string): string {
    switch (type) {
        case 'call':
            return 'Llamada';
        case 'whatsapp':
            return 'WhatsApp';
        case 'email':
            return 'Correo';
        case 'meeting':
            return 'Demo / Reunión';
        case 'quote':
        case 'quote_sent':
            return 'Cotización';
        default:
            return 'Seguimiento';
    }
}

function getActionIcon(type: string) {
    switch (type) {
        case 'whatsapp':
            return MessageSquare;
        case 'email':
            return Mail;
        case 'meeting':
            return Video;
        case 'quote':
        case 'quote_sent':
            return FileText;
        default:
            return Phone;
    }
}

/**
 * Strict validation for whether a scheduled follow_up in the calendar is a Demo / Visit.
 * Excludes notes that are merely phone calls to coordinate/reschedule a demo.
 */
function isScheduledDemoFollowUp(actionType?: string | null, notes?: string | null): boolean {
    if (actionType === 'meeting') return true;
    if (!notes) return false;
    const clean = notes.trim();
    // Exclude notes that are follow-up calls to coordinate, schedule, or reschedule a demo
    if (
        /\b(programar|programaci[oó]n|reprogramar|reprogramaci[oó]n|reprogramci[oó]n|coordinar|concertar|agendar|seguimiento|credenciales|llamar|validar)\b/i.test(
            clean
        )
    ) {
        return false;
    }
    return /^(demo(\s+virtual|\s+presencial)?|visita\s+presencial|presentaci[oó]n(\s+de\s+sistema)?|reuni[oó]n(\s+virtual|\s+presencial)?)$/i.test(
        clean
    );
}

/**
 * Strict validation for whether an executed activity in call_activities is a real Demo / Meeting.
 * Phone calls ('call'), WhatsApps ('whatsapp'), and Emails ('email') that merely mention the word
 * "demo" in their notes (e.g. "se llama para coordinar demo") are NOT executed demos.
 */
function isExecutedDemoActivity(actionType?: string | null): boolean {
    return actionType === 'meeting';
}

export const CalendarPerformanceReportModal: React.FC<Props> = ({
    isOpen,
    onClose,
    initialDate,
    companyId,
    companyTimezone,
    onNavigateLead,
}) => {
    const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
    const [selectedDayStr, setSelectedDayStr] = useState<string>(() => format(initialDate, 'yyyy-MM-dd'));
    const [customFromStr, setCustomFromStr] = useState<string>(() => format(startOfMonth(initialDate), 'yyyy-MM-dd'));
    const [customToStr, setCustomToStr] = useState<string>(() => format(initialDate, 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);
    const [profiles, setProfiles] = useState<AdvisorProfile[]>([]);
    const [followUps, setFollowUps] = useState<RawFollowUp[]>([]);
    const [callActivities, setCallActivities] = useState<RawCallActivity[]>([]);
    const [wonLeads, setWonLeads] = useState<RawWonLead[]>([]);
    const [quotes, setQuotes] = useState<RawQuote[]>([]);
    const [expandedAdvisorId, setExpandedAdvisorId] = useState<string | null>(null);
    const [filterView, setFilterView] = useState<'all' | 'active' | 'inactive'>('all');

    useEffect(() => {
        if (isOpen) {
            setSelectedDayStr(format(initialDate, 'yyyy-MM-dd'));
        }
    }, [isOpen, initialDate]);

    const dateWindow = useMemo(() => {
        const baseDate = selectedDayStr ? new Date(`${selectedDayStr}T12:00:00`) : initialDate;
        let start = new Date(baseDate);
        let end = new Date(baseDate);

        if (periodMode === 'day') {
            start = new Date(`${selectedDayStr}T00:00:00`);
            end = new Date(`${selectedDayStr}T23:59:59.999`);
        } else if (periodMode === 'week') {
            const ws = startOfWeek(baseDate, { weekStartsOn: 1 });
            const we = endOfWeek(baseDate, { weekStartsOn: 1 });
            start = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate(), 0, 0, 0);
            end = new Date(we.getFullYear(), we.getMonth(), we.getDate(), 23, 59, 59, 999);
        } else if (periodMode === '1m') {
            const ms = startOfMonth(baseDate);
            const me = endOfMonth(baseDate);
            start = new Date(ms.getFullYear(), ms.getMonth(), ms.getDate(), 0, 0, 0);
            end = new Date(me.getFullYear(), me.getMonth(), me.getDate(), 23, 59, 59, 999);
        } else if (['2m', '3m', '6m', '9m', '12m'].includes(periodMode)) {
            const monthsBack = parseInt(periodMode.replace('m', ''), 10) - 1;
            const ms = startOfMonth(subMonths(baseDate, monthsBack));
            const me = endOfMonth(baseDate);
            start = new Date(ms.getFullYear(), ms.getMonth(), ms.getDate(), 0, 0, 0);
            end = new Date(me.getFullYear(), me.getMonth(), me.getDate(), 23, 59, 59, 999);
        } else if (periodMode === 'custom') {
            const f = customFromStr || format(baseDate, 'yyyy-MM-dd');
            const t = customToStr || format(baseDate, 'yyyy-MM-dd');
            start = new Date(`${f <= t ? f : t}T00:00:00`);
            end = new Date(`${t >= f ? t : f}T23:59:59.999`);
        }

        const startDateOnly = format(start, 'yyyy-MM-dd');
        const endDateOnly = format(end, 'yyyy-MM-dd');

        const startIso = localToUtcISO(`${startDateOnly}T00:00:00`, companyTimezone);
        const endIso = localToUtcISO(`${endDateOnly}T23:59:59`, companyTimezone);

        const now = new Date();
        const cappedEnd = isAfter(end, now) ? now : end;
        let workingDays = 1;
        if (!isAfter(start, cappedEnd)) {
            const days = eachDayOfInterval({ start, end: cappedEnd });
            workingDays = Math.max(1, days.filter(d => d.getDay() !== 0).length);
        }

        return {
            start,
            end,
            startIso,
            endIso,
            startDateOnly,
            endDateOnly,
            workingDays,
            label:
                periodMode === 'day'
                    ? format(start, "EEEE d 'de' MMMM yyyy", { locale: es })
                    : `${format(start, 'd MMM yyyy', { locale: es })} — ${format(end, 'd MMM yyyy', { locale: es })}`,
        };
    }, [periodMode, selectedDayStr, customFromStr, customToStr, initialDate, companyTimezone]);

    useEffect(() => {
        if (!isOpen || !companyId) return;
        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const [profRes, fuRes, actRes, wonRes, quotesRes] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('id, full_name, role, avatar_url')
                        .eq('company_id', companyId)
                        .eq('is_active', true)
                        .order('full_name'),
                    supabase
                        .from('follow_ups')
                        .select('id, date, notes, action_type, assigned_to, completed, completed_at, lead:leads(id, name, company_name)')
                        .eq('company_id', companyId)
                        .gte('date', dateWindow.startIso)
                        .lte('date', dateWindow.endIso)
                        .order('date', { ascending: true })
                        .limit(4000),
                    supabase
                        .from('call_activities')
                        .select('id, user_id, lead_id, call_date, duration_seconds, action_type, outcome, notes, status_before, status_after, lead:leads(id, name, company_name, status, value, document_path)')
                        .eq('company_id', companyId)
                        .gte('call_date', dateWindow.startIso)
                        .lte('call_date', dateWindow.endIso)
                        .order('call_date', { ascending: true })
                        .limit(5000),
                    supabase
                        .from('leads')
                        .select('id, name, company_name, status, assigned_to, closing_amount, value, internal_won_date, updated_at')
                        .eq('company_id', companyId)
                        .in('status', ['Cerrado', 'Cliente'])
                        .limit(2000),
                    supabase
                        .from('cotizaciones')
                        .select('id, lead_id, nombre_cliente, total_anual, estado, created_by, created_at, lead:leads(id, name, assigned_to)')
                        .eq('company_id', companyId)
                        .gte('created_at', dateWindow.startIso)
                        .lte('created_at', dateWindow.endIso)
                        .order('created_at', { ascending: false })
                        .limit(2000),
                ]);

                if (cancelled) return;
                setProfiles((profRes.data || []) as AdvisorProfile[]);
                setFollowUps(
                    ((fuRes.data || []) as unknown as RawFollowUp[]).filter(
                        f => !isAutoWhatsAppCampaignFollowUp(f.notes)
                    )
                );
                setCallActivities((actRes.data || []) as unknown as RawCallActivity[]);

                const allWon = (wonRes.data || []) as RawWonLead[];
                const periodWon = allWon.filter(l => {
                    const rawDt = l.internal_won_date || l.updated_at;
                    if (!rawDt) return false;
                    const dStr = rawDt.slice(0, 10);
                    return dStr >= dateWindow.startDateOnly && dStr <= dateWindow.endDateOnly;
                });
                setWonLeads(periodWon);
                setQuotes((quotesRes.data || []) as unknown as RawQuote[]);
            } catch (err) {
                console.warn('[CalendarPerformanceReportModal] fetch error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isOpen, companyId, dateWindow.startIso, dateWindow.endIso, dateWindow.startDateOnly, dateWindow.endDateOnly]);

    const advisorMetrics = useMemo<AdvisorMetrics[]>(() => {
        const map = new Map<string, AdvisorProfile>();
        profiles.forEach(p => map.set(p.id, p));

        followUps.forEach(f => {
            if (f.assigned_to && !map.has(f.assigned_to)) {
                map.set(f.assigned_to, { id: f.assigned_to, full_name: 'Asesor', role: 'sales_agent', avatar_url: null });
            }
        });
        callActivities.forEach(a => {
            if (a.user_id && !map.has(a.user_id)) {
                map.set(a.user_id, { id: a.user_id, full_name: 'Asesor', role: 'sales_agent', avatar_url: null });
            }
        });

        const results: AdvisorMetrics[] = [];
        const expectedWorkMinutes = dateWindow.workingDays * 8 * 60;

        map.forEach(advisor => {
            const sch = followUps.filter(f => f.assigned_to === advisor.id);
            const exe = callActivities.filter(a => a.user_id === advisor.id);
            const advWon = wonLeads.filter(l => l.assigned_to === advisor.id);
            const advQuotes = quotes.filter(
                q => q.created_by === advisor.id || (!q.created_by && q.lead?.assigned_to === advisor.id)
            );

            const scheduledTotal = sch.length;
            const scheduledCompleted = sch.filter(f => f.completed).length;
            const scheduledPending = scheduledTotal - scheduledCompleted;
            const agendaPct = scheduledTotal > 0 ? Math.round((scheduledCompleted / scheduledTotal) * 100) : 0;

            const executedTotal = exe.length;
            const executedConnected = exe.filter(a => a.outcome === 'connected').length;
            const executedExtra = Math.max(0, executedTotal - Math.min(executedTotal, scheduledCompleted));

            // 1. Identify REAL Demos / Visits (strictly action_type='meeting' or explicit Demo/Visita calendar event)
            const demosMap = new Map<string, DemoEntry>();
            sch.forEach(f => {
                if (isScheduledDemoFollowUp(f.action_type, f.notes)) {
                    const key = f.lead?.id ? `lead-${f.lead.id}` : `fu-${f.id}`;
                    demosMap.set(key, {
                        id: f.id,
                        leadId: f.lead?.id || null,
                        leadName: f.lead?.name || 'Prospecto',
                        dateStr: formatTimeInZone(f.date, companyTimezone),
                        source: f.notes ? `Agenda: ${f.notes}` : 'Agendada en Calendario',
                        notes: f.notes,
                        completed: f.completed,
                    });
                }
            });
            exe.forEach(a => {
                if (isExecutedDemoActivity(a.action_type)) {
                    const key = a.lead_id ? `lead-${a.lead_id}` : `act-${a.id}`;
                    const existing = demosMap.get(key);
                    demosMap.set(key, {
                        id: a.id,
                        leadId: a.lead_id || null,
                        leadName: a.lead?.name || existing?.leadName || 'Prospecto',
                        dateStr: formatTimeInZone(a.call_date, companyTimezone),
                        source: existing ? `${existing.source} · Ejecutada` : 'Demo / Visita Ejecutada',
                        notes: a.notes || existing?.notes || null,
                        completed: true,
                    });
                }
            });
            const demosList = Array.from(demosMap.values());

            // 2. Formal Quotes CREATED in this period (from cotizaciones table + explicit quote_sent logs)
            const quotesCreatedMap = new Map<string, QuoteEntry>();
            advQuotes.forEach(q => {
                const key = q.lead_id || q.id;
                quotesCreatedMap.set(key, {
                    id: q.id,
                    leadId: q.lead_id,
                    clientName: q.nombre_cliente || q.lead?.name || 'Cliente',
                    amount: Number(q.total_anual) || 0,
                    dateStr: formatTimeInZone(q.created_at, companyTimezone),
                    isNewInPeriod: true,
                });
            });
            exe.filter(a => a.action_type === 'quote_sent').forEach(a => {
                const key = a.lead_id || a.id;
                if (!quotesCreatedMap.has(key)) {
                    quotesCreatedMap.set(key, {
                        id: a.id,
                        leadId: a.lead_id,
                        clientName: a.lead?.name || 'Cliente',
                        amount: Number(a.lead?.value) || 0,
                        dateStr: formatTimeInZone(a.call_date, companyTimezone),
                        isNewInPeriod: true,
                    });
                }
            });
            const quotesCreatedList = Array.from(quotesCreatedMap.values());
            const quotesCount = quotesCreatedList.length;

            // 3. Follow-ups made in this period to leads that ALREADY had an active quote (created in previous days)
            const quotedFollowUpsMap = new Map<string, QuoteEntry>();
            exe.forEach(a => {
                if (!a.lead_id || quotesCreatedMap.has(a.lead_id)) return;
                const leadVal = Number(a.lead?.value) || 0;
                const hasQuoteDoc = Boolean(a.lead?.document_path?.startsWith('cotizacion:'));
                const isNegotiation = a.lead?.status === 'Negociación';
                if (leadVal > 0 || hasQuoteDoc || isNegotiation) {
                    quotedFollowUpsMap.set(a.lead_id, {
                        id: a.id,
                        leadId: a.lead_id,
                        clientName: a.lead?.name || 'Prospecto',
                        amount: leadVal,
                        dateStr: formatTimeInZone(a.call_date, companyTimezone),
                        isNewInPeriod: false,
                    });
                }
            });
            const quotedFollowUpsList = Array.from(quotedFollowUpsMap.values());
            const quotedFollowUpsCount = quotedFollowUpsList.length;
            const quotedFollowUpsAmount = quotedFollowUpsList.reduce((s, q) => s + q.amount, 0);

            // 4. Won deals & amount
            const wonCount = advWon.length;
            const wonAmount = advWon.reduce((s, l) => s + (Number(l.closing_amount) || Number(l.value) || 0), 0);

            // 5. Effective minutes spent in calls/follow-ups/demos
            const effectiveMinutes = exe.reduce((sum, a) => {
                if (a.duration_seconds && a.duration_seconds > 0) {
                    return sum + Math.max(2, Math.ceil(a.duration_seconds / 60) + 1);
                }
                if (a.action_type === 'meeting') return sum + 25;
                return sum + 4;
            }, 0);

            // 6. Accurate Zoned Timestamps for Workday Span & Inactivity Gaps
            const byDay = new Map<string, Date[]>();
            exe.forEach(a => {
                const zonedDt = utcToZonedDateTime(a.call_date, companyTimezone);
                const key = format(zonedDt, 'yyyy-MM-dd');
                if (!byDay.has(key)) byDay.set(key, []);
                byDay.get(key)!.push(zonedDt);
            });

            let totalSpanMinutes = 0;
            const gaps: TimeGap[] = [];

            byDay.forEach(dates => {
                const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
                const first = sorted[0];
                const last = sorted[sorted.length - 1];
                const daySpan = Math.max(4, Math.round((last.getTime() - first.getTime()) / 60000) + 4);
                totalSpanMinutes += daySpan;

                const dayLabel = format(first, 'dd MMM', { locale: es });

                const workStart = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 8, 0, 0);
                const startDiffMins = Math.round((first.getTime() - workStart.getTime()) / 60000);
                if (startDiffMins >= 60) {
                    gaps.push({
                        dayLabel,
                        fromTime: '08:00 a. m.',
                        toTime: format(first, 'hh:mm a', { locale: es }),
                        minutes: startDiffMins,
                    });
                }

                for (let i = 0; i < sorted.length - 1; i++) {
                    const diffMins = Math.round((sorted[i + 1].getTime() - sorted[i].getTime()) / 60000);
                    if (diffMins >= 45) {
                        gaps.push({
                            dayLabel,
                            fromTime: format(sorted[i], 'hh:mm a', { locale: es }),
                            toTime: format(sorted[i + 1], 'hh:mm a', { locale: es }),
                            minutes: diffMins,
                        });
                    }
                }

                const workEnd = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 17, 0, 0);
                const endDiffMins = Math.round((workEnd.getTime() - last.getTime()) / 60000);
                if (endDiffMins >= 60) {
                    gaps.push({
                        dayLabel,
                        fromTime: format(last, 'hh:mm a', { locale: es }),
                        toTime: '05:00 p. m.',
                        minutes: endDiffMins,
                    });
                }
            });

            const firstActionTime = exe.length > 0 ? formatTimeInZone(exe[0].call_date, companyTimezone) : null;
            const lastActionTime = exe.length > 0 ? formatTimeInZone(exe[exe.length - 1].call_date, companyTimezone) : null;
            const unaccountedMinutes = Math.max(0, expectedWorkMinutes - effectiveMinutes);

            results.push({
                advisor,
                scheduledTotal,
                scheduledCompleted,
                scheduledPending,
                agendaPct,
                executedTotal,
                executedConnected,
                executedExtra,
                demosCount: demosList.length,
                quotesCount,
                quotedFollowUpsCount,
                quotedFollowUpsAmount,
                wonCount,
                wonAmount,
                effectiveMinutes,
                activeSpanMinutes: totalSpanMinutes,
                unaccountedMinutes,
                expectedWorkMinutes,
                firstActionTime,
                lastActionTime,
                activeDaysCount: byDay.size,
                scheduledItems: sch,
                executedItems: exe,
                demosList,
                quotesCreatedList,
                quotedFollowUpsList,
                wonLeadsList: advWon,
                gaps: gaps.sort((a, b) => b.minutes - a.minutes),
            });
        });

        return results.sort((a, b) => {
            if (b.wonCount !== a.wonCount) return b.wonCount - a.wonCount;
            if (b.demosCount !== a.demosCount) return b.demosCount - a.demosCount;
            if (b.executedTotal !== a.executedTotal) return b.executedTotal - a.executedTotal;
            return b.scheduledTotal - a.scheduledTotal;
        });
    }, [profiles, followUps, callActivities, wonLeads, quotes, dateWindow.workingDays, companyTimezone]);

    const filteredMetrics = useMemo(() => {
        if (filterView === 'active') {
            return advisorMetrics.filter(
                m => m.executedTotal > 0 || m.scheduledTotal > 0 || m.demosCount > 0 || m.wonCount > 0
            );
        }
        if (filterView === 'inactive') {
            return advisorMetrics.filter(m => m.executedTotal === 0 && m.demosCount === 0 && m.wonCount === 0);
        }
        return advisorMetrics;
    }, [advisorMetrics, filterView]);

    const globalTotals = useMemo(() => {
        const scheduled = advisorMetrics.reduce((s, m) => s + m.scheduledTotal, 0);
        const completed = advisorMetrics.reduce((s, m) => s + m.scheduledCompleted, 0);
        const executed = advisorMetrics.reduce((s, m) => s + m.executedTotal, 0);
        const demos = advisorMetrics.reduce((s, m) => s + m.demosCount, 0);
        const quotesTotal = advisorMetrics.reduce((s, m) => s + m.quotesCount, 0);
        const quotedFollowUpsTotal = advisorMetrics.reduce((s, m) => s + m.quotedFollowUpsCount, 0);
        const won = advisorMetrics.reduce((s, m) => s + m.wonCount, 0);
        const wonAmount = advisorMetrics.reduce((s, m) => s + m.wonAmount, 0);
        const effectiveMins = advisorMetrics.reduce((s, m) => s + m.effectiveMinutes, 0);
        const activeAdvisors = advisorMetrics.filter(
            m => m.executedTotal > 0 || m.demosCount > 0 || m.wonCount > 0
        ).length;
        const zeroAdvisors = advisorMetrics.filter(
            m => m.executedTotal === 0 && m.demosCount === 0 && m.wonCount === 0
        ).length;
        const maxExecuted = Math.max(1, ...advisorMetrics.map(m => m.executedTotal));
        return {
            scheduled,
            completed,
            agendaPct: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
            executed,
            extraExecuted: Math.max(0, executed - completed),
            demos,
            quotesTotal,
            quotedFollowUpsTotal,
            won,
            wonAmount,
            effectiveMins,
            activeAdvisors,
            zeroAdvisors,
            maxExecuted,
        };
    }, [advisorMetrics]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-[#F8FAFC] rounded-[24px] shadow-[0_24px_60px_rgba(15,23,42,0.16)] border border-slate-200/80 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ── TOP HEADER ── */}
                <div className="bg-white px-6 py-4 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Reporte Ejecutivo · Agenda, Demos, Cierres y Tiempo
                            </span>
                            <span className="bg-indigo-50 px-2 py-0.5 rounded-full text-[9px] font-black text-indigo-600 tracking-wider uppercase">
                                {dateWindow.workingDays} {dateWindow.workingDays === 1 ? 'día hábil' : 'días hábiles'}
                            </span>
                        </div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight capitalize mt-0.5">
                            {dateWindow.label}
                        </h2>
                    </div>

                    {/* Period Selector Pills + Date Pickers */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/60">
                            {PERIOD_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setPeriodMode(opt.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        periodMode === opt.id
                                            ? 'bg-white text-indigo-600 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {periodMode === 'day' && (
                            <input
                                type="date"
                                value={selectedDayStr}
                                onChange={e => setSelectedDayStr(e.target.value)}
                                className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                            />
                        )}

                        {periodMode === 'custom' && (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={customFromStr}
                                    onChange={e => setCustomFromStr(e.target.value)}
                                    className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                                />
                                <span className="text-xs text-slate-400 font-bold">a</span>
                                <input
                                    type="date"
                                    value={customToStr}
                                    onChange={e => setCustomToStr(e.target.value)}
                                    className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Imprimir o guardar como PDF"
                        >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span className="hidden sm:inline">Imprimir</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── MAIN BODY ── */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                    {/* 1. KPI Summary Cards (Estilo Dashboard) */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">1. Agenda (Orden)</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                    {globalTotals.completed}/{globalTotals.scheduled}
                                </span>
                                <span className="text-xs font-bold text-indigo-600">{globalTotals.agendaPct}%</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Citas programadas cumplidas
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">2. Gestiones Hechas</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                    {globalTotals.executed}
                                </span>
                                <span className="text-xs font-bold text-emerald-600">
                                    +{globalTotals.extraExecuted} adic.
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                {globalTotals.completed} de agenda + {globalTotals.extraExecuted} proactivos
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">3. Demos y Cotizaciones</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                    {globalTotals.demos}
                                </span>
                                <span className="text-xs font-bold text-violet-600">
                                    {globalTotals.demos === 1 ? 'demo' : 'demos'} · {globalTotals.quotesTotal} cotiz. nuevas
                                </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                {globalTotals.quotedFollowUpsTotal > 0
                                    ? `+ ${globalTotals.quotedFollowUpsTotal} cotizaciones previas en seguimiento`
                                    : 'Presentaciones y propuestas formales'}
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">4. Cierres Logrados</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-emerald-600 tracking-tight tabular-nums">
                                    {globalTotals.won}
                                </span>
                                {globalTotals.wonAmount > 0 && (
                                    <span className="text-xs font-bold text-slate-700 tabular-nums">
                                        ${globalTotals.wonAmount.toLocaleString()}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Clientes cerrados en el período
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-[20px] border border-slate-200/70 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">5. Tiempo Efectivo</p>
                            <div className="flex items-baseline gap-2 mt-1.5">
                                <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                    {formatDurationMinutes(globalTotals.effectiveMins)}
                                </span>
                                {globalTotals.zeroAdvisors > 0 && (
                                    <span className="text-xs font-bold text-rose-600">
                                        · {globalTotals.zeroAdvisors} en cero
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Base laboral: {dateWindow.workingDays * 8}h por asesor
                            </p>
                        </div>
                    </div>

                    {/* 2. Guía de Lectura (Minimalista y Delicada) */}
                    <div className="bg-white px-5 py-3.5 rounded-[20px] border border-slate-200/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span>
                                <strong className="text-slate-900">Agenda:</strong> Lo que tenían programado para la fecha.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>
                                <strong className="text-slate-900">Hechos:</strong> Total de gestiones (agenda + nuevos/atrasados).
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                            <span>
                                <strong className="text-slate-900">Demos y Cotiz.:</strong> Reuniones/visitas reales y cotizaciones nuevas vs. en seguimiento.
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <span>
                                <strong className="text-slate-900">Sin Registro:</strong> Horas de la jornada (8h/día) sin actividad en CRM.
                            </span>
                        </div>
                    </div>

                    {/* 3. Tabla Comparativa por Asesor */}
                    <div className="bg-white rounded-[24px] border border-slate-200/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                    <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                                    Rendimiento por Asesor · Agenda, Demos, Cierres y Uso de Jornada
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                    Selecciona cualquier fila para auditar cuáles son sus agendados, sus gestiones hora por hora y sus demos/cotizaciones/cierres
                                </p>
                            </div>

                            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => setFilterView('all')}
                                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                        filterView === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                                    }`}
                                >
                                    Todos ({advisorMetrics.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterView('active')}
                                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                        filterView === 'active' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                                    }`}
                                >
                                    Activos ({globalTotals.activeAdvisors})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterView('inactive')}
                                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                        filterView === 'inactive' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-500'
                                    }`}
                                >
                                    Sin Actividad ({globalTotals.zeroAdvisors})
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-16 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Cargando datos del período...
                            </div>
                        ) : (
                            <>
                                {/* Table Header */}
                                <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                    <div className="col-span-3">Asesor</div>
                                    <div className="col-span-1 text-center">Agenda</div>
                                    <div className="col-span-2 text-center">Hechos (Volumen)</div>
                                    <div className="col-span-2 text-center">Demos / Cotiz.</div>
                                    <div className="col-span-1 text-center">Cerrados</div>
                                    <div className="col-span-2 text-center">Tiempo Activo / Sin Reg.</div>
                                    <div className="col-span-1 text-right">Detalle</div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {filteredMetrics.map((m, idx) => {
                                        const isExpanded = expandedAdvisorId === m.advisor.id;
                                        const isZero = m.executedTotal === 0 && m.scheduledTotal === 0 && m.demosCount === 0 && m.wonCount === 0;
                                        const barWidthPct = Math.round((m.executedTotal / globalTotals.maxExecuted) * 100);
                                        const agendaSharePct =
                                            m.executedTotal > 0
                                                ? Math.min(100, Math.round((m.scheduledCompleted / m.executedTotal) * 100))
                                                : 0;

                                        return (
                                            <div key={m.advisor.id} className="transition-colors">
                                                <div
                                                    onClick={() => setExpandedAdvisorId(isExpanded ? null : m.advisor.id)}
                                                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-4 items-center cursor-pointer hover:bg-slate-50/70 transition-colors ${
                                                        isZero ? 'bg-rose-50/15' : ''
                                                    }`}
                                                >
                                                    {/* Col 1: Advisor */}
                                                    <div className="md:col-span-3 flex items-center gap-3 min-w-0">
                                                        <span className="w-4 text-[11px] font-black text-slate-400 tabular-nums shrink-0">
                                                            {idx + 1}.
                                                        </span>
                                                        {m.advisor.avatar_url ? (
                                                            <img
                                                                src={m.advisor.avatar_url}
                                                                alt={m.advisor.full_name}
                                                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black shrink-0 border border-slate-200">
                                                                {(m.advisor.full_name || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-black text-slate-900 truncate">
                                                                {m.advisor.full_name}
                                                            </p>
                                                            {m.executedTotal === 0 && m.demosCount === 0 && m.wonCount === 0 ? (
                                                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60">
                                                                    Sin actividad registrada
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-medium block">
                                                                    {m.executedConnected} conectadas · {m.activeDaysCount}{' '}
                                                                    {m.activeDaysCount === 1 ? 'día activo' : 'días activos'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Col 2: Agenda (Orden) */}
                                                    <div className="md:col-span-1 text-center">
                                                        {m.scheduledTotal > 0 ? (
                                                            <div>
                                                                <span className="text-xs font-black text-slate-900 tabular-nums block">
                                                                    {m.scheduledCompleted}/{m.scheduledTotal}
                                                                </span>
                                                                <span
                                                                    className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black ${
                                                                        m.agendaPct === 100
                                                                            ? 'bg-emerald-50 text-emerald-700'
                                                                            : m.agendaPct >= 60
                                                                              ? 'bg-amber-50 text-amber-700'
                                                                              : 'bg-rose-50 text-rose-700'
                                                                    }`}
                                                                >
                                                                    {m.agendaPct}%
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-semibold text-slate-400">0</span>
                                                        )}
                                                    </div>

                                                    {/* Col 3: Hechos (Volumen + Barra comparativa) */}
                                                    <div className="md:col-span-2 px-1">
                                                        <div className="flex items-baseline justify-center gap-1">
                                                            <span className="text-sm font-black text-slate-900 tabular-nums">
                                                                {m.executedTotal}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                ({m.scheduledCompleted} ag. + {m.executedExtra} adic.)
                                                            </span>
                                                        </div>
                                                        <div className="mt-1.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                                            <div
                                                                className="h-full bg-indigo-500 transition-all"
                                                                style={{ width: `${(barWidthPct * agendaSharePct) / 100}%` }}
                                                                title="De agenda"
                                                            />
                                                            <div
                                                                className="h-full bg-emerald-500 transition-all"
                                                                style={{
                                                                    width: `${(barWidthPct * (100 - agendaSharePct)) / 100}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Col 4: Demos / Cotizaciones */}
                                                    <div className="md:col-span-2 text-center">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <span
                                                                className={`px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                                                                    m.demosCount > 0
                                                                        ? 'bg-violet-50 text-violet-700 border border-violet-200/60'
                                                                        : 'bg-slate-50 text-slate-400'
                                                                }`}
                                                            >
                                                                {m.demosCount} {m.demosCount === 1 ? 'Demo' : 'Demos'}
                                                            </span>
                                                            <span
                                                                className={`px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                                                                    m.quotesCount > 0
                                                                        ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                                                                        : 'bg-slate-50 text-slate-400'
                                                                }`}
                                                            >
                                                                {m.quotesCount} Cotiz.
                                                            </span>
                                                        </div>
                                                        {m.quotedFollowUpsCount > 0 && (
                                                            <span className="block text-[9px] text-slate-400 font-medium mt-0.5">
                                                                {m.quotedFollowUpsCount} cotiz. previas en seg.
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Col 5: Cerrados */}
                                                    <div className="md:col-span-1 text-center">
                                                        {m.wonCount > 0 ? (
                                                            <div>
                                                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-black tabular-nums">
                                                                    {m.wonCount}
                                                                </span>
                                                                {m.wonAmount > 0 && (
                                                                    <span className="block text-[9px] font-bold text-emerald-700 mt-0.5 tabular-nums">
                                                                        ${m.wonAmount.toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-300">0</span>
                                                        )}
                                                    </div>

                                                    {/* Col 6: Tiempo en Gestión + Sin Registro */}
                                                    <div className="md:col-span-2 text-center">
                                                        {m.executedTotal > 0 ? (
                                                            <div>
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <span className="text-xs font-black text-slate-900 tabular-nums">
                                                                        ~{formatDurationMinutes(m.effectiveMinutes)}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-rose-600 tabular-nums">
                                                                        · {formatDurationMinutes(m.unaccountedMinutes)} libre
                                                                    </span>
                                                                </div>
                                                                <span className="block text-[9px] text-slate-400 font-medium mt-0.5">
                                                                    {periodMode === 'day' && m.firstActionTime && m.lastActionTime
                                                                        ? `${m.firstActionTime} – ${m.lastActionTime}`
                                                                        : `Ventana: ${formatDurationMinutes(m.activeSpanMinutes)} de ${formatDurationMinutes(m.expectedWorkMinutes)}`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[10px] font-black">
                                                                {formatDurationMinutes(m.expectedWorkMinutes)} sin reg.
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Col 7: Expand */}
                                                    <div className="md:col-span-1 flex justify-end">
                                                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                                            <ChevronDown
                                                                className={`w-4 h-4 transition-transform ${
                                                                    isExpanded ? 'rotate-180 text-indigo-600' : ''
                                                                }`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ── EXPANDED AUDIT FOR THIS ADVISOR ── */}
                                                {isExpanded && (
                                                    <div className="bg-slate-50/70 border-t border-slate-200/60 px-6 py-5 space-y-4">
                                                        {/* Time & Results Justification Banner */}
                                                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                                    Auditoría de Jornada y Resultados — {m.advisor.full_name}
                                                                </p>
                                                                <p className="text-xs text-slate-700 leading-relaxed">
                                                                    {m.executedTotal === 0 && m.demosCount === 0 && m.wonCount === 0 ? (
                                                                        <span>
                                                                            No registra llamadas, demos ni cierres en este período (
                                                                            <strong className="text-rose-600">
                                                                                {formatDurationMinutes(m.expectedWorkMinutes)} laborales sin actividad en CRM
                                                                            </strong>
                                                                            ).
                                                                        </span>
                                                                    ) : (
                                                                        <span>
                                                                            Ejecutó <strong className="text-slate-900">{m.executedTotal} gestiones</strong> (~
                                                                            <strong className="text-slate-900">{formatDurationMinutes(m.effectiveMinutes)}</strong> de tiempo directo
                                                                            {m.firstActionTime && m.lastActionTime
                                                                                ? `, entre ${m.firstActionTime} y ${m.lastActionTime}`
                                                                                : ''}
                                                                            ), con <strong className="text-violet-700">{m.demosCount} demo/visita real</strong>,{' '}
                                                                            <strong className="text-sky-700">{m.quotesCount} cotización(es) nueva(s)</strong>
                                                                            {m.quotedFollowUpsCount > 0
                                                                                ? ` (más ${m.quotedFollowUpsCount} seguimiento(s) a cotizaciones previas por $${m.quotedFollowUpsAmount.toLocaleString()})`
                                                                                : ''}{' '}
                                                                            y <strong className="text-emerald-700">{m.wonCount} cierre(s)</strong>. Restan{' '}
                                                                            <strong className="text-rose-600">
                                                                                {formatDurationMinutes(m.unaccountedMinutes)}
                                                                            </strong>{' '}
                                                                            de la jornada laboral sin registros en el CRM.
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>

                                                            {m.gaps.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                                                    {m.gaps.slice(0, 3).map((g, gi) => (
                                                                        <span
                                                                            key={gi}
                                                                            className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-[10px] font-bold text-amber-800"
                                                                        >
                                                                            Sin registro ({g.dayLabel}): {g.fromTime} a {g.toTime} ({formatDurationMinutes(g.minutes)})
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Three Columns: 1) Agenda | 2) Hechos (con huecos de tiempo) | 3) Demos, Cotizaciones & Cierres */}
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                            {/* Column 1: Scheduled Follow-Ups */}
                                                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col">
                                                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                                                                    <div>
                                                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                                            1. Agenda ({m.scheduledItems.length})
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                                            Compromisos programados para la fecha
                                                                        </p>
                                                                    </div>
                                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black">
                                                                        {m.scheduledCompleted}/{m.scheduledTotal}
                                                                    </span>
                                                                </div>

                                                                {m.scheduledItems.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 py-6 text-center">
                                                                        Sin compromisos agendados para este período.
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                                        {m.scheduledItems.map(item => {
                                                                            const Icon = getActionIcon(item.action_type);
                                                                            return (
                                                                                <div
                                                                                    key={item.id}
                                                                                    onClick={() => item.lead?.id && onNavigateLead?.(item.lead.id)}
                                                                                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all cursor-pointer"
                                                                                >
                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                        <div
                                                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                                                                item.completed
                                                                                                    ? 'bg-emerald-50 text-emerald-600'
                                                                                                    : 'bg-amber-50 text-amber-600'
                                                                                            }`}
                                                                                        >
                                                                                            <Icon className="w-3.5 h-3.5" />
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-xs font-bold text-slate-900 truncate">
                                                                                                {item.lead?.name || 'Prospecto'}
                                                                                            </p>
                                                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                                                {getActionLabel(item.action_type)}
                                                                                                {item.notes ? ` · ${item.notes}` : ''}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="text-right shrink-0">
                                                                                        <span
                                                                                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black ${
                                                                                                item.completed
                                                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                                                    : 'bg-amber-50 text-amber-700'
                                                                                            }`}
                                                                                        >
                                                                                            {item.completed ? 'Cumplido' : 'Pendiente'}
                                                                                        </span>
                                                                                        <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                                                                                            {formatTimeInZone(item.date, companyTimezone)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 2: Executed Call Activities */}
                                                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col">
                                                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                                                                    <div>
                                                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                                            2. Gestiones Hechas ({m.executedItems.length})
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                                            Secuencia cronológica y pausas
                                                                        </p>
                                                                    </div>
                                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black">
                                                                        ~{formatDurationMinutes(m.effectiveMinutes)}
                                                                    </span>
                                                                </div>

                                                                {m.executedItems.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 py-6 text-center">
                                                                        No registró gestiones en este período.
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                                        {m.executedItems.map((act, i) => {
                                                                            const Icon = getActionIcon(act.action_type);
                                                                            const prevAct = i > 0 ? m.executedItems[i - 1] : null;
                                                                            const currZoned = utcToZonedDateTime(act.call_date, companyTimezone);
                                                                            const prevZoned = prevAct
                                                                                ? utcToZonedDateTime(prevAct.call_date, companyTimezone)
                                                                                : null;
                                                                            const gapMins = prevZoned
                                                                                ? Math.round((currZoned.getTime() - prevZoned.getTime()) / 60000)
                                                                                : 0;
                                                                            const sameDayAsPrev =
                                                                                prevZoned &&
                                                                                format(currZoned, 'yyyy-MM-dd') === format(prevZoned, 'yyyy-MM-dd');

                                                                            return (
                                                                                <React.Fragment key={act.id}>
                                                                                    {sameDayAsPrev && gapMins >= 45 && prevZoned && (
                                                                                        <div className="px-2.5 py-1 rounded-lg bg-amber-50/80 border border-dashed border-amber-200 text-[10px] font-bold text-amber-800 flex items-center justify-between">
                                                                                            <span>
                                                                                                Sin registro: {format(prevZoned, 'hh:mm a', { locale: es })} a{' '}
                                                                                                {format(currZoned, 'hh:mm a', { locale: es })}
                                                                                            </span>
                                                                                            <span>{formatDurationMinutes(gapMins)}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    <div
                                                                                        onClick={() => act.lead_id && onNavigateLead?.(act.lead_id)}
                                                                                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all cursor-pointer"
                                                                                    >
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                                                                <Icon className="w-3.5 h-3.5" />
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-xs font-bold text-slate-900 truncate">
                                                                                                    {act.lead?.name || 'Prospecto'}
                                                                                                </p>
                                                                                                <p className="text-[10px] text-slate-400 truncate">
                                                                                                    {getActionLabel(act.action_type)} ·{' '}
                                                                                                    {act.outcome === 'connected' ? 'Conectado' : 'Sin respuesta'}
                                                                                                    {act.notes ? ` · ${act.notes}` : ''}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-right shrink-0">
                                                                                            <span className="text-[11px] font-bold text-slate-700 tabular-nums block">
                                                                                                {formatTimeInZone(act.call_date, companyTimezone)}
                                                                                            </span>
                                                                                            <span className="text-[9px] text-slate-400 font-medium">
                                                                                                {act.duration_seconds && act.duration_seconds > 0
                                                                                                    ? `${Math.ceil(act.duration_seconds / 60)}m`
                                                                                                    : act.action_type === 'meeting'
                                                                                                      ? '~25m'
                                                                                                      : '~4m'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 3: Demos, Quotes & Won Deals */}
                                                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col">
                                                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                                                                    <div>
                                                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                                            3. Demos ({m.demosCount}), Cotiz. ({m.quotesCount}) y Cierres ({m.wonCount})
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                                            Conversión comercial del período
                                                                        </p>
                                                                    </div>
                                                                    <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-black">
                                                                        {m.quotesCount} nuevas
                                                                    </span>
                                                                </div>

                                                                {m.demosList.length === 0 &&
                                                                m.quotesCreatedList.length === 0 &&
                                                                m.quotedFollowUpsList.length === 0 &&
                                                                m.wonLeadsList.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 py-6 text-center">
                                                                        Sin demos, cotizaciones ni cierres en este período.
                                                                    </p>
                                                                ) : (
                                                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                                        {/* Won Deals */}
                                                                        {m.wonLeadsList.map(won => (
                                                                            <div
                                                                                key={`won-${won.id}`}
                                                                                onClick={() => onNavigateLead?.(won.id)}
                                                                                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50 transition-all cursor-pointer"
                                                                            >
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                                                                        <Award className="w-3.5 h-3.5" />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-xs font-bold text-slate-900 truncate">
                                                                                            {won.name}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-emerald-700 font-bold truncate">
                                                                                            Cierre ganado ({won.status})
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-xs font-black text-emerald-700 tabular-nums shrink-0">
                                                                                    ${(Number(won.closing_amount) || Number(won.value) || 0).toLocaleString()}
                                                                                </span>
                                                                            </div>
                                                                        ))}

                                                                        {/* Real Demos / Meetings */}
                                                                        {m.demosList.map(demo => (
                                                                            <div
                                                                                key={`demo-${demo.id}`}
                                                                                onClick={() => demo.leadId && onNavigateLead?.(demo.leadId)}
                                                                                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-violet-200/70 bg-violet-50/30 hover:bg-violet-50/60 transition-all cursor-pointer"
                                                                            >
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                                                                        <Video className="w-3.5 h-3.5" />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-xs font-bold text-slate-900 truncate">
                                                                                            {demo.leadName}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-violet-700 font-semibold truncate">
                                                                                            {demo.source}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-[10px] font-bold text-violet-700 shrink-0">
                                                                                    {demo.dateStr}
                                                                                </span>
                                                                            </div>
                                                                        ))}

                                                                        {/* Formal Quotes Created in Period */}
                                                                        {m.quotesCreatedList.map(q => (
                                                                            <div
                                                                                key={`qnew-${q.id}`}
                                                                                onClick={() => q.leadId && onNavigateLead?.(q.leadId)}
                                                                                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-sky-200/80 bg-sky-50/30 hover:bg-sky-50/60 transition-all cursor-pointer"
                                                                            >
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                                                                        <FileText className="w-3.5 h-3.5" />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-xs font-bold text-slate-900 truncate">
                                                                                            {q.clientName}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-sky-700 font-semibold truncate">
                                                                                            Cotización nueva creada
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <span className="text-xs font-black text-sky-700 tabular-nums shrink-0">
                                                                                    ${q.amount.toLocaleString()}
                                                                                </span>
                                                                            </div>
                                                                        ))}

                                                                        {/* Follow-ups on Existing Quotes from Earlier Dates */}
                                                                        {m.quotedFollowUpsList.length > 0 && (
                                                                            <>
                                                                                <div className="pt-2 pb-1">
                                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                                                        Seguimiento a cotizaciones de fechas previas ({m.quotedFollowUpsList.length})
                                                                                    </p>
                                                                                </div>
                                                                                {m.quotedFollowUpsList.map(qf => (
                                                                                    <div
                                                                                        key={`qprev-${qf.id}`}
                                                                                        onClick={() => qf.leadId && onNavigateLead?.(qf.leadId)}
                                                                                        className="flex items-center justify-between gap-2.5 p-2 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all cursor-pointer"
                                                                                    >
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <div className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                                                                                <FileText className="w-3 h-3" />
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-[11px] font-bold text-slate-800 truncate">
                                                                                                    {qf.clientName}
                                                                                                </p>
                                                                                                <p className="text-[9px] text-slate-400 truncate">
                                                                                                    Cotización previa en seguimiento · {qf.dateStr}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        {qf.amount > 0 && (
                                                                                            <span className="text-[11px] font-bold text-slate-600 tabular-nums shrink-0">
                                                                                                ${qf.amount.toLocaleString()}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
