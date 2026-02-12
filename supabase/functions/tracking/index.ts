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
            console.log(`Processing track event: type=${type}, mid=${msgId}`);

            // 1. Get message details first to find campaign_id
            const { data: msgInfo } = await supabase
                .from('marketing_messages')
                .select('metadata, status')
                .eq('id', msgId)
                .single();

            if (msgInfo) {
                const campaignId = msgInfo.metadata?.campaign_id;
                const newStatus = type === 'open' ? 'opened' : 'clicked';

                // Only update if not already at that level (prevent over-counting)
                // Note: clicked is higher than opened
                if (msgInfo.status !== 'clicked') {
                    const { error: updateError } = await supabase
                        .from('marketing_messages')
                        .update({
                            status: newStatus
                        })
                        .eq('id', msgId);

                    if (updateError) {
                        console.error('Update Status Error:', updateError);
                    } else {
                        console.log('Update Status Success');
                    }

                    if (campaignId) {
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
