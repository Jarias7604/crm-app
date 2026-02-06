import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

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

        // 3. Mark as Sending
        await supabase
            .from("marketing_campaigns")
            .update({ status: "sending" })
            .eq("id", campaignId);

        // 4. Batch Processing
        const results = { success: 0, failed: 0 };
        const trackingBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tracking`;

        // Fetch integration settings
        let telegramToken = null;
        if (campaign.type === 'social' || campaign.type === 'whatsapp') {
            const { data: integration } = await supabase
                .from('marketing_integrations')
                .select('settings')
                .eq('company_id', campaign.company_id)
                .eq('provider', 'telegram')
                .eq('is_active', true)
                .maybeSingle();
            telegramToken = integration?.settings?.token;
        }

        const resendToken = Deno.env.get("RESEND_API_KEY");

        for (const lead of leads) {
            try {
                const messageId = crypto.randomUUID();
                let conversationId = null;

                // A. Telegram Send logic (Placeholder + Message creation)
                if ((campaign.type === 'social' || campaign.type === 'whatsapp')) {
                    const channel = campaign.type === 'whatsapp' ? 'whatsapp' : 'telegram';
                    const { data: conv } = await supabase
                        .from('marketing_conversations')
                        .upsert({
                            company_id: campaign.company_id,
                            lead_id: lead.id,
                            channel: channel,
                            status: 'open'
                        }, { onConflict: 'lead_id,channel' })
                        .select('id, external_id')
                        .single();
                    conversationId = conv?.id;

                    if (conv?.external_id && telegramToken) {
                        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: conv.external_id,
                                text: campaign.content,
                                parse_mode: 'HTML'
                            })
                        });
                    }
                }

                // B. Email Send (Resend)
                if (campaign.type === "email" && lead.email && resendToken) {
                    const trackedHtml = `
                ${campaign.content}
                <img src="${trackingBaseUrl}?type=open&mid=${messageId}" width="1" height="1" style="display:none;" />
            `;

                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${resendToken}`
                        },
                        body: JSON.stringify({
                            from: 'CRM Marketing <marketing@ariasdefense.com>',
                            to: lead.email,
                            subject: campaign.subject || campaign.name,
                            html: trackedHtml
                        })
                    });
                }

                // C. Create Message Record
                await supabase.from("marketing_messages").insert({
                    id: messageId,
                    conversation_id: conversationId,
                    content: campaign.content,
                    direction: "outbound",
                    type: "text",
                    status: (campaign.type === 'email' && !resendToken) ? 'sent' : 'delivered',
                    metadata: {
                        campaign_id: campaignId,
                        lead_id: lead.id,
                        tracking_url: `${trackingBaseUrl}?type=click&mid=${messageId}&url=`
                    }
                });

                results.success++;
            } catch (e) {
                console.error(`Error sending to lead ${lead.id}:`, e);
                results.failed++;
            }
        }

        // 5. Finalize Campaign
        await supabase
            .from("marketing_campaigns")
            .update({
                status: "completed",
                sent_at: new Date().toISOString(),
                total_recipients: results.success,
                stats: { sent: results.success, opened: 0, clicked: 0 },
            })
            .eq("id", campaignId);

        return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
