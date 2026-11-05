import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

// Classification patterns to detect support problems vs general messages
function classifyIssueCategory(text: string): {
  category: string;
  isSupportIssue: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const lower = text.toLowerCase();

  const urgentKeywords = ['urgente', 'caido', 'caído', 'no funciona nada', 'bloqueado', 'no podemos facturar', 'produccion', 'producción', 'error critico', 'error crítico'];
  const supportKeywords = [
    'error', 'problema', 'falla', 'fallando', 'no deja', 'no puedo', 'no carga',
    'no sale', 'no aparece', 'ayuda', 'soporte', 'bug', 'lento', 'traba',
    'factura', 'dte', 'hacienda', 'invalidacion', 'invalidación', 'correo',
    'whatsapp', 'mensaje', 'reporte', 'planilla', 'calculo', 'cálculo',
    'permiso', 'acceso', 'contraseña', 'login', 'sincroniza', 'base de datos',
    'cobro', 'pago', 'impresora', 'ticket', 'pendiente', 'arreglar', 'revisar'
  ];

  const isSupportIssue = supportKeywords.some((k) => lower.includes(k)) || urgentKeywords.some((k) => lower.includes(k));
  const isUrgent = urgentKeywords.some((k) => lower.includes(k));

  let category = 'Soporte General / Consulta';
  if (/dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia/i.test(lower)) {
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

  return {
    category,
    isSupportIssue,
    priority: isUrgent ? 'urgent' : isSupportIssue ? 'high' : 'medium',
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('company_id');

    // Evolution API v1/v2 payload normalization
    const eventType = payload?.event || payload?.type || 'messages.upsert';
    const instanceName = payload?.instance || payload?.instanceName || 'arias';
    const data = payload?.data || payload;

    // Only process incoming/outgoing message upserts
    if (!String(eventType).toLowerCase().includes('message')) {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: `Event ${eventType} ignored` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const key = data?.key || {};
    const remoteJid: string = key?.remoteJid || data?.remoteJid || '';
    const fromMe: boolean = Boolean(key?.fromMe ?? data?.fromMe ?? false);
    const participant: string = key?.participant || data?.participant || '';
    const pushName: string = data?.pushName || payload?.sender || 'Cliente WhatsApp';

    // Extract text message from standard/extended/image caption/conversation
    const msgObj = data?.message || {};
    const messageText: string =
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.imageMessage?.caption ||
      msgObj?.videoMessage?.caption ||
      msgObj?.documentMessage?.caption ||
      data?.body ||
      data?.text ||
      '';

    if (!messageText || messageText.trim().length < 3) {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'Empty or non-text message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isGroup = remoteJid.endsWith('@g.us');
    const cleanPhone = (isGroup ? participant : remoteJid)
      .replace(/@s\.whatsapp\.net|@g\.us|@c\.us/g, '')
      .replace(/\D/g, '');

    // Resolve company_id
    let companyId = companyIdParam;
    if (!companyId) {
      const { data: comp } = await supabase
        .from('companies')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      companyId = comp?.id || null;
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No company_id resolved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to match existing Lead by phone or pushName
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

    const clientDisplayName = matchedLead?.name || pushName || `WhatsApp +${cleanPhone}`;
    const classification = classifyIssueCategory(messageText);

    // Check if there is already an open/pending ticket for this client or WhatsApp JID in the last 72h
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('id, title, status, metadata, description')
      .eq('company_id', companyId)
      .in('status', ['new', 'open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(40);

    const openForSameClient = (existingTickets || []).find((t: any) => {
      const meta = t.metadata || {};
      if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
      if (cleanPhone && meta.whatsapp_phone === cleanPhone) return true;
      if (matchedLead?.id && t.lead_id === matchedLead.id) return true;
      return false;
    });

    // If message is from technician/support (fromMe) or matches a resolution phrase on an existing open ticket
    const isResolutionReply =
      fromMe &&
      /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(messageText);

    if (openForSameClient) {
      // Append message to ticket_comments and optionally mark resolved if team confirmed fix
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
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If it's a new incoming support issue from a client, create a ticket automatically
    if (!fromMe && classification.isSupportIssue) {
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
            evolution_instance: instanceName,
            whatsapp_jid: remoteJid,
            whatsapp_phone: cleanPhone,
            whatsapp_push_name: pushName,
            is_group: isGroup,
            ai_category: classification.category,
          },
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          action: 'ticket_created',
          ticket_id: createdTicket?.id,
          category: classification.category,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, ignored: true, reason: 'Non-support casual message' }),
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

