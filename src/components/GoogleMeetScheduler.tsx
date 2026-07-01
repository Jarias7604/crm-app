import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addMinutes, parseISO, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    X, Video, Calendar, Clock, Users, Mail, Copy,
    ExternalLink, Check, Loader2, AlertCircle, Link2,
    ChevronDown, Plus, Globe, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { leadsService } from '../services/leads';
import { useAuth } from '../auth/AuthProvider';
import { localToUtcISO, formatTimeInZone } from '../utils/timezone';
import { useTimezone } from '../hooks/useTimezone';
import toast from 'react-hot-toast';

interface GoogleMeetSchedulerProps {
    onClose: () => void;
    initialDate?: Date;
    initialLeadId?: string;
    initialLeadName?: string;
    initialLeadEmail?: string | null;
    initialEvent?: any;
}

const DURATION_OPTIONS = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hora', value: 60 },
    { label: '1.5h', value: 90 },
    { label: '2 horas', value: 120 },
];

const COMMON_TIMEZONES = [
    { value: 'America/El_Salvador', label: 'El Salvador (CST, UTC-6)' },
    { value: 'America/Guatemala', label: 'Guatemala (CST, UTC-6)' },
    { value: 'America/Tegucigalpa', label: 'Honduras (CST, UTC-6)' },
    { value: 'America/Managua', label: 'Nicaragua (CST, UTC-6)' },
    { value: 'America/Costa_Rica', label: 'Costa Rica (CST, UTC-6)' },
    { value: 'America/Panama', label: 'Panamá (EST, UTC-5)' },
    { value: 'America/Mexico_City', label: 'México - CDMX (CST, UTC-6)' },
    { value: 'America/Bogota', label: 'Colombia / Ecuador / Perú (EST, UTC-5)' },
    { value: 'America/Caracas', label: 'Venezuela (AST, UTC-4)' },
    { value: 'America/Santo_Domingo', label: 'República Dominicana (AST, UTC-4)' },
    { value: 'America/Santiago', label: 'Chile (CLT, UTC-4)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (ART, UTC-3)' },
    { value: 'America/New_York', label: 'US Eastern Time (EST/EDT, UTC-5/-4)' },
    { value: 'America/Chicago', label: 'US Central Time (CST/CDT, UTC-6/-5)' },
    { value: 'America/Denver', label: 'US Mountain Time (MST/MDT, UTC-7/-6)' },
    { value: 'America/Los_Angeles', label: 'US Pacific Time (PST/PDT, UTC-8/-7)' },
    { value: 'Europe/Madrid', label: 'España (CET/CEST, UTC+1/+2)' },
];

export default function GoogleMeetScheduler({
    onClose,
    initialDate,
    initialLeadId,
    initialLeadName,
    initialLeadEmail,
    initialEvent,
}: GoogleMeetSchedulerProps) {
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    const isEditMode = !!initialEvent;

    // Fetch company/user timezone and initialize selectedTimezone
    const { timezone: companyTimezone } = useTimezone(profile?.company_id);
    const [selectedTimezone, setSelectedTimezone] = useState(() => {
        if (initialEvent?._rawEvent?.start?.timeZone) {
            return initialEvent._rawEvent.start.timeZone;
        }
        return 'America/El_Salvador';
    });

    // Sync timezone once companyTimezone resolves
    useEffect(() => {
        if (companyTimezone && !initialEvent?._rawEvent?.start?.timeZone) {
            setSelectedTimezone(companyTimezone);
        }
    }, [companyTimezone, initialEvent]);

    // Form state
    const [title, setTitle] = useState(() => {
        if (initialEvent?._rawEvent?.summary) return initialEvent._rawEvent.summary;
        if (initialEvent?.lead?.name) return initialEvent.lead.name;
        return initialLeadName ? `Reunión con ${initialLeadName}` : 'Nueva Reunión';
    });

    const [date, setDate] = useState(() => {
        if (initialEvent?.date) {
            return format(new Date(initialEvent.date), 'yyyy-MM-dd');
        }
        return format(initialDate || new Date(), 'yyyy-MM-dd');
    });

    const [startTime, setStartTime] = useState(() => {
        if (initialEvent?.date) {
            return format(new Date(initialEvent.date), 'HH:mm');
        }
        const d = initialDate || new Date();
        const mins = d.getMinutes() < 30 ? 30 : 0;
        const hrs = d.getMinutes() < 30 ? d.getHours() : d.getHours() + 1;
        return `${String(hrs % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    });

    const [duration, setDuration] = useState(() => {
        if (initialEvent?._rawEvent?.start?.dateTime && initialEvent?._rawEvent?.end?.dateTime) {
            const start = new Date(initialEvent._rawEvent.start.dateTime).getTime();
            const end = new Date(initialEvent._rawEvent.end.dateTime).getTime();
            return Math.round((end - start) / (60 * 1000));
        }
        return 30;
    });

    const [description, setDescription] = useState(() => {
        if (initialEvent?._rawEvent?.description) {
            const desc = initialEvent._rawEvent.description;
            const markerIdx = desc.indexOf('\n\n---');
            if (markerIdx !== -1) {
                return desc.substring(0, markerIdx);
            }
            return desc;
        }
        return '';
    });

    const [attendeeInput, setAttendeeInput] = useState('');
    const [attendees, setAttendees] = useState<string[]>(() => {
        if (initialEvent?._rawEvent?.attendees) {
            return initialEvent._rawEvent.attendees.map((a: any) => a.email).filter(Boolean);
        }
        return initialLeadEmail ? [initialLeadEmail] : [];
    });

    const [addMeetLink, setAddMeetLink] = useState(() => {
        if (isEditMode) {
            return !!initialEvent?._rawEvent?.hangoutLink;
        }
        return true;
    });

    const [sendInvites] = useState(true);
    const [copied, setCopied] = useState(false);
    const [createdMeet, setCreatedMeet] = useState<{
        meet_link: string | null;
        html_link: string;
    } | null>(null);

    // Recurrence states
    const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
    const [recurrenceCount, setRecurrenceCount] = useState<number>(5);

    // Custom modern Spanish Date Picker States
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => parseISO(format(initialDate || new Date(), 'yyyy-MM-dd')));

    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const WEEKDAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

    const calendarDays = useMemo(() => {
        const refMonth = currentMonth;
        const startOfCurMonth = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
        const endOfCurMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
        
        const daysInMonth = endOfCurMonth.getDate();
        const startDayOfWeek = startOfCurMonth.getDay(); // 0 = Sunday
        
        const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
        
        // Prev month padding
        const prevMonthEnd = new Date(refMonth.getFullYear(), refMonth.getMonth(), 0);
        const prevDaysCount = prevMonthEnd.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const d = prevDaysCount - i;
            const prevDate = new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, d);
            days.push({
                dateStr: format(prevDate, 'yyyy-MM-dd'),
                dayNum: d,
                isCurrentMonth: false
            });
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const curDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), i);
            days.push({
                dateStr: format(curDate, 'yyyy-MM-dd'),
                dayNum: i,
                isCurrentMonth: true
            });
        }
        
        // Next month padding
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const nextDate = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, i);
            days.push({
                dateStr: format(nextDate, 'yyyy-MM-dd'),
                dayNum: i,
                isCurrentMonth: false
            });
        }
        
        return days;
    }, [currentMonth]);

    // Check if user has Google Calendar connected
    const { data: googleIntegration, isLoading: checkingIntegration } = useQuery({
        queryKey: ['google-integration-check', profile?.id],
        queryFn: async () => {
            if (!profile?.id) return null;
            const { data } = await supabase
                .from('calendar_integrations')
                .select('id, google_email')
                .eq('user_id', profile.id)
                .eq('provider', 'google')
                .eq('is_active', true)
                .maybeSingle();
            return data;
        },
        enabled: !!profile?.id,
        staleTime: 5 * 60 * 1000,
    });

    // Load team members for attendee suggestions
    const { data: teamMembers } = useQuery({
        queryKey: ['team-members', profile?.company_id],
        queryFn: () => leadsService.getTeamMembers(),
        staleTime: 10 * 60 * 1000,
        enabled: !!profile?.id,
    });

    // Compute end time (HH:mm) from start + duration
    const endTime = useMemo(() => {
        const [h, m] = startTime.split(':').map(Number);
        const start = setMinutes(setHours(new Date(), h), m);
        const end = addMinutes(start, duration);
        return format(end, 'HH:mm');
    }, [startTime, duration]);

    // Build ISO datetimes using localToUtcISO and the selected timezone
    const startISO = useMemo(() => {
        try {
            return localToUtcISO(`${date}T${startTime}`, selectedTimezone);
        } catch (e) {
            // Safe fallback
            const [h, m] = startTime.split(':').map(Number);
            const d = parseISO(date);
            return setMinutes(setHours(d, h), m).toISOString();
        }
    }, [date, startTime, selectedTimezone]);

    const endISO = useMemo(() => {
        try {
            // Safely compute end time by adding duration milliseconds to startISO
            const startMs = new Date(startISO).getTime();
            return new Date(startMs + duration * 60 * 1000).toISOString();
        } catch (e) {
            // Fallback
            const [h, m] = endTime.split(':').map(Number);
            const d = parseISO(date);
            return setMinutes(setHours(d, h), m).toISOString();
        }
    }, [startISO, duration, endTime]);

    // Add attendee
    const addAttendee = (email: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) return;
        if (!attendees.includes(trimmed)) setAttendees(prev => [...prev, trimmed]);
        setAttendeeInput('');
    };

    const removeAttendee = (email: string) =>
        setAttendees(prev => prev.filter(e => e !== email));

    // Mutation — handle create/update follow-up + Google Calendar event
    const mutation = useMutation({
        mutationFn: async (sendInvitesOverride?: boolean) => {
            const finalSendInvites = sendInvitesOverride !== undefined ? sendInvitesOverride : sendInvites;

            if (isEditMode) {
                if (!googleIntegration) throw new Error('No Google Calendar integration connected');

                const hostName = profile?.full_name || 'Administrador del CRM';
                const hostEmail = profile?.email || '';
                const enrichedDescription = `${description ? description + '\n\n' : ''}---
Organizador: ${hostName}
Email: ${hostEmail}
Reunión modificada desde Arias CRM.`;

                // extract actual google event ID (from format `google-{real_id}-{group}`)
                let rawId = initialEvent._rawEvent?.id;
                if (!rawId) {
                    const idStr = initialEvent.id;
                    if (idStr.startsWith('google-')) {
                        const firstHyphen = idStr.indexOf('-');
                        const lastHyphen = idStr.lastIndexOf('-');
                        if (firstHyphen !== -1 && lastHyphen !== -1 && lastHyphen > firstHyphen) {
                            rawId = idStr.substring(firstHyphen + 1, lastHyphen);
                        } else {
                            const parts = idStr.split('-');
                            rawId = parts[1];
                        }
                    } else {
                        rawId = idStr;
                    }
                }

                const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        action: 'update_event',
                        integration_id: googleIntegration.id,
                        event_id: rawId,
                        event: {
                            title,
                            description: enrichedDescription,
                            start: startISO,
                            end: endISO,
                            attendees,
                            send_invites: finalSendInvites,
                            timezone: selectedTimezone,
                        }
                    }
                });

                if (error || !data || data.success === false) {
                    throw new Error(data?.error || error?.message || 'Error al actualizar reunión en Google Calendar');
                }

                return { isEdit: true, meetResult: null, isRecurrent: false, recurrenceCount: 1 };
            }

            // Normal or recurrent creation logic
            const occurrences: { start: string; end: string; index: number }[] = [];
            const count = recurrenceType !== 'none' ? recurrenceCount : 1;
            const startMs = new Date(startISO).getTime();
            const endMs = new Date(endISO).getTime();

            for (let i = 0; i < count; i++) {
                let occStart: string;
                let occEnd: string;

                if (recurrenceType === 'daily') {
                    occStart = new Date(startMs + i * 24 * 60 * 60 * 1000).toISOString();
                    occEnd = new Date(endMs + i * 24 * 60 * 60 * 1000).toISOString();
                } else if (recurrenceType === 'weekly') {
                    occStart = new Date(startMs + i * 7 * 24 * 60 * 60 * 1000).toISOString();
                    occEnd = new Date(endMs + i * 7 * 24 * 60 * 60 * 1000).toISOString();
                } else if (recurrenceType === 'monthly') {
                    const sD = new Date(startISO);
                    sD.setMonth(sD.getMonth() + i);
                    occStart = sD.toISOString();
                    
                    const eD = new Date(endISO);
                    eD.setMonth(eD.getMonth() + i);
                    occEnd = eD.toISOString();
                } else {
                    occStart = startISO;
                    occEnd = endISO;
                }

                occurrences.push({ start: occStart, end: occEnd, index: i + 1 });
            }

            let firstMeetResult: any = null;

            for (const occ of occurrences) {
                let followUpId: string | undefined;

                // Create follow-up in CRM
                if (initialLeadId) {
                    const suffix = count > 1 ? ` (${occ.index}/${count})` : '';
                    const followUp = await leadsService.createFollowUp({
                        lead_id: initialLeadId,
                        date: occ.start,
                        notes: description || `Reunión: ${title}${suffix}`,
                        action_type: 'meeting',
                        company_id: localStorage.getItem('simulated_company_id') || profile?.company_id,
                    }, profile?.id);
                    followUpId = followUp.id;
                }

                // Create Google Calendar event (with or without a linked follow-up)
                if (googleIntegration && addMeetLink) {
                    const hostName = profile?.full_name || 'Administrador del CRM';
                    const hostEmail = profile?.email || '';
                    const suffix = count > 1 ? ` (Sesión ${occ.index} de ${count})` : '';
                    const enrichedDescription = `${description ? description + '\n\n' : ''}---
Organizador: ${hostName}
Email: ${hostEmail}
Reunión programada automáticamente desde Arias CRM${suffix}.`;

                    const result = await leadsService.createGoogleMeeting({
                        integrationId: googleIntegration.id,
                        followUpId,
                        title: count > 1 ? `${title} (${occ.index}/${count})` : title,
                        description: enrichedDescription,
                        start: occ.start,
                        end: occ.end,
                        attendees,
                        addMeetLink: true,
                        sendInvites: finalSendInvites,
                        timezone: selectedTimezone,
                    });
                    if (occ.index === 1) {
                        firstMeetResult = result;
                    }
                }
            }

            return { isEdit: false, meetResult: firstMeetResult, isRecurrent: recurrenceType !== 'none', recurrenceCount: count };
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['calendar-follow-ups'] });
            queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] });

            if (isEditMode) {
                toast.success('✅ Cambios guardados en Google Calendar');
                onClose();
            } else {
                if (res.meetResult?.meet_link) {
                    setCreatedMeet(res.meetResult);
                } else {
                    if (res.isRecurrent) {
                        toast.success(`✅ ${res.recurrenceCount} reuniones agendadas en el calendario`);
                    } else {
                        toast.success('✅ Reunión agendada en el calendario');
                    }
                    onClose();
                }
            }
        },
        onError: (err: any) => {
            toast.error(`Error: ${err.message || 'No se pudo procesar la reunión'}`);
        }
    });    const copyMeetLink = () => {
        if (createdMeet?.meet_link) {
            navigator.clipboard.writeText(createdMeet.meet_link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('📋 Link copiado');
        }
    };

    // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────
    if (createdMeet) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Success header */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-2xl font-black text-white">
                            {mutation.data?.isRecurrent ? '¡Reunión recurrente creada!' : '¡Reunión creada!'}
                        </h2>
                        <p className="text-emerald-100 mt-1 text-sm font-medium">
                            {mutation.data?.isRecurrent ? (
                                <span>{mutation.data.recurrenceCount} reuniones agendadas en total (primer link abajo)</span>
                            ) : (
                                <span>{format(parseISO(startISO), "EEEE d 'de' MMMM", { locale: es })} · {formatTimeInZone(startISO, selectedTimezone)} — {formatTimeInZone(endISO, selectedTimezone)}</span>
                            )}
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Meet link */}
                        {createdMeet.meet_link && (
                            <div className="bg-[#4285F4]/5 border border-[#4285F4]/20 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Video className="w-4 h-4 text-[#4285F4]" />
                                    <span className="text-xs font-black text-[#4285F4] uppercase tracking-wide">
                                        Google Meet Link
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm text-gray-700 font-mono bg-gray-50 rounded-xl px-3 py-2 truncate">
                                        {createdMeet.meet_link}
                                    </code>
                                    <button
                                        onClick={copyMeetLink}
                                        className={`p-2.5 rounded-xl transition-all ${
                                            copied
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-gray-100 hover:bg-[#4285F4]/10 text-gray-500 hover:text-[#4285F4]'
                                        }`}
                                        title="Copiar link"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                    <a
                                        href={createdMeet.meet_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2.5 rounded-xl bg-[#4285F4] text-white hover:bg-[#3367d6] transition-all"
                                        title="Abrir Meet"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Calendar link */}
                        {createdMeet.html_link && (
                            <a
                                href={createdMeet.html_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#4285F4]/40 hover:bg-[#4285F4]/5 transition-all text-sm font-semibold text-gray-700 hover:text-[#4285F4]"
                            >
                                <Calendar className="w-4 h-4" />
                                Ver en Google Calendar
                                <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                            </a>
                        )}

                        {sendInvites && attendees.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                <Check className="w-3.5 h-3.5" />
                                Invitaciones enviadas a {attendees.length} asistente{attendees.length !== 1 ? 's' : ''}
                            </div>
                        )}

                        {/* Split Edit/Finish Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setCreatedMeet(null)}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
                            >
                                ✏️ Modificar
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-700 text-white font-bold text-sm transition-all"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── MAIN FORM ────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className={`p-6 flex items-start justify-between shrink-0 bg-gradient-to-br ${
                    isEditMode 
                        ? 'from-blue-500 to-indigo-600' 
                        : 'from-[#4285F4] to-[#1a73e8]'
                }`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Video className="w-5 h-5 text-white/90" />
                            <h2 className="text-xl font-black text-white">
                                {isEditMode ? 'Editar Reunión' : 'Nueva Reunión'}
                            </h2>
                        </div>
                        <p className="text-blue-100 text-sm font-medium">
                            {googleIntegration
                                ? `Conectado como ${googleIntegration.google_email}`
                                : 'Sin Google Calendar conectado'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* No Google Integration warning */}
                {!checkingIntegration && !googleIntegration && (
                    <div className="mx-6 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 shrink-0">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-xs font-bold text-amber-800">Google Calendar no conectado</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                La reunión se agendará en el CRM sin Meet link.{' '}
                                <a href="/settings?tab=integrations" className="underline font-bold">
                                    Conectar Google →
                                </a>
                            </p>
                        </div>
                    </div>
                )}

                {/* Scrollable form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Premium Organizer Profile Card */}
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50/50 rounded-2xl border border-indigo-100/60 p-4 flex items-center gap-3 shadow-sm">
                        {profile?.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.full_name || 'Organizador'}
                                className="w-11 h-11 rounded-full object-cover shadow-md border-2 border-white ring-2 ring-indigo-100 shrink-0"
                            />
                        ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md shrink-0">
                                {(profile?.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                Organizador del Evento
                            </p>
                            <p className="text-sm font-bold text-gray-800 truncate">
                                {profile?.full_name || 'Administrador del CRM'}
                            </p>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                {profile?.email || 'soporte@crm.com'}
                            </p>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                            Título de la reunión
                        </label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 transition-all"
                            placeholder="ej. Demo con Carlos Rodríguez"
                        />
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                                Fecha
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => {
                                        try {
                                            setCurrentMonth(parseISO(date));
                                        } catch (e) {
                                            setCurrentMonth(new Date());
                                        }
                                        setShowDatePicker(!showDatePicker);
                                    }}
                                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 text-left bg-white transition-all flex items-center gap-2 shadow-sm hover:border-gray-300"
                                >
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    {(() => {
                                        try {
                                            return format(parseISO(date), "d 'de' MMMM, yyyy", { locale: es });
                                        } catch (e) {
                                            return date;
                                        }
                                    })()}
                                </button>

                                {showDatePicker && (
                                    <>
                                        {/* Click outside backdrop */}
                                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowDatePicker(false)} />
                                        
                                        {/* Modern Date Picker Popover */}
                                        <div className="absolute top-[105%] left-0 z-50 w-[290px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                                            {/* Header Navigation */}
                                            <div className="flex items-center justify-between mb-3.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                                    className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                                                    {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                                    className="p-1.5 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Weekdays Grid */}
                                            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                                                {WEEKDAY_NAMES.map(w => (
                                                    <span key={w} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                        {w}
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Days Grid */}
                                            <div className="grid grid-cols-7 gap-1">
                                                {calendarDays.map((d, idx) => {
                                                    const isSelected = d.dateStr === date;
                                                    const isToday = d.dateStr === format(new Date(), 'yyyy-MM-dd');
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setDate(d.dateStr);
                                                                setShowDatePicker(false);
                                                            }}
                                                            className={`py-1.5 rounded-xl text-[11px] font-bold transition-all relative ${
                                                                isSelected
                                                                    ? 'bg-[#4285F4] text-white shadow-md shadow-[#4285F4]/30'
                                                                    : d.isCurrentMonth
                                                                        ? 'text-slate-700 hover:bg-slate-50'
                                                                        : 'text-slate-300 hover:bg-slate-50/50'
                                                            }`}
                                                        >
                                                            {d.dayNum}
                                                            {isToday && !isSelected && (
                                                                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4285F4]" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                                Hora inicio
                            </label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Recurrence Selection */}
                    {!isEditMode && (
                        <div className="grid grid-cols-2 gap-4 bg-indigo-50/20 rounded-2xl border border-indigo-100/60 p-4">
                            <div>
                                <label className="text-xs font-black text-indigo-700 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                    Repetir reunión
                                </label>
                                <div className="relative">
                                    <select
                                        value={recurrenceType}
                                        onChange={e => setRecurrenceType(e.target.value as any)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 transition-all appearance-none bg-white cursor-pointer"
                                    >
                                        <option value="none">No repetir</option>
                                        <option value="daily">Diariamente</option>
                                        <option value="weekly">Semanalmente</option>
                                        <option value="monthly">Mensualmente</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {recurrenceType !== 'none' && (
                                <div>
                                    <label className="text-xs font-black text-indigo-700 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                        Número de repeticiones
                                    </label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={20}
                                        value={recurrenceCount}
                                        onChange={e => setRecurrenceCount(Math.min(20, Math.max(2, parseInt(e.target.value) || 2)))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 transition-all"
                                    />
                                    <span className="text-[10px] text-gray-400 mt-1 block">Máx. 20 repeticiones</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Timezone Selector */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-[#4285F4]" />
                            Zona Horaria
                        </label>
                        <div className="relative">
                            <select
                                value={selectedTimezone}
                                onChange={e => setSelectedTimezone(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm font-semibold text-gray-800 transition-all appearance-none bg-white cursor-pointer"
                            >
                                {COMMON_TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Duration quick buttons */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                            Duración · Termina a las {endTime}
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {DURATION_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDuration(opt.value)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                        duration === opt.value
                                            ? 'bg-[#4285F4] text-white shadow-md shadow-[#4285F4]/30'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Attendees */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                            Asistentes
                        </label>

                        {/* Current attendees */}
                        {attendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {attendees.map(email => (
                                    <span
                                        key={email}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-[#4285F4]/10 text-[#4285F4] rounded-full text-xs font-bold"
                                    >
                                        <Mail className="w-3 h-3" />
                                        {email}
                                        <button
                                            onClick={() => removeAttendee(email)}
                                            className="hover:text-red-500 transition-colors ml-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Add attendee input */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    value={attendeeInput}
                                    onChange={e => setAttendeeInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ',') {
                                            e.preventDefault();
                                            addAttendee(attendeeInput);
                                        }
                                    }}
                                    placeholder="email@ejemplo.com"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm transition-all"
                                />
                            </div>
                            <button
                                onClick={() => addAttendee(attendeeInput)}
                                className="p-2.5 rounded-xl bg-gray-100 hover:bg-[#4285F4]/10 text-gray-500 hover:text-[#4285F4] transition-all"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Team member quick-add */}
                        {teamMembers && teamMembers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {teamMembers
                                    .filter(m => m.email && !attendees.includes(m.email))
                                    .slice(0, 5)
                                    .map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => m.email && addAttendee(m.email)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-medium text-gray-600 transition-all"
                                        >
                                            <Users className="w-3 h-3" />
                                            {m.full_name || m.email}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
                            Agenda (opcional)
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Puntos a tratar en la reunión..."
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#4285F4] focus:ring-2 focus:ring-[#4285F4]/20 outline-none text-sm text-gray-700 resize-none transition-all"
                        />
                    </div>

                    {/* Toggles — only show if Google connected */}
                    {googleIntegration && (
                        <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
                            {/* Meet link toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-[#4285F4]/10 flex items-center justify-center">
                                        <Video className="w-4 h-4 text-[#4285F4]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">Generar Google Meet</p>
                                        <p className="text-xs text-gray-500">Link de video conferencia automático</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAddMeetLink(!addMeetLink)}
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                                        addMeetLink ? 'bg-[#4285F4]' : 'bg-gray-300'
                                    }`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                                        addMeetLink ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0 items-center">
                    <button
                        onClick={onClose}
                        className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-100 transition-all shrink-0"
                    >
                        Cancelar
                    </button>
                    
                    <div className="flex-1 flex gap-3 justify-end min-w-0">
                        <button
                            onClick={() => mutation.mutate(false)}
                            disabled={mutation.isPending || !title.trim()}
                            className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[130px] shrink-0"
                        >
                            {mutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Calendar className="w-4 h-4" />
                            )}
                            {isEditMode ? 'Solo Guardar' : 'Solo Agendar'}
                        </button>
                        
                        <button
                            onClick={() => mutation.mutate(true)}
                            disabled={mutation.isPending || !title.trim()}
                            className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                isEditMode
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-indigo-100'
                                    : googleIntegration && addMeetLink
                                        ? 'bg-[#4285F4] hover:bg-[#3367d6] text-white shadow-lg shadow-[#4285F4]/30'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
                            } disabled:opacity-50 min-w-[170px] shrink-0`}
                        >
                            {mutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : googleIntegration && addMeetLink ? (
                                <Video className="w-4 h-4" />
                            ) : (
                                <Calendar className="w-4 h-4" />
                            )}
                            {isEditMode 
                                ? 'Guardar y Notificar' 
                                : googleIntegration && addMeetLink 
                                    ? 'Crear con Meet y Notificar' 
                                    : 'Agendar y Notificar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
