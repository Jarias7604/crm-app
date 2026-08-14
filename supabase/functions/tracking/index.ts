import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const type = url.searchParams.get('type') // 'open' or 'click'
        const msgId = url.searchParams.get('mid')
        const redirectUrl = url.searchParams.get('url')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (msgId) {
            const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
            const isKnownBot = /bot|spider|crawler|googleimageproxy|yahoo|microsoft|outlook|proxy|security|scanner|headless|python|curl|fetch|ping/i.test(userAgent);

            // Fetch current message to check creation time and status
            const { data: fullMsg } = await supabase
                .from('marketing_messages')
                .select('created_at, status, metadata')
                .eq('id', msgId)
                .single();

            const isInstantScan = fullMsg?.created_at && (Date.now() - new Date(fullMsg.created_at).getTime()) < 3000;

            if (type === 'open' && (isKnownBot || isInstantScan)) {
                console.log(`[Tracking] Suppressed bot/pre-fetch open for ${msgId} (UA: ${userAgent})`);
            } else {
                const targetStatus = type === 'click' ? 'clicked' : 'opened';
                // Don't overwrite 'clicked' with 'opened'
                if (fullMsg && fullMsg.status !== 'clicked') {
                    await supabase
                        .from('marketing_messages')
                        .update({
                            status: targetStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', msgId);

                    const campaignId = fullMsg?.metadata?.campaign_id;
                    if (campaignId && fullMsg.status !== targetStatus) {
                        const statsKey = type === 'open' ? 'opened' : 'clicked';
                        await supabase.rpc('increment_campaign_stats', {
                            campaign_id: campaignId,
                            stat_key: statsKey
                        });
                    }
                }
            }
        }

        // Response
        if (type === 'open') {
            // Return 1x1 transparent pixel
            const pixel = Uint8Array.from([
                0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
                0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
                0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
                0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
            ])
            return new Response(pixel, {
                headers: { ...corsHeaders, 'Content-Type': 'image/gif' },
            })
        }

        if (type === 'click' && redirectUrl) {
            return Response.redirect(redirectUrl, 302)
        }

        return new Response('Tracking Active', { headers: corsHeaders })
    } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders })
    }
})
