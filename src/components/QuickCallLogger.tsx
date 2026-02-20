import { useState } from 'react';
import { Phone, X, Loader2, ChevronDown, Clock, CalendarPlus } from 'lucide-react';
import { callActivityService, ACTION_TYPE_CONFIG, CALL_OUTCOME_CONFIG, type CallOutcome, type ActionType } from '../services/callActivity';
import { leadsService } from '../services/leads';
import type { Lead, LeadStatus, FollowUpActionType } from '../types';
import { STATUS_CONFIG } from '../types';
import { CustomDatePicker } from './ui/CustomDatePicker';
import toast from 'react-hot-toast';

interface QuickActionLoggerProps {
    lead: Lead;
    companyId: string;
    teamMembers?: { id: string; email: string; full_name?: string; avatar_url?: string }[];
    onCallLogged: (statusChanged?: boolean, newStatus?: LeadStatus) => void;
    onClose: () => void;
}

// Which outcomes make sense for each action type (scheduled removed — now independent toggle)
const OUTCOME_BY_ACTION: Record<ActionType, CallOutcome[]> = {
    call: ['connected', 'no_answer', 'voicemail', 'busy', 'wrong_number'],
    email: ['connected', 'no_answer'],
    whatsapp: ['connected', 'no_answer'],
    telegram: ['connected', 'no_answer'],
    quote_sent: ['connected'],
    info_sent: ['connected'],
    meeting: ['connected', 'no_answer'],
};

// Custom outcome labels per action type (override generic ones)
const OUTCOME_OVERRIDES: Partial<Record<ActionType, Partial<Record<CallOutcome, { label: string; icon: string }>>>> = {
    email: {
        connected: { label: 'Enviado', icon: '✅' },
        no_answer: { label: 'Sin respuesta', icon: '📵' },
    },
    whatsapp: {
        connected: { label: 'Respondió', icon: '✅' },
        no_answer: { label: 'No leído', icon: '📵' },
    },
    telegram: {
        connected: { label: 'Respondió', icon: '✅' },
        no_answer: { label: 'No leído', icon: '📵' },
    },
    quote_sent: {
        connected: { label: 'Enviada', icon: '✅' },
    },
    info_sent: {
        connected: { label: 'Enviada', icon: '✅' },
    },
    meeting: {
        connected: { label: 'Realizada', icon: '✅' },
        no_answer: { label: 'No asistió', icon: '📵' },
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
            if (h === 21 && m === 30) continue; // stop at 9:00 PM
            const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const hour12 = h === 12 ? 12 : h > 12 ? h - 12 : h === 0 ? 12 : h;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
            slots.push({ value: hour24, label });
        }
    }
    return slots;
})();

// Format date for display in Spanish
const formatDateES = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const todayISO = new Date().toISOString().split('T')[0];

export function QuickActionLogger({ lead, companyId, teamMembers = [], onCallLogged, onClose }: QuickActionLoggerProps) {
    const [actionType, setActionType] = useState<ActionType>('call');
    const [outcome, setOutcome] = useState<CallOutcome>('connected');
    const [notes, setNotes] = useState('');
    const [changeStatus, setChangeStatus] = useState(false);
    const [newStatus, setNewStatus] = useState<LeadStatus>(lead.status);
    const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isOutcomeOpen, setIsOutcomeOpen] = useState(false);

    // Independent follow-up toggle (decoupled from outcome)
    const [wantsFollowUp, setWantsFollowUp] = useState(false);
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpTime, setFollowUpTime] = useState('09:00');
    const [followUpNote, setFollowUpNote] = useState('');
    const [followUpAssignee, setFollowUpAssignee] = useState(lead.assigned_to || '');

    // When action type changes, reset outcome to first valid one
    const handleActionTypeChange = (type: ActionType) => {
        setActionType(type);
        const validOutcomes = OUTCOME_BY_ACTION[type];
        if (!validOutcomes.includes(outcome)) {
            setOutcome(validOutcomes[0]);
        }
    };

    // Get outcome config with overrides
    const getOutcomeConfig = (oc: CallOutcome) => {
        const override = OUTCOME_OVERRIDES[actionType]?.[oc];
        const base = CALL_OUTCOME_CONFIG[oc];
        return override ? { ...base, ...override } : base;
    };

    // Default follow-up date to tomorrow
    const getDefaultDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    // Toggle follow-up scheduling
    const handleFollowUpToggle = () => {
        const next = !wantsFollowUp;
        setWantsFollowUp(next);
        if (next && !followUpDate) {
            setFollowUpDate(getDefaultDate());
        }
    };

    const handleSubmit = async () => {
        if (isSaving) return;

        // Validate follow-up date if scheduling
        if (wantsFollowUp && !followUpDate) {
            toast.error('Selecciona una fecha para el seguimiento');
            return;
        }

        setIsSaving(true);

        try {
            // 1. Log the contact activity with the REAL outcome
            await callActivityService.logCall({
                companyId,
                leadId: lead.id,
                outcome,
                actionType,
                notes: notes.trim() || undefined,
                statusBefore: lead.status,
                statusAfter: changeStatus && newStatus !== lead.status ? newStatus : undefined,
                durationSeconds: durationMinutes ? Number(durationMinutes) * 60 : undefined,
            });

            // 2. If user wants a follow-up, create it independently
            if (wantsFollowUp && followUpDate) {
                const followUpDateTime = `${followUpDate}T${followUpTime}:00`;
                const followUpActionType = ACTION_TO_FOLLOWUP[actionType];

                await leadsService.createFollowUp({
                    lead_id: lead.id,
                    date: followUpDateTime,
                    notes: followUpNote.trim() || `Seguimiento: ${ACTION_TYPE_CONFIG[actionType].label}`,
                    action_type: followUpActionType,
                }, followUpAssignee || undefined);

                const displayTime = TIME_SLOTS.find(s => s.value === followUpTime)?.label || followUpTime;
                toast.success(`📅 Seguimiento agendado: ${formatDateES(followUpDate)} a las ${displayTime}`);
            }

            const actionLabel = ACTION_TYPE_CONFIG[actionType].icon + ' ' + ACTION_TYPE_CONFIG[actionType].label;
            toast.success(`${actionLabel} registrada`);

            onCallLogged(
                changeStatus && newStatus !== lead.status,
                changeStatus && newStatus !== lead.status ? newStatus : undefined
            );
            onClose();
        } catch (error: any) {
            console.error('Error logging action:', error);
            toast.error(`Error al registrar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Statuses available for status change (exclude current and Erróneo)
    const availableStatuses = Object.keys(STATUS_CONFIG).filter(
        s => s !== lead.status && s !== 'Erróneo'
    ) as LeadStatus[];

    // Show duration field for calls and meetings
    const showDuration = actionType === 'call' || actionType === 'meeting';
    const validOutcomes = OUTCOME_BY_ACTION[actionType];

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                        <Phone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Registrar Acción</h4>
                        <p className="text-[10px] text-gray-500 font-medium">{lead.name}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
                >
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Action Type Selector */}
            <div className="mb-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">
                    Tipo de Acción
                </label>
                <div className="flex gap-1.5 flex-wrap">
                    {(Object.entries(ACTION_TYPE_CONFIG) as [ActionType, typeof ACTION_TYPE_CONFIG[ActionType]][]).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => handleActionTypeChange(key)}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${actionType === key
                                ? 'bg-white shadow-md border-emerald-300 text-gray-900 scale-[1.03]'
                                : 'bg-white/40 border-transparent text-gray-500 hover:bg-white/70 hover:border-gray-200'
                                }`}
                        >
                            <span className="text-sm">{config.icon}</span>
                            <span className="hidden sm:inline">{config.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Outcome Selector (adapts to action type — no more "scheduled") */}
            <div className="mb-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">
                    Resultado
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {validOutcomes.map(key => {
                        const config = getOutcomeConfig(key);
                        return (
                            <button
                                key={key}
                                onClick={() => setOutcome(key)}
                                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${outcome === key
                                    ? 'bg-white shadow-md border-emerald-300 text-gray-900 scale-[1.02]'
                                    : 'bg-white/40 border-transparent text-gray-500 hover:bg-white/70 hover:border-gray-200'
                                    }`}
                            >
                                <span className="text-sm">{config.icon}</span>
                                <span className="truncate">{config.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ===== INDEPENDENT FOLLOW-UP TOGGLE ===== */}
            <div className="mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleFollowUpToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${wantsFollowUp ? 'bg-purple-600' : 'bg-gray-200'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${wantsFollowUp ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                    <div className="flex items-center gap-1.5">
                        <CalendarPlus className={`w-3.5 h-3.5 ${wantsFollowUp ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className={`text-xs font-bold ${wantsFollowUp ? 'text-purple-700' : 'text-gray-600'}`}>
                            ¿Agendar seguimiento?
                        </span>
                    </div>
                </div>

                {/* Follow-Up Scheduler (independent from outcome) */}
                {wantsFollowUp && (
                    <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarPlus className="w-4 h-4 text-purple-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                                Agendar Seguimiento
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="block text-[8px] font-bold text-purple-500 uppercase mb-1 ml-1">Fecha</label>
                                <CustomDatePicker
                                    value={followUpDate}
                                    onChange={(date) => setFollowUpDate(date)}
                                    placeholder="Seleccionar fecha"
                                    variant="light"
                                    minDate={todayISO}
                                    forceOpenUp
                                />
                            </div>
                            <div>
                                <label className="block text-[8px] font-bold text-purple-500 uppercase mb-1 ml-1">Hora</label>
                                <select
                                    value={followUpTime}
                                    onChange={(e) => setFollowUpTime(e.target.value)}
                                    className="w-full bg-white border border-purple-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-all outline-none appearance-none cursor-pointer"
                                >
                                    {TIME_SLOTS.map(slot => (
                                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* Assignee Selector */}
                        {teamMembers.length > 0 && (
                            <div className="mb-3">
                                <label className="block text-[8px] font-bold text-purple-500 uppercase mb-1 ml-1">Ejecutivo Asignado</label>
                                <select
                                    value={followUpAssignee}
                                    onChange={(e) => setFollowUpAssignee(e.target.value)}
                                    className="w-full bg-white border border-purple-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-all outline-none appearance-none cursor-pointer"
                                >
                                    <option value="">Sin asignar</option>
                                    {teamMembers.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.full_name || m.email.split('@')[0]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <input
                            type="text"
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            placeholder={`Nota: ej. "Enviar propuesta actualizada"`}
                            className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 text-xs font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 transition-all outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Quick Notes */}
            <div className="mb-4">
                <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">
                    Nota rápida (opcional)
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="¿Qué se discutió? ¿Próximos pasos?"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all outline-none resize-none"
                />
            </div>

            {/* Call Duration (only for calls & meetings) */}
            {showDuration && (
                <div className="mb-4">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">
                        <Clock className="w-3 h-3 inline mr-1" />Duración (minutos)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={0}
                            max={999}
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-20 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-center placeholder:text-gray-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all outline-none"
                        />
                        <div className="flex gap-1 flex-wrap flex-1">
                            {[1, 5, 10, 15, 30].map(min => (
                                <button
                                    key={min}
                                    type="button"
                                    onClick={() => setDurationMinutes(min)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all ${durationMinutes === min
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-white border border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
                                        }`}
                                >
                                    {min}m
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Status Change Toggle */}
            <div className="mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setChangeStatus(!changeStatus)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${changeStatus ? 'bg-emerald-600' : 'bg-gray-200'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${changeStatus ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                    <span className="text-xs font-bold text-gray-600">
                        ¿Cambió el estado del lead?
                    </span>
                </div>

                {changeStatus && (
                    <div className="mt-3 relative" onClick={() => setIsOutcomeOpen(!isOutcomeOpen)}>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 cursor-pointer hover:border-emerald-300 transition-colors">
                            <span className="text-sm">{STATUS_CONFIG[newStatus]?.icon}</span>
                            <span className="text-xs font-bold text-gray-700 flex-1">{STATUS_CONFIG[newStatus]?.label}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOutcomeOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isOutcomeOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 max-h-48 overflow-y-auto">
                                {availableStatuses.map(status => (
                                    <button
                                        key={status}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNewStatus(status);
                                            setIsOutcomeOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition-colors ${newStatus === status
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span>{STATUS_CONFIG[status]?.icon}</span>
                                        {STATUS_CONFIG[status]?.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Submit */}
            <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-black px-4 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className={`flex-[2] text-white font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${wantsFollowUp
                        ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        }`}
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : wantsFollowUp ? (
                        <>
                            <CalendarPlus className="w-3.5 h-3.5" />
                            Registrar + Agendar
                        </>
                    ) : (
                        <>
                            <span className="text-sm">{ACTION_TYPE_CONFIG[actionType].icon}</span>
                            Registrar {ACTION_TYPE_CONFIG[actionType].label}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
