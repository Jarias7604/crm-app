import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Users,
  Play,
  Square,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { leadsService } from '../../services/leads';
import type { Lead } from '../../types';

interface WhatsAppReactivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
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
  tag: string;
  body: string;
}

const DEFAULT_TEMPLATES: ReactivationTemplate[] = [
  {
    id: 'consultivo_corto',
    label: '1. Pregunta corta consultiva (Recomendada)',
    tag: 'Alta respuesta',
    body: 'Hola {nombre}, le saluda {vendedor} de Arias Defense. Hace un tiempo nos solicitó información sobre nuestro sistema; ¿todavía están evaluando opciones o ya lo resolvieron por ahora?',
  },
  {
    id: 'seguimiento_propuesta',
    label: '2. Seguimiento de propuesta / información',
    tag: 'Seguimiento',
    body: 'Hola {nombre}, le escribe {vendedor}. Quería consultarle brevemente si tuvo oportunidad de revisar la información que conversamos o si le gustaría que ajustemos una propuesta a su necesidad actual.',
  },
  {
    id: 'cierre_expediente',
    label: '3. Cierre amable de expediente',
    tag: 'Respuesta rápida',
    body: 'Hola {nombre}, le saluda {vendedor}. Estoy actualizando las solicitudes pendientes de este mes; ¿mantenemos abierta su consulta o prefiere que la cerremos por el momento?',
  },
  {
    id: 'beneficio_implementacion',
    label: '4. Beneficio especial de reactivación',
    tag: 'Promoción',
    body: 'Hola {nombre}, le saluda {vendedor} de Arias Defense. Esta semana habilitamos condiciones especiales para proyectos pendientes y pensé en comentarle por si aún lo tienen en planes. ¿Le gustaría que lo revisemos?',
  },
];

function normalizeWhatsAppPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  // If 8 digits starting with 2, 6, or 7 (El Salvador local number), prefix 503
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

export const WhatsAppReactivationModal: React.FC<WhatsAppReactivationModalProps> = ({
  isOpen,
  onClose,
  selectedLeads,
  companyId,
  currentUser,
  defaultCampaignName = 'Reactivación WhatsApp',
  onCompleted,
  onGoToWhatsAppChat,
}) => {
  const [campaignName, setCampaignName] = useState(defaultCampaignName);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATES[0].id);
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_TEMPLATES[0].body);
  const [delaySeconds, setDelaySeconds] = useState<number>(10);

  const [isSending, setIsSending] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentLeadName, setCurrentLeadName] = useState<string>('');
  const abortRef = useRef(false);

  const sellerDisplayName = useMemo(() => {
    const raw = (currentUser.full_name || '').trim();
    if (!raw || /^platform\s*owner$/i.test(raw)) return 'Jimmy Arias';
    return raw;
  }, [currentUser.full_name]);

  const validLeads = useMemo(
    () =>
      selectedLeads.filter((l) => {
        const p = normalizeWhatsAppPhone(l.phone);
        return p.length >= 8;
      }),
    [selectedLeads]
  );

  const skippedCount = selectedLeads.length - validLeads.length;

  const renderPersonalizedMessage = (lead: Lead, templateText: string): string => {
    const firstName = extractFirstName(lead.name);
    const company = lead.company_name && lead.company_name !== 'Individual' ? lead.company_name.trim() : '';
    let text = templateText
      .replace(/\{nombre\}/gi, firstName ? firstName : '')
      .replace(/\{empresa\}/gi, company ? company : 'su empresa')
      .replace(/\{vendedor\}/gi, sellerDisplayName);
    // Clean up "Hola ," if lead had no clean first name
    text = text.replace(/Hola\s+,/gi, 'Hola,').replace(/[ \t]{2,}/g, ' ').trim();
    return text;
  };

  const previewText = useMemo(() => {
    const sample = validLeads[0] || {
      id: 'sample',
      name: 'Carlos Mendoza',
      company_name: 'Comercial Mendoza',
    };
    return renderPersonalizedMessage(sample as Lead, messageTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validLeads, messageTemplate, sellerDisplayName]);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: ReactivationTemplate) => {
    setSelectedTemplateId(tpl.id);
    setMessageTemplate(tpl.body);
  };

  const sendSingleLeadReactivation = async (lead: Lead, campaignTag: string) => {
    const normalizedPhone = normalizeWhatsAppPhone(lead.phone);
    if (!normalizedPhone) throw new Error('Teléfono inválido');
    const l8 = normalizedPhone.slice(-8);
    const jid = `${normalizedPhone}@s.whatsapp.net`;
    const nowIso = new Date().toISOString();
    const personalizedText = renderPersonalizedMessage(lead, messageTemplate);

    // 1. Find existing WhatsApp ticket for this lead or phone
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

      // Also register in whatsapp_contacts as lead so future incoming replies route directly to Ventas
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

    // 2. Enqueue the WhatsApp message via the existing send_reply action
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

    // 3. Record follow-up in lead history & bump contact_count / last_follow_up_at
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
    if (validLeads.length === 0 || !messageTemplate.trim()) return;
    setIsSending(true);
    setIsFinished(false);
    setSentCount(0);
    setFailedCount(0);
    abortRef.current = false;

    const cleanCampaignTag = campaignName.trim() || 'Reactivación WhatsApp';
    let ok = 0;
    let fail = 0;

    for (let i = 0; i < validLeads.length; i++) {
      if (abortRef.current) break;
      const lead = validLeads[i];
      setCurrentLeadName(`${lead.name} (${lead.phone})`);

      try {
        await sendSingleLeadReactivation(lead, cleanCampaignTag);
        ok++;
        setSentCount(ok);
      } catch (err) {
        console.warn('[WhatsAppReactivation] Error sending to lead:', lead.id, err);
        fail++;
        setFailedCount(fail);
      }

      if (i < validLeads.length - 1 && !abortRef.current) {
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

  return (
    <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_24px_60px_-15px_rgba(15,23,42,0.25)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#EEF0FF] border-b border-indigo-200/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-2xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Reactivación de Prospectos por WhatsApp</h3>
              <p className="text-xs font-medium text-slate-500">
                Envío gradual personalizado hacia el Chat WhatsApp con atribución de respuesta
              </p>
            </div>
          </div>
          {!isSending && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white text-slate-500 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Summary Bar */}
          <div className="bg-[#F4F6FA] border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-[13px] font-bold text-slate-800">
                {validLeads.length} prospecto{validLeads.length === 1 ? '' : 's'} con teléfono válido
              </span>
              {skippedCount > 0 && (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {skippedCount} omitido{skippedCount === 1 ? '' : 's'} sin teléfono
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Cola Anti-Bloqueo Activa</span>
            </div>
          </div>

          {/* Campaign Name & Pacing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Etiqueta de campaña (para medir respuestas)
              </label>
              <input
                type="text"
                disabled={isSending}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ej. Reactivación +30 días"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Pausa entre cada mensaje (Seguridad WhatsApp)
              </label>
              <select
                disabled={isSending}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] font-semibold text-slate-800 focus:bg-white focus:outline-none"
              >
                <option value={8}>Cada 8 segundos (Lotes pequeños &lt; 20)</option>
                <option value={10}>Cada 10 segundos (Recomendado)</option>
                <option value={15}>Cada 15 segundos (Máxima seguridad)</option>
              </select>
            </div>
          </div>

          {/* Template Picker */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Plantillas conversacionales sin enlaces (evitan reporte de spam)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_TEMPLATES.map((tpl) => {
                const active = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                      active
                        ? 'bg-[#EEF0FF] border-indigo-400 text-indigo-950 shadow-2xs'
                        : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{tpl.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                          active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tpl.tag}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editable Template Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Mensaje a enviar (Variables: <code className="text-indigo-600">{'{nombre}'}</code>,{' '}
                <code className="text-indigo-600">{'{empresa}'}</code>,{' '}
                <code className="text-indigo-600">{'{vendedor}'}</code>)
              </label>
            </div>
            <textarea
              rows={3}
              disabled={isSending}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13.5px] font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Live Preview */}
          <div className="bg-[#F4F6FA] border border-slate-200/80 rounded-xl p-3.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Vista previa en WhatsApp ({validLeads[0]?.name || 'Prospecto'})
            </span>
            <div className="bg-[#DFE3FF] text-slate-900 rounded-xl rounded-br-xs px-3.5 py-2.5 text-[13px] font-medium leading-relaxed max-w-lg">
              {previewText}
            </div>
          </div>

          {/* Progress Box when Sending or Finished */}
          {(isSending || isFinished) && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2.5">
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
                      <span>Proceso completado</span>
                    </>
                  )}
                </span>
                <span className="text-indigo-700">
                  {sentCount} enviados · {failedCount > 0 ? `${failedCount} con error · ` : ''}de {validLeads.length}
                </span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-indigo-100">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round(((sentCount + failedCount) / Math.max(1, validLeads.length)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Tiempo estimado: ~{Math.max(1, Math.ceil((validLeads.length * delaySeconds) / 60))} min para {validLeads.length} prospectos
            </span>
          </div>

          <div className="flex items-center gap-2">
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
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
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
                    <span>Ver en Chat WhatsApp</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={validLeads.length === 0 || !messageTemplate.trim()}
                  onClick={handleStartBatch}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar envío a {validLeads.length} prospectos</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

