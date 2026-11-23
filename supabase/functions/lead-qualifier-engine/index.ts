import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_FIRST_TOUCH_TEMPLATE,
  DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
  DEFAULT_HANDOFF_BUSINESS_REPLY,
  DEFAULT_HANDOFF_KEYWORDS,
  DEFAULT_PAIN_PLAYBOOKS,
  DEFAULT_QUALIFIER_SYSTEM_PROMPT,
  DEFAULT_TZ,
  buildAdvisorWhatsAppAlert,
  detectExplicitHandoffIntent,
  extractLeadFirstName,
  generateAvailableDemoSlots,
  isWithinBusinessHours,
  matchPainPlaybook,
  parseQualifierAiJson,
  renderFirstTouchMessage,
  selectNextAdvisorFromRules,
  type BusinessHoursConfig,
  type DemoSlot,
  type PainPlaybook,
  type RoutingRuleLike,
} from './helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sheets-sync-secret',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeWaDigits(raw?: string | null): string {
  const d = String(raw || '').replace(/\D+/g, '');
  if (!d) return '';
  if (d.length === 8 && /^[267]/.test(d)) return `503${d}`;
  return d;
}

function formatSvTime(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('es-SV', {
      timeZone: DEFAULT_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

interface AuthContext {
  isInternal: boolean;
  userId: string | null;
  companyId: string | null;
  isPlatformAdmin: boolean;
  fullName: string;
}

async function resolveAuth(req: Request, supabase: any): Promise<AuthContext | null> {
  const configuredSecret = (Deno.env.get('SHEETS_SYNC_SECRET') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const reqSecret = (req.headers.get('x-sheets-sync-secret') || '').trim();
  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (
    (configuredSecret && reqSecret === configuredSecret) ||
    (serviceKey && (reqSecret === serviceKey || bearer === serviceKey))
  ) {
    return {
      isInternal: true,
      userId: null,
      companyId: null,
      isPlatformAdmin: true,
      fullName: 'Sistema CRM',
    };
  }

  if (!bearer) return null;
  const { data: userData, error } = await supabase.auth.getUser(bearer);
  if (error || !userData?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id, role, is_active, is_platform_owner, full_name')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;
  const isPlatformAdmin = profile.role === 'super_admin' || profile.is_platform_owner === true;

  return {
    isInternal: false,
    userId: profile.id,
    companyId: profile.company_id || null,
    isPlatformAdmin,
    fullName: String(profile.full_name || 'Asesor CRM'),
  };
}

function canAccessCompany(auth: AuthContext, targetCompanyId: string | null | undefined): boolean {
  if (!targetCompanyId) return false;
  if (auth.isInternal || auth.isPlatformAdmin) return true;
  return Boolean(auth.companyId && auth.companyId === targetCompanyId);
}

interface NormalizedConfig {
  company_id: string;
  is_enabled: boolean;
  mode: 'draft' | 'auto';
  response_24_7: boolean;
  allowed_sources: string[];
  max_ai_turns: number;
  timezone: string;
  business_hours: BusinessHoursConfig;
  system_prompt: string;
  first_touch_template: string;
  handoff_reply_business_hours: string;
  handoff_reply_after_hours: string;
  handoff_keywords: string[];
  pain_playbooks: PainPlaybook[];
  demo_duration_minutes: number;
  demo_buffer_minutes: number;
  notify_on_urgent_intake: boolean;
  notify_on_handoff: boolean;
  notify_on_demo_booked: boolean;
  notify_advisors_24_7: boolean;
  notify_channels: { whatsapp: boolean; crm_alert: boolean; email: boolean };
  sla_escalation_minutes: number;
  sla_backup_user_id: string | null;
  crm_base_url: string;
}

async function loadCompanyConfig(supabase: any, companyId: string): Promise<NormalizedConfig> {
  const { data } = await supabase
    .from('lead_qualifier_configs')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  return {
    company_id: companyId,
    is_enabled: Boolean(data?.is_enabled ?? false),
    mode: data?.mode === 'auto' ? 'auto' : 'draft',
    response_24_7: typeof data?.response_24_7 === 'boolean' ? data.response_24_7 : true,
    allowed_sources:
      Array.isArray(data?.allowed_sources) && data.allowed_sources.length > 0
        ? data.allowed_sources
        : ['facebook_ads', 'google_sheets'],
    max_ai_turns: Math.max(1, Math.min(20, Number(data?.max_ai_turns) || 6)),
    timezone: String(data?.timezone || DEFAULT_TZ),
    business_hours: {
      ...DEFAULT_BUSINESS_HOURS,
      ...(data?.business_hours && typeof data.business_hours === 'object' ? data.business_hours : {}),
    },
    system_prompt: String(data?.system_prompt || '').trim() || DEFAULT_QUALIFIER_SYSTEM_PROMPT,
    first_touch_template: String(data?.first_touch_template || '').trim() || DEFAULT_FIRST_TOUCH_TEMPLATE,
    handoff_reply_business_hours:
      String(data?.handoff_reply_business_hours || '').trim() || DEFAULT_HANDOFF_BUSINESS_REPLY,
    handoff_reply_after_hours:
      String(data?.handoff_reply_after_hours || '').trim() || DEFAULT_HANDOFF_AFTER_HOURS_REPLY,
    handoff_keywords:
      Array.isArray(data?.handoff_keywords) && data.handoff_keywords.length > 0
        ? data.handoff_keywords
        : DEFAULT_HANDOFF_KEYWORDS,
    pain_playbooks:
      Array.isArray(data?.pain_playbooks) && data.pain_playbooks.length > 0
        ? data.pain_playbooks
        : DEFAULT_PAIN_PLAYBOOKS,
    demo_duration_minutes: Math.max(15, Math.min(120, Number(data?.demo_duration_minutes) || 30)),
    demo_buffer_minutes: Math.max(0, Math.min(60, Number(data?.demo_buffer_minutes ?? 15))),
    notify_on_urgent_intake: Boolean(data?.notify_on_urgent_intake ?? false),
    notify_on_handoff: typeof data?.notify_on_handoff === 'boolean' ? data.notify_on_handoff : true,
    notify_on_demo_booked: typeof data?.notify_on_demo_booked === 'boolean' ? data.notify_on_demo_booked : true,
    notify_advisors_24_7: typeof data?.notify_advisors_24_7 === 'boolean' ? data.notify_advisors_24_7 : true,
    notify_channels: {
      whatsapp: data?.notify_channels?.whatsapp ?? true,
      crm_alert: data?.notify_channels?.crm_alert ?? true,
      email: Boolean(data?.notify_channels?.email ?? false),
    },
    sla_escalation_minutes: Math.max(1, Math.min(240, Number(data?.sla_escalation_minutes) || 15)),
    sla_backup_user_id: data?.sla_backup_user_id || null,
    crm_base_url: String(data?.crm_base_url || 'https://ariascrm.com').replace(/\/+$/, ''),
  };
}

function isSourceAllowed(allowedSources: string[], rawSource?: string | null): boolean {
  const allowed = (allowedSources || []).map((s) => s.toLowerCase().trim()).filter(Boolean);
  if (allowed.length === 0 || allowed.includes('all')) return true;
  const norm = String(rawSource || '').toLowerCase().trim();
  if (!norm) return allowed.includes('google_sheets') || allowed.includes('facebook_ads');
  if (allowed.includes(norm)) return true;
  if (norm.includes('sheet') && allowed.includes('google_sheets')) return true;
  if ((norm.includes('facebook') || norm.includes('meta') || norm.includes('fb')) && allowed.includes('facebook_ads')) {
    return true;
  }
  return false;
}

function findFieldValue(fields: Record<string, any> | undefined, aliases: string[]): string {
  if (!fields || typeof fields !== 'object') return '';
  const entries = Object.entries(fields);
  const normAliases = aliases.map((a) =>
    a
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim(),
  );
  for (const [k, v] of entries) {
    const nk = k
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (normAliases.some((a) => nk === a || nk.includes(a))) {
      const s = String(v ?? '').trim();
      if (s && s !== '—' && s !== '-') return s;
    }
  }
  return '';
}

function extractLeadDiagnostic(lead: any, productLabel: string | null) {
  const fields = (lead?.raw_meta_payload?.fields || {}) as Record<string, any>;
  const notesBlock = `${lead?.next_action_notes || ''}\n${lead?.notes || ''}`;
  const noteMatch = (label: string) => {
    const m = notesBlock.match(new RegExp(`${label}\\s*:\\s*([^\\n|]+)`, 'i'));
    return m ? m[1].trim() : '';
  };

  const painText =
    findFieldValue(fields, ['PUNTO DE MEJORA', 'AREA DE MEJORA', 'NECESIDAD']) ||
    noteMatch('Punto de Mejora') ||
    '';
  const urgencyText =
    findFieldValue(fields, ['URGENCIA DE PROJECTO', 'URGENCIA DE PROYECTO', 'URGENCIA', 'PLAZO']) ||
    noteMatch('Urgencia') ||
    '';
  const volumeText =
    findFieldValue(fields, ['FACTURAS ANUAL', 'FACTURAS ANUALES']) ||
    noteMatch('Facturas anuales') ||
    '';
  const roleTitle =
    findFieldValue(fields, ['CARGO', 'PUESTO', 'ROL']) ||
    noteMatch('Cargo') ||
    '';
  const methodText =
    findFieldValue(fields, ['METODO DE GESTION ACTUAL', 'METODO ACTUAL']) || '';
  const projectsText =
    findFieldValue(fields, ['CANTIDAD DE PROYECTOS DISPONIBLES', 'PROYECTOS DISPONIBLES']) || '';
  const adName =
    String(lead?.meta_campaign_name || '') ||
    findFieldValue(fields, ['ANUNCIO DE CONVERSION', 'ANUNCIO', 'CAMPAIGN']) ||
    '';
  const comments =
    findFieldValue(fields, ['COMENTARIOS SOBRE PROSPECTO', 'COMENTARIOS', 'NOTAS']) || '';

  return {
    productLabel,
    painText,
    urgencyText,
    volumeText,
    roleTitle,
    methodText,
    projectsText,
    adName,
    comments,
  };
}

function isUrgentIntake(urgencyText: string, priority?: string | null): boolean {
  if (priority === 'very_high') return true;
  return /\b(lo antes posible|inmediato|urgente|esta semana|hoy|ya)\b/i.test(urgencyText || '');
}

async function resolveEvolutionInstance(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from('whatsapp_bridge_state')
      .select('value')
      .eq('key', 'evolution')
      .maybeSingle();
    const inst = String(data?.value?.instance || '').trim();
    if (inst) return inst;
  } catch {
    // fallback
  }
  return 'soporte';
}

async function loadOpenAiKey(supabase: any, companyId: string): Promise<string> {
  const { data: rows } = await supabase
    .from('marketing_integrations')
    .select('company_id, settings, is_active')
    .eq('provider', 'openai')
    .eq('is_active', true);

  if (Array.isArray(rows) && rows.length > 0) {
    const own = rows.find((r: any) => r.company_id === companyId && r.settings?.apiKey);
    if (own?.settings?.apiKey) return String(own.settings.apiKey).trim();
    const anyRow = rows.find((r: any) => r.settings?.apiKey);
    if (anyRow?.settings?.apiKey) return String(anyRow.settings.apiKey).trim();
  }
  return String(Deno.env.get('OPENAI_API_KEY') || '').trim();
}

async function ensureLeadTicket(
  supabase: any,
  companyId: string,
  lead: any,
  activeFlag: boolean,
  qualifierStatus: string,
): Promise<{ ticketId: string; metadata: Record<string, any> } | null> {
  const digits = normalizeWaDigits(lead?.phone);
  if (!digits) return null;
  const jid = `${digits}@s.whatsapp.net`;

  const { data: existingByLead } = await supabase
    .from('tickets')
    .select('id, metadata, status')
    .eq('company_id', companyId)
    .eq('lead_id', lead.id)
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existing = existingByLead || (
    await supabase
      .from('tickets')
      .select('id, metadata, status')
      .eq('company_id', companyId)
      .eq('metadata->>whatsapp_jid', jid)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data;

  if (existing?.id) {
    const nextMeta = {
      ...(existing.metadata || {}),
      wa_scope: 'lead',
      wa_scope_locked: true,
      support_channel: 'ventas',
      ai_qualifier_enrolled: true,
      ai_qualifier_active: activeFlag,
      ai_qualifier_status: qualifierStatus,
    };
    await supabase
      .from('tickets')
      .update({
        lead_id: lead.id,
        lead_name: lead.name,
        status: existing.status === 'closed' ? 'open' : existing.status,
        metadata: nextMeta,
      })
      .eq('id', existing.id);
    return { ticketId: existing.id, metadata: nextMeta };
  }

  const instance = await resolveEvolutionInstance(supabase);
  const initMeta = {
    source: 'whatsapp_evolution',
    whatsapp_jid: jid,
    whatsapp_phone: digits,
    whatsapp_instance: instance,
    wa_scope: 'lead',
    wa_scope_locked: true,
    wa_scope_reason: 'lead_qualifier_enrolled',
    support_channel: 'ventas',
    is_existing_client: false,
    is_technical_ticket: false,
    whatsapp_message_count: 0,
    ai_qualifier_enrolled: true,
    ai_qualifier_active: activeFlag,
    ai_qualifier_status: qualifierStatus,
  };

  const { data: created, error: cErr } = await supabase
    .from('tickets')
    .insert({
      company_id: companyId,
      lead_id: lead.id,
      lead_name: lead.name,
      assigned_to: lead.assigned_to || null,
      title: `[WhatsApp · Lead] ${lead.name}`,
      description: `Calificador Comercial IA · ${lead.company_name || lead.name}\n\n💬 Historial de WhatsApp:`,
      status: 'open',
      priority: lead.priority || 'medium',
      metadata: initMeta,
    })
    .select('id, metadata')
    .single();

  if (cErr) {
    if (String(cErr.code) === '23505') {
      const { data: winner } = await supabase
        .from('tickets')
        .select('id, metadata')
        .eq('company_id', companyId)
        .eq('metadata->>whatsapp_jid', jid)
        .in('status', ['new', 'open', 'pending'])
        .maybeSingle();
      if (winner?.id) return { ticketId: winner.id, metadata: winner.metadata || initMeta };
    }
    throw cErr;
  }

  return { ticketId: created.id, metadata: created.metadata || initMeta };
}

async function enqueueLeadWhatsApp(
  supabase: any,
  input: {
    companyId: string;
    lead: any;
    text: string;
    activeAfter: boolean;
    qualifierStatus: string;
    actorUserId?: string | null;
    existingTicketId?: string | null;
  },
): Promise<{ ticketId: string | null; outboxId: string | null; metaPatch: Record<string, any> }> {
  const digits = normalizeWaDigits(input.lead?.phone);
  if (!digits || !input.text.trim()) {
    return { ticketId: input.existingTicketId || null, outboxId: null, metaPatch: {} };
  }
  const jid = `${digits}@s.whatsapp.net`;
  const instance = await resolveEvolutionInstance(supabase);

  let ticketId = input.existingTicketId || null;
  let currentMeta: Record<string, any> = {};
  if (ticketId) {
    const { data: tRow } = await supabase
      .from('tickets')
      .select('id, metadata')
      .eq('id', ticketId)
      .maybeSingle();
    currentMeta = (tRow?.metadata || {}) as Record<string, any>;
  } else {
    const ensured = await ensureLeadTicket(
      supabase,
      input.companyId,
      input.lead,
      input.activeAfter,
      input.qualifierStatus,
    );
    ticketId = ensured?.ticketId || null;
    currentMeta = ensured?.metadata || {};
  }

  const nowIso = new Date().toISOString();
  const metaPatch = {
    ai_qualifier_enrolled: true,
    ai_qualifier_active: input.activeAfter,
    ai_qualifier_status: input.qualifierStatus,
    last_message_at: nowIso,
    whatsapp_message_count: Number(currentMeta.whatsapp_message_count || 0) + 1,
  };

  let commentId: string | null = null;
  if (ticketId) {
    await supabase
      .from('tickets')
      .update({
        metadata: { ...currentMeta, ...metaPatch },
        updated_at: nowIso,
      })
      .eq('id', ticketId);

    const { data: comment } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: ticketId,
        company_id: input.companyId,
        author_id: input.actorUserId || null,
        body: `[${formatSvTime()}] 👨‍💻 Calificador IA: ${input.text.trim()}`,
        is_internal: false,
      })
      .select('id')
      .maybeSingle();
    commentId = comment?.id || null;
  }

  const { data: outbox, error: obErr } = await supabase
    .from('whatsapp_outbox')
    .insert({
      company_id: input.companyId,
      ticket_id: ticketId,
      comment_id: commentId,
      instance,
      number: jid,
      kind: 'text',
      payload: { text: input.text.trim() },
      status: 'pending',
      created_by: input.actorUserId || null,
    })
    .select('id')
    .single();

  if (obErr) {
    console.warn('[lead-qualifier-engine] enqueueLeadWhatsApp error:', obErr.message);
    return { ticketId, outboxId: null, metaPatch };
  }

  return { ticketId, outboxId: outbox?.id || null, metaPatch };
}

async function enqueueDirectAdvisorWhatsApp(
  supabase: any,
  companyId: string,
  advisorPhone: string | null | undefined,
  text: string,
  createdBy?: string | null,
): Promise<{ sent: boolean; outboxId?: string; reason?: string }> {
  const digits = normalizeWaDigits(advisorPhone);
  if (!digits) return { sent: false, reason: 'Asesor sin teléfono WhatsApp registrado en Perfil' };
  const instance = await resolveEvolutionInstance(supabase);
  const { data: outbox, error } = await supabase
    .from('whatsapp_outbox')
    .insert({
      company_id: companyId,
      ticket_id: null,
      comment_id: null,
      instance,
      number: `${digits}@s.whatsapp.net`,
      kind: 'text',
      payload: { text: text.trim() },
      status: 'pending',
      created_by: createdBy || null,
    })
    .select('id')
    .single();
  if (error) return { sent: false, reason: error.message };
  return { sent: true, outboxId: outbox?.id };
}

async function notifyAdvisors(
  supabase: any,
  cfg: NormalizedConfig,
  input: {
    eventType: 'urgent_intake' | 'handoff_human' | 'demo_booked' | 'sla_escalation';
    lead: any;
    diagnostic: ReturnType<typeof extractLeadDiagnostic>;
    recipientIds: string[];
    summary?: string | null;
    demoSlotLabel?: string | null;
    meetLink?: string | null;
    advisorName?: string | null;
    actorUserId?: string | null;
  },
): Promise<{ whatsappCount: number; crmCount: number }> {
  const uniqueIds = [...new Set(input.recipientIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { whatsappCount: 0, crmCount: 0 };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active')
    .in('id', uniqueIds);

  const withinHours = isWithinBusinessHours(new Date(), cfg.business_hours, cfg.timezone);
  const allowWhatsApp = cfg.notify_channels.whatsapp && (cfg.notify_advisors_24_7 || withinHours || input.eventType === 'sla_escalation');

  const waText = buildAdvisorWhatsAppAlert({
    eventType: input.eventType,
    lead: {
      id: input.lead.id,
      name: input.lead.name,
      company_name: input.lead.company_name,
      phone: input.lead.phone,
      productLabel: input.diagnostic.productLabel,
    },
    painText: input.diagnostic.painText,
    urgencyText: input.diagnostic.urgencyText,
    roleTitle: input.diagnostic.roleTitle,
    summary: input.summary || null,
    demoSlotLabel: input.demoSlotLabel || null,
    meetLink: input.meetLink || null,
    advisorName: input.advisorName || null,
    crmBaseUrl: cfg.crm_base_url,
  });

  const titleByEvent = {
    urgent_intake: `🔥 Lead caliente: ${input.lead.name}`,
    handoff_human: `🙋 Lead pide asesor humano: ${input.lead.name}`,
    demo_booked: `📅 Demo agendada (${input.demoSlotLabel || 'Meet'}): ${input.lead.name}`,
    sla_escalation: `⏱️ SLA sin respuesta (${input.advisorName || 'Asesor'}): ${input.lead.name}`,
  };

  let whatsappCount = 0;
  let crmCount = 0;

  for (const prof of profiles || []) {
    if (prof.is_active === false) continue;

    if (cfg.notify_channels.crm_alert) {
      const { error: nErr } = await supabase.from('notifications').insert({
        company_id: cfg.company_id,
        user_id: prof.id,
        lead_id: input.lead.id,
        type: `qualifier_${input.eventType}`,
        title: titleByEvent[input.eventType],
        body: [
          input.diagnostic.painText ? `Dolor: ${input.diagnostic.painText}` : null,
          input.summary || null,
          input.meetLink ? `Meet: ${input.meetLink}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 280),
        read: false,
        push_sent: false,
        scheduled_for: new Date().toISOString(),
      });
      if (!nErr) crmCount++;
    }

    if (allowWhatsApp && prof.phone) {
      const res = await enqueueDirectAdvisorWhatsApp(supabase, cfg.company_id, prof.phone, waText, input.actorUserId);
      if (res.sent) whatsappCount++;
    }
  }

  return { whatsappCount, crmCount };
}

async function pickAdvisorForLead(
  supabase: any,
  companyId: string,
  lead: any,
  advanceRoundRobin = false,
): Promise<{
  advisorId: string | null;
  advisorName: string | null;
  advisorEmail: string | null;
  extraIds: string[];
  ruleId: string | null;
  strategy: 'fixed' | 'round_robin' | null;
  nextIndex: number;
}> {
  const { data: rules } = await supabase
    .from('lead_demo_routing_rules')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  const pick = selectNextAdvisorFromRules((rules || []) as RoutingRuleLike[], lead?.interested_product_id || null);

  if (advanceRoundRobin && pick.rule && pick.rule.strategy === 'round_robin' && pick.advisorId) {
    await supabase
      .from('lead_demo_routing_rules')
      .update({ last_assigned_index: pick.nextIndex })
      .eq('id', pick.rule.id);
  }

  let advisorId = pick.advisorId || lead?.assigned_to || null;
  let extraIds = pick.notifyExtraUserIds || [];

  if (!advisorId) {
    const { data: fallbackAdmin } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .in('role', ['company_admin', 'super_admin'])
      .limit(1)
      .maybeSingle();
    advisorId = fallbackAdmin?.id || null;
  }

  if (!advisorId) {
    return {
      advisorId: null,
      advisorName: null,
      advisorEmail: null,
      extraIds,
      ruleId: pick.rule?.id || null,
      strategy: pick.rule?.strategy || null,
      nextIndex: pick.nextIndex,
    };
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', advisorId)
    .maybeSingle();

  return {
    advisorId,
    advisorName: prof?.full_name || prof?.email || 'Asesor Comercial',
    advisorEmail: prof?.email || null,
    extraIds,
    ruleId: pick.rule?.id || null,
    strategy: pick.rule?.strategy || null,
    nextIndex: pick.nextIndex,
  };
}

async function loadBusyIntervals(supabase: any, companyId: string, advisorId: string | null): Promise<Array<{ start: string; end: string }>> {
  const nowIso = new Date().toISOString();
  const maxIso = new Date(Date.now() + 11 * 86_400_000).toISOString();
  const busy: Array<{ start: string; end: string }> = [];

  let fuQ = supabase
    .from('follow_ups')
    .select('date')
    .eq('company_id', companyId)
    .eq('completed', false)
    .gte('date', nowIso)
    .lte('date', maxIso);
  if (advisorId) {
    fuQ = fuQ.eq('assigned_to', advisorId);
  }
  const { data: fus } = await fuQ;
  for (const row of fus || []) {
    if (row?.date) {
      const startMs = new Date(row.date).getTime();
      if (Number.isFinite(startMs)) {
        busy.push({ start: new Date(startMs).toISOString(), end: new Date(startMs + 30 * 60_000).toISOString() });
      }
    }
  }

  let bkQ = supabase
    .from('booking_appointments')
    .select('start_time, end_time')
    .eq('company_id', companyId)
    .in('status', ['confirmed', 'scheduled', 'pending'])
    .gte('end_time', nowIso)
    .lte('start_time', maxIso);
  if (advisorId) {
    bkQ = bkQ.eq('user_id', advisorId);
  }
  const { data: bks } = await bkQ;
  for (const row of bks || []) {
    if (row?.start_time && row?.end_time) {
      busy.push({ start: row.start_time, end: row.end_time });
    }
  }

  return busy;
}

async function callQualifierOpenAi(input: {
  apiKey: string;
  cfg: NormalizedConfig;
  lead: any;
  diagnostic: ReturnType<typeof extractLeadDiagnostic>;
  playbook: PainPlaybook | null;
  historyLines: string[];
  incomingMessage: string;
  availableSlots: DemoSlot[];
  offeredSlots: DemoSlot[];
}) {
  const slotsText = (input.offeredSlots.length > 0 ? input.offeredSlots : input.availableSlots)
    .map((s) => `${s.index}) ${s.label}`)
    .join('\n');

  const knownProfileLines = [
    `- Nombre: ${input.lead.name || 'Prospecto'}`,
    `- Empresa: ${input.lead.company_name || 'No indicada'}`,
    input.diagnostic.productLabel ? `- Producto de interés: ${input.diagnostic.productLabel}` : null,
    input.diagnostic.roleTitle ? `- Cargo: ${input.diagnostic.roleTitle}` : null,
    input.diagnostic.painText ? `- Punto de Mejora / Dolor: ${input.diagnostic.painText}` : null,
    input.diagnostic.volumeText ? `- Facturas anuales: ${input.diagnostic.volumeText}` : null,
    input.diagnostic.urgencyText ? `- Urgencia: ${input.diagnostic.urgencyText}` : null,
    input.diagnostic.methodText ? `- Gestión actual: ${input.diagnostic.methodText}` : null,
    input.diagnostic.projectsText ? `- Proyectos disponibles: ${input.diagnostic.projectsText}` : null,
    input.diagnostic.comments ? `- Comentarios del form: ${input.diagnostic.comments}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const playbookContext = input.playbook
    ? [
        `PLAYBOOK ASIGNADO (${input.playbook.label}):`,
        `- Módulos fuertes a destacar: ${input.playbook.strong_modules}`,
        `- Propuesta de valor: ${input.playbook.value_proposition}`,
        `- Pregunta sugerida si falta contexto: ${input.playbook.qualifying_question}`,
      ].join('\n')
    : '';

  const systemContent = [
    input.cfg.system_prompt,
    '',
    'DATOS QUE EL PROSPECTO YA DIO EN EL FORMULARIO (úsalos, NO repitas preguntas sobre lo que ya está aquí):',
    knownProfileLines,
    '',
    playbookContext,
    '',
    'HORARIOS REALES DISPONIBLES PARA DEMO POR GOOGLE MEET:',
    slotsText || 'Sin horarios automáticos disponibles (ofrece pasar a asesor humano).',
    '',
    'REGLAS ESTRICTAS DE RESPUESTA:',
    '- Responde SIEMPRE en JSON válido con exactamente estas claves:',
    '  {"reply": string, "action": "continue"|"offer_slots"|"book_demo"|"handoff_human"|"close_not_interested", "selected_slot_index": number|null, "detected_pain": string|null, "detected_volume": string|null, "summary_for_advisor": string}',
    '- Usa "offer_slots" e incluye las opciones numeradas 1, 2, 3 tal cual aparecen arriba cuando el lead ya esté interesado en ver el sistema.',
    '- Usa "book_demo" y coloca selected_slot_index (1, 2 o 3) SOLO cuando el prospecto haya elegido o confirmado uno de los horarios ofrecidos.',
    '- Usa "handoff_human" si pide hablar con una persona, pide llamada inmediata, pide contrato o muestra frustración.',
    '- Mensaje breve, humano, máximo 4 líneas en WhatsApp.',
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemContent },
        {
          role: 'user',
          content: [
            input.historyLines.length > 0 ? `HISTORIAL RECIENTE:\n${input.historyLines.join('\n')}` : 'HISTORIAL RECIENTE: (primer intercambio)',
            '',
            `ÚLTIMO MENSAJE DEL PROSPECTO:\n${input.incomingMessage}`,
          ].join('\n'),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content || '';
  return parseQualifierAiJson(rawContent);
}

async function createDemoFollowUpAndMeet(
  supabase: any,
  cfg: NormalizedConfig,
  input: {
    lead: any;
    slot: DemoSlot;
    advisorId: string | null;
    advisorEmail: string | null;
    diagnostic: ReturnType<typeof extractLeadDiagnostic>;
    summary: string;
  },
): Promise<{ followUpId: string | null; meetLink: string | null }> {
  const notesText = [
    `🤖 Demo 30 min agendada automáticamente por Calificador IA`,
    input.diagnostic.painText ? `Dolor: ${input.diagnostic.painText}` : null,
    input.diagnostic.urgencyText ? `Urgencia: ${input.diagnostic.urgencyText}` : null,
    input.summary ? `Contexto IA: ${input.summary}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const { data: followUp, error: fuErr } = await supabase
    .from('follow_ups')
    .insert({
      lead_id: input.lead.id,
      company_id: cfg.company_id,
      user_id: input.advisorId || input.lead.assigned_to || null,
      assigned_to: input.advisorId || input.lead.assigned_to || null,
      date: input.slot.startIso,
      action_type: 'meeting',
      notes: notesText,
      completed: false,
      state: 'pending',
    })
    .select('id')
    .maybeSingle();

  if (fuErr) {
    console.warn('[lead-qualifier-engine] create follow_up warn:', fuErr.message);
  }

  let meetLink: string | null = null;
  let integrationRow: any = null;

  if (input.advisorId) {
    const { data: ownCal } = await supabase
      .from('calendar_integrations')
      .select('id, user_id, google_email')
      .eq('company_id', cfg.company_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .eq('user_id', input.advisorId)
      .limit(1)
      .maybeSingle();
    integrationRow = ownCal;
  }
  if (!integrationRow) {
    const { data: anyCal } = await supabase
      .from('calendar_integrations')
      .select('id, user_id, google_email')
      .eq('company_id', cfg.company_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    integrationRow = anyCal;
  }

  if (integrationRow?.id) {
    try {
      const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const attendees = [input.lead.email, input.advisorEmail]
        .filter((e): e is string => Boolean(e && String(e).includes('@')));

      const gcalRes = await fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(serviceKey ? { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } : {}),
        },
        body: JSON.stringify({
          action: 'create_event',
          integration_id: integrationRow.id,
          event: {
            title: `Demo ${input.diagnostic.productLabel || 'Arias CRM/ERP'} — ${input.lead.company_name || input.lead.name}`,
            description: notesText,
            start: input.slot.startIso,
            end: input.slot.endIso,
            attendees,
            add_meet_link: true,
            send_invites: true,
            follow_up_id: followUp?.id || undefined,
            timezone: cfg.timezone || DEFAULT_TZ,
          },
        }),
      });
      if (gcalRes.ok) {
        const gcalJson = await gcalRes.json().catch(() => null);
        meetLink = gcalJson?.meet_link || gcalJson?.html_link || null;
      }
    } catch (calErr: any) {
      console.warn('[lead-qualifier-engine] google-calendar-sync warn:', calErr?.message || calErr);
    }
  }

  return { followUpId: followUp?.id || null, meetLink };
}

async function upsertLeadAiMemory(
  supabase: any,
  companyId: string,
  leadId: string,
  patch: { stage?: string; factsPatch?: Record<string, any> },
) {
  const { data: existing } = await supabase
    .from('lead_ai_memory')
    .select('known_facts, conversation_stage')
    .eq('lead_id', leadId)
    .maybeSingle();

  const mergedFacts = {
    ...(existing?.known_facts && typeof existing.known_facts === 'object' ? existing.known_facts : {}),
    ...(patch.factsPatch || {}),
  };

  await supabase.from('lead_ai_memory').upsert(
    {
      lead_id: leadId,
      company_id: companyId,
      known_facts: mergedFacts,
      conversation_stage: patch.stage || existing?.conversation_stage || 'nuevo',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lead_id' },
  );
}

async function executeHandoff(
  supabase: any,
  cfg: NormalizedConfig,
  input: {
    lead: any;
    ticketId: string | null;
    diagnostic: ReturnType<typeof extractLeadDiagnostic>;
    reason: string;
    summary: string;
    turnCount: number;
    sendWhatsAppReply: boolean;
  },
) {
  const picked = await pickAdvisorForLead(supabase, cfg.company_id, input.lead, true);
  const firstName = extractLeadFirstName(input.lead.name) || '';
  const withinHours = isWithinBusinessHours(new Date(), cfg.business_hours, cfg.timezone);
  const replyTemplate = withinHours ? cfg.handoff_reply_business_hours : cfg.handoff_reply_after_hours;
  const replyMsg = replyTemplate
    .replace(/\{nombre\}/gi, firstName)
    .replace(/\{asesor\}/gi, picked.advisorName || 'un asesor comercial')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let metaPatch: Record<string, any> = {
    ai_qualifier_active: false,
    ai_qualifier_status: 'handed_off',
    ai_qualifier_handoff_reason: input.reason,
  };
  let ticketId = input.ticketId;

  if (input.sendWhatsAppReply) {
    const sent = await enqueueLeadWhatsApp(supabase, {
      companyId: cfg.company_id,
      lead: input.lead,
      text: replyMsg,
      activeAfter: false,
      qualifierStatus: 'handed_off',
      existingTicketId: input.ticketId,
    });
    ticketId = sent.ticketId;
    metaPatch = { ...sent.metaPatch, ...metaPatch };
  }

  const now = new Date();
  const deadline = new Date(now.getTime() + cfg.sla_escalation_minutes * 60_000);

  if (picked.advisorId) {
    await supabase
      .from('leads')
      .update({
        assigned_to: picked.advisorId,
        assigned_at: now.toISOString(),
        next_action_notes: `🙋 Pide asesor (${picked.advisorName}): ${input.summary || input.reason}`,
      })
      .eq('id', input.lead.id);
  }

  await supabase.from('lead_qualifier_sessions').upsert(
    {
      company_id: cfg.company_id,
      lead_id: input.lead.id,
      ticket_id: ticketId,
      status: 'handed_off',
      mode: cfg.mode,
      turn_count: input.turnCount,
      last_ai_action: 'handoff_human',
      assigned_advisor_id: picked.advisorId,
      handoff_reason: input.reason,
      handoff_summary: input.summary || input.reason,
      handoff_at: now.toISOString(),
      sla_deadline_at: deadline.toISOString(),
      advisor_notified_at: now.toISOString(),
    },
    { onConflict: 'lead_id' },
  );

  if (cfg.notify_on_handoff) {
    const targets = [picked.advisorId, ...picked.extraIds].filter(Boolean) as string[];
    await notifyAdvisors(supabase, cfg, {
      eventType: 'handoff_human',
      lead: input.lead,
      diagnostic: input.diagnostic,
      recipientIds: targets,
      summary: input.summary || input.reason,
      advisorName: picked.advisorName,
    });
  }

  return { replyMsg, picked, metaPatch, ticketId };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const auth = await resolveAuth(req, supabase);
    if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || '').trim();
    const companyId = String(payload?.company_id || auth.companyId || '').trim();

    // ── SLA Escalation Sweep (cron/manual per company or global internal) ─────
    if (action === 'check_sla_escalations') {
      if (companyId && !canAccessCompany(auth, companyId)) {
        return json({ ok: false, error: 'Forbidden' }, 403);
      }
      const nowIso = new Date().toISOString();
      let q = supabase
        .from('lead_qualifier_sessions')
        .select('*, leads(*)')
        .eq('status', 'handed_off')
        .is('sla_escalated_at', null)
        .lte('sla_deadline_at', nowIso)
        .limit(30);
      if (companyId) q = q.eq('company_id', companyId);

      const { data: overdue } = await q;
      let escalated = 0;

      for (const sess of overdue || []) {
        if (!sess.leads?.id) continue;
        const cfg = await loadCompanyConfig(supabase, sess.company_id);
        let backupId = cfg.sla_backup_user_id;
        if (!backupId) {
          const { data: fallbackAdmin } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', sess.company_id)
            .eq('is_active', true)
            .in('role', ['company_admin', 'super_admin'])
            .limit(1)
            .maybeSingle();
          backupId = fallbackAdmin?.id || null;
        }
        if (!backupId) continue;

        let advisorName = 'Asesor asignado';
        if (sess.assigned_advisor_id) {
          const { data: adv } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', sess.assigned_advisor_id)
            .maybeSingle();
          if (adv?.full_name) advisorName = adv.full_name;
        }

        let productLabel: string | null = null;
        if (sess.leads.interested_product_id) {
          const { data: pr } = await supabase
            .from('lead_products')
            .select('name')
            .eq('id', sess.leads.interested_product_id)
            .maybeSingle();
          productLabel = pr?.name || null;
        }

        const diagnostic = extractLeadDiagnostic(sess.leads, productLabel);
        await notifyAdvisors(supabase, cfg, {
          eventType: 'sla_escalation',
          lead: sess.leads,
          diagnostic,
          recipientIds: [backupId],
          summary: sess.handoff_summary || sess.handoff_reason || 'Superó el tiempo SLA sin respuesta',
          advisorName,
          actorUserId: auth.userId,
        });

        await supabase
          .from('lead_qualifier_sessions')
          .update({ sla_escalated_at: nowIso })
          .eq('id', sess.id);
        escalated++;
      }

      return json({ ok: true, checked: (overdue || []).length, escalated });
    }

    if (!companyId) return json({ ok: false, error: 'company_id es requerido' }, 400);
    if (!canAccessCompany(auth, companyId)) return json({ ok: false, error: 'Forbidden' }, 403);

    const cfg = await loadCompanyConfig(supabase, companyId);

    // ── Test Executive Advisor WhatsApp Alert ───────────────────────────────
    if (action === 'send_test_advisor_alert') {
      const advisorUserId = String(payload?.advisor_user_id || auth.userId || '').trim();
      if (!advisorUserId) return json({ ok: false, error: 'Selecciona un usuario del equipo para probar' }, 400);

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, phone, company_id')
        .eq('id', advisorUserId)
        .maybeSingle();
      if (!prof || (!auth.isPlatformAdmin && prof.company_id !== companyId)) {
        return json({ ok: false, error: 'Asesor no pertenece a la empresa' }, 404);
      }

      const { data: sampleLead } = await supabase
        .from('leads')
        .select('id, name, company_name, phone')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const msg = buildAdvisorWhatsAppAlert({
        eventType: 'demo_booked',
        lead: sampleLead || {
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Lead de Prueba',
          company_name: 'Empresa Demo S.A.',
          phone: '+50370000000',
          productLabel: 'ERP',
        },
        painText: 'Inventarios y productos (Prueba de alerta)',
        urgencyText: 'Lo antes posible',
        roleTitle: 'Gerente / Propietario',
        demoSlotLabel: 'Prueba del sistema · Notificación instantánea',
        meetLink: 'https://meet.google.com/prueba-crm',
        summary: `Alerta ejecutiva de prueba disparada para ${prof.full_name || 'Asesor'}.`,
        crmBaseUrl: cfg.crm_base_url,
      });

      const waRes = await enqueueDirectAdvisorWhatsApp(supabase, companyId, prof.phone, msg, auth.userId);
      if (!waRes.sent) {
        return json({ ok: false, error: waRes.reason || 'No se pudo encolar WhatsApp al asesor' }, 400);
      }
      return json({ ok: true, outbox_id: waRes.outboxId, to_phone: prof.phone, to_name: prof.full_name });
    }

    // ── Enroll New Lead from Sheets/Meta ────────────────────────────────────
    if (action === 'enroll_new_lead') {
      const leadId = String(payload?.lead_id || '').trim();
      if (!leadId) return json({ ok: false, error: 'lead_id es requerido' }, 400);
      if (!cfg.is_enabled) return json({ ok: true, skipped: true, reason: 'qualifier_disabled' });

      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', leadId)
        .maybeSingle();
      if (!lead) return json({ ok: false, error: 'Lead no encontrado' }, 404);

      if (!isSourceAllowed(cfg.allowed_sources, payload?.source || lead.source)) {
        return json({ ok: true, skipped: true, reason: 'source_not_allowed' });
      }
      if (!normalizeWaDigits(lead.phone)) {
        return json({ ok: true, skipped: true, reason: 'no_valid_phone' });
      }

      let productLabel: string | null = null;
      if (lead.interested_product_id) {
        const { data: pr } = await supabase
          .from('lead_products')
          .select('name')
          .eq('id', lead.interested_product_id)
          .maybeSingle();
        productLabel = pr?.name || null;
      }

      const diagnostic = extractLeadDiagnostic(lead, productLabel);
      const playbook = matchPainPlaybook(cfg.pain_playbooks, {
        painText: diagnostic.painText,
        productLabel,
        adName: diagnostic.adName,
      });

      const firstMsg = renderFirstTouchMessage(cfg.first_touch_template, playbook, {
        name: lead.name,
        companyName: lead.company_name,
        painText: diagnostic.painText,
      });

      if (cfg.notify_on_urgent_intake && isUrgentIntake(diagnostic.urgencyText, lead.priority)) {
        const picked = await pickAdvisorForLead(supabase, companyId, lead, true);
        const recipients = [picked.advisorId, ...picked.extraIds].filter(Boolean) as string[];
        await notifyAdvisors(supabase, cfg, {
          eventType: 'urgent_intake',
          lead,
          diagnostic,
          recipientIds: recipients,
          summary: diagnostic.comments || 'Ingresó con urgencia alta en el formulario.',
        });
      }

      if (cfg.mode === 'draft') {
        await supabase.from('lead_qualifier_sessions').upsert(
          {
            company_id: companyId,
            lead_id: lead.id,
            status: 'draft_pending',
            mode: 'draft',
            turn_count: 0,
            matched_playbook_id: playbook?.id || null,
            first_message_draft: firstMsg,
            last_ai_draft: firstMsg,
            last_ai_action: 'first_touch_draft',
          },
          { onConflict: 'lead_id' },
        );
        return json({ ok: true, mode: 'draft', status: 'draft_pending', draft: firstMsg });
      }

      // Auto mode: enqueue first WhatsApp only if 24/7 or inside business hours
      const withinHours = isWithinBusinessHours(new Date(), cfg.business_hours, cfg.timezone);
      if (!cfg.response_24_7 && !withinHours) {
        await supabase.from('lead_qualifier_sessions').upsert(
          {
            company_id: companyId,
            lead_id: lead.id,
            status: 'draft_pending',
            mode: 'auto',
            turn_count: 0,
            matched_playbook_id: playbook?.id || null,
            first_message_draft: firstMsg,
            last_ai_draft: firstMsg,
            last_ai_action: 'queued_after_hours',
          },
          { onConflict: 'lead_id' },
        );
        return json({ ok: true, mode: 'auto', status: 'draft_pending', reason: 'outside_business_hours' });
      }

      const sent = await enqueueLeadWhatsApp(supabase, {
        companyId,
        lead,
        text: firstMsg,
        activeAfter: true,
        qualifierStatus: 'active',
      });

      await supabase.from('lead_qualifier_sessions').upsert(
        {
          company_id: companyId,
          lead_id: lead.id,
          ticket_id: sent.ticketId,
          status: 'active',
          mode: 'auto',
          turn_count: 1,
          matched_playbook_id: playbook?.id || null,
          first_message_draft: firstMsg,
          last_ai_draft: firstMsg,
          last_ai_action: 'first_touch_sent',
        },
        { onConflict: 'lead_id' },
      );

      return json({ ok: true, mode: 'auto', status: 'active', outbox_id: sent.outboxId, ticket_id: sent.ticketId });
    }

    // ── Approve & Send Draft from CRM UI ────────────────────────────────────
    if (action === 'approve_and_send_draft') {
      const leadId = String(payload?.lead_id || '').trim();
      if (!leadId) return json({ ok: false, error: 'lead_id es requerido' }, 400);

      const [{ data: session }, { data: lead }] = await Promise.all([
        supabase.from('lead_qualifier_sessions').select('*').eq('company_id', companyId).eq('lead_id', leadId).maybeSingle(),
        supabase.from('leads').select('*').eq('company_id', companyId).eq('id', leadId).maybeSingle(),
      ]);
      if (!lead) return json({ ok: false, error: 'Lead no encontrado' }, 404);

      const textToSend = String(
        payload?.message_text || session?.last_ai_draft || session?.first_message_draft || '',
      ).trim();
      if (!textToSend) return json({ ok: false, error: 'No hay mensaje borrador para enviar' }, 400);

      const sent = await enqueueLeadWhatsApp(supabase, {
        companyId,
        lead,
        text: textToSend,
        activeAfter: true,
        qualifierStatus: 'active',
        actorUserId: auth.userId,
        existingTicketId: session?.ticket_id || null,
      });
      if (!sent.outboxId) {
        return json({ ok: false, error: 'El lead no tiene un teléfono WhatsApp válido' }, 400);
      }

      await supabase.from('lead_qualifier_sessions').upsert(
        {
          company_id: companyId,
          lead_id: lead.id,
          ticket_id: sent.ticketId,
          status: 'active',
          mode: cfg.mode,
          turn_count: Math.max(1, Number(session?.turn_count || 0) + (session?.status === 'draft_pending' ? 0 : 1)),
          matched_playbook_id: session?.matched_playbook_id || null,
          first_message_draft: session?.first_message_draft || textToSend,
          last_ai_draft: null,
          last_ai_action: 'draft_approved_sent',
        },
        { onConflict: 'lead_id' },
      );

      return json({ ok: true, status: 'active', outbox_id: sent.outboxId, ticket_id: sent.ticketId });
    }

    // ── Dry-Run Simulator (never sends real WhatsApps or mutates DB) ─────────
    if (action === 'simulate_conversation') {
      const incoming = String(payload?.incoming_message || '').trim();
      const simLead = {
        id: '00000000-0000-0000-0000-000000000000',
        name: String(payload?.lead_name || 'Evany Susana Ortiz'),
        company_name: String(payload?.company_name || 'Susana Calvo Salón'),
        phone: '+50378889900',
        raw_meta_payload: {
          fields: {
            'PUNTO DE MEJORA': String(payload?.pain_text || 'Inventarios y productos'),
            'FACTURAS ANUAL': String(payload?.volume_text || '2,000 - 5,000'),
            'URGENCIA DE PROYECTO': String(payload?.urgency_text || 'Lo antes posible'),
            CARGO: String(payload?.role_title || 'Propietaria'),
          },
        },
      };
      const diag = extractLeadDiagnostic(simLead, String(payload?.product_label || 'ERP'));
      const pb = matchPainPlaybook(cfg.pain_playbooks, {
        painText: diag.painText,
        productLabel: diag.productLabel,
      });

      const simulatedNow = payload?.simulated_iso ? new Date(payload.simulated_iso) : new Date();
      const withinHours = isWithinBusinessHours(simulatedNow, cfg.business_hours, cfg.timezone);

      if (!incoming) {
        const firstMsg = renderFirstTouchMessage(cfg.first_touch_template, pb, {
          name: simLead.name,
          companyName: simLead.company_name,
          painText: diag.painText,
        });
        return json({
          ok: true,
          simulation: {
            stage: 'first_touch',
            within_business_hours: withinHours,
            will_respond_at_this_hour: withinHours || cfg.response_24_7,
            matched_playbook: pb?.label || null,
            reply: firstMsg,
            action: 'first_touch',
            offered_slots: [],
          },
        });
      }

      const handoffCheck = detectExplicitHandoffIntent(incoming, cfg.handoff_keywords);
      if (handoffCheck.isHandoff) {
        const picked = await pickAdvisorForLead(supabase, companyId, simLead);
        const firstName = extractLeadFirstName(simLead.name);
        const tpl = withinHours ? cfg.handoff_reply_business_hours : cfg.handoff_reply_after_hours;
        const reply = tpl.replace(/\{nombre\}/gi, firstName).replace(/\{asesor\}/gi, picked.advisorName || 'nuestro asesor').replace(/\s+,/g, ',');
        return json({
          ok: true,
          simulation: {
            stage: 'handoff_human',
            within_business_hours: withinHours,
            will_respond_at_this_hour: withinHours || cfg.response_24_7,
            matched_playbook: pb?.label || null,
            reply,
            action: 'handoff_human',
            handoff_reason: handoffCheck.reason,
            assigned_advisor: picked.advisorName,
            advisor_alert_preview: buildAdvisorWhatsAppAlert({
              eventType: 'handoff_human',
              lead: simLead,
              painText: diag.painText,
              urgencyText: diag.urgencyText,
              roleTitle: diag.roleTitle,
              summary: handoffCheck.reason,
              crmBaseUrl: cfg.crm_base_url,
            }),
            offered_slots: [],
          },
        });
      }

      const slots = generateAvailableDemoSlots({
        now: simulatedNow,
        businessHours: cfg.business_hours,
        timezone: cfg.timezone,
        durationMinutes: cfg.demo_duration_minutes,
        bufferMinutes: cfg.demo_buffer_minutes,
        busyIntervals: [],
        count: 3,
      });

      const apiKey = await loadOpenAiKey(supabase, companyId);
      if (!apiKey) {
        return json({ ok: false, error: 'No hay clave de OpenAI activa en Marketing Integrations ni OPENAI_API_KEY' }, 400);
      }

      const history = Array.isArray(payload?.history) ? payload.history.map((h: any) => String(h)) : [];
      const offeredPrev = Array.isArray(payload?.offered_slots) ? payload.offered_slots : [];
      const aiOut = await callQualifierOpenAi({
        apiKey,
        cfg,
        lead: simLead,
        diagnostic: diag,
        playbook: pb,
        historyLines: history,
        incomingMessage: incoming,
        availableSlots: slots,
        offeredSlots: offeredPrev,
      });

      return json({
        ok: true,
        simulation: {
          stage: aiOut.action,
          within_business_hours: withinHours,
          will_respond_at_this_hour: withinHours || cfg.response_24_7,
          matched_playbook: pb?.label || null,
          reply: aiOut.reply,
          action: aiOut.action,
          selected_slot_index: aiOut.selected_slot_index,
          offered_slots: aiOut.action === 'offer_slots' ? slots : offeredPrev,
          summary_for_advisor: aiOut.summary_for_advisor,
        },
      });
    }

    // ── Live Inbound WhatsApp Reply Processor ───────────────────────────────
    if (action === 'process_inbound_reply') {
      const leadId = String(payload?.lead_id || '').trim();
      const ticketId = String(payload?.ticket_id || '').trim() || null;
      const incomingText = String(payload?.message_text || '').trim();
      if (!leadId || !incomingText) {
        return json({ ok: true, handled: false, reason: 'missing_lead_or_text' });
      }
      if (!cfg.is_enabled) {
        return json({ ok: true, handled: false, reason: 'qualifier_disabled' });
      }

      const [{ data: lead }, { data: session }] = await Promise.all([
        supabase.from('leads').select('*').eq('company_id', companyId).eq('id', leadId).maybeSingle(),
        supabase.from('lead_qualifier_sessions').select('*').eq('company_id', companyId).eq('lead_id', leadId).maybeSingle(),
      ]);

      if (!lead) return json({ ok: true, handled: false, reason: 'lead_not_found' });
      if (session && ['paused', 'human_takeover', 'closed', 'max_turns'].includes(session.status)) {
        return json({ ok: true, handled: false, reason: `session_${session.status}` });
      }

      const now = new Date();
      const withinHours = isWithinBusinessHours(now, cfg.business_hours, cfg.timezone);
      if (!withinHours && !cfg.response_24_7) {
        return json({ ok: true, handled: false, reason: 'outside_business_hours_24_7_off' });
      }

      let productLabel: string | null = null;
      if (lead.interested_product_id) {
        const { data: pr } = await supabase
          .from('lead_products')
          .select('name')
          .eq('id', lead.interested_product_id)
          .maybeSingle();
        productLabel = pr?.name || null;
      }
      const diagnostic = extractLeadDiagnostic(lead, productLabel);
      const playbook = matchPainPlaybook(cfg.pain_playbooks, {
        painText: diagnostic.painText,
        productLabel,
        adName: diagnostic.adName,
      });

      const currentTurns = Number(session?.turn_count || 0);
      if (currentTurns >= cfg.max_ai_turns) {
        const handoff = await executeHandoff(supabase, cfg, {
          lead,
          ticketId,
          diagnostic,
          reason: `Máximo de turnos IA (${cfg.max_ai_turns}) alcanzado`,
          summary: incomingText.slice(0, 180),
          turnCount: currentTurns,
          sendWhatsAppReply: true,
        });
        await supabase
          .from('lead_qualifier_sessions')
          .update({ status: 'max_turns' })
          .eq('company_id', companyId)
          .eq('lead_id', leadId);
        return json({ ok: true, handled: true, action: 'max_turns_handoff', ticket_meta_patch: handoff.metaPatch });
      }

      // 1. Check explicit handoff keywords FIRST (deterministic zero-delay escalation)
      const handoffIntent = detectExplicitHandoffIntent(incomingText, cfg.handoff_keywords);
      if (handoffIntent.isHandoff) {
        const handoff = await executeHandoff(supabase, cfg, {
          lead,
          ticketId,
          diagnostic,
          reason: handoffIntent.reason || 'Solicitó asesor humano',
          summary: `Mensaje del lead: "${incomingText.slice(0, 160)}"`,
          turnCount: currentTurns + 1,
          sendWhatsAppReply: true,
        });
        return json({ ok: true, handled: true, action: 'handoff_human', ticket_meta_patch: handoff.metaPatch });
      }

      const apiKey = await loadOpenAiKey(supabase, companyId);
      if (!apiKey) {
        return json({ ok: true, handled: false, reason: 'missing_openai_key' });
      }

      let historyLines: string[] = [];
      if (ticketId) {
        const { data: cmts } = await supabase
          .from('ticket_comments')
          .select('body, is_internal')
          .eq('ticket_id', ticketId)
          .eq('is_internal', false)
          .order('created_at', { ascending: false })
          .limit(12);
        historyLines = (cmts || [])
          .reverse()
          .map((c: any) => String(c.body || '').trim())
          .filter(Boolean);
      }

      const pickedForSlots = await pickAdvisorForLead(supabase, companyId, lead, false);
      const busy = await loadBusyIntervals(supabase, companyId, pickedForSlots.advisorId);
      const freshSlots = generateAvailableDemoSlots({
        now,
        businessHours: cfg.business_hours,
        timezone: cfg.timezone,
        durationMinutes: cfg.demo_duration_minutes,
        bufferMinutes: cfg.demo_buffer_minutes,
        busyIntervals: busy,
        count: 3,
      });

      const prevOffered = Array.isArray(session?.offered_slots) ? (session.offered_slots as DemoSlot[]) : [];
      const aiOut = await callQualifierOpenAi({
        apiKey,
        cfg,
        lead,
        diagnostic,
        playbook,
        historyLines,
        incomingMessage: incomingText,
        availableSlots: freshSlots,
        offeredSlots: prevOffered,
      });

      if (aiOut.action === 'handoff_human') {
        const handoff = await executeHandoff(supabase, cfg, {
          lead,
          ticketId,
          diagnostic,
          reason: 'IA detectó intención de hablar con humano / cierre',
          summary: aiOut.summary_for_advisor || incomingText.slice(0, 160),
          turnCount: currentTurns + 1,
          sendWhatsAppReply: true,
        });
        return json({ ok: true, handled: true, action: 'handoff_human', ticket_meta_patch: handoff.metaPatch });
      }

      if (aiOut.action === 'book_demo') {
        const slotPool = prevOffered.length > 0 ? prevOffered : freshSlots;
        const chosenSlot =
          slotPool.find((s) => s.index === aiOut.selected_slot_index) ||
          slotPool[0] ||
          null;

        if (!chosenSlot) {
          const handoff = await executeHandoff(supabase, cfg, {
            lead,
            ticketId,
            diagnostic,
            reason: 'Sin espacios libres automáticos para demo',
            summary: aiOut.summary_for_advisor || incomingText.slice(0, 160),
            turnCount: currentTurns + 1,
            sendWhatsAppReply: true,
          });
          return json({ ok: true, handled: true, action: 'handoff_human', ticket_meta_patch: handoff.metaPatch });
        }

        const picked = pickedForSlots;
        if (picked.ruleId && picked.strategy === 'round_robin' && picked.advisorId) {
          await supabase
            .from('lead_demo_routing_rules')
            .update({ last_assigned_index: picked.nextIndex })
            .eq('id', picked.ruleId);
        }
        const { followUpId, meetLink } = await createDemoFollowUpAndMeet(supabase, cfg, {
          lead,
          slot: chosenSlot,
          advisorId: picked.advisorId,
          advisorEmail: picked.advisorEmail,
          diagnostic,
          summary: aiOut.summary_for_advisor || incomingText.slice(0, 160),
        });

        const firstName = extractLeadFirstName(lead.name);
        const confirmMsg = [
          aiOut.reply || `¡Excelente${firstName ? `, ${firstName}` : ''}! Tu demo de 30 min quedó confirmada para el *${chosenSlot.label}* con ${picked.advisorName}.`,
          meetLink ? `🎥 Enlace Google Meet: ${meetLink}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');

        const sent = await enqueueLeadWhatsApp(supabase, {
          companyId,
          lead,
          text: confirmMsg,
          activeAfter: false,
          qualifierStatus: 'demo_booked',
          existingTicketId: ticketId,
        });

        await supabase
          .from('leads')
          .update({
            status: 'Lead calificado',
            assigned_to: picked.advisorId || lead.assigned_to,
            next_followup_date: chosenSlot.startIso,
            next_followup_assignee: picked.advisorId || lead.assigned_to,
            next_action_notes: `📅 Demo IA: ${chosenSlot.label}${meetLink ? ` · Meet: ${meetLink}` : ''}`,
          })
          .eq('id', lead.id);

        await upsertLeadAiMemory(supabase, companyId, lead.id, {
          stage: 'calificado',
          factsPatch: {
            detected_pain: aiOut.detected_pain || diagnostic.painText || null,
            detected_volume: aiOut.detected_volume || diagnostic.volumeText || null,
            booked_demo_slot: chosenSlot.label,
            booked_meet_link: meetLink,
          },
        });

        await supabase.from('lead_qualifier_sessions').upsert(
          {
            company_id: companyId,
            lead_id: lead.id,
            ticket_id: sent.ticketId,
            status: 'demo_booked',
            mode: cfg.mode,
            turn_count: currentTurns + 1,
            matched_playbook_id: playbook?.id || null,
            last_ai_action: 'book_demo',
            offered_slots: slotPool,
            booked_start_time: chosenSlot.startIso,
            booked_end_time: chosenSlot.endIso,
            booked_meet_link: meetLink,
            booked_follow_up_id: followUpId,
            assigned_advisor_id: picked.advisorId,
            handoff_summary: aiOut.summary_for_advisor || null,
            advisor_notified_at: now.toISOString(),
          },
          { onConflict: 'lead_id' },
        );

        if (cfg.notify_on_demo_booked) {
          const targets = [picked.advisorId, ...picked.extraIds].filter(Boolean) as string[];
          await notifyAdvisors(supabase, cfg, {
            eventType: 'demo_booked',
            lead,
            diagnostic,
            recipientIds: targets,
            summary: aiOut.summary_for_advisor || incomingText.slice(0, 160),
            demoSlotLabel: chosenSlot.label,
            meetLink,
            advisorName: picked.advisorName,
          });
        }

        return json({
          ok: true,
          handled: true,
          action: 'book_demo',
          slot: chosenSlot,
          meet_link: meetLink,
          ticket_meta_patch: sent.metaPatch,
        });
      }

      if (aiOut.action === 'close_not_interested') {
        const replyMsg = aiOut.reply || 'Entiendo perfectamente, quedamos a tus órdenes cuando necesites apoyo con Facturación DTE o ERP. ¡Éxitos!';
        const sent = await enqueueLeadWhatsApp(supabase, {
          companyId,
          lead,
          text: replyMsg,
          activeAfter: false,
          qualifierStatus: 'closed',
          existingTicketId: ticketId,
        });
        await supabase.from('lead_qualifier_sessions').upsert(
          {
            company_id: companyId,
            lead_id: lead.id,
            ticket_id: sent.ticketId,
            status: 'closed',
            mode: cfg.mode,
            turn_count: currentTurns + 1,
            matched_playbook_id: playbook?.id || null,
            last_ai_action: 'close_not_interested',
          },
          { onConflict: 'lead_id' },
        );
        return json({ ok: true, handled: true, action: 'close_not_interested', ticket_meta_patch: sent.metaPatch });
      }

      // Standard continue or offer_slots turn
      const nextOffered = aiOut.action === 'offer_slots' ? freshSlots : prevOffered;
      const replyText =
        aiOut.reply ||
        (aiOut.action === 'offer_slots' && freshSlots.length > 0
          ? `¿Cuál de estos horarios te queda mejor para una demo breve de 30 min?\n${freshSlots.map((s) => `${s.index}) ${s.label}`).join('\n')}`
          : 'Gracias por compartirnos ese dato. ¿Cómo te gustaría avanzar?');

      const sent = await enqueueLeadWhatsApp(supabase, {
        companyId,
        lead,
        text: replyText,
        activeAfter: true,
        qualifierStatus: 'active',
        existingTicketId: ticketId,
      });

      if (aiOut.detected_pain || aiOut.detected_volume) {
        await upsertLeadAiMemory(supabase, companyId, lead.id, {
          factsPatch: {
            ...(aiOut.detected_pain ? { detected_pain: aiOut.detected_pain } : {}),
            ...(aiOut.detected_volume ? { detected_volume: aiOut.detected_volume } : {}),
          },
        });
      }

      await supabase.from('lead_qualifier_sessions').upsert(
        {
          company_id: companyId,
          lead_id: lead.id,
          ticket_id: sent.ticketId,
          status: 'active',
          mode: cfg.mode,
          turn_count: currentTurns + 1,
          matched_playbook_id: playbook?.id || null,
          last_ai_action: aiOut.action,
          offered_slots: nextOffered,
        },
        { onConflict: 'lead_id' },
      );

      return json({ ok: true, handled: true, action: aiOut.action, ticket_meta_patch: sent.metaPatch });
    }

    return json({ ok: false, error: `Acción desconocida: ${action}` }, 400);
  } catch (err: any) {
    console.error('[lead-qualifier-engine] Error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'Internal Error' }, 500);
  }
});
