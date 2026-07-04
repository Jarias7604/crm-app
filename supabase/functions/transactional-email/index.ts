import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform owner company_id (Arias Defense) — fallback email sender
const PLATFORM_OWNER_COMPANY_ID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

async function getResendConfig(supabase: any, companyId: string) {
  // 1. Try tenant's own Resend config
  const { data: tenantResend } = await supabase
    .from('marketing_integrations')
    .select('settings')
    .eq('company_id', companyId)
    .eq('provider', 'resend')
    .eq('is_active', true)
    .maybeSingle();

  if (tenantResend?.settings?.apiKey) return tenantResend.settings;

  // 2. Fallback to platform owner (Arias Defense)
  const { data: platformResend } = await supabase
    .from('marketing_integrations')
    .select('settings')
    .eq('company_id', PLATFORM_OWNER_COMPANY_ID)
    .eq('provider', 'resend')
    .eq('is_active', true)
    .maybeSingle();

  return platformResend?.settings || null;
}

function buildWelcomeEmail(data: {
  companyName: string;
  adminName: string;
  adminEmail: string;
  trialDays: number;
  loginUrl: string;
  senderName: string;
}) {
  const { companyName, adminName, trialDays, loginUrl, senderName } = data;
  const firstName = adminName.split(' ')[0] || adminName;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bienvenido a ${senderName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);padding:40px 40px 32px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:3px;text-transform:uppercase;">${senderName} · CRM PROFESIONAL</p>
      <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;color:white;line-height:1.2;">¡Bienvenido, ${firstName}! 🎉</h1>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">Tu cuenta de <strong>${companyName}</strong> ha sido creada exitosamente.</p>
    </td>
  </tr>

  <!-- TRIAL BADGE -->
  <tr>
    <td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-top:-1px;">
        <tr><td style="padding:16px 20px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:28px;padding-right:12px;">✅</td>
            <td>
              <p style="margin:0;font-size:13px;font-weight:800;color:#15803d;">Trial gratuito de ${trialDays} días activado</p>
              <p style="margin:2px 0 0;font-size:11px;color:#16a34a;">Sin tarjeta de crédito requerida. Cancela cuando quieras.</p>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:32px 40px 24px;">
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">
        Tu CRM está listo para usar. Desde el primer día puedes gestionar leads, crear cotizaciones profesionales, 
        sincronizar tu calendario y usar la IA para cerrar más negocios.
      </p>

      <!-- FEATURE LIST -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['🎯', 'Leads & Pipeline', 'Gestiona todo tu embudo de ventas'],
          ['📄', 'Cotizaciones PDF', 'Crea propuestas profesionales con IA'],
          ['📅', 'Calendario', 'Sincroniza con Google Calendar'],
          ['🤖', 'AI Consultant', 'Cierra más tratos con inteligencia artificial'],
          ['📣', 'Marketing Hub', 'Campañas por Email, WhatsApp y más'],
        ].map(([icon, title, desc]) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:20px;padding-right:12px;width:32px;">${icon}</td>
              <td>
                <p style="margin:0;font-size:13px;font-weight:700;color:#1e293b;">${title}</p>
                <p style="margin:1px 0 0;font-size:11px;color:#94a3b8;">${desc}</p>
              </td>
            </tr></table>
          </td>
        </tr>`).join('')}
      </table>

      <!-- CTA BUTTON -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:8px 0 24px;">
          <a href="${loginUrl}" style="display:inline-block;background:#4f46e5;color:white;font-size:14px;font-weight:900;padding:16px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;">
            Ir a mi CRM ahora →
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
        O copia este enlace: <a href="${loginUrl}" style="color:#4f46e5;">${loginUrl}</a>
      </p>
    </td>
  </tr>

  <!-- NEXT STEPS -->
  <tr>
    <td style="padding:0 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 14px;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Primeros pasos recomendados</p>
          ${[
            ['1', 'Invita a tu equipo', 'Menú → Empresa → Equipo'],
            ['2', 'Agrega tus primeros leads', 'Menú → Leads → Nuevo Lead'],
            ['3', 'Configura tu branding', 'Menú → Empresa → Marca'],
          ].map(([n, title, hint]) => `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr>
            <td width="28" valign="top">
              <div style="width:24px;height:24px;background:#4f46e5;border-radius:50%;text-align:center;line-height:24px;font-size:11px;font-weight:900;color:white;">${n}</div>
            </td>
            <td style="padding-left:10px;">
              <p style="margin:0;font-size:12px;font-weight:700;color:#1e293b;">${title}</p>
              <p style="margin:1px 0 0;font-size:10px;color:#94a3b8;">${hint}</p>
            </td>
          </tr></table>`).join('')}
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;">
      <p style="margin:0;font-size:10px;color:#94a3b8;text-align:center;">
        © ${new Date().getFullYear()} ${senderName} · Este es un mensaje automático, no respondas a este correo.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildTrialExpiryEmail(data: {
  companyName: string;
  adminName: string;
  daysLeft: number;
  expiryDate: string;
  billingUrl: string;
  senderName: string;
}) {
  const { companyName, adminName, daysLeft, expiryDate, billingUrl, senderName } = data;
  const firstName = adminName.split(' ')[0] || adminName;
  const isUrgent = daysLeft <= 1;
  const headerColor = isUrgent ? '#dc2626' : '#f59e0b';
  const emoji = isUrgent ? '🚨' : '⏰';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${emoji} Tu trial vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <tr>
    <td style="background:${headerColor};padding:32px 40px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">${senderName} · AVISO IMPORTANTE</p>
      <h1 style="margin:0;font-size:24px;font-weight:900;color:white;">${emoji} Tu trial vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}</h1>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.7;">
        Hola <strong>${firstName}</strong>, el período de prueba gratuita de <strong>${companyName}</strong> 
        vence el <strong style="color:${headerColor};">${expiryDate}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
        Para continuar usando el CRM sin interrupciones, activa tu suscripción ahora. 
        Tus datos, leads y configuraciones se conservan al 100%.
      </p>

      <!-- CTA -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding:8px 0 24px;">
          <a href="${billingUrl}" style="display:inline-block;background:${headerColor};color:white;font-size:14px;font-weight:900;padding:16px 40px;border-radius:12px;text-decoration:none;">
            Activar mi suscripción →
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        Planes desde $29/mes · Sin contratos · Cancela en cualquier momento
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;">
      <p style="margin:0;font-size:10px;color:#94a3b8;text-align:center;">
        © ${new Date().getFullYear()} ${senderName} · Recibes este email porque eres administrador de ${companyName}.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { type, companyId, adminName, adminEmail, companyName, trialDays, daysLeft, expiryDate } = body;

    if (!type || !companyId || !adminEmail) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, companyId, adminEmail' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Resend config (tenant first, then platform fallback)
    const resendConfig = await getResendConfig(supabase, companyId);

    if (!resendConfig?.apiKey) {
      return new Response(JSON.stringify({ error: 'No Resend API key configured. Set up email in Marketing → Settings.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const senderName = resendConfig.senderName || 'Arias CRM';
    const senderEmail = resendConfig.senderEmail || 'noreply@ariasdefense.com';
    const appUrl = Deno.env.get('APP_URL') || 'https://crm-app-v2-jimmy-s-projects-88ff4cb4.vercel.app';

    let subject = '';
    let html = '';

    if (type === 'welcome') {
      subject = `¡Bienvenido a ${senderName}, ${(adminName || adminEmail).split(' ')[0]}! 🎉`;
      html = buildWelcomeEmail({
        companyName: companyName || 'Tu Empresa',
        adminName: adminName || adminEmail,
        adminEmail,
        trialDays: trialDays || 14,
        loginUrl: `${appUrl}/login`,
        senderName,
      });
    } else if (type === 'trial_expiry') {
      const days = daysLeft ?? 3;
      subject = `${days <= 1 ? '🚨 URGENTE' : '⏰ Aviso'}: Tu trial vence en ${days} día${days === 1 ? '' : 's'} — ${companyName}`;
      html = buildTrialExpiryEmail({
        companyName: companyName || 'Tu Empresa',
        adminName: adminName || adminEmail,
        daysLeft: days,
        expiryDate: expiryDate || 'pronto',
        billingUrl: `${appUrl}/company/billing`,
        senderName,
      });
    } else {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}. Use 'welcome' or 'trial_expiry'.` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendConfig.apiKey}` },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: adminEmail,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[transactional-email] Resend error:', err);
      return new Response(JSON.stringify({ error: `Email send failed: ${err}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await res.json();
    console.log(`[transactional-email] Sent type=${type} to ${adminEmail} emailId=${result.id}`);

    return new Response(JSON.stringify({ success: true, emailId: result.id, type, to: adminEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[transactional-email] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
