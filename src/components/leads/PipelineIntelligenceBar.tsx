import { useMemo, useState, useEffect, useRef } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { Clock, AlertTriangle, Zap, Users, TrendingUp, Settings2, X, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';
import type { Lead, LeadStatus } from '../../types';
import { STATUS_CONFIG } from '../../types';

// ── AT-RISK STATUSES: Prospecto is intentionally excluded ─────────────────────
// These are the stages where a deal can be LOST if not followed up quickly.
// Prospecto is excluded because it inflates the counter with all new leads.
const SAFE_AT_RISK_STATUSES: LeadStatus[] = [
  'Cotizado', 'Negociación', 'Lead calificado', 'En seguimiento', 'Llamada fría', 'En Nutrición'
] as LeadStatus[];

export interface PipelineSettings {
  // How many days without any contact before a lead is "sin contactar"
  neverContactedDays: number;
  // How many hours without contact before an advanced-stage lead is "at risk"
  staleCotizadoHours: number;
  // How many days with contact counts as "active"
  activeContactDays: number;
  // Which statuses trigger the at-risk alert (default: excludes Prospecto)
  atRiskStatuses: string[];
  enableNeverContacted: boolean;
  enableAtRisk: boolean;
  enableHighPriority: boolean;
  enableActive: boolean;
}

const DEFAULT_SETTINGS: PipelineSettings = {
  neverContactedDays: 20,
  staleCotizadoHours: 48,
  activeContactDays: 7,
  // Prospecto intentionally excluded — would inflate counts dramatically
  atRiskStatuses: ['Cotizado', 'Negociación', 'Lead calificado', 'En seguimiento'],
  enableNeverContacted: true,
  enableAtRisk: true,
  enableHighPriority: true,
  enableActive: true,
};

function loadSettings(companyId: string): PipelineSettings {
  try {
    const raw = localStorage.getItem(`pipeline_settings_v2_${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Normalize atRiskStatuses: ensure it's always an array
      if (typeof parsed.atRiskStatuses === 'string') {
        parsed.atRiskStatuses = parsed.atRiskStatuses.split(',').map((x: string) => x.trim()).filter(Boolean);
      }
      // Safety guard: if Prospecto was saved, remove it silently
      if (Array.isArray(parsed.atRiskStatuses)) {
        parsed.atRiskStatuses = parsed.atRiskStatuses.filter((s: string) => s !== 'Prospecto');
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(companyId: string, s: PipelineSettings) {
  localStorage.setItem(`pipeline_settings_v2_${companyId}`, JSON.stringify(s));
}

// ── Helper: days/hours since a date ──────────────────────────────────────────
function daysSince(d: string | null | undefined): number {
  return d ? differenceInDays(new Date(), new Date(d)) : Infinity;
}
function hoursSince(d: string | null | undefined): number {
  return d ? differenceInHours(new Date(), new Date(d)) : Infinity;
}

export type PipelineFilter =
  | 'never_contacted' | 'at_risk_quoted' | 'active_this_week' | 'high_priority_stale' | null;

interface Props {
  leads: Lead[];
  activeFilter: PipelineFilter;
  onFilterChange: (f: PipelineFilter) => void;
  companyId?: string;
  isAdmin?: boolean;
}

// ── CHIP FILTER LOGIC (single source of truth — used for both count & click) ─
function filterLeads(leads: Lead[], filter: PipelineFilter, s: PipelineSettings): Lead[] {
  if (!filter) return leads;
  const active = leads.filter(l => !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? ''));
  const atRisk = Array.isArray(s.atRiskStatuses) ? s.atRiskStatuses : [];

  switch (filter) {
    // 🔴 Leads sin contacto en X días (usa último seguimiento o fecha de creación)
    case 'never_contacted':
      return active.filter(l => {
        const ref = l.last_follow_up_at ?? l.created_at;
        return daysSince(ref) >= s.neverContactedDays;
      });

    // 🟡 Leads en etapas avanzadas sin contacto en X horas (nunca incluye Prospecto)
    case 'at_risk_quoted':
      return active.filter(l =>
        atRisk.some(x => l.status?.toLowerCase() === x.toLowerCase()) &&
        hoursSince(l.last_follow_up_at ?? l.created_at) >= s.staleCotizadoHours
      );

    // 🟢 Leads con seguimiento real en los últimos X días
    case 'active_this_week':
      return active.filter(l =>
        l.last_follow_up_at != null &&
        daysSince(l.last_follow_up_at) <= s.activeContactDays
      );

    // 🟣 Leads de alta prioridad sin seguimiento en X días
    case 'high_priority_stale':
      return active.filter(l =>
        (l.priority === 'high' || l.priority === 'very_high') &&
        daysSince(l.last_follow_up_at ?? l.created_at) > s.activeContactDays
      );

    default: return leads;
  }
}

// ── PUBLIC API: applyPipelineFilter (used by Leads.tsx) ──────────────────────
export function applyPipelineFilter(leads: Lead[], filter: PipelineFilter, companyId = 'default'): Lead[] {
  if (!filter) return leads;
  const s = loadSettings(companyId);
  return filterLeads(leads, filter, s);
}

export function PipelineIntelligenceBar({ leads, activeFilter, onFilterChange, companyId = 'default', isAdmin = false }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PipelineSettings>(() => loadSettings(companyId));
  const [draft, setDraft] = useState<PipelineSettings>(settings);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadSettings(companyId);
    setSettings(s);
    setDraft(s);
  }, [companyId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    if (showSettings) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const handleSave = () => {
    saveSettings(companyId, draft);
    setSettings(draft);
    setShowSettings(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
  };

  // ── METRICS: computed using the same filterLeads() function as clicking ───
  const metrics = useMemo(() => {
    const active = leads.filter(l => !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? ''));
    const total = active.length;
    if (total === 0) return null;

    const neverContacted   = filterLeads(leads, 'never_contacted',   settings);
    const atRiskQuoted     = filterLeads(leads, 'at_risk_quoted',    settings);
    const activeThisWeek   = filterLeads(leads, 'active_this_week',  settings);
    const highPriorityStale = filterLeads(leads, 'high_priority_stale', settings);

    const withLastContact = active.filter(l => l.last_follow_up_at);
    const avgDaysSinceContact = withLastContact.length > 0
      ? Math.round(withLastContact.reduce((s, l) => s + daysSince(l.last_follow_up_at), 0) / withLastContact.length)
      : null;

    const withFirstContact = active.filter(l => l.first_follow_up_at && l.assigned_at);
    const avgFirstContactDays = withFirstContact.length > 0
      ? Math.round(withFirstContact.reduce((s, l) =>
          s + differenceInDays(new Date(l.first_follow_up_at!), new Date(l.assigned_at || l.created_at)), 0
        ) / withFirstContact.length)
      : null;

    return {
      total,
      neverContacted:   neverContacted.length,
      atRiskQuoted:     atRiskQuoted.length,
      activeThisWeek:   activeThisWeek.length,
      highPriorityStale: highPriorityStale.length,
      avgDaysSinceContact,
      avgFirstContactDays,
      pctActive: total > 0 ? Math.round((activeThisWeek.length / total) * 100) : 0,
    };
  }, [leads, settings]);

  if (!metrics) return null;

  // ── CHIP DEFINITIONS ──────────────────────────────────────────────────────
  const chips = [
    {
      id: 'never_contacted' as PipelineFilter,
      label: 'Sin contactar',
      sublabel: `+${settings.neverContactedDays}d sin seguimiento`,
      count: metrics.neverContacted,
      enabled: settings.enableNeverContacted,
      icon: Clock,
      activeClass: 'bg-red-600 text-white border-red-600 shadow-red-100',
      hoverClass: 'hover:border-red-200 hover:bg-red-50 hover:text-red-700',
      countClass: 'bg-red-100 text-red-700',
    },
    {
      id: 'at_risk_quoted' as PipelineFilter,
      label: 'En riesgo',
      sublabel: `+${settings.staleCotizadoHours}h sin contacto`,
      count: metrics.atRiskQuoted,
      enabled: settings.enableAtRisk,
      icon: AlertTriangle,
      activeClass: 'bg-amber-500 text-white border-amber-500 shadow-amber-100',
      hoverClass: 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700',
      countClass: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'high_priority_stale' as PipelineFilter,
      label: 'Alta prioridad fríos',
      sublabel: `Prioritarios +${settings.activeContactDays}d inactivos`,
      count: metrics.highPriorityStale,
      enabled: settings.enableHighPriority,
      icon: TrendingUp,
      activeClass: 'bg-violet-600 text-white border-violet-600 shadow-violet-100',
      hoverClass: 'hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700',
      countClass: 'bg-violet-100 text-violet-700',
    },
    {
      id: 'active_this_week' as PipelineFilter,
      label: 'Activos',
      sublabel: `Últimos ${settings.activeContactDays}d`,
      count: metrics.activeThisWeek,
      enabled: settings.enableActive,
      icon: Zap,
      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-100',
      hoverClass: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700',
      countClass: 'bg-emerald-100 text-emerald-700',
    },
  ].filter(c => c.enabled);

  return (
    <div className="mb-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Inteligencia de Pipeline</span>
          {activeFilter && (
            <button
              onClick={() => onFilterChange(null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black hover:bg-indigo-200 transition-colors"
            >
              <X className="w-2.5 h-2.5" /> Limpiar filtro
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* KPIs */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-400 mr-1">
            {metrics.avgFirstContactDays !== null && (
              <span title="Días promedio hasta el primer seguimiento">⚡ 1er contacto: <strong className="text-gray-600">{metrics.avgFirstContactDays}d</strong></span>
            )}
            {metrics.avgDaysSinceContact !== null && (
              <span title="Días promedio desde el último seguimiento">🕐 Último contacto: <strong className="text-gray-600">{metrics.avgDaysSinceContact}d prom.</strong></span>
            )}
          </div>

          {/* Settings — admin only */}
          {isAdmin && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => { setDraft(settings); setShowSettings(!showSettings); }}
                title="Ajustar umbrales de pipeline"
                className={`p-1.5 rounded-lg border text-[11px] transition-all ${showSettings ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              {/* ── Settings Panel ─────────────────────────────────────── */}
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-[480px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-5 animate-in fade-in slide-in-from-top-2">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h3 className="text-sm font-black text-gray-800">Ajustar Pipeline</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">Define cuándo se activa cada alerta. Haz clic en un chip para filtrar los leads.</p>
                    </div>
                    <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
                  </div>

                  {/* 3 simple number inputs */}
                  <div className="mt-4 space-y-3">

                    {/* Sin contactar */}
                    <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-red-800">Sin contactar</p>
                          <p className="text-[10px] text-red-500">Alerta si no hubo contacto en X días</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number" min={1} max={365}
                          value={draft.neverContactedDays}
                          onChange={e => setDraft(d => ({ ...d, neverContactedDays: +e.target.value }))}
                          className="w-16 text-sm px-2 py-1.5 rounded-lg border border-red-200 text-center font-black focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                        />
                        <span className="text-[11px] text-red-600 font-bold">días</span>
                        <label className="flex items-center">
                          <input type="checkbox" checked={draft.enableNeverContacted} onChange={e => setDraft(d => ({ ...d, enableNeverContacted: e.target.checked }))} className="w-4 h-4 accent-red-600" />
                        </label>
                      </div>
                    </div>

                    {/* En riesgo */}
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-amber-800">En riesgo</p>
                            <p className="text-[10px] text-amber-500">Etapas avanzadas sin contacto en X horas</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number" min={1} max={720}
                            value={draft.staleCotizadoHours}
                            onChange={e => setDraft(d => ({ ...d, staleCotizadoHours: +e.target.value }))}
                            className="w-16 text-sm px-2 py-1.5 rounded-lg border border-amber-200 text-center font-black focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                          <span className="text-[11px] text-amber-600 font-bold">horas</span>
                          <label className="flex items-center">
                            <input type="checkbox" checked={draft.enableAtRisk} onChange={e => setDraft(d => ({ ...d, enableAtRisk: e.target.checked }))} className="w-4 h-4 accent-amber-600" />
                          </label>
                        </div>
                      </div>

                      {/* Status selector — compact, safe */}
                      <div>
                        <p className="text-[10px] font-black text-amber-700 mb-1.5 uppercase tracking-wide">¿Cuáles estados se consideran "en riesgo"?</p>
                        <div className="grid grid-cols-3 gap-1">
                          {SAFE_AT_RISK_STATUSES.map(status => {
                            const isSelected = (Array.isArray(draft.atRiskStatuses) ? draft.atRiskStatuses : []).includes(status);
                            const cfg = STATUS_CONFIG[status];
                            if (!cfg) return null;
                            return (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setDraft(d => {
                                  const current = Array.isArray(d.atRiskStatuses) ? d.atRiskStatuses : [];
                                  return { ...d, atRiskStatuses: isSelected ? current.filter(x => x !== status) : [...current, status] };
                                })}
                                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all text-left ${
                                  isSelected ? `${cfg.bgColor} ${cfg.color} border-current` : 'border-gray-200 bg-white text-gray-500 hover:bg-amber-50'
                                }`}
                              >
                                <span className={`w-3 h-3 rounded shrink-0 border flex items-center justify-center text-[8px] ${isSelected ? 'bg-current border-current text-white' : 'border-gray-300 bg-white'}`}>
                                  {isSelected && '✓'}
                                </span>
                                <span className="truncate">{cfg.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[9px] text-amber-400 mt-1.5">💡 "Prospecto" no aparece aquí — ya lo cubre "Sin contactar"</p>
                      </div>
                    </div>

                    {/* Alta prioridad + Activos — side by side */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-xl px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-violet-800">Alta prioridad fríos</p>
                            <p className="text-[9px] text-violet-400">Inactivos +X días</p>
                          </div>
                        </div>
                        <label className="flex items-center ml-2">
                          <input type="checkbox" checked={draft.enableHighPriority} onChange={e => setDraft(d => ({ ...d, enableHighPriority: e.target.checked }))} className="w-4 h-4 accent-violet-600" />
                        </label>
                      </div>

                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                            <Zap className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-800">Activos</p>
                            <p className="text-[9px] text-emerald-400">Contactados en X días</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <input
                            type="number" min={1} max={90}
                            value={draft.activeContactDays}
                            onChange={e => setDraft(d => ({ ...d, activeContactDays: +e.target.value }))}
                            className="w-12 text-xs px-1.5 py-1 rounded-lg border border-emerald-200 text-center font-black focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                          />
                          <span className="text-[9px] text-emerald-600 font-bold">d</span>
                          <input type="checkbox" checked={draft.enableActive} onChange={e => setDraft(d => ({ ...d, enableActive: e.target.checked }))} className="w-4 h-4 accent-emerald-600 ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-50 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurar
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-indigo-200"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar configuración
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">Guardado localmente por empresa</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Chips ──────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => {
            const isActive = activeFilter === chip.id;
            const isEmpty = chip.count === 0;
            const Icon = chip.icon;
            return (
              <button
                key={chip.id as string}
                onClick={() => !isEmpty && onFilterChange(isActive ? null : chip.id)}
                disabled={isEmpty}
                title={chip.sublabel}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all select-none ${
                  isEmpty
                    ? 'opacity-40 cursor-not-allowed border-gray-100 bg-white text-gray-400'
                    : isActive
                    ? `${chip.activeClass} shadow-sm`
                    : `border-gray-200 bg-white text-gray-600 ${chip.hoverClass}`
                }`}
              >
                <Icon className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : ''}`} />
                <span>{chip.label}</span>
                <span className={`min-w-[20px] h-[16px] px-1 rounded-full flex items-center justify-center text-[10px] font-black ${
                  isActive ? 'bg-white/25 text-white' : chip.countClass
                }`}>
                  {chip.count}
                </span>
                {!isEmpty && !isActive && (
                  <span className="text-[9px] text-gray-400">
                    {Math.round((chip.count / metrics.total) * 100)}%
                  </span>
                )}
              </button>
            );
          })}

          {/* Active % bar */}
          <div className="hidden sm:flex items-center ml-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100">
              <Users className="w-3 h-3 text-indigo-500" />
              <span className="text-[11px] font-black text-indigo-700">{metrics.pctActive}% activo</span>
              <div className="w-14 h-1.5 bg-indigo-100 rounded-full overflow-hidden ml-1">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${metrics.pctActive}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
