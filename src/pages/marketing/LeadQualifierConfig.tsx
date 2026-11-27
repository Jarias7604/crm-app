import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    Bell,
    Bot,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    ExternalLink,
    FileSpreadsheet,
    FlaskConical,
    Loader2,
    MessageSquare,
    Moon,
    Pause,
    Play,
    Plus,
    RefreshCw,
    Save,
    Send,
    Settings2,
    ShieldAlert,
    Sparkles,
    Trash2,
    Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import { AiUsageCostCard } from '../../components/AiUsageCostCard';
import { Button } from '../../components/ui/Button';
import {
    buildDefaultQualifierConfig,
    leadQualifierService,
    type LeadDemoRoutingRule,
    type PendingSheetLead,
    type ProductOption,
    type TeamMemberOption,
} from '../../services/leadQualifierService';
import type {
    LeadQualifierConfig as QualifierConfigType,
    LeadQualifierSession,
    PainPlaybook,
} from '../../utils/leadQualifierDefaults';
import { renderFirstTouchMessage } from '../../utils/leadQualifierDefaults';

type ConfigTab = 'master' | 'prompts' | 'playbooks' | 'routing' | 'sessions';

function getZonedDateKey(isoOrDate: string | Date, timeZone: string): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: timeZone || 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate);
    } catch {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    }
}

function formatSheetLeadTime(iso: string, timeZone: string, todayKey: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const tz = timeZone || 'America/El_Salvador';
    const key = getZonedDateKey(d, tz);
    try {
        const timeStr = new Intl.DateTimeFormat('es-SV', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(d);
        if (key === todayKey) return `Hoy · ${timeStr}`;
        const dateStr = new Intl.DateTimeFormat('es-SV', {
            timeZone: tz,
            day: '2-digit',
            month: 'short',
        }).format(d);
        return `${dateStr} · ${timeStr}`;
    } catch {
        return key === todayKey ? 'Hoy' : key;
    }
}

function extractSheetPainLabel(lead: PendingSheetLead): string {
    const fields = lead.raw_meta_payload?.fields;
    if (!fields || typeof fields !== 'object') return '';
    for (const [k, v] of Object.entries(fields)) {
        const nk = k
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
        if (nk.includes('PUNTO DE MEJORA') || nk.includes('AREA DE MEJORA') || nk === 'NECESIDAD') {
            const val = String(v ?? '').trim();
            if (val && val !== '—' && val !== '-') return val;
        }
    }
    return '';
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    draft_pending: { label: 'Borrador Pendiente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    active: { label: 'IA Activa', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    paused: { label: 'Pausada', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    handed_off: { label: 'Pidió Asesor', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    demo_booked: { label: 'Demo Agendada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    human_takeover: { label: 'Asesor en Control', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    closed: { label: 'Cerrada', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    max_turns: { label: 'Tope Turnos · Asesor', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export default function LeadQualifierConfig() {
    const { profile, simulatedCompanyId } = useAuth();
    const companyId = simulatedCompanyId || profile?.company_id || '';

    const [activeTab, setActiveTab] = useState<ConfigTab>('master');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [config, setConfig] = useState<QualifierConfigType | null>(null);
    const [savedConfigIsEnabled, setSavedConfigIsEnabled] = useState(false);
    const [rules, setRules] = useState<LeadDemoRoutingRule[]>([]);
    const [sessions, setSessions] = useState<LeadQualifierSession[]>([]);
    const [pendingSheetLeads, setPendingSheetLeads] = useState<PendingSheetLead[]>([]);
    const [selectedSheetLeadIds, setSelectedSheetLeadIds] = useState<string[]>([]);
    const [sheetDateFilter, setSheetDateFilter] = useState<'today' | '7d' | 'all'>('today');
    const [enrollingBatch, setEnrollingBatch] = useState(false);
    const filterInitializedRef = React.useRef(false);
    const [team, setTeam] = useState<TeamMemberOption[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);

    // New/Edit routing rule form
    const [editingRule, setEditingRule] = useState<Partial<LeadDemoRoutingRule> | null>(null);
    const [savingRule, setSavingRule] = useState(false);

    // Draft inline editor map
    const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
    const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);

    // Test WhatsApp advisor alert state
    const [testAdvisorId, setTestAdvisorId] = useState<string>('');
    const [sendingTestWa, setSendingTestWa] = useState(false);
    const [runningSla, setRunningSla] = useState(false);

    // Safe Dry-Run Simulator
    const [simName, setSimName] = useState('Evany Susana Ortiz');
    const [simCompany, setSimCompany] = useState('Susana Calvo Salón');
    const [simPain, setSimPain] = useState('Inventarios y productos');
    const [simVolume, setSimVolume] = useState('2,000 - 5,000');
    const [simUrgency, setSimUrgency] = useState('Lo antes posible');
    const [simTimeMode, setSimTimeMode] = useState<'day' | 'night'>('night');
    const [simIncoming, setSimIncoming] = useState('');
    const [simHistory, setSimHistory] = useState<string[]>([]);
    const [simOfferedSlots, setSimOfferedSlots] = useState<any[]>([]);
    const [simResult, setSimResult] = useState<any | null>(null);
    const [simRunning, setSimRunning] = useState(false);

    const loadAll = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [cfg, rls, sess, tm, pr] = await Promise.all([
                leadQualifierService.getConfig(companyId),
                leadQualifierService.getRoutingRules(companyId),
                leadQualifierService.getSessions(companyId),
                leadQualifierService.getTeamMembers(companyId),
                leadQualifierService.getProducts(companyId),
            ]);
            setConfig(cfg);
            setSavedConfigIsEnabled(Boolean(cfg.is_enabled));
            setRules(rls);
            setSessions(sess);
            setTeam(tm);
            setProducts(pr);

            const pending = await leadQualifierService.getPendingSheetLeads(
                companyId,
                sess.map((s) => s.lead_id),
            );
            setPendingSheetLeads(pending);
            setSelectedSheetLeadIds((prev) => prev.filter((id) => pending.some((p) => p.id === id)));

            if (!filterInitializedRef.current) {
                filterInitializedRef.current = true;
                const tz = cfg.timezone || 'America/El_Salvador';
                const todayK = getZonedDateKey(new Date(), tz);
                const sevenDaysAgoMs = Date.now() - 7 * 86_400_000;
                const todayCnt = pending.filter((p) => getZonedDateKey(p.created_at, tz) === todayK).length;
                const weekCnt = pending.filter((p) => new Date(p.created_at).getTime() >= sevenDaysAgoMs).length;
                setSheetDateFilter(todayCnt > 0 ? 'today' : weekCnt > 0 ? '7d' : 'all');
            }

            if (!testAdvisorId && tm.length > 0) {
                const withPhone = tm.find((m) => m.phone) || tm[0];
                setTestAdvisorId(withPhone.id);
            }
            const nextEdits: Record<string, string> = {};
            for (const s of sess) {
                if (s.last_ai_draft || s.first_message_draft) {
                    nextEdits[s.lead_id] = s.last_ai_draft || s.first_message_draft || '';
                }
            }
            setDraftEdits(nextEdits);
        } catch (err: any) {
            toast.error(err?.message || 'Error al cargar configuración del Calificador IA');
        } finally {
            setLoading(false);
        }
    }, [companyId, testAdvisorId]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleSaveConfig = async () => {
        if (!companyId || !config) return;
        setSaving(true);
        try {
            const saved = await leadQualifierService.saveConfig(companyId, profile?.id, config);
            setConfig(saved);
            setSavedConfigIsEnabled(Boolean(saved.is_enabled));
            toast.success(
                saved.is_enabled
                    ? `Configuración guardada (${saved.mode === 'draft' ? 'Modo Borrador Seguro' : 'Modo Automático'})`
                    : 'Configuración guardada (Motor Apagado)',
            );
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleSource = (src: string) => {
        if (!config) return;
        const set = new Set(config.allowed_sources);
        if (set.has(src)) {
            if (set.size > 1) set.delete(src);
        } else {
            set.add(src);
        }
        setConfig({ ...config, allowed_sources: [...set] });
    };

    const handleUpdatePlaybook = (idx: number, patch: Partial<PainPlaybook>) => {
        if (!config) return;
        const next = config.pain_playbooks.map((pb, i) => (i === idx ? { ...pb, ...patch } : pb));
        setConfig({ ...config, pain_playbooks: next });
    };

    const handleAddPlaybook = () => {
        if (!config) return;
        const id = `custom_${Date.now()}`;
        const fresh: PainPlaybook = {
            id,
            label: 'Nuevo Dolor / Necesidad',
            product_hint: 'ERP',
            keywords: ['nueva palabra clave'],
            strong_modules: 'Módulos clave que resuelven este dolor',
            value_proposition: 'Explica el beneficio tangible en 2 líneas.',
            qualifying_question: '¿Pregunta breve para calificar al prospecto?',
            is_active: true,
        };
        setConfig({ ...config, pain_playbooks: [...config.pain_playbooks, fresh] });
    };

    const handleDeletePlaybook = (idx: number) => {
        if (!config) return;
        if (config.pain_playbooks.length <= 1) {
            toast.error('Debes conservar al menos un playbook activo');
            return;
        }
        setConfig({
            ...config,
            pain_playbooks: config.pain_playbooks.filter((_, i) => i !== idx),
        });
    };

    const handleSaveRule = async () => {
        if (!companyId || !editingRule?.name?.trim()) {
            toast.error('Escribe un nombre para la regla');
            return;
        }
        if (!editingRule.assignee_user_ids || editingRule.assignee_user_ids.length === 0) {
            toast.error('Selecciona al menos un asesor responsable');
            return;
        }
        setSavingRule(true);
        try {
            await leadQualifierService.upsertRoutingRule(companyId, editingRule as any);
            setEditingRule(null);
            const rls = await leadQualifierService.getRoutingRules(companyId);
            setRules(rls);
            toast.success('Regla de enrutamiento guardada');
        } catch (err: any) {
            toast.error(err?.message || 'Error al guardar regla');
        } finally {
            setSavingRule(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        try {
            await leadQualifierService.deleteRoutingRule(ruleId);
            setRules((prev) => prev.filter((r) => r.id !== ruleId));
            toast.success('Regla eliminada');
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo eliminar la regla');
        }
    };

    const handleApproveDraft = async (sess: LeadQualifierSession) => {
        if (!companyId) return;
        const msg = (draftEdits[sess.lead_id] || sess.last_ai_draft || sess.first_message_draft || '').trim();
        if (!msg) {
            toast.error('El mensaje no puede estar vacío');
            return;
        }
        setSendingDraftId(sess.lead_id);
        try {
            await leadQualifierService.approveAndSendDraft(companyId, sess.lead_id, msg);
            toast.success(`WhatsApp encolado para ${sess.leads?.name || 'el prospecto'}`);
            const fresh = await leadQualifierService.getSessions(companyId);
            setSessions(fresh);
        } catch (err: any) {
            toast.error(err?.message || 'Error al aprobar y enviar borrador');
        } finally {
            setSendingDraftId(null);
        }
    };

    const handleToggleSessionPause = async (sess: LeadQualifierSession) => {
        const nextStatus = sess.status === 'active' ? 'paused' : 'active';
        try {
            await leadQualifierService.updateSessionStatus(sess.id, nextStatus);
            setSessions((prev) => prev.map((s) => (s.id === sess.id ? { ...s, status: nextStatus } : s)));
            toast.success(nextStatus === 'paused' ? 'Bot pausado para este prospecto' : 'Bot reactivado');
        } catch (err: any) {
            toast.error(err?.message || 'No se pudo actualizar estado');
        }
    };

    const handleSendTestAdvisorAlert = async () => {
        if (!companyId || !testAdvisorId) {
            toast.error('Selecciona un asesor primero');
            return;
        }
        setSendingTestWa(true);
        try {
            const res = await leadQualifierService.sendTestAdvisorAlert(companyId, testAdvisorId);
            toast.success(`Alerta de prueba encolada por WhatsApp para ${res.to_name || 'el asesor'} (${res.to_phone})`);
        } catch (err: any) {
            toast.error(err?.message || 'Error enviando WhatsApp de prueba');
        } finally {
            setSendingTestWa(false);
        }
    };

    const handleRunSlaCheck = async () => {
        if (!companyId) return;
        setRunningSla(true);
        try {
            const res = await leadQualifierService.checkSlaEscalations(companyId);
            toast.success(`Revisión SLA completada: ${res.checked || 0} evaluadas, ${res.escalated || 0} escaladas`);
            const fresh = await leadQualifierService.getSessions(companyId);
            setSessions(fresh);
        } catch (err: any) {
            toast.error(err?.message || 'Error al revisar SLA');
        } finally {
            setRunningSla(false);
        }
    };

    const handleRunSimulation = async (overrideMsg?: string) => {
        if (!companyId) return;
        setSimRunning(true);
        const msg = overrideMsg !== undefined ? overrideMsg : simIncoming;
        // Monday 10:00 AM SV (16:00Z) vs Monday 10:00 PM SV (Tue 04:00Z)
        const simIso = simTimeMode === 'day' ? '2026-11-23T16:00:00Z' : '2026-11-24T04:00:00Z';
        try {
            const res = await leadQualifierService.simulateConversation(companyId, {
                lead_name: simName,
                company_name: simCompany,
                pain_text: simPain,
                volume_text: simVolume,
                urgency_text: simUrgency,
                role_title: 'Gerente / Propietario',
                incoming_message: msg,
                simulated_iso: simIso,
                history: simHistory,
                offered_slots: simOfferedSlots,
            });
            const sim = res.simulation;
            setSimResult(sim);
            if (Array.isArray(sim?.offered_slots) && sim.offered_slots.length > 0) {
                setSimOfferedSlots(sim.offered_slots);
            }
            if (sim?.reply) {
                setSimHistory((prev) => [
                    ...prev,
                    ...(msg ? [`👤 Prospecto: ${msg}`] : []),
                    `🤖 IA: ${sim.reply}`,
                ]);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error al ejecutar simulación');
        } finally {
            setSimRunning(false);
        }
    };

    const firstTouchPreview = useMemo(() => {
        if (!config) return '';
        const pb = config.pain_playbooks.find((p) => p.is_active) || config.pain_playbooks[0] || null;
        return renderFirstTouchMessage(config.first_touch_template, pb, {
            name: 'Carlos Mendoza',
            companyName: 'Distribuidora Centro S.A.',
            painText: pb?.label || 'Inventarios y productos',
        });
    }, [config]);

    const pendingDraftsCount = useMemo(
        () => sessions.filter((s) => s.status === 'draft_pending').length,
        [sessions],
    );

    const activeTz = config?.timezone || 'America/El_Salvador';
    const todayDateKey = useMemo(() => getZonedDateKey(new Date(), activeTz), [activeTz]);
    const sheetCounts = useMemo(() => {
        const weekAgoMs = Date.now() - 7 * 86_400_000;
        const today = pendingSheetLeads.filter((l) => getZonedDateKey(l.created_at, activeTz) === todayDateKey);
        const week = pendingSheetLeads.filter((l) => new Date(l.created_at).getTime() >= weekAgoMs);
        return {
            today,
            week,
            all: pendingSheetLeads,
        };
    }, [pendingSheetLeads, activeTz, todayDateKey]);

    const filteredSheetLeads = useMemo(() => {
        if (sheetDateFilter === 'today') return sheetCounts.today;
        if (sheetDateFilter === '7d') return sheetCounts.week;
        return sheetCounts.all;
    }, [sheetDateFilter, sheetCounts]);

    const selectableFilteredIds = useMemo(
        () => filteredSheetLeads.filter((l) => Boolean(l.phone && l.phone.trim())).map((l) => l.id),
        [filteredSheetLeads],
    );

    const handleToggleSelectSheetLead = (leadId: string) => {
        setSelectedSheetLeadIds((prev) =>
            prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
        );
    };

    const handleSelectAllFilteredSheetLeads = () => {
        if (selectableFilteredIds.length === 0) return;
        const allSelected = selectableFilteredIds.every((id) => selectedSheetLeadIds.includes(id));
        if (allSelected) {
            setSelectedSheetLeadIds((prev) => prev.filter((id) => !selectableFilteredIds.includes(id)));
        } else {
            setSelectedSheetLeadIds((prev) => [...new Set([...prev, ...selectableFilteredIds])]);
        }
    };

    const handleEnrollSelectedSheetLeads = async () => {
        if (!companyId || selectedSheetLeadIds.length === 0) return;
        setEnrollingBatch(true);
        try {
            const res = await leadQualifierService.enrollBatchLeads(companyId, selectedSheetLeadIds);
            setSelectedSheetLeadIds([]);
            await loadAll();
            if (res.enrolled_count === 0) {
                toast.error('Ninguno de los leads seleccionados pudo activarse (sin teléfono válido o ya inscritos).');
            } else if (res.mode === 'auto') {
                toast.success(
                    `IA activada para ${res.enrolled_count} lead(s): 1er WhatsApp encolado y visible en Chats WhatsApp`,
                );
            } else {
                toast.success(`${res.enrolled_count} borrador(es) preparados abajo para aprobación`);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error al activar leads de Google Sheets');
        } finally {
            setEnrollingBatch(false);
        }
    };

    if (loading || !config) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[420px]">
                <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                    <Loader2 className="w-5 h-5 animate-spin text-[#4449AA]" />
                    <span>Cargando Centro de Calificación IA y Enrutamiento…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
            {/* Top Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Link to="/leads" className="inline-flex items-center gap-1 hover:text-[#4449AA] font-medium">
                            <ArrowLeft className="w-3.5 h-3.5" /> Prospectos / Leads
                        </Link>
                        <span>/</span>
                        <span className="font-semibold text-slate-700">Calificador IA y Enrutamiento</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4449AA]">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                Calificador WhatsApp IA & Auto-Agendamiento
                            </h1>
                            <p className="text-xs text-slate-500">
                                Arquitectura SaaS multi-empresa: conecta diagnóstico del Sheet → WhatsApp IA 24/7 → Google Meet → Alerta al asesor.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                        to="/support/chat"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        Chats WhatsApp
                    </Link>

                    <button
                        type="button"
                        onClick={() => setConfig({ ...config, is_enabled: !config.is_enabled })}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                            config.is_enabled
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-slate-100 border-slate-300 text-slate-600'
                        }`}
                    >
                        <span
                            className={`w-2.5 h-2.5 rounded-full ${
                                config.is_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                        />
                        {config.is_enabled ? 'Motor IA: ACTIVO' : 'Motor IA: APAGADO (Seguro)'}
                    </button>

                    <Button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={saving}
                        className="bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold px-4 h-9 rounded-xl shadow-sm"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            {/* Safety Notice when OFF or Draft */}
            {(!config.is_enabled || config.mode === 'draft') && (
                <div
                    className={`rounded-2xl border p-3.5 flex items-start gap-3 text-xs ${
                        !config.is_enabled
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <span className="font-bold">
                            {!config.is_enabled
                                ? 'Modo Seguro (Apagado): '
                                : 'Modo Borrador Activo: '}
                        </span>
                        {!config.is_enabled
                            ? 'Ningún lead nuevo recibirá mensajes automáticos hasta que enciendas el Motor IA arriba y guardes. Tu equipo sigue trabajando normalmente y los chats de Soporte Técnico no se ven afectados.'
                            : 'Cuando entre un lead nuevo por Google Sheets, la IA redactará su primer mensaje personalizado y lo dejará en la pestaña "Simulador y Cola" para que tú lo apruebes con 1 clic antes de enviarlo por WhatsApp.'}
                    </div>
                </div>
            )}

            {/* AI Usage Cost Card */}
            <AiUsageCostCard
                companyId={companyId}
                budgetUsd={config.ai_monthly_budget_usd}
                variant="compact"
            />

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-2xl p-1.5 overflow-x-auto shadow-sm">
                {[
                    { id: 'master' as ConfigTab, label: 'Control Maestro & Horario 24/7', icon: Settings2 },
                    { id: 'prompts' as ConfigTab, label: 'Prompts y Traspaso Humano', icon: Sparkles },
                    { id: 'playbooks' as ConfigTab, label: `Playbooks por Dolor (${config.pain_playbooks.length})`, icon: Bot },
                    { id: 'routing' as ConfigTab, label: `Asesores, WhatsApp & SLA (${rules.length})`, icon: Users },
                    {
                        id: 'sessions' as ConfigTab,
                        label: `Cola Borradores & Simulador${pendingDraftsCount > 0 ? ` (${pendingDraftsCount})` : ''}`,
                        icon: FlaskConical,
                    },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                active
                                    ? 'bg-[#4449AA] text-white shadow-sm'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: MASTER CONTROL */}
            {activeTab === 'master' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900">1. Modo de Operación y Fuentes Permitidas</h2>
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                Aislado de Soporte Técnico
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setConfig({ ...config, mode: 'draft' })}
                                className={`text-left p-3.5 rounded-xl border-2 transition ${
                                    config.mode === 'draft'
                                        ? 'border-[#4449AA] bg-indigo-50/40'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-900">📝 Borrador (Manual)</span>
                                    {config.mode === 'draft' && <CheckCircle2 className="w-4 h-4 text-[#4449AA]" />}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Recomendado al inicio. Prepara el mensaje personalizado y espera tu clic para enviar.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setConfig({ ...config, mode: 'auto' })}
                                className={`text-left p-3.5 rounded-xl border-2 transition ${
                                    config.mode === 'auto'
                                        ? 'border-emerald-600 bg-emerald-50/40'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-900">🚀 Automático 24/7</span>
                                    {config.mode === 'auto' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Saluda al instante en cuanto entra el lead de Sheets/Ads y califica hasta agendar Meet.
                                </p>
                            </button>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label className="block text-xs font-bold text-slate-700">
                                ¿A qué orígenes de leads aplica el Calificador IA?
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: 'google_sheets', label: 'Google Sheets (Formulario)' },
                                    { key: 'facebook_ads', label: 'Meta / Facebook Ads' },
                                    { key: 'all', label: 'Cualquier origen nuevo' },
                                ].map((item) => {
                                    const checked = config.allowed_sources.includes(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => handleToggleSource(item.key)}
                                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                                                checked
                                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Check className={`w-3.5 h-3.5 ${checked ? 'opacity-100' : 'opacity-20'}`} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Garantía anti-caos: los chats históricos, grupos de soporte y clientes existentes nunca son respondidos por este bot comercial.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Máximo de turnos IA antes de pasar a humano
                                </label>
                                <input
                                    type="number"
                                    min={2}
                                    max={20}
                                    value={config.max_ai_turns}
                                    onChange={(e) => setConfig({ ...config, max_ai_turns: Number(e.target.value) || 6 })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Zona Horaria Empresa
                                </label>
                                <input
                                    type="text"
                                    value={config.timezone}
                                    onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900">2. Cobertura Nocturna 24/7 vs Horario Real de Demos</h2>

                        <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <Moon className="w-4 h-4 text-[#4449AA] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-900">
                                        Atender 24/7 por WhatsApp (Ej. leads a las 10:00 PM)
                                    </p>
                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                        La IA responde al instante en la noche/madrugada para no enfriar al lead, y propone horarios de Demo únicamente dentro de tu jornada laboral real.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.response_24_7}
                                onChange={(e) => setConfig({ ...config, response_24_7: e.target.checked })}
                                className="w-4 h-4 accent-[#4449AA] mt-1 cursor-pointer"
                            />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">L-V Inicio</label>
                                <input
                                    type="time"
                                    value={config.business_hours.start}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            business_hours: { ...config.business_hours, start: e.target.value },
                                        })
                                    }
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">L-V Fin</label>
                                <input
                                    type="time"
                                    value={config.business_hours.end}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            business_hours: { ...config.business_hours, end: e.target.value },
                                        })
                                    }
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sáb Inicio</label>
                                <input
                                    type="time"
                                    value={config.business_hours.sat_start || '08:00'}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            business_hours: { ...config.business_hours, sat_start: e.target.value },
                                        })
                                    }
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sáb Fin</label>
                                <input
                                    type="time"
                                    value={config.business_hours.sat_end || '12:00'}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            business_hours: { ...config.business_hours, sat_end: e.target.value },
                                        })
                                    }
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                            <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={Boolean(config.business_hours.sat_enabled)}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            business_hours: { ...config.business_hours, sat_enabled: e.target.checked },
                                        })
                                    }
                                    className="accent-[#4449AA]"
                                />
                                Permitir agendar Demos los Sábados por la mañana
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Duración Demo (min)
                                </label>
                                <input
                                    type="number"
                                    min={15}
                                    max={120}
                                    value={config.demo_duration_minutes}
                                    onChange={(e) =>
                                        setConfig({ ...config, demo_duration_minutes: Number(e.target.value) || 30 })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Margen entre citas (min)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={config.demo_buffer_minutes}
                                    onChange={(e) =>
                                        setConfig({ ...config, demo_buffer_minutes: Number(e.target.value) || 15 })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Presupuesto IA / mes (USD)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={5000}
                                    step={1}
                                    value={config.ai_monthly_budget_usd}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            ai_monthly_budget_usd: Math.max(1, Number(e.target.value) || 20),
                                        })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                    <Calendar className="w-3.5 h-3.5 text-[#4449AA]" />
                                    Reglas Inteligentes de Agenda & Prioridad de Demos
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Demos tienen prioridad
                                </span>
                            </div>

                            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.sync_google_calendar_busy}
                                    onChange={(e) =>
                                        setConfig({ ...config, sync_google_calendar_busy: e.target.checked })
                                    }
                                    className="accent-[#4449AA] mt-0.5"
                                />
                                <span>
                                    <strong>Sincronizar Google Calendar del asesor asignado:</strong> bloquea solo eventos ocupados de su calendario principal.
                                </span>
                            </label>

                            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.ignore_unaccepted_calendar_invites}
                                    onChange={(e) =>
                                        setConfig({
                                            ...config,
                                            ignore_unaccepted_calendar_invites: e.target.checked,
                                        })
                                    }
                                    className="accent-[#4449AA] mt-0.5"
                                />
                                <span>
                                    <strong>Ignorar invitaciones &quot;en la lupa&quot; y calendarios compartidos:</strong> demos de Patricia u otros compañeros sin aceptar / opcionales no bloquean tu agenda.
                                </span>
                            </label>

                            <p className="text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2.5 py-1.5">
                                Prioridad Demos CRM: los seguimientos secundarios (<strong>Llamada</strong>, WhatsApp, Email o Cotización) NO bloquean horarios disponibles para Demos.
                            </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setConfig(buildDefaultQualifierConfig(companyId))}
                                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 underline"
                            >
                                Restaurar valores sugeridos de fábrica
                            </button>
                            <span className="text-[11px] text-slate-400">Multi-tenant: solo afecta a tu empresa</span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PROMPTS & HUMAN HANDOFF */}
            {activeTab === 'prompts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900">Primer Saludo Automático (Ataque al Dolor)</h2>
                            <span className="text-[11px] text-slate-500">
                                Variables: {'{nombre}'}, {'{empresa}'}, {'{dolor}'}, {'{propuesta_dolor}'}, {'{pregunta_dolor}'}
                            </span>
                        </div>
                        <textarea
                            rows={5}
                            value={config.first_touch_template}
                            onChange={(e) => setConfig({ ...config, first_touch_template: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-indigo-100 focus:border-[#4449AA] outline-none"
                        />
                        <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 space-y-1">
                            <div className="text-[11px] font-bold text-emerald-800">Vista previa real (WhatsApp):</div>
                            <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                                {firstTouchPreview}
                            </pre>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-2">
                            <label className="block text-xs font-bold text-slate-900">
                                Instrucciones Maestras del Agente Comercial (System Prompt)
                            </label>
                            <textarea
                                rows={7}
                                value={config.system_prompt}
                                onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed focus:ring-2 focus:ring-indigo-100 focus:border-[#4449AA] outline-none"
                            />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900">Protocolo de Traspaso a Asesor Humano</h2>
                        <p className="text-xs text-slate-500">
                            Si el lead escribe cualquiera de estas frases (o la IA detecta que pide atención personal o quiere contratar ya), el bot se pausa al instante, asigna el lead y dispara la alerta al asesor.
                        </p>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Frases / Palabras clave de Traspaso (separadas por coma)
                            </label>
                            <textarea
                                rows={3}
                                value={config.handoff_keywords.join(', ')}
                                onChange={(e) =>
                                    setConfig({
                                        ...config,
                                        handoff_keywords: e.target.value
                                            .split(',')
                                            .map((k) => k.trim())
                                            .filter(Boolean),
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Respuesta al lead en HORARIO LABORAL ({'{nombre}'}, {'{asesor}'})
                            </label>
                            <textarea
                                rows={3}
                                value={config.handoff_reply_business_hours}
                                onChange={(e) =>
                                    setConfig({ ...config, handoff_reply_business_hours: e.target.value })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Respuesta al lead FUERA DE HORARIO / 10:00 PM ({'{nombre}'}, {'{asesor}'})
                            </label>
                            <textarea
                                rows={3}
                                value={config.handoff_reply_after_hours}
                                onChange={(e) =>
                                    setConfig({ ...config, handoff_reply_after_hours: e.target.value })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PAIN PLAYBOOKS */}
            {activeTab === 'playbooks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Playbooks Dinámicos según Punto de Mejora</h2>
                            <p className="text-xs text-slate-500">
                                El sistema lee la columna "Punto de mejora" del Google Sheet y elige automáticamente tus módulos fuertes y argumento de venta.
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={handleAddPlaybook}
                            className="bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold px-3.5 h-9 rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Agregar Playbook
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {config.pain_playbooks.map((pb, idx) => (
                            <div key={pb.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="checkbox"
                                            checked={pb.is_active !== false}
                                            onChange={(e) => handleUpdatePlaybook(idx, { is_active: e.target.checked })}
                                            className="accent-[#4449AA]"
                                        />
                                        <input
                                            type="text"
                                            value={pb.label}
                                            onChange={(e) => handleUpdatePlaybook(idx, { label: e.target.value })}
                                            className="font-bold text-xs text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1"
                                        />
                                        <input
                                            type="text"
                                            value={pb.product_hint}
                                            onChange={(e) => handleUpdatePlaybook(idx, { product_hint: e.target.value })}
                                            placeholder="ERP / SIPLE"
                                            className="w-20 text-center font-bold text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeletePlaybook(idx)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                        title="Eliminar playbook"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                        Palabras clave del Excel / Formulario (separadas por coma)
                                    </label>
                                    <input
                                        type="text"
                                        value={(pb.keywords || []).join(', ')}
                                        onChange={(e) =>
                                            handleUpdatePlaybook(idx, {
                                                keywords: e.target.value
                                                    .split(',')
                                                    .map((k) => k.trim())
                                                    .filter(Boolean),
                                            })
                                        }
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                        Módulos Fuertes a Destacar
                                    </label>
                                    <input
                                        type="text"
                                        value={pb.strong_modules}
                                        onChange={(e) => handleUpdatePlaybook(idx, { strong_modules: e.target.value })}
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                        Propuesta de Valor (Cómo resolvemos su dolor)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={pb.value_proposition}
                                        onChange={(e) => handleUpdatePlaybook(idx, { value_proposition: e.target.value })}
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                        Pregunta Calificadora / Cierre hacia Demo
                                    </label>
                                    <input
                                        type="text"
                                        value={pb.qualifying_question}
                                        onChange={(e) => handleUpdatePlaybook(idx, { qualifying_question: e.target.value })}
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 4: ROUTING, ADVISOR WHATSAPP & SLA */}
            {activeTab === 'routing' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900">
                                        Reglas Dinámicas de Asignación (Patricia, Jimmy, Diana o Equipo)
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Define quién recibe la Demo o el traspaso según el producto (ERP, SIPLE o todos) en modo Fijo o Round-Robin.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    onClick={() =>
                                        setEditingRule({
                                            name: 'Regla Comercial Principal',
                                            product_id: null,
                                            strategy: 'round_robin',
                                            assignee_user_ids: [],
                                            notify_extra_user_ids: [],
                                            priority: 10,
                                            is_active: true,
                                        })
                                    }
                                    className="bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold h-9 px-3.5 rounded-xl"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Nueva Regla
                                </Button>
                            </div>

                            {editingRule && (
                                <div className="border-2 border-indigo-200 bg-indigo-50/30 rounded-2xl p-4 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre de Regla</label>
                                            <input
                                                type="text"
                                                value={editingRule.name || ''}
                                                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                                                placeholder="Ej. Demos ERP · Patricia / Diana"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Producto</label>
                                            <select
                                                value={editingRule.product_id || ''}
                                                onChange={(e) =>
                                                    setEditingRule({ ...editingRule, product_id: e.target.value || null })
                                                }
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                                            >
                                                <option value="">Todos los productos (Global)</option>
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Estrategia</label>
                                            <select
                                                value={editingRule.strategy || 'round_robin'}
                                                onChange={(e) =>
                                                    setEditingRule({
                                                        ...editingRule,
                                                        strategy: e.target.value as 'fixed' | 'round_robin',
                                                    })
                                                }
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                                            >
                                                <option value="round_robin">🔄 Rotación (Round-Robin)</option>
                                                <option value="fixed">📌 Asesor Fijo</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Asesor(es) Responsables (Reciben Lead + Demo + WhatsApp)
                                            </label>
                                            <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 space-y-1">
                                                {team.map((m) => {
                                                    const selected = (editingRule.assignee_user_ids || []).includes(m.id);
                                                    return (
                                                        <label
                                                            key={m.id}
                                                            className="flex items-center justify-between text-xs px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected}
                                                                    onChange={() => {
                                                                        const cur = editingRule.assignee_user_ids || [];
                                                                        const next = selected
                                                                            ? cur.filter((id) => id !== m.id)
                                                                            : [...cur, m.id];
                                                                        setEditingRule({ ...editingRule, assignee_user_ids: next });
                                                                    }}
                                                                    className="accent-[#4449AA]"
                                                                />
                                                                <span className="font-semibold text-slate-800">
                                                                    {m.full_name || m.email}
                                                                </span>
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {m.phone || 'Sin tel.'}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Copia WhatsApp / Supervisión (Opcional, Ej. Jimmy)
                                            </label>
                                            <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 space-y-1">
                                                {team.map((m) => {
                                                    const selected = (editingRule.notify_extra_user_ids || []).includes(m.id);
                                                    return (
                                                        <label
                                                            key={m.id}
                                                            className="flex items-center justify-between text-xs px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected}
                                                                    onChange={() => {
                                                                        const cur = editingRule.notify_extra_user_ids || [];
                                                                        const next = selected
                                                                            ? cur.filter((id) => id !== m.id)
                                                                            : [...cur, m.id];
                                                                        setEditingRule({ ...editingRule, notify_extra_user_ids: next });
                                                                    }}
                                                                    className="accent-[#4449AA]"
                                                                />
                                                                <span className="font-semibold text-slate-800">
                                                                    {m.full_name || m.email}
                                                                </span>
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {m.phone || 'Sin tel.'}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setEditingRule(null)}
                                            className="text-xs h-8 px-3 rounded-xl"
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={handleSaveRule}
                                            disabled={savingRule}
                                            className="bg-[#4449AA] text-white text-xs font-bold h-8 px-4 rounded-xl"
                                        >
                                            {savingRule ? 'Guardando...' : 'Guardar Regla'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {rules.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                                    Aún no hay reglas creadas. Crea una regla arriba (por ejemplo: <strong>Patricia</strong> para ERP y <strong>Jimmy</strong> o <strong>Diana</strong> en copia) para que el sistema asigne y notifique por WhatsApp dinámicamente.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {rules.map((r) => {
                                        const prod = products.find((p) => p.id === r.product_id);
                                        const assignees = (r.assignee_user_ids || [])
                                            .map((id) => team.find((t) => t.id === id)?.full_name || id.slice(0, 6))
                                            .join(', ');
                                        const extras = (r.notify_extra_user_ids || [])
                                            .map((id) => team.find((t) => t.id === id)?.full_name || id.slice(0, 6))
                                            .join(', ');
                                        return (
                                            <div
                                                key={r.id}
                                                className="border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50"
                                            >
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-900">{r.name}</span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                            {prod ? prod.name : 'Todos los productos'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                                            {r.strategy === 'fixed' ? 'Asesor Fijo' : 'Round-Robin'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-600">
                                                        <strong>Responsables:</strong> {assignees || 'Sin asignar'}
                                                        {extras ? ` · CC WhatsApp: ${extras}` : ''}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingRule(r)}
                                                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRule(r.id)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Notifications + Test Alert + SLA */}
                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-[#4449AA]" />
                                <h2 className="text-sm font-bold text-slate-900">Alertas WhatsApp al Equipo</h2>
                            </div>

                            <div className="space-y-2 text-xs">
                                {[
                                    { key: 'notify_on_demo_booked' as const, label: 'Al agendar Demo (con enlace Google Meet)' },
                                    { key: 'notify_on_handoff' as const, label: 'Al pedir hablar con un asesor humano' },
                                    { key: 'notify_on_urgent_intake' as const, label: 'Al entrar lead de Urgencia Alta desde Sheet' },
                                    { key: 'notify_advisors_24_7' as const, label: 'Enviar alerta al asesor también de noche (24/7)' },
                                ].map((item) => (
                                    <label key={item.key} className="flex items-center gap-2 text-slate-700 font-medium cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(config[item.key])}
                                            onChange={(e) => setConfig({ ...config, [item.key]: e.target.checked })}
                                            className="accent-[#4449AA]"
                                        />
                                        <span>{item.label}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <label className="block text-[11px] font-bold text-slate-700">
                                    Canales de Notificación
                                </label>
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.notify_channels.whatsapp}
                                            onChange={(e) =>
                                                setConfig({
                                                    ...config,
                                                    notify_channels: { ...config.notify_channels, whatsapp: e.target.checked },
                                                })
                                            }
                                            className="accent-[#4449AA]"
                                        />
                                        <span>WhatsApp directo</span>
                                    </label>
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.notify_channels.crm_alert}
                                            onChange={(e) =>
                                                setConfig({
                                                    ...config,
                                                    notify_channels: { ...config.notify_channels, crm_alert: e.target.checked },
                                                })
                                            }
                                            className="accent-[#4449AA]"
                                        />
                                        <span>Campana CRM</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 space-y-2">
                                <label className="block text-[11px] font-bold text-slate-700">
                                    Probar Alerta Ejecutiva por WhatsApp Ahora
                                </label>
                                <select
                                    value={testAdvisorId}
                                    onChange={(e) => setTestAdvisorId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                >
                                    {team.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.full_name || m.email} {m.phone ? `(${m.phone})` : '— Sin teléfono'}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleSendTestAdvisorAlert}
                                    disabled={sendingTestWa || !testAdvisorId}
                                    className="w-full text-xs font-bold h-9 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                >
                                    {sendingTestWa ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Enviar WhatsApp de Prueba al Asesor
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-rose-600" />
                                <h2 className="text-sm font-bold text-slate-900">Escalamiento SLA (Anti-Fuga)</h2>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Si un lead pide hablar con asesor y nadie le escribe en X minutos, se alerta por WhatsApp al supervisor de respaldo.
                            </p>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    Tiempo máximo sin respuesta (minutos)
                                </label>
                                <input
                                    type="number"
                                    min={5}
                                    max={240}
                                    value={config.sla_escalation_minutes}
                                    onChange={(e) =>
                                        setConfig({ ...config, sla_escalation_minutes: Number(e.target.value) || 15 })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    Supervisor de Respaldo SLA
                                </label>
                                <select
                                    value={config.sla_backup_user_id || ''}
                                    onChange={(e) =>
                                        setConfig({ ...config, sla_backup_user_id: e.target.value || null })
                                    }
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                >
                                    <option value="">Administrador principal automático</option>
                                    {team.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.full_name || m.email} {m.phone ? `(${m.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleRunSlaCheck}
                                disabled={runningSla}
                                className="w-full text-xs font-semibold h-8 rounded-xl"
                            >
                                {runningSla ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                                Revisar SLA Vencidos Ahora
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: DRAFTS, SESSIONS & SAFE SIMULATOR */}
            {activeTab === 'sessions' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {/* Left: Pending Google Sheets Queue + Drafts & Sessions */}
                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                                        <FileSpreadsheet className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900">
                                            Leads de Google Sheets sin IA Activa
                                        </h2>
                                        <p className="text-[11px] text-slate-500">
                                            Activa en lote los leads que entraron antes de encender el motor.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    {(
                                        [
                                            { id: 'today', label: `Hoy (${sheetCounts.today.length})` },
                                            { id: '7d', label: `7 días (${sheetCounts.week.length})` },
                                            { id: 'all', label: `Todos (${sheetCounts.all.length})` },
                                        ] as const
                                    ).map((pill) => (
                                        <button
                                            key={pill.id}
                                            type="button"
                                            onClick={() => setSheetDateFilter(pill.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                                                sheetDateFilter === pill.id
                                                    ? 'bg-[#4449AA] border-[#4449AA] text-white'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {pill.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredSheetLeads.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                                    No hay leads pendientes de Google Sheets en este rango de fechas.
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                                        <span>
                                            Mostrando {filteredSheetLeads.length} lead(s) sin sesión IA aún
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllFilteredSheetLeads}
                                                className="font-bold text-[#4449AA] hover:underline"
                                            >
                                                {selectableFilteredIds.length > 0 &&
                                                selectableFilteredIds.every((id) => selectedSheetLeadIds.includes(id))
                                                    ? 'Limpiar selección'
                                                    : 'Seleccionar todos'}
                                            </button>
                                            {selectedSheetLeadIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSheetLeadIds([])}
                                                    className="text-slate-400 hover:text-slate-700"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                        {filteredSheetLeads.map((lead) => {
                                            const hasPhone = Boolean(lead.phone && lead.phone.trim());
                                            const checked = selectedSheetLeadIds.includes(lead.id);
                                            const painLabel = extractSheetPainLabel(lead);
                                            return (
                                                <label
                                                    key={lead.id}
                                                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs transition ${
                                                        !hasPhone
                                                            ? 'opacity-55 bg-slate-50 border-slate-200 cursor-not-allowed'
                                                            : checked
                                                            ? 'bg-indigo-50/50 border-[#4449AA]/50 cursor-pointer'
                                                            : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={!hasPhone}
                                                        checked={checked}
                                                        onChange={() => handleToggleSelectSheetLead(lead.id)}
                                                        className="mt-0.5 w-3.5 h-3.5 accent-[#4449AA]"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                            <div className="font-bold text-slate-900 truncate">
                                                                {lead.name}
                                                                {lead.company_name ? (
                                                                    <span className="font-normal text-slate-500">
                                                                        {' '}
                                                                        · {lead.company_name}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                                                {formatSheetLeadTime(lead.created_at, activeTz, todayDateKey)}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                                                            <span>{lead.phone || 'Sin teléfono válido'}</span>
                                                            {painLabel && (
                                                                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                                                                    {painLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <p className="text-[11px] text-slate-500 leading-snug">
                                    {!config.is_enabled
                                        ? 'Enciende "Motor IA: ACTIVO" arriba y pulsa "Guardar Cambios" primero.'
                                        : !savedConfigIsEnabled
                                        ? 'Pulsa "Guardar Cambios" arriba para confirmar el Motor IA antes de enviar.'
                                        : config.mode === 'auto'
                                        ? 'Modo Automático: enviará el 1er WhatsApp al instante y aparecerán en Chats WhatsApp.'
                                        : 'Modo Borrador: creará los borradores abajo para que los revises y envíes.'}
                                </p>
                                <Button
                                    type="button"
                                    onClick={handleEnrollSelectedSheetLeads}
                                    disabled={
                                        enrollingBatch ||
                                        selectedSheetLeadIds.length === 0 ||
                                        !config.is_enabled ||
                                        !savedConfigIsEnabled
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3.5 rounded-xl shrink-0"
                                >
                                    {enrollingBatch ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Activar IA para Seleccionados ({selectedSheetLeadIds.length})
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900">Cola de Borradores y Sesiones IA</h2>
                                    <p className="text-xs text-slate-500">
                                        Aprueba mensajes en modo Borrador, pausa o reactiva un lead individual o abre su ficha CRM.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadAll}
                                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                                    title="Actualizar cola"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>

                        {sessions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                                No hay sesiones registradas aún. Cuando actives el motor en modo Borrador o Automático y entre un lead por Sheets, aparecerá aquí.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                                {sessions.map((s) => {
                                    const badge = STATUS_BADGE[s.status] || {
                                        label: s.status,
                                        cls: 'bg-slate-100 text-slate-600 border-slate-200',
                                    };
                                    const advisor = team.find((m) => m.id === s.assigned_advisor_id);
                                    const draftText = draftEdits[s.lead_id] ?? s.last_ai_draft ?? s.first_message_draft ?? '';
                                    return (
                                        <div key={s.id} className="border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-900">
                                                            {s.leads?.name || 'Prospecto'}
                                                        </span>
                                                        {s.leads?.company_name && (
                                                            <span className="text-[11px] text-slate-500">
                                                                · {s.leads.company_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">
                                                        {s.leads?.phone || 'Sin teléfono'} · Turnos: {s.turn_count}
                                                        {s.matched_playbook_id ? ` · Playbook: ${s.matched_playbook_id}` : ''}
                                                        {advisor ? ` · Asesor: ${advisor.full_name}` : ''}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badge.cls}`}>
                                                        {badge.label}
                                                    </span>
                                                    <Link
                                                        to={`/leads?lead=${s.lead_id}`}
                                                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#4449AA]"
                                                        title="Abrir ficha CRM"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                    {(s.status === 'active' || s.status === 'paused') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleSessionPause(s)}
                                                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                            title={s.status === 'active' ? 'Pausar IA en este chat' : 'Reactivar IA'}
                                                        >
                                                            {s.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {s.status === 'draft_pending' && (
                                                <div className="space-y-2 pt-1">
                                                    <textarea
                                                        rows={3}
                                                        value={draftText}
                                                        onChange={(e) =>
                                                            setDraftEdits((prev) => ({ ...prev, [s.lead_id]: e.target.value }))
                                                        }
                                                        className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/30 text-xs text-slate-800"
                                                    />
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleApproveDraft(s)}
                                                        disabled={sendingDraftId === s.lead_id}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3.5 rounded-xl"
                                                    >
                                                        {sendingDraftId === s.lead_id ? (
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Send className="w-3.5 h-3.5 mr-1.5" />
                                                        )}
                                                        Aprobar y Enviar por WhatsApp
                                                    </Button>
                                                </div>
                                            )}

                                            {s.booked_meet_link && (
                                                <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                                                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                    <span>
                                                        Demo: {s.booked_start_time ? new Date(s.booked_start_time).toLocaleString('es-SV') : ''} ·{' '}
                                                        <a href={s.booked_meet_link} target="_blank" rel="noreferrer" className="underline font-bold">
                                                            Abrir Meet
                                                        </a>
                                                    </span>
                                                </div>
                                            )}

                                            {s.handoff_reason && (
                                                <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-1.5">
                                                    <strong>Motivo:</strong> {s.handoff_reason}
                                                    {s.handoff_summary ? ` — ${s.handoff_summary}` : ''}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Right: Safe Simulator */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Simulador Seguro (0 WhatsApps Reales)</h2>
                                <p className="text-xs text-slate-500">
                                    Prueba prompts, dolores del Sheet, horario 10:00 PM y traspaso a humano sin enviar nada a clientes reales.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSimHistory([]);
                                    setSimOfferedSlots([]);
                                    setSimResult(null);
                                }}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                            >
                                Limpiar chat
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <input
                                type="text"
                                value={simName}
                                onChange={(e) => setSimName(e.target.value)}
                                placeholder="Nombre"
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                            />
                            <input
                                type="text"
                                value={simCompany}
                                onChange={(e) => setSimCompany(e.target.value)}
                                placeholder="Empresa"
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                            />
                            <input
                                type="text"
                                value={simPain}
                                onChange={(e) => setSimPain(e.target.value)}
                                placeholder="Punto de mejora"
                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-600">Hora simulada:</span>
                            <button
                                type="button"
                                onClick={() => setSimTimeMode('day')}
                                className={`px-2.5 py-1 rounded-lg border font-semibold ${
                                    simTimeMode === 'day' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-slate-200 text-slate-500'
                                }`}
                            >
                                ☀️ 10:00 AM (Laboral)
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimTimeMode('night')}
                                className={`px-2.5 py-1 rounded-lg border font-semibold ${
                                    simTimeMode === 'night' ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'border-slate-200 text-slate-500'
                                }`}
                            >
                                🌙 10:00 PM (Nocturno)
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleRunSimulation('')}
                                disabled={simRunning}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                            >
                                1. Simular 1er Saludo
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSimIncoming('Sí me interesa ver cómo manejan las bodegas y el DTE, qué horarios tienen para una demo?');
                                    handleRunSimulation('Sí me interesa ver cómo manejan las bodegas y el DTE, qué horarios tienen para una demo?');
                                }}
                                disabled={simRunning}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                            >
                                2. Pedir Demo
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSimIncoming('Quiero hablar con alguien en persona ahorita');
                                    handleRunSimulation('Quiero hablar con alguien en persona ahorita');
                                }}
                                disabled={simRunning}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700"
                            >
                                3. Pedir Humano
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={simIncoming}
                                onChange={(e) => setSimIncoming(e.target.value)}
                                placeholder="Escribe una respuesta simulada del prospecto…"
                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !simRunning) handleRunSimulation();
                                }}
                            />
                            <Button
                                type="button"
                                onClick={() => handleRunSimulation()}
                                disabled={simRunning}
                                className="bg-[#4449AA] hover:bg-[#383d8f] text-white text-xs font-bold h-9 px-3.5 rounded-xl"
                            >
                                {simRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Probar'}
                            </Button>
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 min-h-[200px] max-h-[340px] overflow-y-auto space-y-2 text-xs">
                            {simHistory.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">
                                    Pulsa "1. Simular 1er Saludo" o escribe un mensaje arriba para ver cómo responde el agente con tu configuración actual.
                                </p>
                            ) : (
                                simHistory.map((line, i) => (
                                    <div
                                        key={i}
                                        className={`p-2.5 rounded-xl whitespace-pre-wrap ${
                                            line.startsWith('👤')
                                                ? 'bg-white border border-slate-200 text-slate-800 ml-6'
                                                : 'bg-indigo-50 border border-indigo-200 text-slate-900 mr-6'
                                        }`}
                                    >
                                        {line}
                                    </div>
                                ))
                            )}
                        </div>

                        {simResult && (
                            <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] space-y-1 text-slate-600">
                                <div>
                                    <strong>Acción detectada:</strong> {simResult.action} ·{' '}
                                    <strong>Playbook:</strong> {simResult.matched_playbook || 'Default'} ·{' '}
                                    <strong>¿Responde en este horario?:</strong>{' '}
                                    {simResult.will_respond_at_this_hour ? 'Sí' : 'No (24/7 apagado)'}
                                </div>
                                {simResult.advisor_alert_preview && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-800 whitespace-pre-wrap">
                                        <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Vista previa Alerta WhatsApp al Asesor:
                                        </div>
                                        {simResult.advisor_alert_preview}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
