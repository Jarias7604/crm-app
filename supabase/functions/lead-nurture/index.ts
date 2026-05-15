import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ── TIMING CONFIG ─────────────────────────────────────────────────────────────
const ORPHAN_HOURS  = [0, 72, 168];  // Send at: Day 0, Day 3, Day 7
const RESCUE_HOURS  = [48, 72];      // Quote rescue: 48h, 72h after quote

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

// ── EMAIL BUILDER: ORPHAN SEQUENCE ───────────────────────────────────────────
function buildOrphanEmail(step: number, lead: any, agentName: string) {
  const first = (lead.name || 'Estimado cliente').split(' ')[0];
  const co    = lead.company_name ? ` a <strong>${lead.company_name}</strong>` : '';

  const subjects = [
    `${first}, conozca la solución DTE líder en El Salvador 🚀`,
    `${first}, ¿recibió nuestra información? ✉️`,
    `Oferta especial para ${lead.company_name || first} — válida por 48 h ⏳`,
  ];

  const bodies = [
    `Hola ${first},<br><br>Nos comunicamos desde <strong>Arias Defense Components</strong>. Somos la solución #1 en El Salvador para <strong>Facturación Electrónica DTE</strong> y <strong>ERP empresarial</strong>.<br><br>Podemos ayudar${co} a cumplir al 100% con el Ministerio de Hacienda, automatizar su facturación y controlar su inventario — todo en un solo sistema.`,
    `Hola ${first},<br><br>Hace unos días le enviamos información sobre nuestra plataforma DTE. Queremos asegurarnos de que la recibió y resolver cualquier duda que tenga.<br><br>Muchas empresas como la suya ya están ahorrando horas al mes gracias a nuestra automatización.`,
    `Hola ${first},<br><br>Este es nuestro último mensaje y queremos hacerle una propuesta especial. Por las próximas <strong>48 horas</strong>, le ofrecemos implementación gratuita y 2 meses de soporte incluido — sin costo adicional.`,
  ];

  const ctas = [
    { text: '📅 Agendar Demo Gratis', color: '#1e3a8a' },
    { text: '💬 Hablar con un Experto', color: '#1d4ed8' },
    { text: '🔥 Reclamar Oferta Especial', color: '#dc2626' },
  ];

  const { text, color } = ctas[step - 1];
  const waLink = `https://wa.me/50371978911?text=Hola%2C+me+interesa+la+solución+DTE`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:36px;text-align:center">
    <h1 style="color:white;margin:0;font-size:26px;font-weight:800">⚡ Arias Defense Components</h1>
    <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px">Facturación Electrónica DTE · ERP · El Salvador</p>
  </div>
  <div style="padding:36px">
    <p style="font-size:16px;line-height:1.7;color:#374151">${bodies[step - 1]}</p>
    <div style="background:#eff6ff;border-left:4px solid #1e3a8a;padding:18px;border-radius:0 10px 10px 0;margin:24px 0">
      <p style="margin:0;font-weight:700;color:#1e3a8a">✅ Por qué elegir Arias Defense:</p>
      <ul style="margin:10px 0 0;color:#374151;padding-left:20px;line-height:2">
        <li>DTE 100% legal — Ministerio de Hacienda El Salvador</li>
        <li>ERP completo: inventario, CxC, nómina, reportes</li>
        <li>Implementación en 48 horas</li>
        <li>Soporte local en español — equipo en El Salvador</li>
      </ul>
    </div>
    <div style="text-align:center;margin:32px 0">
      <a href="${waLink}" style="background:${color};color:white;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">${text}</a>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px">O llámenos: <strong>7197-8911</strong> · <a href="mailto:ventas@ariasdefense.com" style="color:#1d4ed8">ventas@ariasdefense.com</a><br>${agentName} — Arias Defense Components</p>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="font-size:11px;color:#9ca3af;margin:0">Arias Defense Components · El Salvador · <a href="mailto:ventas@ariasdefense.com" style="color:#9ca3af">Cancelar suscripción</a></p>
  </div>
</div></body></html>`;

  return { subject: subjects[step - 1], html };
}

// ── EMAIL BUILDER: QUOTE RESCUE ───────────────────────────────────────────────
function buildQuoteRescueEmail(step: number, lead: any, agentName: string) {
  const first = (lead.name || 'Estimado cliente').split(' ')[0];
  const urgent = step === 2;

  const subject = urgent
    ? `🚨 ${first}, última oportunidad — su cotización vence hoy`
    : `⏰ ${first}, su cotización está por vencer`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,${urgent ? '#991b1b,#dc2626' : '#92400e,#d97706'});padding:36px;text-align:center">
    <h1 style="color:white;margin:0;font-size:26px">${urgent ? '🚨 Cotización por Vencer Hoy' : '⏰ Su Cotización Vence Pronto'}</h1>
    <p style="color:${urgent ? '#fecaca' : '#fef3c7'};margin:8px 0 0;font-size:14px">Arias Defense Components</p>
  </div>
  <div style="padding:36px">
    <p style="font-size:16px;line-height:1.7;color:#374151">
      Hola ${first},<br><br>
      ${urgent
        ? `Este es nuestro aviso final. Su cotización de <strong>Facturación Electrónica DTE</strong> vence <strong>hoy</strong>. Después de esta fecha, los precios y condiciones pueden cambiar.<br><br>Si tiene alguna duda, nuestro equipo está disponible ahora mismo.`
        : `Le recordamos que su cotización de <strong>Facturación Electrónica DTE</strong> está próxima a vencer. Los precios actuales están garantizados por tiempo limitado.<br><br>Confirme ahora para asegurar estas condiciones.`}
    </p>
    <div style="text-align:center;margin:32px 0">
      <a href="https://wa.me/50371978911?text=Hola%2C+quiero+confirmar+mi+cotización"
         style="background:${urgent ? '#dc2626' : '#d97706'};color:white;padding:16px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
        ${urgent ? '🔥 Confirmar Ahora — Última Oportunidad' : '✅ Confirmar Mi Cotización'}
      </a>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px">Llámenos: <strong>7197-8911</strong><br>${agentName} — Arias Defense Components</p>
  </div>
</div></body></html>`;

  return { subject, html };
}

// ── SEND EMAIL via RESEND ─────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, apiKey: string, from: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) { console.error('[lead-nurture] Resend error:', await res.text()); return false; }
    return true;
  } catch (e) { console.error('[lead-nurture] Send exception:', e); return false; }
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logs: string[] = [];
  const log = (...args: any[]) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };

  try {
    const body  = await req.json().catch(() => ({}));
    const coId  = body?.company_id || null;
    log(`[lead-nurture v1] Starting. Target: ${coId || 'ALL'}`);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY');

    // Get active AI agents (one per company)
    let agentsQ = supabase.from('marketing_ai_agents').select('company_id,name,settings').eq('is_active', true);
    if (coId) agentsQ = agentsQ.eq('company_id', coId);
    const { data: agents } = await agentsQ;
    if (!agents?.length) { log('No active agents'); return new Response(JSON.stringify({ success: true, logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    let sent = 0, skipped = 0, errors = 0;
    const now = new Date();

    for (const agent of agents) {
      const companyId  = agent.company_id;
      const agentName  = agent.name || 'Sofía';
      const fromEmail  = agent.settings?.email_from || 'ventas@ariasdefense.com';
      const fromDisplay = `${agentName} — Arias Defense <${fromEmail}>`;

      // ── ORPHAN LEADS ───────────────────────────────────────────────────────
      const { data: rawLeads } = await supabase.from('leads')
        .select('id,name,email,company_name,status,created_at')
        .eq('company_id', companyId)
        .not('email', 'is', null)
        .not('status', 'in', '("cerrado","perdido")')
        .gt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
        .limit(60);

      const { data: activeConvs } = await supabase.from('marketing_conversations')
        .select('lead_id').eq('company_id', companyId).eq('status', 'active');
      const activeIds = new Set((activeConvs || []).map((c: any) => c.lead_id));

      const orphans = (rawLeads || []).filter(l => !activeIds.has(l.id) && l.email);
      log(`Company ${companyId}: ${orphans.length} orphan leads`);

      for (const lead of orphans) {
        const { data: mem } = await supabase.from('lead_ai_memory').select('known_facts').eq('lead_id', lead.id).maybeSingle();
        const facts       = mem?.known_facts || {};
        const seqStep     = facts.email_seq_step  || 0;
        const lastSentAt  = facts.email_seq_last_sent;
        const hoursLast   = lastSentAt ? hoursSince(lastSentAt) : null;
        const hoursInCRM  = hoursSince(lead.created_at);

        let step = 0;
        if (seqStep === 0 && hoursInCRM >= ORPHAN_HOURS[0]) step = 1;
        else if (seqStep === 1 && hoursLast && hoursLast >= ORPHAN_HOURS[1]) step = 2;
        else if (seqStep === 2 && hoursLast && hoursLast >= (ORPHAN_HOURS[2] - ORPHAN_HOURS[1])) step = 3;

        if (!step || seqStep >= 3) { skipped++; continue; }

        const { subject, html } = buildOrphanEmail(step, lead, agentName);
        const ok = await sendEmail(lead.email, subject, html, resendKey, fromDisplay);

        if (ok) {
          await supabase.from('lead_ai_memory').upsert(
            { lead_id: lead.id, company_id: companyId, known_facts: { ...facts, email_seq_step: step, email_seq_last_sent: now.toISOString() }, updated_at: now.toISOString() },
            { onConflict: 'lead_id' }
          );
          log(`✅ Orphan email ${step} → ${lead.name} (${lead.email})`);
          sent++;
        } else errors++;
      }

      // ── QUOTE RESCUE ───────────────────────────────────────────────────────
      const { data: quotedLeads } = await supabase.from('leads')
        .select('id,name,email,company_name')
        .eq('company_id', companyId).eq('status', 'cotizado').not('email', 'is', null);

      for (const lead of (quotedLeads || [])) {
        const { data: mem } = await supabase.from('lead_ai_memory').select('known_facts').eq('lead_id', lead.id).maybeSingle();
        const facts         = mem?.known_facts || {};
        const quoteAt       = facts.quote_created_at;
        if (!quoteAt) { skipped++; continue; }

        const hoursQuote     = hoursSince(quoteAt);
        const rescueStep     = facts.quote_rescue_step     || 0;
        const lastRescueAt   = facts.quote_rescue_last_sent;
        const hoursRescue    = lastRescueAt ? hoursSince(lastRescueAt) : null;

        let step = 0;
        if (rescueStep === 0 && hoursQuote >= RESCUE_HOURS[0]) step = 1;
        else if (rescueStep === 1 && hoursRescue && hoursRescue >= 24) step = 2;

        if (!step || rescueStep >= 2) { skipped++; continue; }

        const { subject, html } = buildQuoteRescueEmail(step, lead, agentName);
        const ok = await sendEmail(lead.email, subject, html, resendKey, fromDisplay);

        if (ok) {
          await supabase.from('lead_ai_memory').upsert(
            { lead_id: lead.id, company_id: companyId, known_facts: { ...facts, quote_rescue_step: step, quote_rescue_last_sent: now.toISOString() }, updated_at: now.toISOString() },
            { onConflict: 'lead_id' }
          );
          log(`🚨 Quote rescue ${step} → ${lead.name} (${lead.email})`);
          sent++;
        } else errors++;
      }
    }

    log(`[lead-nurture] Done. Sent:${sent} Skipped:${skipped} Errors:${errors}`);
    return new Response(JSON.stringify({ success: true, sent, skipped, errors, logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[lead-nurture] Fatal:', err);
    return new Response(JSON.stringify({ error: err.message, logs }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
