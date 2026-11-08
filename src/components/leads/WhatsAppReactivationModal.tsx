import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  Sparkles,
  Users,
  Play,
  Square,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Search,
  Filter,
  Phone,
  CheckSquare,
  Square as SquareIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { leadsService } from '../../services/leads';
import type { Lead } from '../../types';

interface WhatsAppReactivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadsPool: Lead[];
  preSelectedLeadIds?: string[];
  initialInactivityFilter?: 'all' | 'never' | '15d' | '30d' | '60d' | '90d';
  companyId: string;
  currentUser: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  };
  defaultCampaignName?: string;
  onCompleted?: () => void;
  onGoToWhatsAppChat?: () => void;
}

interface ReactivationTemplate {
  id: string;
  label: string;
  subtitle: string;
  tag: string;
  body: string;
}

const DEFAULT_TEMPLATES: ReactivationTemplate[] = [
  {
    id: 'consultivo_corto',
    label: '1. Pregunta corta consultiva',
    subtitle: 'Ideal para prospectos que pidieron información y nunca respondieron',
    tag: 'Recomendada · Alta respuesta',
    body: 'Hola {nombre}, le saluda {vendedor}. Hace un tiempo nos solicitó información sobre nuestros servicios; ¿todavía están evaluando opciones en {empresa} o ya lo resolvieron por ahora?',
  },
  {
    id: 'seguimiento_propuesta',
    label: '2. Seguimiento de propuesta o cotización',
    subtitle: 'Para prospectos calificados o en seguimiento que dejaron de contestar',
    tag: 'Seguimiento comercial',
    body: 'Hola {nombre}, le escribe {vendedor}. Quería consultarle brevemente si tuvo oportunidad de revisar la información que conversamos o si le gustaría que ajustemos una propuesta a su necesidad actual.',
  },
  {
    id: 'cierre_expediente',
    label: '3. Cierre amable de solicitud',
    subtitle: 'Genera respuesta rápida en prospectos fríos de +30 o +60 días',
    tag: 'Respuesta rápida',
    body: 'Hola {nombre}, le saluda {vendedor}. Estoy actualizando las solicitudes pendientes de este mes; ¿mantenemos abierta su consulta o prefiere que la dejemos en pausa por el momento?',
  },
  {
    id: 'beneficio_implementacion',
    label: '4. Beneficio especial de reactivación',
    subtitle: 'Para retomar negociaciones detenidas con una condición especial',
    tag: 'Promoción',
    body: 'Hola {nombre}, le saluda {vendedor}. Esta semana habilitamos condiciones especiales para proyectos pendientes y pensé en comentarle por si aún lo tienen en planes. ¿Le gustaría que lo revisemos?',
  },
];

function normalizeWhatsAppPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8 && /^[267]/.test(digits)) {
    return `503${digits}`;
  }
  return digits.length >= 8 ? digits : '';
}

function extractFirstName(fullName?: string | null): string {
  const clean = String(fullName || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean || /^(contacto|cliente|prospecto|lead)\b/i.test(clean)) return '';
  return clean.split(/\s+/)[0];
}

function getDaysInactive(lead: Lead): { days: number; neverContacted: boolean; label: string } {
  const cCount = Number(lead.contact_count || 0);
  const lastTouch = lead.last_follow_up_at || lead.created_at;
  const days = lastTouch
    ? Math.max(0, Math.floor((Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const neverContacted = cCount === 0 && !lead.last_follow_up_at;
  if (neverContacted) {
    return { days, neverContacted: true, label: `Sin contacto (${days}d)` };
  }
  return { days, neverContacted: false, label: `Hace ${days}d` };
}

export const WhatsAppReactivationModal: React.FC<WhatsAppReactivationModalProps> = ({
  isOpen,
  onClose,
  leadsPool,
  preSelectedLeadIds = [],
  initialInactivityFilter = 'all',
  companyId,
  currentUser,
  defaultCampaignName = 'Reactivación WhatsApp',
  onCompleted,
  onGoToWhatsAppChat,
}) => {
  const [inactivityFilter, setInactivityFilter] = useState<'all' | 'never' | '15d' | '30d' | '60d' | '90d'>(
    initialInactivityFilter
  );
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [batchLimit, setBatchLimit] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [campaignName, setCampaignName] = useState(defaultCampaignName);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATES[0].id);
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_TEMPLATES[0].body);
  const [delaySeconds, setDelaySeconds] = useState<number>(10);

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [sentLeadIds, setSentLeadIds] = useState<Set<string>>(new Set());
  const [currentLeadName, setCurrentLeadName] = useState<string>('');
  const abortRef = useRef(false);

  useEffect(() => {
    setInactivityFilter(initialInactivityFilter);
  }, [initialInactivityFilter]);

  const sellerDisplayName = useMemo(() => {
    const raw = (currentUser.full_name || '').trim();
    if (!raw || /^platform\s*owner$/i.test(raw)) return 'Jimmy Arias';
    return raw;
  }, [currentUser.full_name]);

  // Base pool: if user manually checked specific rows on the table, respect that pool; otherwise use all leads in view with valid phone
  const baseLeadsWithPhone = useMemo(() => {
    const source =
      preSelectedLeadIds.length > 0 && preSelectedLeadIds.length < leadsPool.length
        ? leadsPool.filter((l) => preSelectedLeadIds.includes(l.id))
        : leadsPool;

    return source.filter((l) => {
      if (l.status === 'Cerrado' || l.status === 'Perdido' || l.status === 'Erróneo') return false;
      const p = normalizeWhatsAppPhone(l.phone);
      return p.length >= 8;
    });
  }, [leadsPool, preSelectedLeadIds]);

  // Filtered by inactivity + stage + search
  const matchingLeads = useMemo(() => {
    return baseLeadsWithPhone.filter((l) => {
      const info = getDaysInactive(l);
      if (inactivityFilter === 'never' && !info.neverContacted) return false;
      if (inactivityFilter === '15d' && info.days < 15) return false;
      if (inactivityFilter === '30d' && info.days < 30) return false;
      if (inactivityFilter === '60d' && info.days < 60) return false;
      if (inactivityFilter === '90d' && info.days < 90) return false;

      if (stageFilter !== 'all' && l.status !== stageFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (l.name || '').toLowerCase().includes(q);
        const matchComp = (l.company_name || '').toLowerCase().includes(q);
        const matchPhone = (l.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchPhone) return false;
      }
      return true;
    });
  }, [baseLeadsWithPhone, inactivityFilter, stageFilter, searchQuery]);

  // Apply batch limit (e.g. 25, 50, 100, or all)
  const limitedLeads = useMemo(() => {
    if (batchLimit <= 0) return matchingLeads;
    return matchingLeads.slice(0, batchLimit);
  }, [matchingLeads, batchLimit]);

  // Final active leads to send (excluding unchecked rows)
  const activeBatchLeads = useMemo(
    () => limitedLeads.filter((l) => !excludedIds.has(l.id)),
    [limitedLeads, excludedIds]
  );

  // Counts per inactivity bucket for quick badges
  const bucketCounts = useMemo(() => {
    let never = 0;
    let d15 = 0;
    let d30 = 0;
    let d60 = 0;
    let d90 = 0;
    for (const l of baseLeadsWithPhone) {
      if (stageFilter !== 'all' && l.status !== stageFilter) continue;
      const info = getDaysInactive(l);
      if (info.neverContacted) never++;
      if (info.days >= 15) d15++;
      if (info.days >= 30) d30++;
      if (info.days >= 60) d60++;
      if (info.days >= 90) d90++;
    }
    return { all: baseLeadsWithPhone.length, never, d15, d30, d60, d90 };
  }, [baseLeadsWithPhone, stageFilter]);

  const renderPersonalizedMessage = (lead: Lead, templateText: string): string => {
    const firstName = extractFirstName(lead.name);
    const company =
      lead.company_name && lead.company_name !== 'Individual' ? lead.company_name.trim() : 'su empresa';
    let text = templateText
      .replace(/\{nombre\}/gi, firstName ? firstName : '')
      .replace(/\{empresa\}/gi, company)
      .replace(/\{vendedor\}/gi, sellerDisplayName);
    text = text.replace(/Hola\s+,/gi, 'Hola,').replace(/[ \t]{2,}/g, ' ').trim();
    return text;
  };

  const previewLead = useMemo(() => {
    if (previewLeadId) {
      const found = limitedLeads.find((l) => l.id === previewLeadId);
      if (found) return found;
    }
    return (
      activeBatchLeads[0] ||
      limitedLeads[0] ||
      ({
        id: 'sample',
        name: 'Carlos Mendoza',
        company_name: 'Comercial Mendoza',
      } as Lead)
    );
  }, [previewLeadId, activeBatchLeads, limitedLeads]);

  const previewText = useMemo(
    () => renderPersonalizedMessage(previewLead, messageTemplate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewLead, messageTemplate, sellerDisplayName]
  );

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: ReactivationTemplate) => {
    setSelectedTemplateId(tpl.id);
    setMessageTemplate(tpl.body);
  };

  const toggleLeadCheckbox = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (activeBatchLeads.length === limitedLeads.length) {
      // Deselect all visible
      setExcludedIds(new Set(limitedLeads.map((l) => l.id)));
    } else {
      setExcludedIds(new Set());
    }
  };

  const sendSingleLeadReactivation = async (lead: Lead, campaignTag: string) => {
    const normalizedPhone = normalizeWhatsAppPhone(lead.phone);
    if (!normalizedPhone) throw new Error('Teléfono inválido');
    const l8 = normalizedPhone.slice(-8);
    const jid = `${normalizedPhone}@s.whatsapp.net`;
    const nowIso = new Date().toISOString();
    const personalizedText = renderPersonalizedMessage(lead, messageTemplate);

    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, metadata, lead_id, assigned_to')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .order('updated_at', { ascending: false })
      .limit(200);

    const existingTicket = (existingTickets || []).find((t: any) => {
      const m = t.metadata || {};
      if (m.merged_into || m.is_group) return false;
      if (lead.id && t.lead_id === lead.id) return true;
      const tPhone = String(m.whatsapp_phone || '').replace(/\D/g, '');
      return tPhone.length >= 8 && tPhone.slice(-8) === l8;
    });

    let ticketId: string;

    if (existingTicket) {
      ticketId = existingTicket.id;
      const curMeta = (existingTicket.metadata || {}) as Record<string, any>;
      await supabase
        .from('tickets')
        .update({
          lead_id: lead.id,
          lead_name: lead.name,
          assigned_to: existingTicket.assigned_to || lead.assigned_to || currentUser.id,
          updated_at: nowIso,
          metadata: {
            ...curMeta,
            wa_scope: curMeta.wa_scope === 'soporte' ? 'soporte' : 'lead',
            whatsapp_phone: curMeta.whatsapp_phone || normalizedPhone,
            whatsapp_jid: curMeta.whatsapp_jid || jid,
            wa_reactivation: true,
            wa_reactivation_campaign: campaignTag,
            wa_reactivation_sent_at: nowIso,
            wa_reactivation_by: currentUser.id,
            wa_reactivation_by_name: sellerDisplayName,
            wa_attended_at: nowIso,
          },
        })
        .eq('id', ticketId);
    } else {
      const { data: createdTicket, error: createErr } = await supabase
        .from('tickets')
        .insert({
          company_id: companyId,
          title: `[WhatsApp · Lead] ${lead.name || `+${normalizedPhone}`}`,
          description: `Reactivación comercial por WhatsApp (${campaignTag})`,
          status: 'open',
          priority: 'medium',
          lead_id: lead.id,
          lead_name: lead.name,
          assigned_to: lead.assigned_to || currentUser.id,
          metadata: {
            source: 'whatsapp_evolution',
            wa_scope: 'lead',
            support_channel: 'ventas',
            ai_category: 'Ventas / Reactivación Lead',
            whatsapp_phone: normalizedPhone,
            whatsapp_jid: jid,
            evolution_instance: 'soporte',
            wa_reactivation: true,
            wa_reactivation_campaign: campaignTag,
            wa_reactivation_sent_at: nowIso,
            wa_reactivation_by: currentUser.id,
            wa_reactivation_by_name: sellerDisplayName,
            wa_attended_at: nowIso,
          },
        })
        .select('id')
        .single();

      if (createErr || !createdTicket?.id) {
        throw new Error(createErr?.message || 'No se pudo crear la conversación de WhatsApp');
      }
      ticketId = createdTicket.id;

      try {
        await supabase.from('whatsapp_contacts').upsert(
          {
            company_id: companyId,
            phone: normalizedPhone,
            display_name: lead.name,
            contact_type: 'lead',
            lead_id: lead.id,
            classified_by: currentUser.id,
            classified_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: 'company_id,phone' }
        );
      } catch {
        // non-blocking
      }
    }

    const { data: sendRes, error: sendErr } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
      body: {
        action: 'send_reply',
        ticket_id: ticketId,
        message_text: personalizedText,
        response_minutes: 1,
      },
    });
    if (sendErr || (sendRes && sendRes.ok === false)) {
      throw new Error(sendErr?.message || sendRes?.error || 'Error al encolar mensaje WhatsApp');
    }

    try {
      await leadsService.createFollowUp({
        lead_id: lead.id,
        action_type: 'whatsapp' as any,
        notes: `[${campaignTag}] Mensaje enviado por WhatsApp: "${personalizedText.slice(0, 180)}"`,
        date: nowIso,
      });
      await supabase
        .from('leads')
        .update({
          last_follow_up_at: nowIso,
          contact_count: Number(lead.contact_count || 0) + 1,
        })
        .eq('id', lead.id);
    } catch {
      // non-blocking
    }
  };

  const handleStartBatch = async () => {
    if (activeBatchLeads.length === 0 || !messageTemplate.trim()) return;
    setIsSending(true);
    setIsFinished(false);
    setSentCount(0);
    setFailedCount(0);
    abortRef.current = false;

    const cleanCampaignTag = campaignName.trim() || 'Reactivación WhatsApp';
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < activeBatchLeads.length; i++) {
      if (abortRef.current) break;
      const lead = activeBatchLeads[i];
      setCurrentLeadName(`${lead.name} (${lead.phone})`);

      try {
        await sendSingleLeadReactivation(lead, cleanCampaignTag);
        ok++;
        setSentCount(ok);
        setSentLeadIds((prev) => new Set(prev).add(lead.id));
      } catch (err) {
        console.warn('[WhatsAppReactivation] Error sending to lead:', lead.id, err);
        fail++;
        setFailedCount(fail);
      }

      if (i < activeBatchLeads.length - 1 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    setIsSending(false);
    setIsFinished(true);
    setCurrentLeadName('');
    if (ok > 0) {
      toast.success(`Reactivación enviada a ${ok} prospecto${ok === 1 ? '' : 's'}`);
      onCompleted?.();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    toast('Deteniendo cola de envío…');
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}${variable}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-[80] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_24px_60px_-15px_rgba(15,23,42,0.28)] max-w-6xl w-full overflow-hidden flex flex-col h-[88vh] max-h-[820px]">
        {/* ── HEADER ── */}
        <div className="px-6 py-3.5 bg-[#EEF0FF] border-b border-indigo-200/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">
                Motor de Reactivación de Prospectos por WhatsApp
              </h3>
              <p className="text-xs font-medium text-slate-500">
                1. Filtra quiénes no han respondido · 2. Revisa la lista · 3. Envía con plantilla y mide respuestas en el Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cola Anti-Bloqueo Activa</span>
            </div>
            {!isSending && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 text-slate-500 border border-slate-200/80 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── STEP 1: TOP SEGMENTATION BAR (Inactivity + Status + Safe Batch Size) ── */}
        <div className="px-6 py-3 bg-[#F8F9FC] border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Inactivity Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Tiempo sin respuesta:
            </span>
            {(
              [
                { id: 'all', label: `Todos (${bucketCounts.all})` },
                { id: 'never', label: `Sin contacto (${bucketCounts.never})` },
                { id: '15d', label: `+15 días (${bucketCounts.d15})` },
                { id: '30d', label: `+30 días (${bucketCounts.d30})` },
                { id: '60d', label: `+60 días (${bucketCounts.d60})` },
                { id: '90d', label: `+90 días (${bucketCounts.d90})` },
              ] as const
            ).map((opt) => {
              const active = inactivityFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSending}
                  onClick={() => {
                    setInactivityFilter(opt.id);
                    setExcludedIds(new Set());
                    if (opt.id === 'never') setCampaignName('Reactivación Sin Contacto');
                    else if (opt.id !== 'all') setCampaignName(`Reactivación +${opt.id.replace('d', ' días')}`);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs transition ${
                    active
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Stage & Batch Size Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              disabled={isSending}
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setExcludedIds(new Set());
              }}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Todas las etapas</option>
              <option value="Prospecto">Etapa: Prospecto</option>
              <option value="Llamada fría">Etapa: Llamada fría</option>
              <option value="Calificado">Etapa: Calificado</option>
              <option value="En seguimiento">Etapa: En seguimiento</option>
              <option value="Negociación">Etapa: Negociación</option>
            </select>

            <select
              disabled={isSending}
              value={batchLimit}
              onChange={(e) => {
                setBatchLimit(Number(e.target.value));
                setExcludedIds(new Set());
              }}
              className="px-3 py-1.5 rounded-xl bg-[#EEF0FF] border border-indigo-200 text-xs font-bold text-indigo-800 focus:outline-none"
            >
              <option value={20}>Lote seguro: 20 prospectos</option>
              <option value={30}>Lote recomendado: 30 prospectos</option>
              <option value={50}>Lote mediano: 50 prospectos</option>
              <option value={100}>Lote amplio: 100 prospectos</option>
              <option value={0}>Mostrar todos ({matchingLeads.length})</option>
            </select>
          </div>
        </div>

        {/* ── MAIN 2-COLUMN WORKSPACE ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
          {/* ── LEFT COLUMN (5 cols): ORGANIZED PROSPECT LIST ── */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-white">
            {/* List Header & Search */}
            <div className="p-3.5 border-b border-slate-100 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-[13px] font-bold text-slate-900">
                    Destinatarios seleccionados ({activeBatchLeads.length})
                  </h4>
                </div>
                <button
                  type="button"
                  disabled={isSending || limitedLeads.length === 0}
                  onClick={toggleSelectAllVisible}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                >
                  {activeBatchLeads.length === limitedLeads.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar prospecto por nombre, empresa o teléfono..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Scrollable Prospect Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {limitedLeads.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Users className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">
                    No hay prospectos con teléfono en este filtro.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Prueba cambiar el filtro de tiempo sin respuesta o etapa arriba.
                  </p>
                </div>
              ) : (
                limitedLeads.map((lead, idx) => {
                  const isIncluded = !excludedIds.has(lead.id);
                  const isPreviewed = previewLead.id === lead.id;
                  const wasSent = sentLeadIds.has(lead.id);
                  const inactivity = getDaysInactive(lead);
                  const cleanPhone = normalizeWhatsAppPhone(lead.phone);

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setPreviewLeadId(lead.id)}
                      className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition ${
                        isPreviewed
                          ? 'bg-[#EEF0FF]/70'
                          : isIncluded
                          ? 'bg-white hover:bg-slate-50/80'
                          : 'bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLeadCheckbox(lead.id);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 shrink-0"
                        >
                          {isIncluded ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <SquareIcon className="w-4 h-4 text-slate-300" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400">{idx + 1}.</span>
                            <span className="text-[13px] font-bold text-slate-900 truncate">
                              {lead.name}
                            </span>
                            {wasSent && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Enviado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="inline-flex items-center gap-0.5 font-medium text-slate-600">
                              <Phone className="w-2.5 h-2.5 text-emerald-600" />+{cleanPhone}
                            </span>
                            {lead.company_name && lead.company_name !== 'Individual' && (
                              <span className="truncate max-w-[120px]">· {lead.company_name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {lead.status}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            inactivity.neverContacted
                              ? 'bg-rose-50 text-rose-700'
                              : inactivity.days >= 30
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {inactivity.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {matchingLeads.length > limitedLeads.length && (
              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200/70 text-[11px] font-medium text-slate-500 flex items-center justify-between">
                <span>
                  Mostrando lote de <b>{limitedLeads.length}</b> de <b>{matchingLeads.length}</b> prospectos filtrados
                </span>
                <button
                  type="button"
                  onClick={() => setBatchLimit(0)}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Ver todos
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (7 cols): TEMPLATES, MESSAGE EDITOR & LIVE PREVIEW ── */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#FAFBFD] overflow-y-auto p-5 space-y-4">
            {/* Step 2 Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <h4 className="text-[13px] font-bold text-slate-900">
                  Elige una plantilla conversacional (sin enlaces para máxima entrega)
                </h4>
              </div>
            </div>

            {/* Clean Full-Text Template Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEFAULT_TEMPLATES.map((tpl) => {
                const active = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 ${
                      active
                        ? 'bg-[#EEF0FF] border-indigo-400 text-indigo-950 shadow-2xs'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug">{tpl.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tpl.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{tpl.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Message Editor + Clickable Variable Pills */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Personalizar mensaje a enviar
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Insertar variable:</span>
                  {(['{nombre}', '{empresa}', '{vendedor}'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={isSending}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold transition"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                disabled={isSending}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Live WhatsApp Preview */}
            <div className="bg-[#F3F4F8] border border-slate-200/90 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Vista previa en WhatsApp para: <b className="text-slate-800">{previewLead.name}</b>
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  Haz clic en cualquier prospecto de la izquierda para previsualizar
                </span>
              </div>
              <div className="bg-[#DFE3FF] text-slate-900 rounded-xl rounded-br-xs px-3.5 py-2.5 text-[13px] font-medium leading-relaxed shadow-2xs">
                {previewText}
              </div>
            </div>

            {/* Step 3: Campaign Tag & Anti-Ban Pacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white border border-slate-200/90 rounded-xl p-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  3. Etiqueta de campaña (para medir respuestas)
                </label>
                <input
                  type="text"
                  disabled={isSending}
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ej. Reactivación +30 días"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="bg-white border border-slate-200/90 rounded-xl p-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Pausa de seguridad entre cada envío
                </label>
                <select
                  disabled={isSending}
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                >
                  <option value={8}>Cada 8 segundos (Lotes pequeños &lt; 25)</option>
                  <option value={10}>Cada 10 segundos (Recomendado)</option>
                  <option value={15}>Cada 15 segundos (Máxima seguridad)</option>
                </select>
              </div>
            </div>

            {/* Live Progress Box when Sending or Finished */}
            {(isSending || isFinished) && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-2">
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        <span>Enviando a: {currentLeadName}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Envío completado con éxito</span>
                      </>
                    )}
                  </span>
                  <span className="text-indigo-700">
                    {sentCount} enviados · {failedCount > 0 ? `${failedCount} con error · ` : ''}de{' '}
                    {activeBatchLeads.length}
                  </span>
                </div>
                <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((sentCount + failedCount) / Math.max(1, activeBatchLeads.length)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span>
              Se enviarán <b>{activeBatchLeads.length}</b> mensajes personalizados · Tiempo estimado:{' '}
              <b>~{Math.max(1, Math.ceil((activeBatchLeads.length * delaySeconds) / 60))} min</b>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {isSending ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Detener envío</span>
              </button>
            ) : isFinished ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cerrar
                </button>
                {onGoToWhatsAppChat && (
                  <button
                    type="button"
                    onClick={onGoToWhatsAppChat}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver respuestas en Chat WhatsApp</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={activeBatchLeads.length === 0 || !messageTemplate.trim()}
                  onClick={handleStartBatch}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar envío a {activeBatchLeads.length} prospectos</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
