import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import {
  Building2, Users, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Clock, DollarSign,
  RefreshCw, BarChart3, Zap, Activity, Search
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantStat {
  company_id: string;
  company_name: string;
  plan_name: string;
  plan_slug: string;
  status: string;
  user_count: number;
  lead_count: number;
  quote_count: number;
  current_period_end: string | null;
  price_monthly: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
    active: { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Activo', Icon: CheckCircle2 },
    trialing: { bg: 'bg-amber-100', color: 'text-amber-700', label: 'Trial', Icon: Clock },
    past_due: { bg: 'bg-rose-100', color: 'text-rose-700', label: 'Pago Fallido', Icon: AlertTriangle },
    canceled: { bg: 'bg-slate-100', color: 'text-slate-600', label: 'Cancelado', Icon: XCircle },
    paused: { bg: 'bg-purple-100', color: 'text-purple-700', label: 'Pausado', Icon: Clock },
  };
  const s = map[status] ?? map.canceled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${s.bg} ${s.color}`}>
      <s.Icon className="w-3.5 h-3.5" /> {s.label}
    </span>
  );
};

const planBadge = (slug: string, name: string) => {
  const colors: Record<string, string> = { 
    starter: 'bg-blue-50 text-blue-700 border-blue-200', 
    pro: 'bg-purple-50 text-purple-700 border-purple-200', 
    enterprise: 'bg-slate-100 text-slate-800 border-slate-300' 
  };
  const c = colors[slug] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${c}`}>
      {name || slug}
    </span>
  );
};

const fmt = (n: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('es-SV').format(n);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, colorClass, bgClass, iconBgClass }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 -mr-8 -mt-8 pointer-events-none transition-all group-hover:opacity-40 ${bgClass}`}></div>
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${iconBgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>
      <p className="text-3xl font-black text-slate-900 mb-1 tracking-tight relative z-10">{value}</p>
      {sub && <p className="text-slate-400 text-xs font-medium relative z-10">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Observatory() {
  const [tenants, setTenants] = useState<TenantStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_tenant_stats');
    if (!error && data) setTenants(data as TenantStat[]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = tenants.filter(t =>
    !search || t.company_name?.toLowerCase().includes(search.toLowerCase()) || t.plan_slug?.includes(search.toLowerCase())
  );

  // KPI calculations
  const mrr = tenants.reduce((sum, t) => sum + (t.price_monthly ?? 0), 0);
  const arr = mrr * 12;
  const activeCount = tenants.filter(t => ['active', 'trialing'].includes(t.status)).length;
  const pastDueCount = tenants.filter(t => t.status === 'past_due').length;
  const totalLeads = tenants.reduce((sum, t) => sum + (t.lead_count ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-slate-900 rounded-[14px] flex items-center justify-center shadow-md">
             <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Super Admin Observatory</h1>
            <p className="text-sm text-slate-500 font-medium">Visibilidad centralizada de todos los tenants · Actualizado: {lastRefresh.toLocaleTimeString('es-SV')}</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 relative z-10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Datos
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <KpiCard label="MRR Total" value={fmt(mrr)} sub="Ingresos Mensuales" icon={DollarSign} colorClass="text-emerald-600" bgClass="bg-emerald-500" iconBgClass="bg-emerald-50 border border-emerald-100" />
        <KpiCard label="ARR Proyectado" value={fmt(arr)} sub="Run Rate Anual" icon={TrendingUp} colorClass="text-indigo-600" bgClass="bg-indigo-500" iconBgClass="bg-indigo-50 border border-indigo-100" />
        <KpiCard label="Tenants Activos" value={fmtNum(activeCount)} sub={`de ${tenants.length} registrados`} icon={Building2} colorClass="text-purple-600" bgClass="bg-purple-500" iconBgClass="bg-purple-50 border border-purple-100" />
        <KpiCard label="Pagos Fallidos" value={fmtNum(pastDueCount)} sub={pastDueCount > 0 ? '⚠️ Requiere atención' : 'Sin alertas'} icon={AlertTriangle} colorClass={pastDueCount > 0 ? 'text-rose-600' : 'text-slate-400'} bgClass={pastDueCount > 0 ? 'bg-rose-500' : 'bg-slate-500'} iconBgClass={pastDueCount > 0 ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100'} />
        <KpiCard label="Volumen Leads" value={fmtNum(totalLeads)} sub="En toda la red" icon={BarChart3} colorClass="text-amber-600" bgClass="bg-amber-500" iconBgClass="bg-amber-50 border border-amber-100" />
      </div>

      {/* Tenants Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
        {/* Table Header Controls */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-black text-slate-900">Directorio de Tenants</h2>
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black tracking-wider">
              {filtered.length}
            </span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar por empresa o plan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-sm w-full md:w-80 shadow-sm"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center text-slate-400 flex flex-col items-center">
              <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
              <span className="font-bold">Sincronizando con base de datos...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Uso Global</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">MRR</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Renovación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.company_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shadow-inner group-hover:scale-105 transition-transform">
                          {(t.company_name ?? 'T').charAt(0).toUpperCase()}
                        </div>
                        <div>
                           <span className="text-slate-900 font-bold block">{t.company_name ?? 'Sin Nombre'}</span>
                           <span className="text-[10px] font-mono text-slate-400">{t.company_id.slice(0,8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {planBadge(t.plan_slug, t.plan_name)}
                    </td>
                    <td className="px-6 py-4">
                      {statusBadge(t.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                         <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <Users className="w-3.5 h-3.5 text-slate-400" /> {fmtNum(t.user_count ?? 0)} usuarios
                         </div>
                         <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <BarChart3 className="w-3.5 h-3.5 text-slate-400" /> {fmtNum(t.lead_count ?? 0)} leads
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-emerald-600 font-black font-mono bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        {fmt(t.price_monthly ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {t.current_period_end ? new Date(t.current_period_end).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                        <Zap className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="font-bold text-slate-600">No se encontraron resultados</p>
                      <p className="text-sm">Prueba ajustando tu búsqueda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
