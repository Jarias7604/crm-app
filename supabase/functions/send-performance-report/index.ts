import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportPayload {
    companyId: string;
    advisorId: string;
    advisorName: string;
    advisorEmail?: string;
    recipientEmail: string;
    recipientName?: string;
    periodLabel: string;
    generatedAt: string;
    // KPI data
    actual: number;
    actualConnected: number;
    goalUpToDate: number;
    periodGoal: number;
    dailyGoal: number;
    deviation: number;
    percent: number;
    avgResponseTime: number;
    // Day grid
    dayGrid: { label: string; count: number; goal: number; isFuture: boolean }[];
    daysOK: number;
    pastDaysCount: number;
    // Opportunity
    leadsWithoutFollowUp: number;
    deficit: number;
    userNeglectLoss: number;
    userActivityLoss: number;
    userConsolidated: number;
    conversionRate: number;
    avgDealSize: number;
    // Schedule (optional)
    scheduleId?: string;
}

function colorFor(pct: number, count: number): string {
    if (pct >= 100) return '#10b981';
    if (pct >= 80) return '#14b8a6';
    if (pct >= 50) return '#f59e0b';
    if (count > 0) return '#f97316';
    return '#ef4444';
}

function formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
}

function formatRT(hours: number): string {
    if (hours <= 0) return 'N/A';
    if (hours < 1) return '<1h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours / 24)}d`;
}

function buildHTML(p: ReportPayload): string {
    const pctColor = p.percent >= 100 ? '#10b981' : p.percent >= 75 ? '#f59e0b' : '#ef4444';
    const rtColor = p.avgResponseTime === 0 ? '#94a3b8' : p.avgResponseTime <= 2 ? '#10b981' : p.avgResponseTime <= 24 ? '#f59e0b' : '#ef4444';
    const devLabel = p.deviation >= 0 ? `+${p.deviation}` : `${p.deviation}`;
    const devColor = p.deviation >= 0 ? '#10b981' : '#ef4444';

    const dayGridRows = p.dayGrid.filter(d => !d.isFuture).map(d => {
        const pct = d.goal > 0 ? (d.count / d.goal) * 100 : 0;
        const c = colorFor(pct, d.count);
        return `<div style="border:1.5px solid ${c}40;background:${c}0d;border-radius:8px;padding:10px 4px;text-align:center;min-width:0">
            <p style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;margin:0 0 4px;letter-spacing:.5px;">${d.label}</p>
            <p style="font-size:20px;font-weight:900;color:${c};margin:0;">${d.count}</p>
            <p style="font-size:8px;color:#94a3b8;margin:3px 0 0;">/${d.goal}</p>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reporte de Rendimiento — ${p.advisorName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="margin:0;font-size:9px;font-weight:800;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">Arias CRM · Reporte Individual de Rendimiento</p>
            <p style="margin:8px 0 0;font-size:26px;font-weight:900;color:white;letter-spacing:.5px;text-transform:uppercase;">${p.advisorName}</p>
            <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.75);font-weight:600;">📅 Período: <strong style="color:white;">${p.periodLabel}</strong><br/>🕐 Generado: ${p.generatedAt}</p>
          </td>
          <td align="right" valign="middle" width="64">
            <div style="width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white;text-align:center;line-height:56px;">${p.advisorName.charAt(0)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- KPI Row -->
  <tr>
    <td style="padding:24px 32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${[
            { label: 'Llamadas Realizadas', value: `${p.actual}`, sub: `de ${p.goalUpToDate} meta a la fecha`, color: '#4f46e5' },
            { label: 'Cumplimiento', value: `${Math.round(p.percent)}%`, sub: `${p.daysOK}/${p.pastDaysCount} días con meta`, color: pctColor },
            { label: 'Abordaje Promedio', value: formatRT(p.avgResponseTime), sub: 'asignación → contacto', color: rtColor },
            { label: 'Desviación vs Meta', value: devLabel, sub: `meta diaria: ${p.dailyGoal}`, color: devColor },
          ].map(k => `
          <td width="25%" style="padding:0 4px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
              <p style="margin:0;font-size:8px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">${k.label}</p>
              <p style="margin:8px 0 4px;font-size:22px;font-weight:900;color:${k.color};">${k.value}</p>
              <p style="margin:0;font-size:9px;color:#94a3b8;font-weight:600;">${k.sub}</p>
            </div>
          </td>`).join('')}
        </tr>
      </table>
    </td>
  </tr>

  ${p.dayGrid.filter(d => !d.isFuture).length > 0 ? `
  <!-- Day Grid -->
  <tr>
    <td style="padding:0 32px 20px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
        <p style="margin:0 0 14px;font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">📆 Desglose Diario — ${p.pastDaysCount} días laborables evaluados</p>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
          ${dayGridRows}
        </div>
      </div>
    </td>
  </tr>` : ''}

  <!-- 2-col: Activity + Opportunity -->
  <tr>
    <td style="padding:0 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Activity -->
          <td width="50%" valign="top" style="padding-right:8px;">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
              <p style="margin:0 0 14px;font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">📊 Actividad de Llamadas</p>
              ${[
                ['Meta diaria', `${p.dailyGoal} llam./día`],
                ['Meta del período', `${p.periodGoal} llamadas`],
                ['Meta a la fecha', `${p.goalUpToDate} llamadas`],
                ['Realizadas', `${p.actual}`],
                ['Conectadas', `${p.actualConnected}`],
                ['Días evaluados', `${p.pastDaysCount}`],
                ['Días con meta OK', `${p.daysOK}`],
              ].map(([l, v], i) => `
              <div style="display:flex;justify-content:space-between;padding:7px 0;${i < 6 ? 'border-bottom:1px solid #f1f5f9' : ''}">
                <span style="font-size:10px;color:#64748b;font-weight:600;">${l}</span>
                <span style="font-size:11px;font-weight:900;color:#1e293b;">${v}</span>
              </div>`).join('')}
            </div>
          </td>
          <!-- Opportunity -->
          <td width="50%" valign="top" style="padding-left:8px;">
            <div style="background:#f8fafc;border:1px solid ${p.userConsolidated > 0 ? '#fecaca' : '#e2e8f0'};border-radius:12px;padding:18px;">
              <p style="margin:0 0 14px;font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">💸 Oportunidad Perdida</p>
              ${p.userConsolidated > 0 ? `
              ${[
                ['Leads sin contacto', `${p.leadsWithoutFollowUp}`, '#ef4444'],
                ['Llamadas faltantes', `-${p.deficit}`, '#ef4444'],
                ['Pérd. por negligencia', formatCurrency(p.userNeglectLoss), '#ef4444'],
                ['Pérd. por inactividad', formatCurrency(p.userActivityLoss), '#f59e0b'],
                ['Tasa conversión', `${p.conversionRate.toFixed(1)}%`, '#64748b'],
                ['Ticket promedio', formatCurrency(p.avgDealSize), '#64748b'],
              ].map(([l, v, c], i) => `
              <div style="display:flex;justify-content:space-between;padding:7px 0;${i < 5 ? 'border-bottom:1px solid #f1f5f9' : ''}">
                <span style="font-size:10px;color:#64748b;font-weight:600;">${l}</span>
                <span style="font-size:11px;font-weight:900;color:${c};">${v}</span>
              </div>`).join('')}
              <div style="display:flex;justify-content:space-between;padding:10px 0 0;border-top:2px solid #e2e8f0;margin-top:4px;">
                <span style="font-size:10px;color:#0f172a;font-weight:900;">Costo Total Estimado</span>
                <span style="font-size:14px;font-weight:900;color:#ef4444;">${formatCurrency(p.userConsolidated)}</span>
              </div>` : `<p style="font-size:11px;color:#10b981;font-weight:700;padding:8px 0;">✓ Sin oportunidades perdidas detectadas en el período.</p>`}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Methodology note -->
  <tr>
    <td style="padding:0 32px 24px;">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;">
        <p style="margin:0 0 8px;font-size:9px;font-weight:900;color:#3730a3;text-transform:uppercase;letter-spacing:2px;">🔍 Metodología</p>
        <p style="margin:0;font-size:10px;color:#1e40af;font-weight:500;line-height:1.6;">
          <strong>Llamadas:</strong> call_activities del período &nbsp;·&nbsp;
          <strong>Meta a la fecha:</strong> Meta diaria × días laborables transcurridos (excluye días futuros) &nbsp;·&nbsp;
          <strong>Leads sin contacto:</strong> Leads activos sin ninguna call_activity en el período (excluye Perdidos/Cerrados) &nbsp;·&nbsp;
          <strong>Oportunidad perdida:</strong> Estimación estadística basada en tasa de conversión y ticket promedio histórico.
        </p>
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td><p style="margin:0;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Arias CRM — Sistema de Rendimiento</p></td>
          <td align="right"><p style="margin:0;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Confidencial · Solo uso interno</p></td>
        </tr>
      </table>
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

        const payload: ReportPayload = await req.json();

        if (!payload.recipientEmail || !payload.advisorName) {
            return new Response(JSON.stringify({ error: 'Missing required fields: recipientEmail, advisorName' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Resolve Resend API key — tenant first, then platform fallback
        let resendToken = Deno.env.get('RESEND_API_KEY');
        let senderEmail = 'reportes@ariasdefense.com';
        let senderName = 'Arias CRM';

        const { data: tenantResend } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', payload.companyId)
            .eq('provider', 'resend')
            .eq('is_active', true)
            .maybeSingle();

        if (!tenantResend) {
            const { data: platformResend } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
                .eq('provider', 'resend')
                .eq('is_active', true)
                .maybeSingle();
            if (platformResend?.settings?.apiKey) resendToken = platformResend.settings.apiKey;
            if (platformResend?.settings?.senderEmail) senderEmail = platformResend.settings.senderEmail;
            if (platformResend?.settings?.senderName) senderName = platformResend.settings.senderName;
        } else {
            if (tenantResend.settings?.apiKey) resendToken = tenantResend.settings.apiKey;
            if (tenantResend.settings?.senderEmail) senderEmail = tenantResend.settings.senderEmail;
            if (tenantResend.settings?.senderName) senderName = tenantResend.settings.senderName;
        }

        if (!resendToken) {
            return new Response(JSON.stringify({ error: 'No Resend API key configured. Set up email integration in Marketing Settings.' }), {
                status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const htmlBody = buildHTML(payload);
        const subject = `📊 Reporte de Rendimiento — ${payload.advisorName} | ${payload.periodLabel}`;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendToken}` },
            body: JSON.stringify({
                from: `${senderName} <${senderEmail}>`,
                to: payload.recipientEmail,
                subject,
                html: htmlBody,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[send-performance-report] Resend error:', err);
            return new Response(JSON.stringify({ error: `Email send failed: ${err}` }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const result = await res.json();
        console.log('[send-performance-report] Sent OK:', result.id, '→', payload.recipientEmail);

        // Log send to report_schedules if this is a scheduled send
        if (payload.scheduleId) {
            await supabase
                .from('report_schedules')
                .update({ last_sent_at: new Date().toISOString() })
                .eq('id', payload.scheduleId);
        }

        return new Response(JSON.stringify({ success: true, emailId: result.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[send-performance-report] Error:', err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
