import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[email-webhook] Payload received:', JSON.stringify(body));

    // Resend Inbound Webhook payload:
    // { type: "email.received", data: { from: "...", to: "...", subject: "...", text: "...", html: "..." } }
    // or direct payload: { from: "...", subject: "...", text: "..." }
    const emailData = body.data || body;
    const rawFrom = emailData.from || '';
    const subject = emailData.subject || 'Sin asunto';
    const textContent = emailData.text || emailData.html || 'Mensaje de correo entrante';

    // Parse email address from "Sender Name <sender@example.com>" or "sender@example.com"
    const emailMatch = rawFrom.match(/<([^>]+)>/) || [null, rawFrom.trim()];
    const senderEmail = (emailMatch[1] || rawFrom).trim().toLowerCase();

    if (!senderEmail || !senderEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'No valid sender email found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[email-webhook] Processing inbound email from: ${senderEmail}`);

    // Find lead by email in database
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, company_id, name, status, reengaged_at')
      .ilike('email', senderEmail)
      .limit(1)
      .maybeSingle();

    if (leadErr) {
      console.error('[email-webhook] Lead lookup error:', leadErr);
    }

    if (!lead) {
      console.log(`[email-webhook] No lead found for email ${senderEmail}. Ignoring.`);
      return new Response(JSON.stringify({ message: 'No matching lead found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyId = lead.company_id;
    const BACKGROUND_STATUSES = ['Llamada fría', 'En Nutrición'];
    const originalStatus = lead.status;

    // Check if lead is in pool (Llamada fría / En Nutrición) and needs recovery
    if (BACKGROUND_STATUSES.includes(originalStatus)) {
      const now = new Date().toISOString();
      console.log(`[email-webhook] ♻️ Re-engaging lead ${lead.id} (${lead.name}) from '${originalStatus}' via email`);

      // 1. Update lead to active pipeline ('En seguimiento') + set attribution metadata
      await supabase
        .from('leads')
        .update({
          status: 'En seguimiento',
          reengaged_from: originalStatus,
          reengaged_via: 'email',
          reengaged_at: now,
        })
        .eq('id', lead.id);

      // 2. Log nota en lead_notes (no requiere user_id)
      await supabase.from('lead_notes').insert({
        lead_id: lead.id,
        company_id: companyId,
        content: `♻️ Lead re-enganchado automáticamente desde pool de campañas (${originalStatus}) — respondió por Email`,
        created_at: now,
      }).maybeSingle(); // ignore error if table doesn't exist
    }

    // 3. Store conversation and inbound message via RPC
    const { error: rpcErr } = await supabase.rpc('process_incoming_marketing_message', {
      p_company_id: companyId,
      p_channel: 'email',
      p_external_id: senderEmail,
      p_sender_name: lead.name || senderEmail,
      p_content: `[Asunto: ${subject}] ${textContent}`,
      p_metadata: { subject, from: senderEmail },
    });

    if (rpcErr) {
      console.error('[email-webhook] RPC error saving message:', rpcErr);
    }

    const wasReengaged = BACKGROUND_STATUSES.includes(originalStatus) && !lead.reengaged_at;
    return new Response(JSON.stringify({ success: true, lead_id: lead.id, reengaged: wasReengaged }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[email-webhook] Exception:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
