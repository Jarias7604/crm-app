import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string, defaultCountryCode = '503'): string {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (phone.startsWith("00")) { cleaned = cleaned.substring(2); }
    if (cleaned.length === 8 && defaultCountryCode === '503') { return `+503${cleaned}`; }
    return `+${cleaned}`;
}

/**
 * Substitutes ALL lead-specific template variables in a text/HTML string.
 * Returns the substituted result AND a list of any variables that could NOT be resolved.
 * If missingVars.length > 0 the caller MUST block sending — never send with raw {{...}} placeholders.
 */
function substituteLeadVariables(
    text: string,
    lead: { name?: string; company_name?: string; phone?: string; address?: string; industry?: string },
    greeting: string
): { result: string; missingVars: string[] } {
    if (!text) return { result: '', missingVars: [] };

    const firstName = (lead.name || '').split(' ')[0] || 'Estimado/a';
    const rawCompany = (lead.company_name && lead.company_name.trim() !== '' && lead.company_name !== 'Individual')
        ? lead.company_name.trim()
        : (lead.name || '').trim();
    const companyName = rawCompany || 'Iglesia Gateway Community Church';
    const city = (lead.address || '').split(',')[0].trim() || 'su ciudad';
    const industry = lead.industry || 'Iglesia';

    let result = text
        .replace(/\{\{greeting\}\}/gi, greeting)
        .replace(/\{\{(name|nombre)\}\}/gi, lead.name || firstName)
        .replace(/\{\{(first_name|nombre_contacto)\}\}/gi, firstName)
        .replace(/\{\{phone\}\}/gi, lead.phone || '')
        .replace(/\{\{(ciudad|city)\}\}/gi, city)
        .replace(/\{\{(rubro|industria|industry|denominacion|denomination)\}\}/gi, industry)
        .replace(
            /\{\{(nombre_empresa|company_name|empresa|nombre_iglesia|nombre iglesia|iglesia|nombre_congregacion|congregacion|organizacion|nombre_organizacion)\}\}/gi,
            companyName
        );

    const missingVars = result.match(/\{\{[^}]+\}\}/g) || [];
    return { result, missingVars };
}

/**
 * Injects click tracking into all <a href="..."> links in the HTML.
 * Replaces original URLs with a tracked redirect URL.
 */
function injectClickTracking(html: string, trackingBase: string, messageId: string): string {
    return html.replace(/<(a|v:roundrect)(\s+[^>]*?)href="([^"]+)"([^>]*?)>/gi, (_match, tag, before, href, after) => {
        if (href.startsWith('mailto:') || href.startsWith('#') || href.includes(trackingBase)) {
            return _match; // Skip mailto, anchors, and already-tracked links
        }
        const trackedUrl = `${trackingBase}?type=click&mid=${messageId}&url=${encodeURIComponent(href)}`;
        return `<${tag}${before}href="${trackedUrl}"${after}>`;
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { campaignId, mode, testEmail, subject: customSubject, html: customHtml, companyId: customCompanyId, sampleLead } = body;

        // Security: require a valid Supabase anon key or user token
        const authHeader = req.headers.get('Authorization') || '';
        const apiKey = req.headers.get('apikey') || '';
        if (!authHeader && !apiKey) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("CRM_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        // ── TEST EMAIL DISPATCH MODE (Single preview send) ────────────────────────
        if (mode === 'test' || testEmail) {
            const recipientEmail = (testEmail || '').trim();
            if (!recipientEmail) {
                return new Response(JSON.stringify({ error: 'Email de prueba no especificado' }), { status: 400, headers: corsHeaders });
            }

            let targetCompanyId = customCompanyId;
            let currentCampaign = null;

            if (campaignId) {
                const { data: c } = await supabase.from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
                currentCampaign = c;
                if (c?.company_id) targetCompanyId = c.company_id;
            }

            const { data: company } = targetCompanyId 
                ? await supabase.from("companies").select("id, name, email").eq("id", targetCompanyId).maybeSingle()
                : { data: null };

            // Dynamic Multi-Tenant Email Config
            const { data: tenantResend } = targetCompanyId ? await supabase.from('marketing_integrations')
                .select('settings')
                .eq('company_id', targetCompanyId)
                .eq('provider', 'resend')
                .eq('is_active', true)
                .maybeSingle() : { data: null };

            let platformResend = null;
            if (!tenantResend?.settings?.apiKey) {
                const { data: pr } = await supabase.from('marketing_integrations').select('settings')
                    .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30') // Platform owner
                    .eq('provider', 'resend')
                    .eq('is_active', true)
                    .maybeSingle();
                platformResend = pr;
            }

            const senderName = tenantResend?.settings?.senderName || company?.name || "Iclesia";
            const platformEmail = platformResend?.settings?.senderEmail || "notificaciones@ariascrm.com";
            const senderEmail = tenantResend?.settings?.senderEmail || platformEmail;
            const replyTo = tenantResend?.settings?.replyTo || company?.email || undefined;
            const resendToken = tenantResend?.settings?.apiKey || platformResend?.settings?.apiKey || Deno.env.get("RESEND_API_KEY");

            if (!resendToken) {
                return new Response(JSON.stringify({ error: 'Falta configurar API Key de Resend en el sistema' }), { status: 422, headers: corsHeaders });
            }

            const fromDisplay = `${senderName} <${senderEmail}>`;

            // Prepare sample lead for variable substitution
            const previewLead = sampleLead || {
                name: 'Jimmy Arias',
                company_name: 'Iglesia Gateway Community Church',
                email: recipientEmail,
                address: 'San Salvador',
                industry: 'Iglesia'
            };

            const hour = new Date().getHours();
            const greeting = hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches';

            const rawSubject = customSubject || currentCampaign?.subject || 'Prueba de Campaña';
            const rawContent = customHtml || currentCampaign?.content || '';

            const { result: testSubject } = substituteLeadVariables(rawSubject, previewLead, greeting);
            const { result: testContent } = substituteLeadVariables(rawContent, previewLead, greeting);

            const emailPayload: any = {
                from: fromDisplay,
                to: recipientEmail,
                subject: testSubject,
                html: testContent,
            };

            if (replyTo) {
                emailPayload.reply_to = replyTo;
            }

            console.log(`[marketing-engine test] Sending test email from "${fromDisplay}" to "${recipientEmail}"`);

            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendToken}` },
                body: JSON.stringify(emailPayload)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error("[marketing-engine test] Resend error:", errText);
                return new Response(JSON.stringify({ error: `Resend error: ${errText}` }), { status: 502, headers: corsHeaders });
            }

            const resData = await res.json();
            return new Response(JSON.stringify({ 
                success: true, 
                test: true, 
                message: `Correo de prueba enviado con éxito a ${recipientEmail}`, 
                id: resData.id 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }
        // ──────────────────────────────────────────────────────────────────────────

        const { data: campaign, error: campError } = await supabase
            .from("marketing_campaigns").select("*").eq("id", campaignId).single();

        if (campError || !campaign) throw new Error(`Campaign not found: ${campError?.message}`);

        const { data: company } = await supabase
            .from("companies").select("id, name, email").eq("id", campaign.company_id).maybeSingle();

        // ── Enterprise Rate Limiting (20 marketing calls/min per company) ──
        const rl = checkRateLimit(campaign.company_id, 'marketing');
        if (!rl.allowed) return rateLimitResponse(rl.resetAt);

        const filters = campaign.audience_filters || {};
        let query = supabase.from("leads").select("id, name, company_name, email, phone, priority, address, industry").eq("company_id", campaign.company_id);

        if (filters.specificIds && filters.specificIds.length > 0) {
            query = query.in(filters.idType || 'id', filters.specificIds);
        } else {
            if (filters.status?.length > 0) {
                const statusMap: Record<string, string> = {
                    'prospecto': 'Prospecto',
                    'llamada fría': 'Llamada fría',
                    'en nutrición': 'En Nutrición',
                    'lead calificado': 'Lead calificado',
                    'en seguimiento': 'En seguimiento',
                    'negociación': 'Negociación',
                    'cerrado': 'Cerrado',
                    'cliente': 'Cliente',
                    'perdido': 'Perdido',
                    'erróneo': 'Erróneo'
                };
                const expandedStatuses = Array.from(new Set(
                    filters.status.flatMap((s: string) => {
                        const lower = s.toLowerCase();
                        const title = statusMap[lower] || (s.charAt(0).toUpperCase() + s.slice(1));
                        return [s, lower, title];
                    })
                ));
                query = query.in("status", expandedStatuses);
            }
            if (filters.priority && filters.priority !== 'all') query = query.eq("priority", filters.priority);
            if (filters.dateRange === "new") {
                const d = new Date(); d.setDate(d.getDate() - 30);
                query = query.gte("created_at", d.toISOString());
            }
        }

        if (campaign.type === 'email') query = query.not('email', 'is', null).neq('email', '');

        const { data: leads, error: leadError } = await query;
        if (leadError) throw leadError;
        if (!leads || leads.length === 0) {
            return new Response(JSON.stringify({ message: "No audience found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const excludedIds = new Set(filters.excludedIds || []);
        const afterExclusion = excludedIds.size > 0 ? leads.filter(l => !excludedIds.has(l.id)) : leads;

        const { data: sentMessages } = await supabase.from('marketing_messages').select('metadata').eq('metadata->>campaign_id', campaignId);
        const sentLeadIds = new Set(sentMessages?.map((m: any) => m.metadata?.lead_id).filter(Boolean) || []);
        const filteredLeads = afterExclusion.filter(l => !sentLeadIds.has(l.id));

        if (filteredLeads.length === 0) {
            return new Response(JSON.stringify({
                success: true, message: "All leads already processed",
                results: { success: 0, failed: 0, total: leads.length, skipped: leads.length }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);

        const results = { success: 0, failed: 0 };
        const trackingBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking`;

        let telegramToken = null;
        let whatsappConfig = null;

        if (campaign.type === 'whatsapp') {
            const { data: i } = await supabase.from('marketing_integrations').select('settings').eq('company_id', campaign.company_id).eq('provider', 'whatsapp').eq('is_active', true).maybeSingle();
            whatsappConfig = i?.settings;
        } else if (campaign.type === 'social' || campaign.type === 'telegram') {
            const { data: i } = await supabase.from('marketing_integrations').select('settings').eq('company_id', campaign.company_id).eq('provider', 'telegram').eq('is_active', true).maybeSingle();
            telegramToken = i?.settings?.token;
        }

        // Dynamic Multi-Tenant Email Config
        const { data: tenantResend } = await supabase.from('marketing_integrations')
            .select('settings')
            .eq('company_id', campaign.company_id)
            .eq('provider', 'resend')
            .eq('is_active', true)
            .maybeSingle();

        let platformResend = null;
        if (!tenantResend?.settings?.apiKey) {
            const { data: pr } = await supabase.from('marketing_integrations').select('settings')
                .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30') // Platform owner
                .eq('provider', 'resend')
                .eq('is_active', true)
                .maybeSingle();
            platformResend = pr;
        }

        // 1. Sender Name: ALWAYS prioritize tenant's custom name, or tenant company name (e.g. "Iclesia")
        const senderName = tenantResend?.settings?.senderName || company?.name || "Marketing CRM";

        // 2. Sender Email: Tenant's verified email, or platform verified fallback
        const platformEmail = platformResend?.settings?.senderEmail || "notificaciones@ariascrm.com";
        const senderEmail = tenantResend?.settings?.senderEmail || platformEmail;

        // 3. Reply-To: Lead replies will ALWAYS go directly to the tenant's email!
        const replyTo = tenantResend?.settings?.replyTo || company?.email || undefined;

        // 4. API Key: Tenant's own Resend key, or platform fallback
        const resendToken = tenantResend?.settings?.apiKey || platformResend?.settings?.apiKey || Deno.env.get("RESEND_API_KEY");

        const fromDisplay = `${senderName} <${senderEmail}>`;
        console.log(`[Marketing-Engine] Sender: "${fromDisplay}" | Reply-To: "${replyTo || 'none'}" (${tenantResend?.settings?.apiKey ? 'tenant custom domain' : 'platform verified sender'})`);

        let templateData = null;
        if (campaign.template_id) {
            const { data } = await supabase.from('marketing_templates').select('*').eq('id', campaign.template_id).maybeSingle();
            templateData = data;
        }

        console.log(`[Marketing-Engine] Processing ${filteredLeads.length} leads.`);

        for (let i = 0; i < filteredLeads.length; i++) {
            const lead = filteredLeads[i];
            if (i > 0) await new Promise(r => setTimeout(r, 150));
            const phone = normalizePhone(lead.phone);

            try {
                const messageId = crypto.randomUUID();
                let conversationId = null;

                const hour = new Date().getHours();
                const greeting = hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches';

                // ── Substitute variables in BOTH body and subject upfront ──
                const { result: substitutedContent, missingVars: contentMissing } = substituteLeadVariables(campaign.content || '', lead, greeting);
                const rawSubject = campaign.subject || campaign.name || '';
                const { result: localizedSubject, missingVars: subjectMissing } = substituteLeadVariables(rawSubject, lead, greeting);
                let localizedContent = substitutedContent;

                // ══ SAFETY GATE ══════════════════════════════════════════════════════════
                // If ANY {{variable}} is still unresolved in subject or body → BLOCK send.
                // Sending emails with raw {{nombre_iglesia}} placeholders is UNACCEPTABLE.
                // ═════════════════════════════════════════════════════════════════════════
                const allMissingVars = [...new Set([...contentMissing, ...subjectMissing])];
                if (allMissingVars.length > 0) {
                    const reason = `Variables sin datos del lead: ${allMissingVars.join(', ')}`;
                    console.warn(`[Marketing-Engine] ⛔ BLOQUEADO lead ${lead.id} (${lead.name || 'sin-nombre'}) — ${reason}`);
                    results.failed++;
                    continue; // Do NOT send — move to next lead
                }

                const extractMediaAndText = (html: string) => {
                    let mediaUrl: string | null = null;
                    let mediaType: 'image' | 'video' | 'document' | null = null;
                    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
                    if (imgMatch) { mediaUrl = imgMatch[1]; mediaType = 'image'; }
                    const videoMatch = html.match(/<source[^>]+src="([^">]+)"/);
                    if (videoMatch) { mediaUrl = videoMatch[1]; mediaType = 'video'; }
                    const docMatch = html.match(/<a[^>]+href="([^">]+)"[^>]*>Ver Archivo<\/a>/);
                    if (docMatch) { mediaUrl = docMatch[1]; mediaType = 'document'; }
                    const cleanText = html
                        .replace(/<br\s*\/?>/gi, '\n').replace(/<b>(.*?)<\/b>/gi, '*$1*')
                        .replace(/<strong>(.*?)<\/strong>/gi, '*$1*').replace(/<i>(.*?)<\/i>/gi, '_$1_')
                        .replace(/<em>(.*?)<\/em>/gi, '_$1_')
                        .replace(/<a[^>]+href="([^">]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
                        .replace(/<p>(.*?)<\/p>/gi, '$1\n').replace(/<h[1-2]>(.*?)<\/h[1-2]>/gi, '*$1*\n')
                        .replace(/<[^>]+>/g, '').trim();
                    return { cleanText, mediaUrl, mediaType };
                };
                const richContent = extractMediaAndText(localizedContent);

                // A. WhatsApp
                if (campaign.type === 'whatsapp' && phone) {
                    const { data: conv } = await supabase.from('marketing_conversations').upsert({
                        company_id: campaign.company_id, lead_id: lead.id, channel: 'whatsapp',
                        status: 'active', external_id: phone.replace('+', '')
                    }, { onConflict: 'lead_id,channel' }).select('id, external_id').single();
                    conversationId = conv?.id;

                    if (whatsappConfig?.token && whatsappConfig?.phoneNumberId) {
                        let payload: any = { messaging_product: 'whatsapp', to: lead.phone.replace(/\D/g, '') };
                        if (campaign.template_id) {
                            payload.type = 'template';
                            payload.template = { name: campaign.subject || campaign.name, language: { code: 'es' }, components: [{ type: 'body', parameters: lead.name ? [{ type: 'text', text: lead.name }] : [] }] };
                        } else if (richContent.mediaUrl) {
                            payload.type = richContent.mediaType;
                            payload[richContent.mediaType!] = { link: richContent.mediaUrl, caption: richContent.cleanText };
                        } else {
                            payload.type = 'text'; payload.text = { body: richContent.cleanText };
                        }
                        const waRes = await fetch(`https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}/messages`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whatsappConfig.token}` },
                            body: JSON.stringify(payload)
                        });
                        if (!waRes.ok) { const e = await waRes.text(); throw new Error(`WhatsApp Error: ${e}`); }
                    } else {
                        throw new Error("WhatsApp no configurado. Ve a Marketing > Configuración > WhatsApp para activarlo.");
                    }
                }

                // B. Telegram
                if (campaign.type === 'social' || campaign.type === 'telegram') {
                    const { data: conv } = await supabase.from('marketing_conversations').upsert({
                        company_id: campaign.company_id, lead_id: lead.id, channel: 'telegram', status: 'active'
                    }, { onConflict: 'lead_id,channel' }).select('id, external_id').single();
                    conversationId = conv?.id;

                    if (conv?.external_id && telegramToken) {
                        let method = 'sendMessage';
                        const payload: any = { chat_id: conv.external_id, parse_mode: 'HTML' };
                        if (richContent.mediaUrl) {
                            if (richContent.mediaType === 'image') method = 'sendPhoto';
                            else if (richContent.mediaType === 'video') method = 'sendVideo';
                            else method = 'sendDocument';
                            payload[richContent.mediaType === 'image' ? 'photo' : richContent.mediaType!] = richContent.mediaUrl;
                            payload.caption = localizedContent;
                        } else { payload.text = localizedContent; }
                        if (templateData?.channel === 'telegram' && templateData.content?.buttons) {
                            payload.reply_markup = { inline_keyboard: templateData.content.buttons.map((btn: any) => ([{ text: btn.text, url: btn.url?.replace(/{{name}}/g, lead.name || '') }])) };
                        }
                        const tgRes = await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                        });
                        if (!tgRes.ok) { const e = await tgRes.json(); throw new Error(`Telegram Error: ${e.description || 'Unknown'}`); }
                        await supabase.from('marketing_conversations').update({ last_message: richContent.cleanText.substring(0, 100), last_message_at: new Date().toISOString() }).eq('id', conversationId);
                    } else {
                        throw new Error("Telegram no configurado. El lead debe iniciar conversación con el bot primero.");
                    }
                }

                // C. Email — with open pixel + click tracking link injection
                if (campaign.type === "email" && lead.email) {
                    const cleanEmail = lead.email.trim().split(/[\r\n,;]/)[0].trim();
                    const { data: conv } = await supabase.from('marketing_conversations').upsert({
                        company_id: campaign.company_id, lead_id: lead.id, channel: 'email', status: 'active', external_id: cleanEmail
                    }, { onConflict: 'lead_id,channel' }).select('id').single();
                    if (!conv) throw new Error("Failed to create conversation");
                    conversationId = conv.id;
                    if (!resendToken) throw new Error("Missing Resend API Key — configure email integration.");

                    // Inject click tracking into all links
                    const clickTrackedContent = injectClickTracking(localizedContent, trackingBaseUrl, messageId);

                    // Legal Anti-Spam Footer (CAN-SPAM / Google 2024 compliance)
                    const unsubscribeFooter = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;text-align:center;">
  <tr>
    <td align="center">
      <p style="margin:0 0 6px 0;">Mensaje enviado por <strong>${senderName}</strong></p>
      <p style="margin:0;">Para dejar de recibir estas comunicaciones, responda a este correo indicando "Desuscribir".</p>
    </td>
  </tr>
</table>`;

                    // Standard 1x1 tracking pixel (avoids spam penalty of display:none)
                    const openTrackingPixel = `<img src="${trackingBaseUrl}?type=open&mid=${messageId}" width="1" height="1" alt="" border="0" style="display:block;width:1px;height:1px;border:0;" />`;
                    const trackedHtml = `${clickTrackedContent}${unsubscribeFooter}${openTrackingPixel}`;

                    // Extract sender domain for List-Unsubscribe header
                    const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'ariascrm.com';

                    // localizedSubject is already computed and validated at the top of this try-block

                    const emailPayload: any = {
                        from: fromDisplay,
                        to: cleanEmail,
                        subject: localizedSubject,
                        html: trackedHtml,
                        text: richContent.cleanText, // RFC 2046 Plain Text alternative!
                        headers: {
                            'List-Unsubscribe': `<mailto:bounces@${senderDomain}?subject=unsubscribe>`,
                            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                            'X-Entity-Ref-ID': messageId
                        }
                    };

                    if (replyTo) {
                        emailPayload.reply_to = replyTo;
                    }

                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendToken}` },
                        body: JSON.stringify(emailPayload)
                    });
                    if (!res.ok) { const e = await res.text(); console.error("Resend Error:", e); throw new Error(`Resend Error: ${e}`); }
                    await supabase.from('marketing_conversations').update({ last_message: localizedSubject, last_message_at: new Date().toISOString() }).eq('id', conversationId);
                }

                // D. Record message
                await supabase.from("marketing_messages").insert({
                    id: messageId, conversation_id: conversationId, content: localizedContent,
                    direction: "outbound", type: "text", status: 'delivered',
                    metadata: { campaign_id: campaignId, lead_id: lead.id, processed_by: 'edge-function', tracking_url: `${trackingBaseUrl}?type=click&mid=${messageId}&url=` }
                });
                results.success++;
            } catch (e) {
                console.error(`Error sending to lead ${lead.id}:`, e);
                results.failed++;
            }
        }

        const { count: totalSent } = await supabase.from('marketing_messages').select('*', { count: 'exact', head: true }).eq('metadata->>campaign_id', campaignId);
        await supabase.from("marketing_campaigns").update({
            status: "completed", sent_at: new Date().toISOString(),
            total_recipients: totalSent || results.success,
            stats: { sent: totalSent || results.success, failed: results.failed, total: leads.length, opened: 0, clicked: 0 }
        }).eq("id", campaignId);

        return new Response(JSON.stringify({ success: true, results: { success: results.success, failed: results.failed, cumulative: totalSent, total: leads.length } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
