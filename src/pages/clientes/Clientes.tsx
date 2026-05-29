import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, TrendingUp, Clock, CheckCircle2, Search, CalendarCheck } from 'lucide-react';
import { clientsService, pipelineStagesService } from '../../services/clients';
import type { Client, ClientPipelineStage } from '../../types/clients';
import OnboardingPipeline from '../../components/clientes/OnboardingPipeline';
import ClienteDetail from '../../components/clientes/ClienteDetail';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../auth/AuthProvider';
import { pagosService } from '../../services/pagos';

type Tab = 'pipeline' | 'activos';

export default function Clientes() {
  const { hasPermission, isAdmin } = usePermissions();
  const canView = hasPermission('clientes.view') || isAdmin();
  const { profile } = useAuth();

  const [tab, setTab] = useState<Tab>('pipeline');
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<ClientPipelineStage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [clientesCuentas, setClientesCuentas] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientResult, stageResult] = await Promise.allSettled([
        clientsService.getAll(),
        pipelineStagesService.getAll(),
      ]);
      setClients(clientResult.status === 'fulfilled' ? clientResult.value : []);
      setStages(stageResult.status === 'fulfilled' ? stageResult.value : []);

      if (profile?.company_id) {
        try {
          const cuentas = await pagosService.getClientesCuentas(profile.company_id);
          const cuentasMap: Record<string, any> = {};
          cuentas.forEach(c => {
            if (c.nombre_cliente) {
              cuentasMap[c.nombre_cliente.trim().toLowerCase()] = c;
            }
          });
          setClientesCuentas(cuentasMap);
        } catch (err) {
          console.error('[Clientes] Error loading accounts:', err);
        }
      }
    } catch {
      setClients([]);
      setStages([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => { load(); }, [load]);

  // Reset stage filter when switching tabs
  useEffect(() => { setSelectedStageId(null); }, [tab]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400 font-medium">No tienes acceso a este módulo.</p>
      </div>
    );
  }

  const inPipeline = clients.filter(c => !c.es_activo);
  const activos = clients.filter(c => c.es_activo);
  const goLiveThisWeek = inPipeline.filter(c => {
    const stage = stages.find(s => s.id === c.etapa_actual_id);
    return stage?.es_final;
  });

  const displayed = tab === 'pipeline' ? inPipeline : activos;

  const searchFiltered = displayed.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.contacto || '').toLowerCase().includes(search.toLowerCase())
  );

  // Stage chip counts — from the full tab list (not search-filtered, so counts stay consistent)
  const sorted = [...stages].sort((a, b) => a.orden - b.orden);
  const stageCounts = sorted.reduce((acc, stage) => {
    acc[stage.id] = inPipeline.filter(c => c.etapa_actual_id === stage.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Apply stage filter on top of search
  const filtered = selectedStageId
    ? searchFiltered.filter(c => c.etapa_actual_id === selectedStageId)
    : searchFiltered;

  const getCompletedIds = (client: Client) => {
    const idx = sorted.findIndex(s => s.id === client.etapa_actual_id);
    return sorted.slice(0, idx).map(s => s.id);
  };

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const avatarColors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#8b5cf6'];
  const getColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  const formatFechaCierre = (client: Client): string => {
    const rawDate = (client as any).fecha_cierre_lead || client.created_at;
    try {
      return format(
        new Date(rawDate.substring(0, 10) + 'T12:00:00'),
        'dd MMM yyyy',
        { locale: es }
      ).toUpperCase();
    } catch {
      return new Date(rawDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Clientes</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">Pipeline de Onboarding</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'En Pipeline', value: inPipeline.length, icon: Clock, color: 'text-blue-600 bg-blue-50' },
          { label: 'Go-Live Esta Semana', value: goLiveThisWeek.length, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Clientes Activos', value: activos.length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Total', value: clients.length, icon: Users, color: 'text-purple-600 bg-purple-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['pipeline', 'activos'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pipeline' ? `En Proceso (${inPipeline.length})` : `Activos (${activos.length})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:border-[#4449AA]"
          />
        </div>
      </div>

      {/* Stage filter chips — only in pipeline tab */}
      {tab === 'pipeline' && sorted.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* "Todos" chip */}
          <button
            onClick={() => setSelectedStageId(null)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              !selectedStageId
                ? 'bg-[#4449AA] text-white border-[#4449AA] shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-[#4449AA]/40 hover:text-[#4449AA]'
            }`}
          >
            Todos
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              !selectedStageId ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {inPipeline.length}
            </span>
          </button>

          {/* One chip per stage that has clients */}
          {sorted.map(stage => {
            const count = stageCounts[stage.id] ?? 0;
            if (count === 0) return null;
            const isActive = selectedStageId === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(isActive ? null : stage.id)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  isActive
                    ? 'bg-[#4449AA] text-white border-[#4449AA] shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#4449AA]/40 hover:text-[#4449AA]'
                }`}
              >
                <span>{stage.icono}</span>
                <span>{stage.nombre}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#4449AA]/10 text-[#4449AA]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-gray-100 rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-gray-50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-56 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm font-medium">
              {selectedStageId
                ? 'No hay clientes en esta etapa.'
                : search
                  ? 'Sin resultados para tu búsqueda.'
                  : tab === 'pipeline'
                    ? 'No hay clientes en proceso.'
                    : 'No hay clientes activos aún.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(client => {
              const completedIds = getCompletedIds(client);
              const hasFechaCierre = !!(client as any).fecha_cierre_lead;
              return (
                <button
                  key={client.id}
                  onClick={() => setSelectedId(client.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{ background: getColor(client.nombre) }}
                  >
                    {getInitials(client.nombre)}
                  </div>

                  {/* Name */}
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{client.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{client.contacto || '—'}</p>
                  </div>

                  {/* Pipeline stepper */}
                  {tab === 'pipeline' && stages.length > 0 && (
                    <div className="flex-1 px-4">
                      <OnboardingPipeline
                        stages={stages}
                        currentStageId={client.etapa_actual_id}
                        completedStageIds={completedIds}
                        stageHistory={client.stage_history ?? []}
                        compact
                      />
                    </div>
                  )}

                  {/* Active badge */}
                  {tab === 'activos' && (
                    <div className="flex-1 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-700">
                        ✓ Cliente Activo
                      </span>
                    </div>
                  )}

                  {/* Payment status badge */}
                  {(() => {
                    const cuenta = clientesCuentas[client.nombre.trim().toLowerCase()] || 
                                   (client.contacto ? clientesCuentas[client.contacto.trim().toLowerCase()] : null);
                    if (!cuenta) return null;
                    const total = (cuenta.total_cobrado || 0) + (cuenta.total_pendiente || 0);
                    if (total === 0) return null;
                    const pct = Math.round((cuenta.total_cobrado / total) * 100);
                    return (
                      <div className="flex flex-col items-end gap-0.5 min-w-[120px] text-right mr-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${cuenta.total_pendiente === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className={`text-[9px] font-black uppercase tracking-wider ${cuenta.total_pendiente === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {cuenta.total_pendiente === 0 ? 'Pagado (Income)' : 'CxC Pendiente'}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono font-black text-slate-700">
                          ${(cuenta.total_cobrado || 0).toLocaleString()} / ${(total || 0).toLocaleString()}
                        </p>
                        <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${cuenta.total_pendiente === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Doc count badge */}
                  {(() => {
                    const docCount = (client as any).doc_count ?? 0;
                    if (docCount === 0) return null;
                    return (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        {docCount} doc{docCount !== 1 ? 's' : ''}
                      </span>
                    );
                  })()}

                  {/* Fecha cierre + arrow */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-semibold ${
                      hasFechaCierre ? 'text-[#4449AA]' : 'text-gray-400'
                    }`}>
                      <CalendarCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      {formatFechaCierre(client)}
                    </span>
                    <span className="text-gray-300 group-hover:text-[#4449AA] transition-colors text-sm font-bold">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail slide-over */}
      <ClienteDetail
        clientId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={load}
      />
    </div>
  );
}
