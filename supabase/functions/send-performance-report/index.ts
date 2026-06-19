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
    periodLabel: string;
    generatedAt: string;
    actual: number;
    actualConnected: number;
    goalUpToDate: number;
    periodGoal: number;
    dailyGoal: number;
    deviation: number;
    percent: number;
    avgResponseTime: number;
    dayGrid: { label: string; count: number; goal: number; isFuture: boolean }[];
    daysOK: number;
    pastDaysCount: number;
    leadsWithoutFollowUp: number;
    deficit: number;
    userNeglectLoss: number;
    userActivityLoss: number;
    userConsolidated: number;
    conversionRate: number;
    avgDealSize: number;
    scheduleId?: string;
}

function colorFor(pct: number, count: number): string {
    if (pct >= 100) return '#10b981';
    if (pct >= 80) return '#14b8a6';
    if (pct >= 50) return '#f59e0b';
    if (count > 0) return '#f97316';
    return '#ef4444';
}

function fmtCur(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
}

function fmtRT(hours: number): string {
    if (hours <= 0) return 'N/A';
    if (hours < 1) return '&lt;1h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours / 24)}d`;
}

// Chunk array into groups of N
function chunk<T>(arr: T[], n: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
    return result;
}

function buildHTML(p: ReportPayload): string {
    const pctColor = p.percent >= 100 ? '#10b981' : p.percent >= 75 ? '#f59e0b' : '#ef4444';
    const rtColor = p.avgResponseTime === 0 ? '#94a3b8' : p.avgResponseTime <= 2 ? '#10b981' : p.avgResponseTime <= 24 ? '#f59e0b' : '#ef4444';
    const devLabel = p.deviation >= 0 ? `+${p.deviation}` : `${p.deviation}`;
    const devColor = p.deviation >= 0 ? '#10b981' : '#ef4444';

    const pastDays = p.dayGrid.filter(d => !d.isFuture);
    const weeks = chunk(pastDays, 7);

    // Build day grid as pure HTML table — 7 columns per row (email-safe)
    const dayTableRows = weeks.map(week => {
        const cells = week.map(d => {
            const pct = d.goal > 0 ? (d.count / d.goal) * 100 : 0;
            const c = colorFor(pct, d.count);
            const bg = c + '15';
            const border = c + '60';
            return `<td width="${Math.floor(100/7)}%" style="padding:3px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:2px solid ${border};border-radius:8px;">
    <tr><td style="padding:8px 4px;text-align:center;">
      <p style="margin:0 0 3px;font-size:7px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;">${d.label}</p>
      <p style="margin:0 0 2px;font-size:20px;font-weight:900;color:${c};line-height:1;">${d.count}</p>
      <p style="margin:0;font-size:8px;color:#94a3b8;font-weight:600;">/${d.goal}</p>
    </td></tr>
  </table>
</td>`;
        });
        // Pad last row with empty cells
        while (cells.length < 7) {
            cells.push(`<td width="${Math.floor(100/7)}%" style="padding:3px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border:2px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:8px 4px;text-align:center;"><p style="margin:0;font-size:8px;color:#cbd5e1;">—</p></td></tr></table></td>`);
        }
        return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const kpis = [
        { label: 'Llamadas Realizadas', value: `${p.actual}`, sub: `de ${p.goalUpToDate} meta`, color: '#4f46e5' },
        { label: 'Cumplimiento', value: `${Math.round(p.percent)}%`, sub: `${p.daysOK}/${p.pastDaysCount} días OK`, color: pctColor },
        { label: 'Abordaje Prom.', value: fmtRT(p.avgResponseTime), sub: 'asign. → contacto', color: rtColor },
        { label: 'Desviación', value: devLabel, sub: `meta diaria: ${p.dailyGoal}`, color: devColor },
    ];

    const activityRows = [
        ['Meta diaria', `${p.dailyGoal} llam./día`],
        ['Meta del período', `${p.periodGoal}`],
        ['Meta a la fecha', `${p.goalUpToDate}`],
        ['Realizadas', `${p.actual}`],
        ['Conectadas', `${p.actualConnected}`],
        ['Días evaluados', `${p.pastDaysCount}`],
        ['Días con meta OK', `${p.daysOK}`],
    ];

    const oppRows = p.userConsolidated > 0 ? [
        ['Leads sin contacto', `${p.leadsWithoutFollowUp}`, '#ef4444'],
        ['Llamadas faltantes', `-${p.deficit}`, '#ef4444'],
        ['Pérd. negligencia', fmtCur(p.userNeglectLoss), '#ef4444'],
        ['Pérd. inactividad', fmtCur(p.userActivityLoss), '#f59e0b'],
        ['Tasa conversión', `${p.conversionRate.toFixed(1)}%`, '#64748b'],
        ['Ticket promedio', fmtCur(p.avgDealSize), '#64748b'],
    ] : [];

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Reporte — ${p.advisorName}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <tr>
    <td style="background:#4f46e5;padding:24px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle">
          <p style="margin:0;font-size:8px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:3px;text-transform:uppercase;">ARIAS CRM &middot; REPORTE INDIVIDUAL DE RENDIMIENTO</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:900;color:white;text-transform:uppercase;letter-spacing:.5px;">${p.advisorName}</p>
          <p style="margin:6px 0 0;font-size:10px;color:rgba(255,255,255,0.75);">Periodo: <strong style="color:white;">${p.periodLabel}</strong> &nbsp;&middot;&nbsp; Generado: ${p.generatedAt}</p>
        </td>
        <td valign="middle" align="center" width="52" style="background:rgba(255,255,255,0.18);border-radius:10px;width:52px;height:52px;">
          <p style="margin:0;font-size:24px;font-weight:900;color:white;text-align:center;">${p.advisorName.charAt(0)}</p>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- KPI CARDS -->
  <tr>
    <td style="padding:20px 20px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${kpis.map(k => `
        <td width="25%" style="padding:0 4px;" valign="top">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <tr><td style="padding:12px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:7px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">${k.label}</p>
              <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:${k.color};">${k.value}</p>
              <p style="margin:0;font-size:8px;color:#94a3b8;">${k.sub}</p>
            </td></tr>
          </table>
        </td>`).join('')}
      </tr></table>
    </td>
  </tr>

  ${pastDays.length > 0 ? `
  <!-- DAY GRID — 7 columns per week, email-safe table layout -->
  <tr>
    <td style="padding:0 20px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr><td style="padding:14px 14px 8px;">
          <p style="margin:0 0 10px;font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Desglose Diario &mdash; ${p.pastDaysCount} dias laborables evaluados</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${dayTableRows}
          </table>
        </td></tr>
      </table>
    </td>
  </tr>` : ''}

  <!-- ACTIVITY + OPPORTUNITY -->
  <tr>
    <td style="padding:0 20px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="50%" valign="top" style="padding-right:6px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
            <tr><td style="padding:14px;">
              <p style="margin:0 0 10px;font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Actividad de Llamadas</p>
              ${activityRows.map(([l, v], i) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="${i < activityRows.length-1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
                <tr>
                  <td style="padding:5px 0;font-size:9px;color:#64748b;">${l}</td>
                  <td style="padding:5px 0;font-size:10px;font-weight:800;color:#1e293b;text-align:right;">${v}</td>
                </tr>
              </table>`).join('')}
            </td></tr>
          </table>
        </td>
        <td width="50%" valign="top" style="padding-left:6px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${p.userConsolidated > 0 ? '#fecaca' : '#e2e8f0'};border-radius:10px;">
            <tr><td style="padding:14px;">
              <p style="margin:0 0 10px;font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Oportunidad Perdida</p>
              ${p.userConsolidated > 0 ? oppRows.map(([l, v, c], i) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="${i < oppRows.length-1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
                <tr>
                  <td style="padding:5px 0;font-size:9px;color:#64748b;">${l}</td>
                  <td style="padding:5px 0;font-size:10px;font-weight:800;color:${c};text-align:right;">${v}</td>
                </tr>
              </table>`).join('') + `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e2e8f0;margin-top:4px;">
                <tr>
                  <td style="padding:7px 0 0;font-size:9px;font-weight:900;color:#0f172a;">Costo Total</td>
                  <td style="padding:7px 0 0;font-size:13px;font-weight:900;color:#ef4444;text-align:right;">${fmtCur(p.userConsolidated)}</td>
                </tr>
              </table>` : '<p style="font-size:10px;color:#10b981;font-weight:700;margin:0;">&#10003; Sin perdidas detectadas.</p>'}
            </td></tr>
          </table>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- METHODOLOGY -->
  <tr>
    <td style="padding:0 20px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
        <tr><td style="padding:14px;">
          <p style="margin:0 0 6px;font-size:8px;font-weight:800;color:#3730a3;text-transform:uppercase;letter-spacing:2px;">Metodologia</p>
          <p style="margin:0;font-size:9px;color:#1e40af;line-height:1.6;">
            <strong>Llamadas:</strong> call_activities del periodo &nbsp;&middot;&nbsp;
            <strong>Meta a la fecha:</strong> Meta diaria x dias laborables transcurridos (excluye dias futuros) &nbsp;&middot;&nbsp;
            <strong>Leads sin contacto:</strong> Leads activos sin call_activity en el periodo (excluye Perdidos/Cerrados) &nbsp;&middot;&nbsp;
            <strong>Oportunidad:</strong> Estimacion estadistica basada en tasa de conversion y ticket promedio.
          </p>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><p style="margin:0;font-size:8px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Arias CRM &mdash; Sistema de Rendimiento</p></td>
        <td align="right"><p style="margin:0;font-size:8px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Confidencial &middot; Uso interno</p></td>
      </tr></table>
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
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

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
            const { data: pr } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
                .eq('provider', 'resend')
                .eq('is_active', true)
                .maybeSingle();
            if (pr?.settings?.apiKey) resendToken = pr.settings.apiKey;
            if (pr?.settings?.senderEmail) senderEmail = pr.settings.senderEmail;
            if (pr?.settings?.senderName) senderName = pr.settings.senderName;
        } else {
            if (tenantResend.settings?.apiKey) resendToken = tenantResend.settings.apiKey;
            if (tenantResend.settings?.senderEmail) senderEmail = tenantResend.settings.senderEmail;
            if (tenantResend.settings?.senderName) senderName = tenantResend.settings.senderName;
        }

        if (!resendToken) {
            return new Response(JSON.stringify({ error: 'No Resend API key configured.' }), {
                status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const htmlBody = buildHTML(payload);
        const subject = `Reporte de Rendimiento — ${payload.advisorName} | ${payload.periodLabel}`;

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendToken}` },
            body: JSON.stringify({ from: `${senderName} <${senderEmail}>`, to: payload.recipientEmail, subject, html: htmlBody }),
        });

        if (!res.ok) {
            const err = await res.text();
            return new Response(JSON.stringify({ error: `Email send failed: ${err}` }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const result = await res.json();
        console.log('[send-performance-report] OK:', result.id, '->', payload.recipientEmail);

        if (payload.scheduleId) {
            await supabase.from('report_schedules').update({ last_sent_at: new Date().toISOString() }).eq('id', payload.scheduleId);
        }

        return new Response(JSON.stringify({ success: true, emailId: result.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
