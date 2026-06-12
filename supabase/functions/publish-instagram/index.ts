// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 📸 PUBLISH-INSTAGRAM Edge Function
 * Publica en Instagram Business via Meta Graph API v22.0
 * Proceso: Crear Media Container → Publicar Container (2 pasos requeridos por Meta)
 * ---------------------------------------------------------------
 * ⚠️ META_API_VERSION: Actualizar cuando Meta depreca versiones.
 *    Revisar: developers.facebook.com/docs/graph-api/changelog
 *    Próxima revision: Septiembre 2026
 */
const META_API_VERSION = "v22.0";

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const { post_id, company_id } = await req.json();

        const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // 1. Get post
        const { data: post, error: postErr } = await supabase
            .from('social_posts')
            .select('*')
            .eq('id', post_id)
            .single();

        if (postErr || !post) {
            return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers: cors });
        }

        // 2. Get Instagram account (stored as instagram_business_id in metadata)
        const { data: account } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('company_id', company_id || post.company_id)
            .eq('platform', 'instagram')
            .eq('is_active', true)
            .maybeSingle();

        if (!account?.access_token || !account?.metadata?.instagram_business_id) {
            await supabase.from('social_posts').update({
                results: { ...post.results, instagram: { error: 'Instagram Business account not connected.' } }
            }).eq('id', post_id);
            return new Response(JSON.stringify({ error: 'Instagram not connected' }), { status: 400, headers: cors });
        }

        const igBusinessId = account.metadata.instagram_business_id;
        const accessToken = account.access_token;
        const caption = post.captions?.instagram || post.captions?.default || '';

        // 3. Step 1: Create Media Container
        const isVideo = post.content_type === 'video' || post.content_type === 'reel';
        const containerBody: any = {
            caption,
            access_token: accessToken,
        };

        if (isVideo) {
            containerBody.media_type = post.content_type === 'reel' ? 'REELS' : 'VIDEO';
            containerBody.video_url = post.content_url;
        } else {
            containerBody.image_url = post.content_url;
        }

        const containerRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${igBusinessId}/media`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(containerBody)
            }
        );
        const container = await containerRes.json();

        if (!container.id) {
            console.error('[publish-instagram] Container creation failed:', JSON.stringify(container));
            await supabase.from('social_posts').update({
                results: { ...post.results, instagram: { error: container.error?.message || 'Container creation failed' } }
            }).eq('id', post_id);
            return new Response(JSON.stringify({ error: 'Container creation failed', detail: container }), { status: 400, headers: cors });
        }

        console.log(`[publish-instagram] Container created: ${container.id}`);

        // 4. Step 2: Wait for processing then Publish Container
        await sleep(2000); // Give Meta time to process

        const publishRes = await fetch(
            `https://graph.facebook.com/${META_API_VERSION}/${igBusinessId}/media_publish`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: container.id,
                    access_token: accessToken,
                })
            }
        );
        const publishResult = await publishRes.json();

        const success = !!publishResult.id && !publishResult.error;
        console.log(`[publish-instagram] ${success ? '✅' : '❌'}`, JSON.stringify(publishResult));

        await supabase.from('social_posts').update({
            results: {
                ...post.results,
                instagram: success
                    ? { media_id: publishResult.id, published_at: new Date().toISOString() }
                    : { error: publishResult.error?.message || 'Publish failed', code: publishResult.error?.code }
            }
        }).eq('id', post_id);

        return new Response(JSON.stringify({ success, result: publishResult }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[publish-instagram] Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
});
