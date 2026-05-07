import { useMemo, useState } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import { Clock, AlertTriangle, Zap, Users, TrendingUp, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Lead } from '../../types';

// ─── Thresholds (company-configurable in the future via settings) ───────────
const DEFAULT_THRESHOLDS = {
  neverContactedDays: 20,      // Lead sin contacto: cuántos días = alerta
  staleCotizadoHours: 48,      // Cotizado/Negociación: horas sin contacto = riesgo
  slowFirstResponseDays: 3,    // Tiempo de primer contacto > Xd = lento
  activeContactDays: 7,        // Contactado en los últimos Xd = activo
};

export type PipelineFilter =
  | 'never_contacted'
  | 'at_risk_quoted'
  | 'slow_first_response'
  | 'active_this_week'
  | 'high_priority_stale'
  | null;

interface PipelineIntelligenceBarProps {
  leads: Lead[];
  activeFilter: PipelineFilter;
  onFilterChange: (filter: PipelineFilter) => void;
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  return differenceInDays(new Date(), new Date(dateStr));
}

function hoursSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  return differenceInHours(new Date(), new Date(dateStr));
}

export function PipelineIntelligenceBar({
  leads,
  activeFilter,
  onFilterChange,
}: PipelineIntelligenceBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const t = DEFAULT_THRESHOLDS;

  // ─── Computed intelligence metrics ────────────────────────────────────────
  const metrics = useMemo(() => {
    const active = leads.filter(l => !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? ''));
    const total = active.length;
    if (total === 0) return null;

    // 1. Never contacted — sin ningún follow-up y lleva más de N días
    const neverContacted = active.filter(l =>
      !l.last_follow_up_at &&
      daysSince(l.created_at) >= t.neverContactedDays
    );

    // 2. At risk — cotizados/negociación sin contacto en 48h
    const atRiskStatuses = ['Cotizado', 'Negociación', 'En negociación', 'Propuesta enviada'];
    const atRiskQuoted = active.filter(l =>
      atRiskStatuses.some(s => l.status?.toLowerCase().includes(s.toLowerCase())) &&
      hoursSince(l.last_follow_up_at ?? l.created_at) >= t.staleCotizadoHours
    );

    // 3. Slow first response — tiempo de primer contacto > 3 días
    const slowFirstResponse = active.filter(l =>
      l.first_follow_up_at &&
      differenceInDays(new Date(l.first_follow_up_at), new Date(l.created_at)) > t.slowFirstResponseDays
    );

    // 4. Active this week — contactados en los últimos 7 días
    const activeThisWeek = active.filter(l =>
      daysSince(l.last_follow_up_at) <= t.activeContactDays
    );

    // 5. High priority + stale (alta prioridad sin contacto esta semana)
    const highPriorityStale = active.filter(l =>
      l.priority === 'high' &&
      daysSince(l.last_follow_up_at ?? l.created_at) > t.activeContactDays
    );

    // Avg days to first contact (for leads that have been contacted)
    const withFirstContact = active.filter(l => l.first_follow_up_at);
    const avgFirstContactDays = withFirstContact.length > 0
      ? Math.round(
          withFirstContact.reduce((sum, l) =>
            sum + differenceInDays(new Date(l.first_follow_up_at!), new Date(l.created_at ?? '')), 0
          ) / withFirstContact.length
        )
      : null;

    // Avg days since last contact (for active leads)
    const withLastContact = active.filter(l => l.last_follow_up_at);
    const avgDaysSinceContact = withLastContact.length > 0
      ? Math.round(
          withLastContact.reduce((sum, l) => sum + daysSince(l.last_follow_up_at), 0)
          / withLastContact.length
        )
      : null;

    return {
      total,
      neverContacted: neverContacted.length,
      atRiskQuoted: atRiskQuoted.length,
      slowFirstResponse: slowFirstResponse.length,
      activeThisWeek: activeThisWeek.length,
      highPriorityStale: highPriorityStale.length,
      avgFirstContactDays,
      avgDaysSinceContact,
      pctActive: Math.round((activeThisWeek.length / total) * 100),
      pctNeverContacted: Math.round((neverContacted.length / total) * 100),
    };
  }, [leads]);

  if (!metrics || metrics.total === 0) return null;

  const chips: {
    id: PipelineFilter;
    label: string;
    count: number;
    pct: number;
    icon: React.ElementType;
    color: string;
    bgActive: string;
    bgHover: string;
    desc: string;
  }[] = [
    {
      id: 'never_contacted',
      label: 'Sin contactar',
      count: metrics.neverContacted,
      pct: metrics.pctNeverContacted,
      icon: Clock,
      color: metrics.neverContacted > 20 ? 'text-red-600' : metrics.neverContacted > 5 ? 'text-amber-600' : 'text-slate-500',
      bgActive: 'bg-red-600 text-white border-red-600',
      bgHover: 'hover:border-red-300 hover:bg-red-50',
      desc: `+${DEFAULT_THRESHOLDS.neverContactedDays}d sin primer contacto`,
    },
    {
      id: 'at_risk_quoted',
      label: 'Cotizados en riesgo',
      count: metrics.atRiskQuoted,
      pct: Math.round((metrics.atRiskQuoted / metrics.total) * 100),
      icon: AlertTriangle,
      color: metrics.atRiskQuoted > 5 ? 'text-red-600' : metrics.atRiskQuoted > 0 ? 'text-amber-600' : 'text-slate-400',
      bgActive: 'bg-amber-500 text-white border-amber-500',
      bgHover: 'hover:border-amber-300 hover:bg-amber-50',
      desc: `Cotizados/Negociación sin contacto +${DEFAULT_THRESHOLDS.staleCotizadoHours}h`,
    },
    {
      id: 'high_priority_stale',
      label: 'Alta prioridad fríos',
      count: metrics.highPriorityStale,
      pct: Math.round((metrics.highPriorityStale / metrics.total) * 100),
      icon: TrendingUp,
      color: metrics.highPriorityStale > 0 ? 'text-violet-600' : 'text-slate-400',
      bgActive: 'bg-violet-600 text-white border-violet-600',
      bgHover: 'hover:border-violet-300 hover:bg-violet-50',
      desc: `Alta prioridad sin contacto esta semana`,
    },
    {
      id: 'active_this_week',
      label: 'Activos esta semana',
      count: metrics.activeThisWeek,
      pct: metrics.pctActive,
      icon: Zap,
      color: 'text-emerald-600',
      bgActive: 'bg-emerald-600 text-white border-emerald-600',
      bgHover: 'hover:border-emerald-300 hover:bg-emerald-50',
      desc: `Contactados en los últimos ${DEFAULT_THRESHOLDS.activeContactDays}d`,
    },
  ];

  return (
    <div className="mb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
            Inteligencia de Pipeline
          </span>
          {activeFilter && (
            <button
              onClick={() => onFilterChange(null)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black hover:bg-indigo-200 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
              Limpiar filtro
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Summary stats */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-400">
            {metrics.avgFirstContactDays !== null && (
              <span title="Promedio de días para hacer el primer contacto">
                ⚡ 1er contacto: <strong className="text-gray-600">{metrics.avgFirstContactDays}d</strong>
              </span>
            )}
            {metrics.avgDaysSinceContact !== null && (
              <span title="Promedio de días desde el último contacto en leads activos">
                🕐 Último contacto: <strong className="text-gray-600">{metrics.avgDaysSinceContact}d promedio</strong>
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chips row */}
      {!collapsed && (
        <div className="flex items-center gap-2 flex-wrap">
          {chips.map(chip => {
            const isActive = activeFilter === chip.id;
            const Icon = chip.icon;
            const isZero = chip.count === 0;
            return (
              <button
                key={chip.id}
                onClick={() => !isZero && onFilterChange(isActive ? null : chip.id)}
                disabled={isZero}
                title={chip.desc}
                className={`
                  group flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold
                  transition-all duration-150 select-none
                  ${isZero ? 'opacity-40 cursor-not-allowed border-gray-100 bg-white text-gray-400' :
                    isActive
                      ? `${chip.bgActive} shadow-sm`
                      : `border-gray-200 bg-white text-gray-600 ${chip.bgHover}`
                  }
                `}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : chip.color}`} />
                <span>{chip.label}</span>
                <span className={`
                  min-w-[22px] h-[18px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-black
                  ${isActive ? 'bg-white/25 text-white' : isZero ? 'bg-gray-100 text-gray-400' :
                    chip.count > 10 ? 'bg-red-100 text-red-700' :
                    chip.count > 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-indigo-100 text-indigo-700'
                  }
                `}>
                  {chip.count}
                </span>
                {!isZero && !isActive && chip.pct > 0 && (
                  <span className="text-[9px] font-medium text-gray-400">
                    {chip.pct}%
                  </span>
                )}
              </button>
            );
          })}

          {/* Divider + summary pill */}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[11px] font-black text-indigo-700">
                {metrics.pctActive}% activo
              </span>
              <div className="w-16 h-1.5 bg-indigo-100 rounded-full overflow-hidden ml-1">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${metrics.pctActive}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter function to apply pipeline intelligence filter ──────────────────
export function applyPipelineFilter(leads: Lead[], filter: PipelineFilter): Lead[] {
  if (!filter) return leads;
  const t = DEFAULT_THRESHOLDS;

  switch (filter) {
    case 'never_contacted':
      return leads.filter(l =>
        !l.last_follow_up_at &&
        !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? '') &&
        daysSince(l.created_at) >= t.neverContactedDays
      );
    case 'at_risk_quoted': {
      const atRiskStatuses = ['Cotizado', 'Negociación', 'En negociación', 'Propuesta enviada'];
      return leads.filter(l =>
        atRiskStatuses.some(s => l.status?.toLowerCase().includes(s.toLowerCase())) &&
        hoursSince(l.last_follow_up_at ?? l.created_at) >= t.staleCotizadoHours
      );
    }
    case 'slow_first_response':
      return leads.filter(l =>
        l.first_follow_up_at &&
        differenceInDays(new Date(l.first_follow_up_at), new Date(l.created_at ?? '')) > t.slowFirstResponseDays
      );
    case 'active_this_week':
      return leads.filter(l => daysSince(l.last_follow_up_at) <= t.activeContactDays);
    case 'high_priority_stale':
      return leads.filter(l =>
        l.priority === 'high' &&
        !['Cerrado', 'Cliente', 'Perdido'].includes(l.status ?? '') &&
        daysSince(l.last_follow_up_at ?? l.created_at) > t.activeContactDays
      );
    default:
      return leads;
  }
}
