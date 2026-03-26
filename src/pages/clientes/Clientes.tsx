import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, Clock, CheckCircle2, Search } from 'lucide-react';
import { clientsService, pipelineStagesService } from '../../services/clients';
import type { Client, ClientPipelineStage } from '../../types/clients';
import OnboardingPipeline from '../../components/clientes/OnboardingPipeline';
import ClienteDetail from '../../components/clientes/ClienteDetail';
import { usePermissions } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';

type Tab = 'pipeline' | 'activos';

export default function Clientes() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('clientes.view');

  const [tab, setTab] = useState<Tab>('pipeline');
  const [clients, setClients] = useState<Client[]>([]);
  const [stages, setStages] = useState<ClientPipelineStage[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientData, stageData] = await Promise.all([
        clientsService.getAll(),
        pipelineStagesService.getAll(),
      ]);
      setClients(clientData);
      setStages(stageData);
    } catch {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
  const filtered = displayed.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.contacto || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...stages].sort((a, b) => a.orden - b.orden);

  // La etapa actual es la current, las anteriores están completadas
  const getCompletedIds = (client: Client) => {
    const idx = sorted.findIndex(s => s.id === client.etapa_actual_id);
    return sorted.slice(0, idx).map(s => s.id);
  };

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const avatarColors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#8b5cf6'];
  const getColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

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
              {search ? 'Sin resultados para tu búsqueda.' : tab === 'pipeline' ? 'No hay clientes en proceso.' : 'No hay clientes activos aún.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(client => {
              const completedIds = getCompletedIds(client);
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

                  {/* Date + arrow */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(client.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
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
