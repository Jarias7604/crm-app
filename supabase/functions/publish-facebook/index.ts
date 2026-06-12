// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 📘 PUBLISH-FACEBOOK Edge Function
 * Publica imagen o video en una Facebook Page via Meta Graph API v22.0
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

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const { post_id, company_id, account_id } = await req.json();

        const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // 1. Get the post
        const { data: post, error: postErr } = await supabase
            .from('social_posts')
            .select('*')
            .eq('id', post_id)
            .single();

        if (postErr || !post) {
            return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers: cors });
        }

        // 2. Get Facebook account credentials
        let accountQuery = supabase
            .from('social_accounts')
            .select('*')
            .eq('company_id', company_id || post.company_id)
            .eq('platform', 'facebook')
            .eq('is_active', true);

        if (account_id) {
            accountQuery = accountQuery.eq('account_id', account_id);
        } else {
            accountQuery = accountQuery.order('is_default', { ascending: false }).order('created_at');
        }

        const { data: accounts } = await accountQuery;
        const account = accounts?.[0];

        if (!account?.access_token || !account?.account_id) {
            await supabase.from('social_posts').update({
                results: { ...post.results, facebook: { error: 'Facebook account not connected. Go to Social Hub → Connect Accounts.' } }
            }).eq('id', post_id);
            return new Response(JSON.stringify({ error: 'Facebook not connected' }), { status: 400, headers: cors });
        }

        const pageId = account.account_id;
        const pageToken = account.access_token;
        const caption = post.captions?.facebook || post.captions?.default || '';

        let fbResult: any = {};

        // 3. Publish based on content type
        if (post.content_type === 'video') {
            // Video upload via resumable upload (simplified — direct URL)
            const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${pageId}/videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_url: post.content_url,
                    description: caption,
                    access_token: pageToken,
                })
            });
            fbResult = await res.json();
        } else {
            // Photo post
            const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${pageId}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: post.content_url,
                    caption,
                    access_token: pageToken,
                })
            });
            fbResult = await res.json();
        }

        const success = !!fbResult.id && !fbResult.error;
        console.log(`[publish-facebook] ${success ? '✅' : '❌'} Result:`, JSON.stringify(fbResult));

        // 4. Update post results
        await supabase.from('social_posts').update({
            results: {
                ...post.results,
                facebook: success
                    ? { post_id: fbResult.id, published_at: new Date().toISOString() }
                    : { error: fbResult.error?.message || 'Unknown error', code: fbResult.error?.code }
            }
        }).eq('id', post_id);

        return new Response(JSON.stringify({ success, result: fbResult }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[publish-facebook] Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
});
