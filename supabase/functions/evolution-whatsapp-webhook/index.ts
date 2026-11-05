import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

// 1. Detect greetings, courtesy replies, or closing agreements (e.g. "ok, de acuerdo, esta bien...")
// These must NEVER open a brand-new ticket on their own!
function isGreetingOrClosingAgreement(text: string): boolean {
  const clean = (text || '')
    .toLowerCase()
    .replace(/[¡!¿?.,;:👍🙏👌✅👋]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length < 4) return true;

  const startsWithAgreement =
    /^(ok|okay|va|dale|de acuerdo|esta bien|está bien|perfecto|excelente|entendido|muchas gracias|gracias|mil gracias|ah ok|ah bueno|listo|ya quedo|ya quedó|si esta bien|sí está bien|bueno)\b/i.test(
      clean
    );

  const hasExplicitNewErrorAfterOk =
    /\b(pero sigue|sigue dando error|no funciono|no funcionó|volvio a fallar|volvió a fallar|otro problema|otro error)\b/i.test(
      clean
    );

  if (startsWithAgreement && !hasExplicitNewErrorAfterOk) {
    return true;
  }

  const pureGreeting =
    /^(hola|buenas|buenos dias|buenos días|buenas tardes|buenas noches|saludos|hey|alo|aló)(\s+(equipo|melvin|gerson|soporte|amigo|amigos|inge|ingeniero|como estan|cómo están))?$/i.test(
      clean
    );

  return pureGreeting;
}

// 2. Detect if a message actually describes a problem, error, bug, or support request
function classifyIssueCategory(text: string): {
  category: string;
  shortCategoryTag: string;
  isActualSupportProblem: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const lower = (text || '').toLowerCase();

  const urgentKeywords = [
    'urgente',
    'caido',
    'caído',
    'no funciona nada',
    'bloqueado',
    'no podemos facturar',
    'produccion',
    'producción',
    'error critico',
    'error crítico',
  ];

  const problemIndicators = [
    'error',
    'problema',
    'falla',
    'fallando',
    'fallo',
    'falló',
    'no deja',
    'no puedo',
    'no podemos',
    'no carga',
    'no sale',
    'no aparece',
    'no funciona',
    'no genera',
    'no transmite',
    'no envia',
    'no envía',
    'no cuadra',
    'ayuda',
    'ayudarme',
    'apoyo',
    'soporte',
    'revisar',
    'revisen',
    'arreglar',
    'corregir',
    'bug',
    'lento',
    'traba',
    'pegado',
    'rechaza',
    'rechazado',
    'inconveniente',
    'duda',
    'consulta sobre',
    'como hago',
    'cómo hago',
    'factura',
    'dte',
    'hacienda',
    'invalidacion',
    'invalidación',
    'credito fiscal',
    'crédito fiscal',
    'sello',
    'firmador',
    'contingencia',
    'planilla',
    'calculo',
    'cálculo',
    'permiso',
    'acceso',
    'contraseña',
    'login',
    'sincroniza',
    'base de datos',
  ];

  const isUrgent = urgentKeywords.some((k) => lower.includes(k));
  const hasProblemKeyword = problemIndicators.some((k) => lower.includes(k));
  const isClosingOrGreeting = isGreetingOrClosingAgreement(text);

  const isActualSupportProblem = (isUrgent || hasProblemKeyword) && !isClosingOrGreeting;

  let category = 'Soporte General / Consulta';
  let shortCategoryTag = 'Soporte';

  if (
    /dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia|sello|firmador/i.test(
      lower
    )
  ) {
    category = 'Facturación Electrónica / DTE / Hacienda';
    shortCategoryTag = 'Facturación DTE';
  } else if (/whatsapp|mensaje|cola|api|envio|envío|notificaci/i.test(lower)) {
    category = 'WhatsApp / Mensajería / API';
    shortCategoryTag = 'WhatsApp API';
  } else if (/login|acceso|usuario|permiso|contrase|rol|sesion|sesión/i.test(lower)) {
    category = 'Accesos / Usuarios / Permisos';
    shortCategoryTag = 'Accesos/Permisos';
  } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
    category = 'Reportes / Exportación / Datos';
    shortCategoryTag = 'Reportes';
  } else if (/calculo|cálculo|monto|iva|total|descuento|planilla|pago|cobro/i.test(lower)) {
    category = 'Cálculos / Finanzas / Pagos';
    shortCategoryTag = 'Cálculos/Pagos';
  } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
    category = 'Infraestructura / Base de Datos / Lentitud';
    shortCategoryTag = 'Base de Datos/Server';
  }

  return {
    category,
    shortCategoryTag,
    isActualSupportProblem,
    priority: isUrgent ? 'urgent' : 'high',
  };
}

function isGenericProblemTitle(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return (
    lower.length < 32 ||
    /tengo un problema|necesito ayuda|una consulta|me ayudan|hay un error|no funciona$/i.test(
      lower
    )
  );
}

async function resolveMainCompanyId(
  supabase: any,
  companyIdParam: string | null
): Promise<string | null> {
  if (companyIdParam) return companyIdParam;

  const { data: recentTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentTicket?.company_id) return recentTicket.company_id;

  const { data: mainProf } = await supabase
    .from('profiles')
    .select('company_id')
    .or('email.ilike.%jarias%,full_name.ilike.%Melvin%,full_name.ilike.%Gerson%')
    .not('company_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (mainProf?.company_id) return mainProf.company_id;

  const { data: comp } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return comp?.id || null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        ok: true,
        status: 'active',
        service: 'evolution-whatsapp-webhook (50379718911 - Tickets Only, Zero Leads)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey =
      Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('company_id');

    const eventType = String(payload?.event || payload?.type || 'messages.upsert').toLowerCase();
    const instanceName = payload?.instance || payload?.instanceName || 'soporte';

    const rawData = payload?.data || payload;
    const msgEntry = Array.isArray(rawData)
      ? rawData[0]
      : Array.isArray(rawData?.messages)
      ? rawData.messages[0]
      : rawData;

    const key = msgEntry?.key || payload?.key || {};
    const remoteJid: string =
      key?.remoteJid || msgEntry?.remoteJid || payload?.remoteJid || payload?.sender || '';

    if (!remoteJid || remoteJid === 'status@broadcast') {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'Status broadcast ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromMe: boolean = Boolean(key?.fromMe ?? msgEntry?.fromMe ?? false);
    const participant: string = key?.participant || msgEntry?.participant || '';
    const remoteJidAlt: string = key?.remoteJidAlt || msgEntry?.remoteJidAlt || '';
    const pushName: string =
      msgEntry?.pushName || payload?.pushName || payload?.sender || 'Cliente WhatsApp';

    const msgObj = msgEntry?.message || payload?.message || {};
    const messageText: string =
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.imageMessage?.caption ||
      msgObj?.videoMessage?.caption ||
      msgObj?.documentMessage?.caption ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.listResponseMessage?.title ||
      msgEntry?.body ||
      msgEntry?.text ||
      (msgObj?.imageMessage ? '[📷 Imagen enviada por WhatsApp]' : '') ||
      (msgObj?.audioMessage ? '[🎤 Nota de voz enviada por WhatsApp]' : '') ||
      (msgObj?.documentMessage
        ? `[📄 Documento: ${msgObj.documentMessage.fileName || 'Archivo'}]`
        : '') ||
      '';

    if (!messageText || messageText.trim().length < 1) {
      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          event: eventType,
          reason: 'No text or media content in payload',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isGroup = remoteJid.endsWith('@g.us');
    const isLid = remoteJid.endsWith('@lid') && !remoteJidAlt;

    const rawJidForPhone = remoteJidAlt || (isGroup ? participant : remoteJid);
    const digitsOnly = rawJidForPhone
      .replace(/@s\.whatsapp\.net|@g\.us|@c\.us|@lid/g, '')
      .replace(/\D/g, '');
    const isRealPhone = !isLid && digitsOnly.length >= 8 && digitsOnly.length <= 12;
    const cleanPhone = isRealPhone ? digitsOnly : '';

    const companyId = await resolveMainCompanyId(supabase, companyIdParam);
    if (!companyId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No company_id resolved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load internal company team profiles (Melvin, Gerson, etc.) so we know when a technician is speaking!
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_id', companyId);

    const matchedTechProfile = (companyProfiles || []).find((p: any) => {
      const fullName = (p.full_name || '').toLowerCase().trim();
      const senderLower = (pushName || '').toLowerCase().trim();
      if (!fullName || !senderLower || senderLower === 'cliente whatsapp') return false;
      if (fullName === senderLower) return true;
      if (
        (senderLower.includes('gerson') && fullName.includes('gerson')) ||
        (senderLower.includes('melvin') && fullName.includes('melvin'))
      ) {
        return true;
      }
      return false;
    });

    const isTeamStaffReply = fromMe || Boolean(matchedTechProfile);

    // ⚠️ IMPORTANT: NEVER call process_incoming_marketing_message and NEVER insert into `leads`!
    // We ONLY read `leads` (read-only) to see if the phone belongs to an existing client name.
    let matchedLead: { id: string; name: string; phone: string | null } | null = null;
    if (!isTeamStaffReply && cleanPhone && cleanPhone.length >= 8) {
      const last8 = cleanPhone.slice(-8);
      const { data: leadsByPhone } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .ilike('phone', `%${last8}%`)
        .limit(1);
      if (leadsByPhone && leadsByPhone.length > 0) {
        matchedLead = leadsByPhone[0];
      }
    }

    const clientDisplayName =
      matchedLead?.name ||
      (pushName && pushName !== 'Cliente WhatsApp'
        ? cleanPhone
          ? `${pushName} (+${cleanPhone})`
          : pushName
        : cleanPhone
        ? `WhatsApp +${cleanPhone}`
        : 'Cliente WhatsApp');

    const classification = classifyIssueCategory(messageText);
    const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/El_Salvador',
    });
    const senderLabel = isTeamStaffReply
      ? `👨‍💻 ${matchedTechProfile?.full_name || 'Equipo Soporte'}`
      : `👤 ${pushName || 'Cliente'}`;

    // Find if this client/group ALREADY has an active ticket (or one closed in the last 4 hours)
    const { data: recentClientTickets } = await supabase
      .from('tickets')
      .select(
        'id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at'
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(80);

    const matchingClientTickets = (recentClientTickets || []).filter((t: any) => {
      const meta = t.metadata || {};
      if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
      if (cleanPhone && meta.whatsapp_phone === cleanPhone) return true;
      if (matchedLead?.id && t.lead_id === matchedLead.id) return true;
      if (
        !isTeamStaffReply &&
        pushName &&
        pushName.length >= 4 &&
        t.lead_name &&
        t.lead_name.toLowerCase().includes(pushName.toLowerCase())
      ) {
        return true;
      }
      return false;
    });

    const activeTicket = matchingClientTickets.find((t: any) =>
      ['new', 'open', 'pending'].includes(t.status)
    );

    const recentlyClosedTicket = !activeTicket
      ? matchingClientTickets.find((t: any) => {
          if (!['resolved', 'closed'].includes(t.status)) return false;
          const closedTime = new Date(t.resolved_at || t.created_at).getTime();
          const hoursSinceClosed = (Date.now() - closedTime) / (1000 * 60 * 60);
          return hoursSinceClosed <= 4;
        })
      : null;

    const isResolutionReply =
      isTeamStaffReply &&
      /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(
        messageText
      );

    // ─── CASE A: Client/Group ALREADY has an open/pending Ticket ──────────────
    // Append all 40 messages into THIS SAME TICKET (both in Notas and in Descripción)!
    if (activeTicket) {
      await supabase.from('ticket_comments').insert({
        ticket_id: activeTicket.id,
        company_id: companyId,
        author_id: matchedTechProfile?.id || null,
        body: `[${nowTimeStr}] ${senderLabel}: ${messageText}`,
        is_internal: false,
      });

      const currentMeta = activeTicket.metadata || {};
      const msgCount = Number(currentMeta.whatsapp_message_count || 1) + 1;

      const shouldUpgradeProblemTitle =
        !isTeamStaffReply &&
        classification.isActualSupportProblem &&
        isGenericProblemTitle(activeTicket.title) &&
        messageText.length >= 15;

      const prevDesc = activeTicket.description || '';
      const newChatLine = `[${nowTimeStr}] ${senderLabel}: ${messageText}`;
      const updatedDescription = prevDesc.includes('💬 Historial de WhatsApp:')
        ? `${prevDesc}\n${newChatLine}`
        : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${newChatLine}`;

      const updatedFields: Record<string, any> = {
        description: updatedDescription,
        updated_at: new Date().toISOString(),
        metadata: {
          ...currentMeta,
          whatsapp_message_count: msgCount,
          last_whatsapp_message: messageText.slice(0, 200),
          last_whatsapp_at: new Date().toISOString(),
          ai_category: shouldUpgradeProblemTitle
            ? classification.category
            : currentMeta.ai_category || classification.category,
        },
      };

      // Auto-assign ticket to Melvin or Gerson if they reply to it and it was unassigned!
      if (matchedTechProfile?.id && !activeTicket.assigned_to) {
        updatedFields.assigned_to = matchedTechProfile.id;
      }

      if (shouldUpgradeProblemTitle) {
        const cleanSnippet =
          messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();
        updatedFields.title = `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${cleanSnippet}`;
      }

      if (isResolutionReply) {
        updatedFields.status = 'resolved';
        updatedFields.resolved_at = new Date().toISOString();
        updatedFields.last_status_change_at = new Date().toISOString();
        updatedFields.solution = messageText;
      }

      await supabase.from('tickets').update(updatedFields).eq('id', activeTicket.id);

      return new Response(
        JSON.stringify({
          ok: true,
          action: isResolutionReply ? 'ticket_resolved' : 'message_appended_to_existing_ticket',
          ticket_id: activeTicket.id,
          total_messages_in_ticket: msgCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE B: Sender is a Team Member (Melvin/Gerson) and no open ticket exists
    // Never create a support ticket where Melvin or Gerson is the "client"!
    if (isTeamStaffReply) {
      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          reason: 'Staff message with no open ticket — ignored so staff never creates self-tickets',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE C: Message is an agreement/courtesy/greeting ("ok, de acuerdo, esta bien...", "Hola", "Gracias")
    if (!classification.isActualSupportProblem) {
      if (recentlyClosedTicket) {
        await supabase.from('ticket_comments').insert({
          ticket_id: recentlyClosedTicket.id,
          company_id: companyId,
          body: `[${nowTimeStr}] ${senderLabel}: ${messageText}`,
          is_internal: false,
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          action: 'non_problem_message_ignored',
          reason: 'Greeting or agreement reply — no ticket or lead created',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE D: Client reports an ACTUAL PROBLEM and has NO open ticket ─────
    // Create 1 consolidated Ticket in `tickets` ONLY (NEVER in `leads`!)
    const shortTitle =
      messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();

    const previousSameCategoryTicket = matchingClientTickets.find(
      (t: any) =>
        ['resolved', 'closed'].includes(t.status) &&
        t.metadata?.ai_category === classification.category
    );

    const initialDescription = [
      `📌 PROBLEMA REPORTADO (${classification.category}):`,
      messageText.trim(),
      ``,
      `💬 Historial de WhatsApp:`,
      `[${nowTimeStr}] ${senderLabel}: ${messageText.trim()}`,
    ].join('\n');

    const { data: createdTicket, error: insertError } = await supabase
      .from('tickets')
      .insert({
        company_id: companyId,
        lead_id: matchedLead?.id || null,
        lead_name: clientDisplayName,
        parent_ticket_id: previousSameCategoryTicket?.id || null,
        title: `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${shortTitle}`,
        description: initialDescription,
        status: 'open',
        priority: classification.priority,
        metadata: {
          source: 'whatsapp_evolution',
          support_phone: '50379718911',
          evolution_instance: instanceName,
          whatsapp_jid: remoteJid,
          whatsapp_phone: cleanPhone,
          whatsapp_push_name: pushName,
          is_group: isGroup,
          ai_category: classification.category,
          whatsapp_message_count: 1,
          is_recurring_client_issue: Boolean(previousSameCategoryTicket),
          previous_ticket_id: previousSameCategoryTicket?.id || null,
        },
      })
      .select('id, title')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (createdTicket?.id) {
      await supabase.from('ticket_comments').insert({
        ticket_id: createdTicket.id,
        company_id: companyId,
        body: `[${nowTimeStr}] ${senderLabel} (Reporte Inicial): ${messageText}`,
        is_internal: false,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: 'ticket_created',
        ticket_id: createdTicket?.id,
        title: createdTicket?.title,
        is_recurring: Boolean(previousSameCategoryTicket),
        category: classification.category,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[evolution-whatsapp-webhook] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
