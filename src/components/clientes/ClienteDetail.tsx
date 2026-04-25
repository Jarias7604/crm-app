import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Circle, Loader2, ChevronRight, Send, MessageSquare, Mail, Phone, UserCircle2 } from 'lucide-react';
import type { Client, ClientPipelineStage, ClientDocument, ClientStageDocumentType } from '../../types/clients';
import { clientsService, pipelineStagesService } from '../../services/clients';
import StageDocumentUpload from './StageDocumentUpload';
import { usePermissions } from '../../hooks/usePermissions';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

interface TeamMember { id: string; full_name: string | null; email: string; }

interface Props {
  clientId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ClienteDetail({ clientId, onClose, onUpdated }: Props) {
  const { hasPermission, isAdmin } = usePermissions();
  const canManage = hasPermission('clientes.manage') || isAdmin();
  const canSendPortal = hasPermission('clientes.send_portal') || isAdmin();

  const [client, setClient] = useState<Client | null>(null);
  const [stages, setStages] = useState<ClientPipelineStage[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      const [c, s] = await Promise.all([
        clientsService.getById(clientId),
        pipelineStagesService.getAll(),
      ]);
      setClient(c);
      setStages(s);
      if (c?.documents) setDocuments(c.documents as unknown as ClientDocument[]);
      // Abrir la etapa actual por defecto
      const idx = s.findIndex(st => st.id === c?.etapa_actual_id);
      setActiveStageIdx(idx >= 0 ? idx : 0);
    } catch {
      toast.error('Error al cargar cliente');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
    // Cargar equipo de la empresa
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      if (!profile?.company_id) return;
      const { data: team } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', profile.company_id)
        .order('full_name');
      if (team) setTeamMembers(team as TeamMember[]);
    });
  }, [load]);

  const handleAssignStage = async (stageId: string, profileId: string | null) => {
    setSavingAssign(true);
    try {
      await pipelineStagesService.update(stageId, { assigned_to: profileId });
      // actualizar localmente para no recargar todo
      setStages(prev => prev.map(s =>
        s.id === stageId
          ? { ...s, assigned_to: profileId, assigned_profile: teamMembers.find(m => m.id === profileId) || null }
          : s
      ));
      toast.success(profileId ? '👤 Responsable asignado' : 'Responsable eliminado');
    } catch { toast.error('Error al asignar responsable'); }
    finally { setSavingAssign(false); }
  };

  const handleAdvanceStage = async () => {
    if (!client || !canManage) return;
    const sorted = [...stages].sort((a, b) => a.orden - b.orden);
    const currentIdx = sorted.findIndex(s => s.id === client.etapa_actual_id);
    const nextStage = sorted[currentIdx + 1];

    if (!nextStage) {
      // Es la etapa final — promover a activo (sin confirm bloqueante)
      setAdvancing(true);
      try {
        await clientsService.promoteToActive(client.id);
        toast.success('🎉 ¡Cliente activado exitosamente!');
        onUpdated();
        onClose();
      } catch (err: any) {
        console.error('Error al activar cliente:', err);
        toast.error(`Error al activar: ${err?.message || 'intenta de nuevo'}`);
      }
      finally { setAdvancing(false); }
      return;
    }

    setAdvancing(true);
    try {
      await clientsService.advanceStage(client.id, nextStage.id);
      toast.success(`✅ Avanzado a ${nextStage.nombre}`);
      onUpdated();
      await load();
    } catch (err: any) {
      console.error('Error al avanzar etapa:', err);
      toast.error(`Error al avanzar: ${err?.message || 'intenta de nuevo'}`);
    }
    finally { setAdvancing(false); }
  };

  const handleSendPortalLink = (channel: 'whatsapp' | 'email' | 'telegram') => {
    if (!client) return;
    const link = clientsService.getPortalUrl(client.portal_token);
    const msg = `Hola ${client.contacto || client.nombre}, adjunta tus documentos aquí: ${link}`;

    switch (channel) {
      case 'whatsapp':
        window.open(`https://wa.me/${client.telefono?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        break;
      case 'email':
        window.open(`mailto:${client.email}?subject=Portal de documentos&body=${encodeURIComponent(msg)}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`, '_blank');
        break;
    }
    toast.success(`Link enviado por ${channel}`);
  };

  const handleRevertStage = async () => {
    if (!client || !canManage) return;
    const sorted = [...stages].sort((a, b) => a.orden - b.orden);
    const currentIdx = sorted.findIndex(s => s.id === client.etapa_actual_id);
    const prevStage = sorted[currentIdx - 1];

    if (!prevStage) return;

    setReverting(true);
    try {
      await clientsService.advanceStage(client.id, prevStage.id);
      toast.success(`⏪ Regresó a ${prevStage.nombre}`);
      onUpdated();
      await load();
    } catch (err: any) {
      console.error('Error al regresar etapa:', err);
      toast.error(`Error al regresar: ${err?.message || 'intenta de nuevo'}`);
    }
    finally { setReverting(false); }
  };

  const sorted = [...stages].sort((a, b) => a.orden - b.orden);
  const currentStageIdx = sorted.findIndex(s => s.id === client?.etapa_actual_id);
  const completedIds = sorted.slice(0, currentStageIdx).map(s => s.id);
  const isLastStage = currentStageIdx === sorted.length - 1;
  const isFirstStage = currentStageIdx === 0;

  if (!clientId) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Slide-over */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            {loading ? (
              <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <h2 className="text-lg font-black text-gray-900">{client?.nombre}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{client?.contacto}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  {client?.telefono && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Phone className="w-3 h-3" />{client.telefono}
                    </span>
                  )}
                  {client?.email && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      <Mail className="w-3 h-3" />{client.email}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!loading && client && !client.es_activo && (
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-700">
                En Proceso
              </span>
            )}
            {!loading && client?.es_activo && (
              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-700">
                ✓ Activo
              </span>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Send link bar */}
        {!loading && client && !client.es_activo && canSendPortal && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-medium flex-1">Enviar link de portal al cliente:</span>
            <button onClick={() => handleSendPortalLink('whatsapp')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
              <MessageSquare className="w-3 h-3" /> WhatsApp
            </button>
            <button onClick={() => handleSendPortalLink('email')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              <Mail className="w-3 h-3" /> Email
            </button>
            <button onClick={() => handleSendPortalLink('telegram')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600">
              <Phone className="w-3 h-3" /> Telegram
            </button>
          </div>
        )}

        {/* Stages vertical nav + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Vertical stepper */}
          <div className="w-36 border-r border-gray-100 py-4 flex flex-col gap-1 overflow-y-auto flex-shrink-0">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="mx-2 h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))
            ) : sorted.map((stage, idx) => {
              const isDone = completedIds.includes(stage.id);
              const isCurrent = stage.id === client?.etapa_actual_id;
              const isSelected = idx === activeStageIdx;

              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageIdx(idx)}
                  className={`mx-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isSelected ? 'bg-[#4449AA]/10 text-[#4449AA]' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDone
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      : isCurrent
                      ? <Loader2 className="w-3.5 h-3.5 text-[#4449AA] animate-spin flex-shrink-0" />
                      : <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    }
                    <span className="text-xs font-semibold truncate">{stage.nombre}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stage content */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="space-y-3">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const selectedStage = sorted[activeStageIdx];
              if (!selectedStage || !client) return null;
              const stageWithTypes = {
                ...selectedStage,
                document_types: (selectedStage as any).document_types || [],
              } as ClientPipelineStage & { document_types: ClientStageDocumentType[] };

              const assignedProfile = (selectedStage as any).assigned_profile as TeamMember | null;

              return (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-gray-900">{selectedStage.nombre}</h3>
                    {selectedStage.descripcion && (
                      <p className="text-xs text-gray-500 mt-0.5">{selectedStage.descripcion}</p>
                    )}

                    {/* Responsable — editable */}
                    <div className="flex items-center gap-2 mt-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                      {/* Avatar */}
                      {assignedProfile ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm"
                          style={{ background: selectedStage.color }}
                        >
                          {(assignedProfile.full_name || assignedProfile.email)[0].toUpperCase()}
                        </div>
                      ) : (
                        <UserCircle2 className="w-7 h-7 text-gray-300 flex-shrink-0" />
                      )}

                      {/* Dropdown */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Responsable etapa</p>
                        <select
                          value={selectedStage.assigned_to ?? ''}
                          onChange={e => handleAssignStage(selectedStage.id, e.target.value || null)}
                          disabled={!canManage || savingAssign}
                          className="w-full text-xs font-semibold text-gray-700 bg-transparent border-none outline-none cursor-pointer disabled:cursor-default disabled:opacity-60"
                        >
                          <option value="">Sin responsable</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                          ))}
                        </select>
                      </div>

                      {savingAssign && <Loader2 className="w-3.5 h-3.5 text-[#4449AA] animate-spin flex-shrink-0" />}
                    </div>
                  </div>

                  <StageDocumentUpload
                    stage={stageWithTypes}
                    client={client}
                    documents={documents}
                    onDocumentUploaded={load}
                    readOnly={!canManage}
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer: advance button */}
        {!loading && client && !client.es_activo && canManage && (
          <div className="p-4 border-t border-gray-100 flex gap-2">
            {!isFirstStage && (
              <button
                onClick={handleRevertStage}
                disabled={reverting || advancing}
                title="Regresar a etapa anterior"
                className="flex items-center justify-center px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-all disabled:opacity-50 border border-red-100/50"
              >
                {reverting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regresar etapa'}
              </button>
            )}
            <button
              onClick={handleAdvanceStage}
              disabled={advancing || reverting}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${
                isLastStage
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-[#4449AA] hover:bg-[#3338a0] text-white'
              } disabled:opacity-60`}
            >
              {advancing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : isLastStage
                ? '🎉 Promover a Cliente Activo'
                : <>Completar etapa y avanzar <ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        )}
      </div>
    </>
  );
}
