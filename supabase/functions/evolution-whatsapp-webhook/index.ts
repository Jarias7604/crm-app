import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

function classifyIssueCategory(text: string): {
  category: string;
  isSupportIssue: boolean;
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

  const isUrgent = urgentKeywords.some((k) => lower.includes(k));

  let category = 'Soporte General / Consulta WhatsApp';
  if (
    /dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia|sello|firmador/i.test(
      lower
    )
  ) {
    category = 'Facturación Electrónica / DTE / Hacienda';
  } else if (/whatsapp|mensaje|cola|api|envio|envío|notificaci/i.test(lower)) {
    category = 'WhatsApp / Mensajería / API';
  } else if (/login|acceso|usuario|permiso|contrase|rol|sesion|sesión/i.test(lower)) {
    category = 'Accesos / Usuarios / Permisos';
  } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
    category = 'Reportes / Exportación / Datos';
  } else if (/calculo|cálculo|monto|iva|total|descuento|planilla|pago|cobro/i.test(lower)) {
    category = 'Cálculos / Finanzas / Pagos';
  } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
    category = 'Infraestructura / Base de Datos / Lentitud';
  }

  // Every incoming message to the dedicated support number 50379718911 is treated as support
  return {
    category,
    isSupportIssue: true,
    priority: isUrgent ? 'urgent' : 'high',
  };
}

async function resolveMainCompanyId(supabase: any, companyIdParam: string | null): Promise<string | null> {
  if (companyIdParam) return companyIdParam;

  // 1. Prefer the company that already has active tickets (General / Principal workspace)
  const { data: recentTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentTicket?.company_id) return recentTicket.company_id;

  // 2. Fallback to Melvin / Gerson / Jarias profile company_id
  const { data: mainProf } = await supabase
    .from('profiles')
    .select('company_id')
    .or('email.ilike.%jarias%,full_name.ilike.%Melvin%,full_name.ilike.%Gerson%')
    .not('company_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (mainProf?.company_id) return mainProf.company_id;

  // 3. Fallback to first company
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
        service: 'evolution-whatsapp-webhook (50379718911)',
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

    // Accept messages.upsert, send.message, or any payload containing message data
    const rawData = payload?.data || payload;
    const msgEntry = Array.isArray(rawData)
      ? rawData[0]
      : Array.isArray(rawData?.messages)
      ? rawData.messages[0]
      : rawData;

    const key = msgEntry?.key || payload?.key || {};
    const remoteJid: string =
      key?.remoteJid || msgEntry?.remoteJid || payload?.remoteJid || payload?. sender || '';

    if (remoteJid === 'status@broadcast') {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'Status broadcast ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromMe: boolean = Boolean(key?.fromMe ?? msgEntry?.fromMe ?? false);
    const participant: string = key?.participant || msgEntry?.participant || '';
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
      (msgObj?.imageMessage ? '[Imagen enviada por WhatsApp]' : '') ||
      (msgObj?.audioMessage ? '[Nota de voz enviada por WhatsApp]' : '') ||
      (msgObj?.documentMessage ? `[Documento: ${msgObj.documentMessage.fileName || 'Archivo'}]` : '') ||
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
    const cleanPhone = (isGroup ? participant || remoteJid : remoteJid)
      .replace(/@s\.whatsapp\.net|@g\.us|@c\.us|@lid/g, '')
      .replace(/\D/g, '');

    const companyId = await resolveMainCompanyId(supabase, companyIdParam);
    if (!companyId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No company_id resolved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Match existing Lead or Client by phone or name
    let matchedLead: { id: string; name: string; phone: string | null } | null = null;
    if (cleanPhone && cleanPhone.length >= 7) {
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

    if (!matchedLead && pushName && pushName !== 'Cliente WhatsApp') {
      const { data: leadsByName } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .ilike('name', `%${pushName.trim()}%`)
        .limit(1);
      if (leadsByName && leadsByName.length > 0) {
        matchedLead = leadsByName[0];
      }
    }

    const clientDisplayName =
      matchedLead?.name ||
      (pushName && pushName !== 'Cliente WhatsApp'
        ? `${pushName} (${cleanPhone ? `+${cleanPhone}` : 'WhatsApp'})`
        : cleanPhone
        ? `WhatsApp +${cleanPhone}`
        : 'Cliente WhatsApp');

    const classification = classifyIssueCategory(messageText);

    // Also mirror the message into Mensajes (marketing_conversations / marketing_messages) if RPC exists
    try {
      if (cleanPhone && !fromMe) {
        await supabase.rpc('process_incoming_marketing_message', {
          p_company_id: companyId,
          p_channel: 'whatsapp',
          p_external_id: cleanPhone,
          p_sender_name: clientDisplayName,
          p_content: messageText,
          p_metadata: {
            source: 'whatsapp_evolution_support',
            support_phone: '50379718911',
            evolution_instance: instanceName,
            whatsapp_jid: remoteJid,
            phone: `+${cleanPhone}`,
            chat_id: cleanPhone,
          },
        });
      }
    } catch (chatErr) {
      console.warn('[evolution-whatsapp-webhook] Non-fatal chat mirror warning:', chatErr);
    }

    // Check if there is already an open/pending ticket for this client or WhatsApp JID
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, title, status, metadata, description, lead_id')
      .eq('company_id', companyId)
      .in('status', ['new', 'open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(60);

    const openForSameClient = (existingTickets || []).find((t: any) => {
      const meta = t.metadata || {};
      if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
      if (cleanPhone && cleanPhone.length >= 7 && meta.whatsapp_phone === cleanPhone) return true;
      if (matchedLead?.id && t.lead_id === matchedLead.id) return true;
      return false;
    });

    const isResolutionReply =
      fromMe &&
      /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(
        messageText
      );

    if (openForSameClient) {
      await supabase.from('ticket_comments').insert({
        ticket_id: openForSameClient.id,
        company_id: companyId,
        body: `[WhatsApp ${fromMe ? 'Equipo Soporte' : clientDisplayName}]: ${messageText}`,
        is_internal: false,
      });

      if (isResolutionReply) {
        await supabase
          .from('tickets')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            last_status_change_at: new Date().toISOString(),
            solution: messageText,
          })
          .eq('id', openForSameClient.id);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: isResolutionReply ? 'ticket_resolved' : 'comment_added',
          ticket_id: openForSameClient.id,
          company_id: companyId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a new Ticket automatically (including test messages or incoming client messages)
    const isTestMessage = /prueba|test|probando|hola/i.test(messageText);
    if (!fromMe || isTestMessage) {
      const shortTitle =
        messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();

      const { data: createdTicket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          company_id: companyId,
          lead_id: matchedLead?.id || null,
          lead_name: clientDisplayName,
          title: `[WhatsApp] ${clientDisplayName}: ${shortTitle}`,
          description: messageText,
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
          },
        })
        .select('id, title')
        .single();

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: 'ticket_created',
          ticket_id: createdTicket?.id,
          title: createdTicket?.title,
          company_id: companyId,
          category: classification.category,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, ignored: true, reason: 'Outgoing non-resolution message' }),
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
