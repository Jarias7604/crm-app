import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
 * Injects click tracking into all <a href="..."> links in the HTML.
 * Replaces original URLs with a tracked redirect URL.
 */
function injectClickTracking(html: string, trackingBase: string, messageId: string): string {
    return html.replace(/<a(\s+[^>]*?)href="([^"]+)"([^>]*?)>/gi, (_match, before, href, after) => {
        if (href.startsWith('mailto:') || href.startsWith('#') || href.includes(trackingBase)) {
            return _match; // Skip mailto, anchors, and already-tracked links
        }
        const trackedUrl = `${trackingBase}?type=click&mid=${messageId}&url=${encodeURIComponent(href)}`;
        return `<a${before}href="${trackedUrl}"${after}>`;
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { campaignId } = await req.json();

        // Security: require a valid Supabase anon key or user token
        const authHeader = req.headers.get('Authorization') || '';
        const apiKey = req.headers.get('apikey') || '';
        if (!authHeader && !apiKey) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data: campaign, error: campError } = await supabase
            .from("marketing_campaigns").select("*").eq("id", campaignId).single();

        if (campError || !campaign) throw new Error(`Campaign not found: ${campError?.message}`);

        const filters = campaign.audience_filters || {};
        let query = supabase.from("leads").select("id, name, email, phone, priority").eq("company_id", campaign.company_id);

        if (filters.specificIds && filters.specificIds.length > 0) {
            query = query.in(filters.idType || 'id', filters.specificIds);
        } else {
            if (filters.status?.length > 0) query = query.in("status", filters.status);
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

        const { data: sentMessages } = await supabase.from('marketing_messages').select('metadata->lead_id').eq('metadata->>campaign_id', campaignId);
        const sentLeadIds = new Set(sentMessages?.map(m => m.lead_id) || []);
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

        // Email config — platform fallback to Arias Defense if no tenant config
        let senderName = "CRM Marketing";
        let senderEmail = "ventas@ariasdefense.com";
        const { data: tenantResend } = await supabase.from('marketing_integrations').select('settings').eq('company_id', campaign.company_id).eq('provider', 'resend').eq('is_active', true).maybeSingle();
        let platformResend = null;
        if (!tenantResend) {
            const { data: pr } = await supabase.from('marketing_integrations').select('settings')
                .eq('company_id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30') // Arias Defense — platform owner
                .eq('provider', 'resend').eq('is_active', true).maybeSingle();
            platformResend = pr;
        }
        const activeResend = tenantResend || platformResend;
        let resendToken = Deno.env.get("RESEND_API_KEY");
        if (activeResend?.settings?.apiKey) resendToken = activeResend.settings.apiKey;
        if (activeResend?.settings?.senderName) senderName = activeResend.settings.senderName;
        if (activeResend?.settings?.senderEmail) senderEmail = activeResend.settings.senderEmail;
        const fromDisplay = `${senderName} <${senderEmail}>`;
        console.log(`[Marketing-Engine] Sender: ${senderEmail} (${tenantResend ? 'tenant config' : 'platform fallback'})`);

        let templateData = null;
        if (campaign.template_id) {
            const { data } = await supabase.from('marketing_templates').select('*').eq('id', campaign.template_id).maybeSingle();
            templateData = data;
        }

        console.log(`[Marketing-Engine] Processing ${filteredLeads.length} leads.`);

        for (let i = 0; i < filteredLeads.length; i++) {
            const lead = filteredLeads[i];
            if (i > 0) await new Promise(r => setTimeout(r, 600));
            const phone = normalizePhone(lead.phone);

            try {
                const messageId = crypto.randomUUID();
                let conversationId = null;
                let localizedContent = campaign.content || '';

                const hour = new Date().getHours();
                const greeting = hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches';
                const firstName = (lead.name || '').split(' ')[0] || 'Hola';
                localizedContent = localizedContent
                    .replace(/{{greeting}}/g, greeting)
                    .replace(/{{name}}/g, lead.name || '')
                    .replace(/{{first_name}}/g, firstName)
                    .replace(/{{phone}}/g, lead.phone || '');

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

                    // Inject click tracking into all links, then append open pixel
                    const clickTrackedContent = injectClickTracking(localizedContent, trackingBaseUrl, messageId);
                    const trackedHtml = `${clickTrackedContent}<img src="${trackingBaseUrl}?type=open&mid=${messageId}" width="1" height="1" style="display:none;" />`;

                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendToken}` },
                        body: JSON.stringify({ from: fromDisplay, to: cleanEmail, subject: campaign.subject || campaign.name, html: trackedHtml })
                    });
                    if (!res.ok) { const e = await res.text(); console.error("Resend Error:", e); throw new Error(`Resend Error: ${e}`); }
                    await supabase.from('marketing_conversations').update({ last_message: campaign.subject || campaign.name, last_message_at: new Date().toISOString() }).eq('id', conversationId);
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
