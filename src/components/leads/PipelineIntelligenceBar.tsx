import { useMemo, useState, useEffect, useRef } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { Clock, AlertTriangle, Zap, Users, TrendingUp, Settings2, X, ChevronDown, ChevronUp, Save, Check } from 'lucide-react';
import type { Lead, LeadStatus } from '../../types';
import { STATUS_CONFIG } from '../../types';

// All selectable lead statuses for at-risk dropdown
const ALL_STATUSES = Object.keys(STATUS_CONFIG) as LeadStatus[];

export interface PipelineSettings {
  neverContactedDays: number;
  neverContactedLabel: string;
  staleCotizadoHours: number;
  staleCotizadoLabel: string;
  activeContactDays: number;
  activeLabel: string;
  highPriorityLabel: string;
  atRiskStatuses: string[];  // array of LeadStatus strings
  enableNeverContacted: boolean;
  enableAtRisk: boolean;
  enableHighPriority: boolean;
  enableActive: boolean;
}

const DEFAULT_SETTINGS: PipelineSettings = {
  neverContactedDays: 20,
  neverContactedLabel: 'Sin contactar',
  staleCotizadoHours: 48,
  staleCotizadoLabel: 'Cotizados en riesgo',
  activeContactDays: 7,
  activeLabel: 'Activos esta semana',
  highPriorityLabel: 'Alta prioridad fríos',
  atRiskStatuses: ['Cotizado', 'Negociación', 'Lead calificado', 'En seguimiento'],
  enableNeverContacted: true,
  enableAtRisk: true,
  enableHighPriority: true,
  enableActive: true,
};

// Migrate old comma-string format to array
function normalizeSettings(raw: any): PipelineSettings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (typeof s.atRiskStatuses === 'string') {
    s.atRiskStatuses = s.atRiskStatuses.split(',').map((x: string) => x.trim()).filter(Boolean);
  }
  return s;
}

function loadSettings(companyId: string): PipelineSettings {
  try {
    const raw = localStorage.getItem(`pipeline_settings_${companyId}`);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(companyId: string, s: PipelineSettings) {
  localStorage.setItem(`pipeline_settings_${companyId}`, JSON.stringify(s));
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

function daysSince(d: string | null | undefined) { return d ? differenceInDays(new Date(), new Date(d)) : Infinity; }
function hoursSince(d: string | null | undefined) { return d ? differenceInHours(new Date(), new Date(d)) : Infinity; }

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

  // Close settings on outside click
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

  const t = settings;
  const atRiskStatusList = Array.isArray(t.atRiskStatuses) ? t.atRiskStatuses : [];

  const metrics = useMemo(() => {
    const active = leads.filter(l => !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? ''));
    const total = active.length;
    if (total === 0) return null;

    const neverContacted = active.filter(l => !l.last_follow_up_at && daysSince(l.created_at) >= t.neverContactedDays);
    const atRiskQuoted = active.filter(l =>
      atRiskStatusList.some(s => l.status?.toLowerCase().includes(s.toLowerCase())) &&
      hoursSince(l.last_follow_up_at ?? l.created_at) >= t.staleCotizadoHours
    );
    const activeThisWeek = active.filter(l => daysSince(l.last_follow_up_at) <= t.activeContactDays);
    const highPriorityStale = active.filter(l =>
      l.priority === 'high' && daysSince(l.last_follow_up_at ?? l.created_at) > t.activeContactDays
    );

    const withFirstContact = active.filter(l => l.first_follow_up_at);
    const avgFirstContactDays = withFirstContact.length > 0
      ? Math.round(withFirstContact.reduce((s, l) => s + differenceInDays(new Date(l.first_follow_up_at!), new Date(l.created_at)), 0) / withFirstContact.length)
      : null;

    const withLastContact = active.filter(l => l.last_follow_up_at);
    const avgDaysSinceContact = withLastContact.length > 0
      ? Math.round(withLastContact.reduce((s, l) => s + daysSince(l.last_follow_up_at), 0) / withLastContact.length)
      : null;

    return {
      total, neverContacted: neverContacted.length, atRiskQuoted: atRiskQuoted.length,
      activeThisWeek: activeThisWeek.length, highPriorityStale: highPriorityStale.length,
      avgFirstContactDays, avgDaysSinceContact,
      pctActive: Math.round((activeThisWeek.length / total) * 100),
      pctNever: Math.round((neverContacted.length / total) * 100),
    };
  }, [leads, t]);

  if (!metrics) return null;

  type ChipDef = { id: PipelineFilter; label: string; count: number; pct: number; enabled: boolean; icon: React.ElementType; active: string; hover: string; countColor: string; desc: string; };

  const chips: ChipDef[] = ([
    { id: 'never_contacted' as const, label: t.neverContactedLabel, count: metrics.neverContacted, pct: metrics.pctNever, enabled: t.enableNeverContacted, icon: Clock, active: 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-100', hover: 'hover:border-red-200 hover:bg-red-50 hover:text-red-700', countColor: 'bg-red-100 text-red-700', desc: `+${t.neverContactedDays}d sin primer contacto` },
    { id: 'at_risk_quoted' as const, label: t.staleCotizadoLabel, count: metrics.atRiskQuoted, pct: Math.round((metrics.atRiskQuoted / metrics.total) * 100), enabled: t.enableAtRisk, icon: AlertTriangle, active: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-100', hover: 'hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700', countColor: 'bg-amber-100 text-amber-700', desc: `+${t.staleCotizadoHours}h sin contacto` },
    { id: 'high_priority_stale' as const, label: t.highPriorityLabel, count: metrics.highPriorityStale, pct: Math.round((metrics.highPriorityStale / metrics.total) * 100), enabled: t.enableHighPriority, icon: TrendingUp, active: 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-100', hover: 'hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700', countColor: 'bg-violet-100 text-violet-700', desc: `Alta prioridad inactivos +${t.activeContactDays}d` },
    { id: 'active_this_week' as const, label: t.activeLabel, count: metrics.activeThisWeek, pct: metrics.pctActive, enabled: t.enableActive, icon: Zap, active: 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100', hover: 'hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700', countColor: 'bg-emerald-100 text-emerald-700', desc: `Contactados en los últimos ${t.activeContactDays}d` },
  ] as ChipDef[]).filter(c => c.enabled);


  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Inteligencia de Pipeline</span>
          {activeFilter && (
            <button onClick={() => onFilterChange(null)} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black hover:bg-indigo-200 transition-colors">
              <X className="w-2.5 h-2.5" /> Limpiar filtro
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-400 mr-1">
            {metrics.avgFirstContactDays !== null && (
              <span title="Días promedio hasta el primer seguimiento">⚡ 1er contacto: <strong className="text-gray-600">{metrics.avgFirstContactDays}d</strong></span>
            )}
            {metrics.avgDaysSinceContact !== null && (
              <span title="Días promedio desde el último seguimiento">🕐 Último contacto: <strong className="text-gray-600">{metrics.avgDaysSinceContact}d prom.</strong></span>
            )}
          </div>
          {/* Settings button — only admins */}
          {isAdmin && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => { setDraft(settings); setShowSettings(!showSettings); }}
                title="Configurar métricas de pipeline"
                className={`p-1.5 rounded-lg border text-[11px] transition-all ${showSettings ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              {/* Settings Panel */}
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Configurar Pipeline</h3>
                    <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">

                    {/* ── Sin contactar ── */}
                    <div className="rounded-xl border border-red-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-red-50">
                        <span className="text-[11px] font-black text-red-700 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Sin contactar</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-red-500">{draft.enableNeverContacted ? 'Activo' : 'Oculto'}</span>
                          <input type="checkbox" checked={draft.enableNeverContacted} onChange={e => setDraft(d => ({ ...d, enableNeverContacted: e.target.checked }))} className="w-3.5 h-3.5 accent-red-600" />
                        </label>
                      </div>
                      <div className="px-3 py-2.5 bg-white space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Texto del chip</p>
                          <input type="text" value={draft.neverContactedLabel} onChange={e => setDraft(d => ({ ...d, neverContactedLabel: e.target.value }))} placeholder="Ej: Sin contactar" className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-red-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Días sin contacto para activar alerta</p>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} max={365} value={draft.neverContactedDays} onChange={e => setDraft(d => ({ ...d, neverContactedDays: +e.target.value }))} className="w-20 text-sm px-2 py-1.5 rounded-lg border border-gray-200 text-center font-black focus:outline-none focus:ring-1 focus:ring-red-400" />
                            <span className="text-[11px] text-gray-500 font-bold">días sin contacto</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── En riesgo ── */}
                    <div className="rounded-xl border border-amber-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-50">
                        <span className="text-[11px] font-black text-amber-700 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> En riesgo</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-amber-500">{draft.enableAtRisk ? 'Activo' : 'Oculto'}</span>
                          <input type="checkbox" checked={draft.enableAtRisk} onChange={e => setDraft(d => ({ ...d, enableAtRisk: e.target.checked }))} className="w-3.5 h-3.5 accent-amber-600" />
                        </label>
                      </div>
                      <div className="px-3 py-2.5 bg-white space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Texto del chip</p>
                          <input type="text" value={draft.staleCotizadoLabel} onChange={e => setDraft(d => ({ ...d, staleCotizadoLabel: e.target.value }))} placeholder="Ej: Cotizados en riesgo" className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Horas sin contacto para activar alerta</p>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} max={720} value={draft.staleCotizadoHours} onChange={e => setDraft(d => ({ ...d, staleCotizadoHours: +e.target.value }))} className="w-20 text-sm px-2 py-1.5 rounded-lg border border-gray-200 text-center font-black focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            <span className="text-[11px] text-gray-500 font-bold">horas sin contacto</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1.5">Estados que cuentan como "en riesgo"</p>
                          <div className="grid grid-cols-2 gap-1">
                            {ALL_STATUSES.filter(s => !['Cerrado','Cliente','Perdido','Erróneo'].includes(s)).map(status => {
                              const isSelected = (Array.isArray(draft.atRiskStatuses) ? draft.atRiskStatuses : []).includes(status);
                              const cfg = STATUS_CONFIG[status];
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => setDraft(d => {
                                    const current = Array.isArray(d.atRiskStatuses) ? d.atRiskStatuses : [];
                                    return { ...d, atRiskStatuses: isSelected ? current.filter(x => x !== status) : [...current, status] };
                                  })}
                                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all text-left ${isSelected ? `${cfg.bgColor} ${cfg.color} border-current` : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                >
                                  <span className={`w-3.5 h-3.5 rounded shrink-0 border flex items-center justify-center ${isSelected ? 'bg-current border-current' : 'border-gray-300 bg-white'}`}>
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </span>
                                  <span className="truncate">{cfg.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Alta prioridad ── */}
                    <div className="rounded-xl border border-violet-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-violet-50">
                        <span className="text-[11px] font-black text-violet-700 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Alta prioridad fríos</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-violet-500">{draft.enableHighPriority ? 'Activo' : 'Oculto'}</span>
                          <input type="checkbox" checked={draft.enableHighPriority} onChange={e => setDraft(d => ({ ...d, enableHighPriority: e.target.checked }))} className="w-3.5 h-3.5 accent-violet-600" />
                        </label>
                      </div>
                      <div className="px-3 py-2.5 bg-white">
                        <p className="text-[10px] font-bold text-gray-500 mb-1">Texto del chip</p>
                        <input type="text" value={draft.highPriorityLabel} onChange={e => setDraft(d => ({ ...d, highPriorityLabel: e.target.value }))} placeholder="Ej: Alta prioridad fríos" className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                    </div>

                    {/* ── Activos ── */}
                    <div className="rounded-xl border border-emerald-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50">
                        <span className="text-[11px] font-black text-emerald-700 flex items-center gap-1.5"><Zap className="w-3 h-3" /> Activos</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] text-emerald-500">{draft.enableActive ? 'Activo' : 'Oculto'}</span>
                          <input type="checkbox" checked={draft.enableActive} onChange={e => setDraft(d => ({ ...d, enableActive: e.target.checked }))} className="w-3.5 h-3.5 accent-emerald-600" />
                        </label>
                      </div>
                      <div className="px-3 py-2.5 bg-white space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Texto del chip</p>
                          <input type="text" value={draft.activeLabel} onChange={e => setDraft(d => ({ ...d, activeLabel: e.target.value }))} placeholder="Ej: Activos esta semana" className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 mb-1">Lead activo si fue contactado en los últimos</p>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} max={90} value={draft.activeContactDays} onChange={e => setDraft(d => ({ ...d, activeContactDays: +e.target.value }))} className="w-20 text-sm px-2 py-1.5 rounded-lg border border-gray-200 text-center font-black focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                            <span className="text-[11px] text-gray-500 font-bold">días</span>
                          </div>
                        </div>
                      </div>
                    </div>


                  </div>

                  <button
                    onClick={handleSave}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-indigo-200"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Guardar configuración
                  </button>
                  <p className="text-[9px] text-gray-400 text-center mt-2">Configuración guardada por empresa en este dispositivo</p>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title={collapsed ? 'Expandir' : 'Colapsar'}>
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chips */}
      {!collapsed && (
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => {
            const isActive = activeFilter === chip.id;
            const Icon = chip.icon;
            const isEmpty = chip.count === 0;
            return (
              <button
                key={chip.id}
                onClick={() => !isEmpty && onFilterChange(isActive ? null : chip.id)}
                disabled={isEmpty}
                title={chip.desc}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all select-none ${isEmpty ? 'opacity-40 cursor-not-allowed border-gray-100 bg-white text-gray-400' : isActive ? chip.active : `border-gray-200 bg-white text-gray-600 ${chip.hover}`}`}
              >
                <Icon className={`w-3 h-3 shrink-0 ${isActive ? 'text-white' : ''}`} />
                <span>{chip.label}</span>
                <span className={`min-w-[20px] h-[16px] px-1 rounded-full flex items-center justify-center text-[10px] font-black ${isActive ? 'bg-white/25 text-white' : chip.countColor}`}>
                  {chip.count}
                </span>
                {!isEmpty && !isActive && chip.pct > 0 && (
                  <span className="text-[9px] text-gray-400">{chip.pct}%</span>
                )}
              </button>
            );
          })}

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

export function applyPipelineFilter(leads: Lead[], filter: PipelineFilter, companyId = 'default'): Lead[] {
  if (!filter) return leads;
  let s: PipelineSettings = DEFAULT_SETTINGS;
  try { const raw = localStorage.getItem(`pipeline_settings_${companyId}`); if (raw) s = normalizeSettings(JSON.parse(raw)); } catch {}
  const atRisk = Array.isArray(s.atRiskStatuses) ? s.atRiskStatuses : [];

  switch (filter) {
    case 'never_contacted': return leads.filter(l => !l.last_follow_up_at && !['Cerrado','Cliente','Perdido'].includes(l.status??'') && daysSince(l.created_at) >= s.neverContactedDays);
    case 'at_risk_quoted': return leads.filter(l => atRisk.some(x => l.status?.toLowerCase().includes(x.toLowerCase())) && hoursSince(l.last_follow_up_at??l.created_at) >= s.staleCotizadoHours);
    case 'active_this_week': return leads.filter(l => daysSince(l.last_follow_up_at) <= s.activeContactDays);
    case 'high_priority_stale': return leads.filter(l => l.priority==='high' && !['Cerrado','Cliente','Perdido'].includes(l.status??'') && daysSince(l.last_follow_up_at??l.created_at) > s.activeContactDays);
    default: return leads;
  }
}
