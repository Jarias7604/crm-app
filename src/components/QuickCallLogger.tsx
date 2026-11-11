import { useState, useRef, useEffect } from 'react';
import { 
    Phone, 
    X, 
    Loader2, 
    Clock, 
    CalendarPlus, 
    Check, 
    MessageSquare, 
    Mail, 
    Send, 
    User, 
    CheckCircle2, 
    PhoneMissed, 
    Voicemail, 
    PhoneOff, 
    AlertCircle, 
    FileText, 
    Users,
    Video,
    Sparkles
} from 'lucide-react';
import { SessionTimer } from './ui/SessionTimer';
import { callActivityService, type CallOutcome, type ActionType } from '../services/callActivity';
import { leadsService } from '../services/leads';
import { supabase } from '../services/supabase';
import type { Lead, LeadStatus, FollowUpActionType } from '../types';
import toast from 'react-hot-toast';
import { useTimezone } from '../hooks/useTimezone';
import { localToUtcISO, DEFAULT_TIMEZONE } from '../utils/timezone';
import { CustomSelect } from './ui/CustomSelect';
import { CustomDatePicker } from './ui/CustomDatePicker';
import { CustomTimePicker } from './ui/CustomTimePicker';
import { STATUS_CONFIG } from '../types';

interface QuickActionLoggerProps {
    lead: Lead;
    companyId: string;
    teamMembers?: { id: string; email: string; full_name?: string; avatar_url?: string }[];
    onCallLogged: (statusChanged?: boolean, newStatus?: LeadStatus) => void;
    onClose: () => void;
    /** Optional: timestamp (ms) when the call physically started — set from callTracker
     *  for mobile click-to-call flows. Overrides the form-open time. */
    callStartedAt?: number;
}

// ── Canales de contacto con iconos vectoriales ──────────────────────────────
const CHANNEL_CONFIG: Record<ActionType, { label: string; icon: typeof Phone }> = {
    call: { label: 'Llamada', icon: Phone },
    whatsapp: { label: 'WhatsApp', icon: MessageSquare },
    email: { label: 'Correo', icon: Mail },
    telegram: { label: 'Telegram', icon: Send },
    quote_sent: { label: 'Cotización', icon: FileText },
    info_sent: { label: 'Info Enviada', icon: Send },
    meeting: { label: 'Reunión', icon: Users },
};
const CHANNEL_ACTION_TYPES: ActionType[] = ['call', 'whatsapp', 'email', 'telegram'];

// ── Resultados con iconos vectoriales y etiquetas limpias ───────────────────
interface OutcomeConfig {
    label: string;
    icon: typeof CheckCircle2;
    iconColor: string;
}

const OUTCOME_CONFIG_MAP: Record<CallOutcome, OutcomeConfig> = {
    connected: { label: 'Conectado / Habló', icon: CheckCircle2, iconColor: 'text-emerald-600' },
    no_answer: { label: 'Sin respuesta', icon: PhoneMissed, iconColor: 'text-amber-500' },
    voicemail: { label: 'Buzón de voz', icon: Voicemail, iconColor: 'text-blue-500' },
    busy: { label: 'Ocupado', icon: PhoneOff, iconColor: 'text-rose-500' },
    wrong_number: { label: 'Nro. equivocado', icon: AlertCircle, iconColor: 'text-slate-400' },
    scheduled: { label: 'Programada', icon: CalendarPlus, iconColor: 'text-indigo-500' },
};

// Which outcomes make sense for each channel action type
const OUTCOME_BY_ACTION: Record<ActionType, CallOutcome[]> = {
    call: ['connected', 'no_answer', 'voicemail', 'busy', 'wrong_number'],
    email: ['connected', 'no_answer'],
    whatsapp: ['connected', 'no_answer'],
    telegram: ['connected', 'no_answer'],
    quote_sent: ['connected'],
    info_sent: ['connected'],
    meeting: ['connected', 'no_answer'],
};

// Special outcomes
type SpecialOutcome = 'quote_sent' | 'info_sent' | 'meeting';
const SPECIAL_OUTCOME_CONFIG: Record<SpecialOutcome, OutcomeConfig> = {
    quote_sent: { label: 'Cotización Enviada', icon: FileText, iconColor: 'text-indigo-600' },
    info_sent: { label: 'Info Enviada', icon: Send, iconColor: 'text-sky-600' },
    meeting: { label: 'Demo / Reunión Realizada', icon: Video, iconColor: 'text-purple-600' },
};
const SPECIAL_OUTCOMES: SpecialOutcome[] = ['quote_sent', 'info_sent', 'meeting'];

const NEXT_APPOINTMENT_TYPES: { key: FollowUpActionType; label: string; icon: typeof Phone }[] = [
    { key: 'call', label: 'Llamada', icon: Phone },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'meeting', label: 'Demo / Meet', icon: Video },
    { key: 'email', label: 'Correo', icon: Mail },
];

// Custom outcome labels per action type
const OUTCOME_OVERRIDES: Partial<Record<ActionType, Partial<Record<CallOutcome, Partial<OutcomeConfig>>>>> = {
    email: {
        connected: { label: 'Email enviado' },
        no_answer: { label: 'Sin respuesta' },
    },
    whatsapp: {
        connected: { label: 'Respondió chat' },
        no_answer: { label: 'No leído / Pendiente' },
    },
    telegram: {
        connected: { label: 'Respondió mensaje' },
        no_answer: { label: 'No leído / Pendiente' },
    },
};

// Map ActionType to FollowUpActionType for scheduling
const ACTION_TO_FOLLOWUP: Record<ActionType, FollowUpActionType> = {
    call: 'call',
    email: 'email',
    whatsapp: 'whatsapp',
    telegram: 'other',
    quote_sent: 'other',
    info_sent: 'other',
    meeting: 'meeting',
};

// 12h time slots (every 30 min)
const TIME_SLOTS = (() => {
    const slots: { value: string; label: string }[] = [];
    for (let h = 6; h <= 21; h++) {
        for (const m of [0, 30]) {
            if (h === 21 && m === 30) continue;
            const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const hour12 = h === 12 ? 12 : h > 12 ? h - 12 : h === 0 ? 12 : h;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
            slots.push({ value: hour24, label });
        }
    }
    return slots;
})();

const formatDateES = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const cleanStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
        const date = new Date(cleanStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const todayISO = new Date().toISOString().split('T')[0];

export function QuickActionLogger({ lead, companyId, teamMembers = [], onCallLogged, onClose, callStartedAt }: QuickActionLoggerProps) {
    const [actionType, setActionType] = useState<ActionType>('call');
    const [outcome, setOutcome] = useState<CallOutcome>('connected');
    const [specialOutcome, setSpecialOutcome] = useState<SpecialOutcome | null>(null);
    const [notes, setNotes] = useState('');
    const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
    const [isSaving, setIsSaving] = useState(false);
    const [newStatus, setNewStatus] = useState<string>('');

    // Track when form was opened
    const openedAtRef = useRef(callStartedAt ?? Date.now());

    // Quality Score calculation
    const calcQualityScore = () => {
        try {
            let score = 0;
            const effectiveOutcome = specialOutcome ? 'connected' : outcome;
            const sessionSecs = (Date.now() - (openedAtRef.current || Date.now())) / 1000;

            if (effectiveOutcome === 'connected') score += 20;
            if (notes && notes.trim().length > 15) score += 10;
            if (notes && notes.trim().length > 60) score += 5;
            if (wantsFollowUp && followUpDate) score += 20;
            if (sessionSecs > 90) score += 15;

            if (lead?.next_followup_date) {
                const targetTime = new Date(lead.next_followup_date).getTime();
                if (!isNaN(targetTime)) {
                    const diffH = Math.abs(Date.now() - targetTime) / 3_600_000;
                    if (diffH < 2) score += 30;
                }
            }

            return Math.min(Math.max(score, 0), 100);
        } catch {
            return 50;
        }
    };

    const { timezone: rawTimezone } = useTimezone(companyId);
    const companyTimezone = rawTimezone || DEFAULT_TIMEZONE;

    // Follow-up scheduling
    const [wantsFollowUp, setWantsFollowUp] = useState(false);
    const [followUpType, setFollowUpType] = useState<FollowUpActionType>('call');
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpTime, setFollowUpTime] = useState('09:00');
    const [followUpNote, setFollowUpNote] = useState('');
    const [followUpAssignee, setFollowUpAssignee] = useState(lead.assigned_to || '');
    const [googleIntegrationId, setGoogleIntegrationId] = useState<string | null>(null);
    const [googleIntegrationEmail, setGoogleIntegrationEmail] = useState<string | null>(null);
    const [createMeetInvite, setCreateMeetInvite] = useState(false);
    const [meetAttendeeEmail, setMeetAttendeeEmail] = useState(lead.email || '');

    useEffect(() => {
        let mounted = true;
        const loadGoogleIntegration = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const currentUserId = authData?.user?.id;
            const targetUserId = followUpAssignee || currentUserId;
            if (!targetUserId) return;

            let { data } = await supabase
                .from('calendar_integrations')
                .select('id, google_email')
                .eq('user_id', targetUserId)
                .eq('provider', 'google')
                .eq('is_active', true)
                .maybeSingle();

            if (!data && currentUserId && currentUserId !== targetUserId) {
                const fallback = await supabase
                    .from('calendar_integrations')
                    .select('id, google_email')
                    .eq('user_id', currentUserId)
                    .eq('provider', 'google')
                    .eq('is_active', true)
                    .maybeSingle();
                data = fallback.data;
            }

            if (mounted) {
                setGoogleIntegrationId(data?.id || null);
                setGoogleIntegrationEmail(data?.google_email || null);
            }
        };
        loadGoogleIntegration();
        return () => {
            mounted = false;
        };
    }, [followUpAssignee]);

    const handleActionTypeChange = (type: ActionType) => {
        setActionType(type);
        const validOutcomes = OUTCOME_BY_ACTION[type];
        if (!validOutcomes.includes(outcome)) {
            setOutcome(validOutcomes[0]);
        }
    };

    const handleSpecialOutcome = (key: SpecialOutcome) => {
        setSpecialOutcome(prev => prev === key ? null : key);
    };

    const getOutcomeConfig = (oc: CallOutcome): OutcomeConfig => {
        const base = OUTCOME_CONFIG_MAP[oc];
        const override = OUTCOME_OVERRIDES[actionType]?.[oc];
        return override ? { ...base, ...override } : base;
    };

    const getDefaultDate = () => {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        } catch {
            return '';
        }
    };

    const handleFollowUpToggle = () => {
        const next = !wantsFollowUp;
        setWantsFollowUp(next);
        if (next && !followUpDate) {
            setFollowUpDate(getDefaultDate());
        }
    };

    const handleSubmit = async () => {
        if (isSaving) return;

        if (wantsFollowUp && !followUpDate) {
            toast.error('Selecciona una fecha para el seguimiento');
            return;
        }

        setIsSaving(true);

        try {
            const effectiveActionType: ActionType = specialOutcome ?? actionType;
            const effectiveOutcome: CallOutcome = specialOutcome ? 'connected' : outcome;
            await callActivityService.logCall({
                companyId,
                leadId: lead.id,
                outcome: effectiveOutcome,
                actionType: effectiveActionType,
                notes: notes.trim() || undefined,
                statusBefore: lead.status,
                statusAfter: newStatus || undefined,
                durationSeconds: durationMinutes ? Number(durationMinutes) * 60 : undefined,
            });

            if (newStatus && newStatus !== lead.status) {
                await leadsService.updateLead(lead.id, { status: newStatus as any });
            }

            try {
                const { data: currentLead } = await supabase.from('leads').select('contact_count').eq('id', lead.id).single();
                await supabase.from('leads').update({ contact_count: ((currentLead?.contact_count as number) || 0) + 1 }).eq('id', lead.id);
            } catch (cntErr) {
                console.warn('Non-fatal: could not increment contact_count:', cntErr);
            }

            if (wantsFollowUp && followUpDate) {
                const followUpDateTime = localToUtcISO(`${followUpDate}T${followUpTime}`, companyTimezone);
                const nextTypeLabel = NEXT_APPOINTMENT_TYPES.find(t => t.key === followUpType)?.label || 'Llamada';
                const defaultNote = followUpType === 'meeting' ? 'Demo / Reunión' : `Seguimiento: ${nextTypeLabel}`;

                const createdFollowUp = await leadsService.createFollowUp({
                    lead_id: lead.id,
                    company_id: companyId || lead.company_id,
                    date: followUpDateTime,
                    notes: followUpNote.trim() || defaultNote,
                    action_type: followUpType,
                }, followUpAssignee || undefined);

                if (followUpType === 'meeting' && createMeetInvite && googleIntegrationId) {
                    try {
                        const startMs = new Date(followUpDateTime).getTime();
                        const endIso = new Date(startMs + 30 * 60 * 1000).toISOString();
                        const cleanEmail = meetAttendeeEmail.trim().toLowerCase();
                        const meetTitle = followUpNote.trim()
                            ? `${followUpNote.trim()} - ${lead.company_name || lead.name}`
                            : `Demo - ${lead.company_name || lead.name}`;
                        const meetRes = await leadsService.createGoogleMeeting({
                            integrationId: googleIntegrationId,
                            followUpId: createdFollowUp?.id,
                            title: meetTitle,
                            description: notes.trim() || `Demo / Reunión con ${lead.name}`,
                            start: followUpDateTime,
                            end: endIso,
                            attendees: cleanEmail && cleanEmail.includes('@') ? [cleanEmail] : [],
                            addMeetLink: true,
                            sendInvites: true,
                            timezone: companyTimezone,
                        });
                        if (meetRes?.meet_link) {
                            navigator.clipboard?.writeText(meetRes.meet_link).catch(() => {});
                            toast.success('Sala de Google Meet creada (link copiado al portapapeles)');
                        }
                    } catch (gErr) {
                        console.warn('Could not create Google Meet event automatically:', gErr);
                    }
                }

                const displayTime = (() => { const [h, m] = (followUpTime || '09:00').split(':'); const hn = parseInt(h, 10); return !isNaN(hn) ? `${hn % 12 || 12}:${(m || '00').slice(0, 2)} ${hn >= 12 ? 'PM' : 'AM'}` : followUpTime; })();
                toast.success(`${nextTypeLabel} agendada: ${formatDateES(followUpDate)} a las ${displayTime}`);
            }

            const effectiveLabel = specialOutcome
                ? SPECIAL_OUTCOME_CONFIG[specialOutcome].label
                : CHANNEL_CONFIG[actionType].label;
            toast.success(`${effectiveLabel} registrada`);

            onCallLogged(!!(newStatus && newStatus !== lead.status), newStatus ? newStatus as any : undefined);
            onClose();
        } catch (error: any) {
            console.error('Error logging action:', error);
            toast.error(`Error al registrar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const showDuration = actionType === 'call' || specialOutcome === 'meeting';
    const validOutcomes = OUTCOME_BY_ACTION[actionType];

    // Status dropdown options
    const statusOptions = [
        { value: '', label: `Sin cambio — Mantener (${lead.status})` },
        ...Object.entries(STATUS_CONFIG)
            .filter(([key]) => key !== lead.status)
            .map(([key, config]) => ({
                value: key,
                label: config.label,
                icon: config.icon,
            })),
    ];

    // Team member options for follow-up
    const assigneeOptions = [
        { value: '', label: 'Sin asignar' },
        ...(Array.isArray(teamMembers) ? teamMembers : [])
            .filter(Boolean)
            .map(m => {
                const emailPrefix = typeof m?.email === 'string' && m.email.includes('@') ? m.email.split('@')[0] : '';
                return {
                    value: m?.id || '',
                    label: m?.full_name || emailPrefix || 'Usuario',
                };
            }),
    ];

    const leadSubtitle = lead.company_name && lead.company_name !== lead.name
        ? `${lead.name} • ${lead.company_name}`
        : lead.name;

    return (
        <div className="bg-white rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col font-sans w-full">
            {/* Header Limpio & Profesional (Modelo Enterprise) */}
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                            Registrar Seguimiento
                        </h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                            {leadSubtitle}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
                    title="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Contenido Formulario con Scroll Interno — Espacios optimizados en las esquinas */}
            <div className="p-2 sm:p-4 space-y-3 overflow-y-auto max-h-[78vh]">
                {/* ── 1. CANAL DE CONTACTO (4 Segmented Tabs con Iconos Vectoriales) ── */}
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Canal de Contacto
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                        {CHANNEL_ACTION_TYPES.map(key => {
                            const config = CHANNEL_CONFIG[key];
                            const ChannelIcon = config.icon;
                            const isSelected = actionType === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleActionTypeChange(key)}
                                    className={`flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80 font-black'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                                    }`}
                                >
                                    <ChannelIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                                    <span className="text-[10px] sm:text-[11px] tracking-tight">{config.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── 2. RESULTADO DE LA ACCIÓN (2 COLUMNAS ORDENADAS, ICONOS VECTORIALES, SIN RECORTE) ── */}
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Resultado del Contacto
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {validOutcomes.map(key => {
                            const config = getOutcomeConfig(key);
                            const OutcomeIcon = config.icon;
                            const isSelected = outcome === key && !specialOutcome;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => { setOutcome(key); setSpecialOutcome(null); }}
                                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs transition-all border flex items-center gap-2 text-left cursor-pointer active:scale-98 ${
                                        isSelected
                                            ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold ring-1 ring-blue-600 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                                    }`}
                                >
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-blue-100/80' : 'bg-slate-100'
                                    }`}>
                                        <OutcomeIcon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                                    </div>
                                    <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                                        {config.label}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Special outcomes: Cotización, Info Enviada, Reunión */}
                        {SPECIAL_OUTCOMES.map(key => {
                            const config = SPECIAL_OUTCOME_CONFIG[key];
                            const OutcomeIcon = config.icon;
                            const isSelected = specialOutcome === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleSpecialOutcome(key)}
                                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs transition-all border flex items-center gap-2 text-left cursor-pointer active:scale-98 ${
                                        isSelected
                                            ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 font-bold ring-1 ring-indigo-600 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                                    }`}
                                >
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-indigo-100/80' : 'bg-slate-100'
                                    }`}>
                                        <OutcomeIcon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                                    </div>
                                    <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                                        {config.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── 3. CAMBIO DE ESTADO (CustomSelect) ── */}
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        ¿Cambió el estado del prospecto? <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <CustomSelect
                        value={newStatus}
                        onChange={(val) => setNewStatus(val)}
                        options={statusOptions}
                        placeholder={`Sin cambio — Mantener (${lead.status})`}
                        buttonClassName="w-full h-10 flex items-center justify-between bg-white border border-slate-200 shadow-2xs rounded-xl px-3.5 text-left text-xs font-semibold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer"
                    />
                    {newStatus && (
                        <p className="text-[11px] text-blue-600 font-bold mt-1.5 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Se actualizará a: <strong className="font-extrabold">{lead.status} → {newStatus}</strong></span>
                        </p>
                    )}
                </div>

                {/* ── 4. DURACIÓN DE LA LLAMADA ── */}
                {showDuration && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>Duración de la llamada</span>
                            </label>
                            <SessionTimer openedAt={openedAtRef.current} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                                const autoMin = Math.max(1, Math.round((Date.now() - openedAtRef.current) / 60000));
                                return (
                                    <button
                                        type="button"
                                        onClick={() => setDurationMinutes(autoMin)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                            durationMinutes === autoMin
                                                ? 'bg-blue-600 text-white shadow-2xs'
                                                : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                                        }`}
                                    >
                                        <Clock className="w-3 h-3" /> Auto ({autoMin}m)
                                    </button>
                                );
                            })()}
                            {[1, 5, 10, 15, 30].map(min => (
                                <button
                                    key={min}
                                    type="button"
                                    onClick={() => setDurationMinutes(min)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        durationMinutes === min
                                            ? 'bg-blue-600 text-white shadow-2xs'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    {min} min
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 5. NOTAS DE LA CONVERSACIÓN ── */}
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        Resumen de la Conversación / Notas <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="¿Qué se habló con el cliente? Requerimientos, acuerdos..."
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all resize-none shadow-2xs leading-relaxed"
                    />
                </div>

                {/* ── 6. AGENDAR PRÓXIMO SEGUIMIENTO ── */}
                <div className="border border-slate-200 rounded-xl bg-white">
                    <button
                        type="button"
                        onClick={handleFollowUpToggle}
                        className={`w-full flex items-center justify-between p-3 transition-colors cursor-pointer text-left ${
                            wantsFollowUp ? 'bg-indigo-50/70 border-b border-indigo-100 rounded-t-xl' : 'bg-slate-50/70 hover:bg-slate-100/70 rounded-xl'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <CalendarPlus className={`w-4 h-4 ${wantsFollowUp ? 'text-indigo-600' : 'text-slate-500'}`} />
                            <span className={`text-xs font-bold ${wantsFollowUp ? 'text-indigo-900 font-extrabold' : 'text-slate-700'}`}>
                                ¿Agendar próximo seguimiento con fecha?
                            </span>
                        </div>
                        <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                            wantsFollowUp ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                wantsFollowUp ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                        </div>
                    </button>

                    {wantsFollowUp && (
                        <div className="p-3 bg-indigo-50/30 rounded-b-xl space-y-2.5 animate-in fade-in duration-200">
                            {/* Tipo de Próxima Cita (Llamada | WhatsApp | Demo / Reunión | Correo) */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                    Tipo de Próxima Cita en Calendario
                                </label>
                                <div className="grid grid-cols-4 gap-1 p-0.5 bg-white rounded-xl border border-slate-200">
                                    {NEXT_APPOINTMENT_TYPES.map(item => {
                                        const NextIcon = item.icon;
                                        const isSelected = followUpType === item.key;
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => {
                                                    setFollowUpType(item.key);
                                                    setCreateMeetInvite(item.key === 'meeting');
                                                }}
                                                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                                                    isSelected
                                                        ? item.key === 'meeting'
                                                            ? 'bg-violet-600 text-white shadow-2xs font-black'
                                                            : 'bg-indigo-600 text-white shadow-2xs font-black'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                            >
                                                <NextIcon className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Fecha y Hora: Alineación perfecta horizontal y vertical (mismo baseline, mismo h-10) */}
                            <div className="grid grid-cols-2 gap-2.5 items-end">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                        Fecha
                                    </label>
                                    <CustomDatePicker
                                        value={followUpDate}
                                        onChange={setFollowUpDate}
                                        minDate={todayISO}
                                        variant="white"
                                        placeholder="Seleccionar fecha"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                        Hora
                                    </label>
                                    <CustomTimePicker
                                        value={followUpTime}
                                        onChange={setFollowUpTime}
                                    />
                                </div>
                            </div>

                            {/* Ejecutivo Asignado */}
                            {Array.isArray(teamMembers) && teamMembers.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                        Asignar a Ejecutivo
                                    </label>
                                    <CustomSelect
                                        value={followUpAssignee}
                                        onChange={setFollowUpAssignee}
                                        options={assigneeOptions}
                                        placeholder="Asignar ejecutivo"
                                        buttonClassName="w-full h-10 flex items-center justify-between bg-white border border-slate-200 shadow-2xs rounded-xl px-3.5 text-left text-xs font-semibold text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 cursor-pointer"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                                    Objetivo del Seguimiento
                                </label>
                                <input
                                    type="text"
                                    value={followUpNote}
                                    onChange={(e) => setFollowUpNote(e.target.value)}
                                    placeholder={
                                        followUpType === 'meeting'
                                            ? 'Ej: "Demo virtual del sistema / Visita presencial"'
                                            : 'Ej: "Llamar para confirmar recepción de propuesta"'
                                    }
                                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all shadow-2xs"
                                />
                            </div>

                            {/* Google Calendar + Google Meet Integration Card (Always visible so user can toggle it directly) */}
                            <div
                                className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                    createMeetInvite
                                        ? 'bg-violet-50/80 border-violet-300 shadow-2xs'
                                        : 'bg-white border-slate-200'
                                }`}
                            >
                                <label className="flex items-center justify-between gap-2 cursor-pointer">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                createMeetInvite
                                                    ? 'bg-violet-600 text-white'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[11px] font-bold text-slate-900 truncate">
                                                Agendar en Google Calendar + Google Meet
                                            </span>
                                            <span className="block text-[9px] text-slate-500 truncate">
                                                {googleIntegrationEmail
                                                    ? `Conectado: ${googleIntegrationEmail}`
                                                    : 'Genera sala de videollamada e invitación de calendario'}
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={createMeetInvite}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setCreateMeetInvite(checked);
                                            if (checked && followUpType !== 'meeting') {
                                                setFollowUpType('meeting');
                                            }
                                        }}
                                        className="w-4 h-4 rounded accent-violet-600 cursor-pointer shrink-0"
                                    />
                                </label>
                                {createMeetInvite && (
                                    <div className="pt-1 space-y-1.5">
                                        <input
                                            type="email"
                                            value={meetAttendeeEmail}
                                            onChange={e => setMeetAttendeeEmail(e.target.value)}
                                            placeholder="Correo del cliente para enviar invitación de Google Meet (opcional)"
                                            className="w-full h-8 bg-white border border-violet-200 rounded-lg px-2.5 text-[11px] font-medium text-slate-800 placeholder-slate-400 focus:border-violet-600 outline-none"
                                        />
                                        {!googleIntegrationId && (
                                            <p className="text-[10px] text-amber-700 font-medium">
                                                Se agendará como Demo en el CRM (conecta Google Calendar en Configuración para generar link Meet automático).
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 7. CALIDAD DEL REGISTRO (Minimalista) ── */}
                {(() => {
                    const score = calcQualityScore();
                    const isGreat = score >= 80;
                    const isOk = score >= 50;
                    const barColor = isGreat ? 'bg-emerald-500' : isOk ? 'bg-amber-500' : 'bg-blue-500';
                    const textColor = isGreat ? 'text-emerald-700' : isOk ? 'text-amber-700' : 'text-blue-700';
                    const label = isGreat ? 'Excelente' : isOk ? 'Buena' : 'Básica';
                    return (
                        <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/80">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Calidad de Información</span>
                                <span className={`text-[11px] font-black ${textColor}`}>{score}/100 • {label}</span>
                            </div>
                            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                    style={{ width: `${score}%` }}
                                />
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Footer con Botones de Acción (Accesibles al Pulgar) */}
            <div className="p-2.5 sm:p-4 border-t border-slate-200/90 bg-slate-50/90 flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50 ${
                        wantsFollowUp
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/20'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/20'
                    }`}
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : wantsFollowUp ? (
                        <>
                            <CalendarPlus className="w-4 h-4" />
                            <span>Registrar y Agendar</span>
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            <span>Registrar {CHANNEL_CONFIG[actionType].label}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
