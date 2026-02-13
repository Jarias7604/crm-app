import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

/**
 * Senior Standard Phone Normalization (E.164)
 * Handles: +503..., 503..., 1..., 7744-3322 (local)
 */
function normalizePhone(phone: string, defaultCountryCode = '503'): string {
    if (!phone) return "";

    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, "");

    // If it starts with 00, replace with +
    if (phone.startsWith("00")) {
        cleaned = cleaned.substring(2);
    }

    // logic for local numbers (El Salvador specific 8 digits)
    if (cleaned.length === 8 && defaultCountryCode === '503') {
        return `+503${cleaned}`;
    }

    // If it doesn't have a plus, add it
    return `+${cleaned}`;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { campaignId } = await req.json();

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Fetch Campaign Details
        const { data: campaign, error: campError } = await supabase
            .from("marketing_campaigns")
            .select("*")
            .eq("id", campaignId)
            .single();

        if (campError || !campaign) {
            throw new Error(`Campaign not found: ${campError?.message}`);
        }

        // 2. Fetch Audience based on filters
        const filters = campaign.audience_filters || {};
        let query = supabase
            .from("leads")
            .select("id, name, email, phone, priority")
            .eq("company_id", campaign.company_id);

        if (filters.specificIds && filters.specificIds.length > 0) {
            const idField = filters.idType || 'id';
            query = query.in(idField, filters.specificIds);
        } else {
            if (filters.status && filters.status.length > 0) {
                query = query.in("status", filters.status);
            }
            if (filters.priority && filters.priority !== 'all') {
                query = query.eq("priority", filters.priority);
            }
            if (filters.dateRange === "new") {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                query = query.gte("created_at", thirtyDaysAgo.toISOString());
            }
        }

        if (campaign.type === 'email') {
            query = query.not('email', 'is', null);
        }

        const { data: leads, error: leadError } = await query;
        if (leadError) throw leadError;

        if (!leads || leads.length === 0) {
            return new Response(JSON.stringify({ message: "No audience found" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2b. Senior Idempotency: Exclude already sent leads for this campaign
        const { data: sentMessages } = await supabase
            .from('marketing_messages')
            .select('metadata->lead_id')
            .eq('metadata->>campaign_id', campaignId);

        const sentLeadIds = new Set(sentMessages?.map(m => m.lead_id) || []);
        const filteredLeads = leads.filter(l => !sentLeadIds.has(l.id));

        if (filteredLeads.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: "All leads already processed",
                results: { success: 0, failed: 0, total: leads.length, skipped: leads.length }
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 3. Mark as Sending
        await supabase
            .from("marketing_campaigns")
            .update({ status: "sending" })
            .eq("id", campaignId);

        // 4. Batch Processing
        const results = { success: 0, failed: 0 };
        const trackingBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking`;

        // Fetch integration settings based on campaign type
        let telegramToken = null;
        let whatsappConfig = null;

        if (campaign.type === 'whatsapp') {
            // Fetch Meta Cloud API credentials for WhatsApp
            const { data: integration } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', campaign.company_id)
                .eq('provider', 'whatsapp')
                .eq('is_active', true)
                .maybeSingle();

            whatsappConfig = integration?.settings;
        } else if (campaign.type === 'social' || campaign.type === 'telegram') {
            // Fetch Telegram credentials for social/telegram campaigns
            const { data: integration } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', campaign.company_id)
                .eq('provider', 'telegram')
                .eq('is_active', true)
                .maybeSingle();
            telegramToken = integration?.settings?.token;
        }

        // Fetch Resend sender details
        let senderName = "CRM Marketing";
        let senderEmail = "marketing@ariasdefense.com";

        const { data: resendIntegration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', campaign.company_id)
            .eq('provider', 'resend')
            .eq('is_active', true)
            .maybeSingle();

        // PRIORITIZE Database API Key
        let resendToken = Deno.env.get("RESEND_API_KEY");
        if (resendIntegration?.settings?.apiKey) {
            resendToken = resendIntegration.settings.apiKey;
        }

        if (resendIntegration?.settings?.senderName) {
            senderName = resendIntegration.settings.senderName;
        }
        if (resendIntegration?.settings?.senderEmail) {
            senderEmail = resendIntegration.settings.senderEmail;
        }

        const fromDisplay = `${senderName} <${senderEmail}>`;

        // Fetch Template if applicable
        let templateData = null;
        if (campaign.template_id) {
            const { data } = await supabase
                .from('marketing_templates')
                .select('*')
                .eq('id', campaign.template_id)
                .maybeSingle();
            templateData = data;
        }

        console.log(`[Marketing-Engine] Starting batch processing for ${filteredLeads.length} leads.`);

        for (let i = 0; i < filteredLeads.length; i++) {
            const lead = filteredLeads[i];
            console.log(`[Marketing-Engine] [${i + 1}/${filteredLeads.length}] Processing lead: ${lead.email || lead.phone || lead.id}`);

            // Senior Bulk Pattern: Small delay to avoid slamming APIs and hitting rate limits
            if (i > 0) await new Promise(r => setTimeout(r, 600));

            const phone = normalizePhone(lead.phone);

            try {
                const messageId = crypto.randomUUID();
                let conversationId = null;

                // Professional Variable Substitution: {{name}}, {{first_name}}, {{greeting}}, {{phone}}
                let localizedContent = campaign.content || '';

                const getGreeting = () => {
                    // Use a standardized greeting based on server time (UTC-6 for Central America usually)
                    const hour = new Date().getHours();
                    if (hour >= 5 && hour < 12) return 'Buenos días';
                    if (hour >= 12 && hour < 19) return 'Buenas tardes';
                    return 'Buenas noches';
                };

                const greeting = getGreeting();
                const firstName = (lead.name || '').split(' ')[0] || 'Hola';

                localizedContent = localizedContent.replace(/{{greeting}}/g, greeting);
                localizedContent = localizedContent.replace(/{{name}}/g, lead.name || '');
                localizedContent = localizedContent.replace(/{{first_name}}/g, firstName);
                localizedContent = localizedContent.replace(/{{phone}}/g, lead.phone || '');

                // --- Media Extraction & Formatting Utility ---
                const extractMediaAndText = (html: string) => {
                    let text = html;
                    let mediaUrl: string | null = null;
                    let mediaType: 'image' | 'video' | 'document' | null = null;

                    // Extract Image
                    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
                    if (imgMatch) {
                        mediaUrl = imgMatch[1];
                        mediaType = 'image';
                    }

                    // Extract Video
                    const videoMatch = html.match(/<source[^>]+src="([^">]+)"/);
                    if (videoMatch) {
                        mediaUrl = videoMatch[1];
                        mediaType = 'video';
                    }

                    // Extract Document
                    const docMatch = html.match(/<a[^>]+href="([^">]+)"[^>]*>Ver Archivo<\/a>/);
                    if (docMatch) {
                        mediaUrl = docMatch[1];
                        mediaType = 'document';
                    }

                    // Strip HTML for WhatsApp
                    const cleanText = text
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<b>(.*?)<\/b>/gi, '*$1*')
                        .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
                        .replace(/<i>(.*?)<\/i>/gi, '_$1_')
                        .replace(/<em>(.*?)<\/em>/gi, '_$1_')
                        .replace(/<a[^>]+href="([^">]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
                        .replace(/<p>(.*?)<\/p>/gi, '$1\n')
                        .replace(/<h[1-2]>(.*?)<\/h[1-2]>/gi, '*$1*\n')
                        .replace(/<[^>]+>/g, '') // Final strip of any remaining tags
                        .trim();

                    return { cleanText, mediaUrl, mediaType };
                };

                const richContent = extractMediaAndText(localizedContent);

                // A. WhatsApp Send (Meta Cloud API) - Generic Foundation
                if (campaign.type === 'whatsapp' && phone) {
                    const { data: conv } = await supabase
                        .from('marketing_conversations')
                        .upsert({
                            company_id: campaign.company_id,
                            lead_id: lead.id,
                            channel: 'whatsapp',
                            status: 'active',
                            external_id: phone.replace('+', '') // Use numeric ID for Meta
                        }, { onConflict: 'lead_id,channel' })
                        .select('id, external_id')
                        .single();
                    conversationId = conv?.id;

                    if (whatsappConfig?.token && whatsappConfig?.phoneNumberId) {
                        try {
                            let payload: any = {
                                messaging_product: 'whatsapp',
                                to: lead.phone.replace(/\D/g, '')
                            };

                            if (campaign.template_id) {
                                payload.type = 'template';
                                payload.template = {
                                    name: campaign.subject || campaign.name,
                                    language: { code: 'es' },
                                    components: [{
                                        type: 'body',
                                        parameters: lead.name ? [{ type: 'text', text: lead.name }] : []
                                    }]
                                };
                            } else if (richContent.mediaUrl) {
                                // Rich Media Delivery
                                payload.type = richContent.mediaType;
                                payload[richContent.mediaType!] = {
                                    link: richContent.mediaUrl,
                                    caption: richContent.cleanText
                                };
                            } else {
                                payload.type = 'text';
                                payload.text = { body: richContent.cleanText };
                            }

                            const whatsappRes = await fetch(
                                `https://graph.facebook.com/v18.0/${whatsappConfig.phoneNumberId}/messages`,
                                {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${whatsappConfig.token}`
                                    },
                                    body: JSON.stringify(payload)
                                }
                            );

                            if (!whatsappRes.ok) {
                                const errData = await whatsappRes.text();
                                console.error('WhatsApp API Error:', errData);
                                throw new Error(`WhatsApp Error: ${errData}`);
                            }

                            const waData = await whatsappRes.json();
                            if (waData.messages?.[0]?.id) {
                                await supabase
                                    .from('marketing_conversations')
                                    .update({
                                        external_id: waData.messages[0].id,
                                        last_message: campaign.template_id ? 'Plantilla WhatsApp enviada' : richContent.cleanText.substring(0, 100),
                                        last_message_at: new Date().toISOString()
                                    })
                                    .eq('id', conversationId);
                            }
                        } catch (waError) {
                            console.error(`WhatsApp send error for lead ${lead.id}:`, waError);
                            throw waError;
                        }
                    }
                }

                // B. Telegram Send (for 'social' or 'telegram' campaigns) - High Standard
                if ((campaign.type === 'social' || campaign.type === 'telegram')) {
                    const { data: conv } = await supabase
                        .from('marketing_conversations')
                        .upsert({
                            company_id: campaign.company_id,
                            lead_id: lead.id,
                            channel: 'telegram',
                            status: 'active'
                        }, { onConflict: 'lead_id,channel' })
                        .select('id, external_id')
                        .single();
                    conversationId = conv?.id;

                    if (conv?.external_id && telegramToken) {
                        let method = 'sendMessage';
                        const payload: any = {
                            chat_id: conv.external_id,
                            parse_mode: 'HTML'
                        };

                        if (richContent.mediaUrl) {
                            // Telegram Rich Media Support
                            if (richContent.mediaType === 'image') method = 'sendPhoto';
                            else if (richContent.mediaType === 'video') method = 'sendVideo';
                            else method = 'sendDocument';

                            payload[richContent.mediaType === 'image' ? 'photo' : richContent.mediaType!] = richContent.mediaUrl;
                            payload.caption = localizedContent; // Telegram supports HTML in captions
                        } else {
                            payload.text = localizedContent;
                        }

                        // Support for Professional Buttons (Inline Keyboard)
                        if (templateData?.channel === 'telegram' && templateData.content?.buttons) {
                            payload.reply_markup = {
                                inline_keyboard: templateData.content.buttons.map((btn: any) => ([{
                                    text: btn.text,
                                    url: btn.url ? btn.url.replace(/{{name}}/g, lead.name || '') : undefined
                                }]))
                            };
                        }

                        const tgRes = await fetch(`https://api.telegram.org/bot${telegramToken}/${method}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!tgRes.ok) {
                            const errData = await tgRes.json();
                            console.error(`Telegram Error for lead ${lead.id}:`, errData);
                            throw new Error(`Telegram Error: ${errData.description || 'Unknown error'}`);
                        }

                        // Update conversation preview
                        await supabase
                            .from('marketing_conversations')
                            .update({
                                last_message: richContent.cleanText.substring(0, 100),
                                last_message_at: new Date().toISOString()
                            })
                            .eq('id', conversationId);
                    } else {
                        throw new Error("Missing Telegram Chat ID (external_id). Lead must start conversation with bot first.");
                    }
                }

                // C. Email Send (Resend)
                if (campaign.type === "email" && lead.email) {
                    // Senior Robustness: Clean email from dirty data (newlines, spaces, multiple emails)
                    const cleanEmail = lead.email.trim().split(/[\r\n,;]/)[0].trim();

                    // Create/Get Conversation for Email channel
                    const { data: conv } = await supabase
                        .from('marketing_conversations')
                        .upsert({
                            company_id: campaign.company_id,
                            lead_id: lead.id,
                            channel: 'email',
                            status: 'active',
                            external_id: cleanEmail
                        }, { onConflict: 'lead_id,channel' })
                        .select('id')
                        .single();

                    if (!conv) throw new Error("Failed to create conversation bucket");
                    conversationId = conv.id;

                    if (!resendToken) {
                        console.error(`Missing Resend API Key for company ${campaign.company_id}`);
                        throw new Error("Missing Resend API Key configuration");
                    }

                    const trackedHtml = `
                        ${localizedContent}
                        <img src="${trackingBaseUrl}?type=open&mid=${messageId}" width="1" height="1" style="display:none;" />
                    `;

                    const res = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendToken}`
                        },
                        body: JSON.stringify({
                            from: fromDisplay,
                            to: cleanEmail,
                            subject: campaign.subject || campaign.name,
                            html: trackedHtml
                        })
                    });

                    if (!res.ok) {
                        const errData = await res.text();
                        console.error("Resend API Error:", errData);
                        throw new Error(`Resend Error: ${errData}`);
                    }

                    // Update conversation preview
                    await supabase
                        .from('marketing_conversations')
                        .update({
                            last_message: campaign.subject || campaign.name,
                            last_message_at: new Date().toISOString()
                        })
                        .eq('id', conversationId);
                }

                // D. Create Message Record
                const { error: msgError } = await supabase.from("marketing_messages").insert({
                    id: messageId,
                    conversation_id: conversationId,
                    content: localizedContent,
                    direction: "outbound",
                    type: "text",
                    status: (campaign.type === 'email' && !resendToken) ? 'sent' : 'delivered',
                    metadata: {
                        campaign_id: campaignId,
                        lead_id: lead.id,
                        processed_by: 'edge-function',
                        tracking_url: `${trackingBaseUrl}?type=click&mid=${messageId}&url=`
                    }
                });

                if (msgError) {
                    console.error(`Database Error for lead ${lead.id}:`, msgError.message);
                    throw new Error(`DB Error: ${msgError.message}`);
                }

                results.success++;
            } catch (e) {
                console.error(`Error sending to lead ${lead.id}:`, e);
                results.failed++;
            }
        }

        // 5. Finalize Campaign with cumulative stats
        const { count: totalSent } = await supabase
            .from('marketing_messages')
            .select('*', { count: 'exact', head: true })
            .eq('metadata->>campaign_id', campaignId);

        console.log(`[Marketing-Engine] Campaign finished. New: ${results.success}, Cumulative Total: ${totalSent}`);

        await supabase
            .from("marketing_campaigns")
            .update({
                status: "completed",
                sent_at: new Date().toISOString(),
                total_recipients: totalSent || results.success,
                stats: {
                    sent: totalSent || results.success,
                    failed: results.failed,
                    total: leads.length,
                    opened: 0,
                    clicked: 0
                },
            })
            .eq("id", campaignId);

        return new Response(JSON.stringify({
            success: true,
            results: {
                success: results.success,
                failed: results.failed,
                cumulative: totalSent,
                total: leads.length
            }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
