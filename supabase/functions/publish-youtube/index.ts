// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonRes(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function buildYouTubeTitle(post: any): string {
  const explicit = String(post.captions?.youtube_title || '').trim();
  if (explicit) return explicit.slice(0, 100);

  const metaParts = [post.episode_label, post.topic].map((v: any) => String(v || '').trim()).filter(Boolean);
  if (metaParts.length > 0) return metaParts.join(' — ').slice(0, 100);

  const rawCaption = String(post.captions?.youtube || post.captions?.default || '').trim();
  const firstLine = rawCaption.split(/\r?\n/).map((s: string) => s.trim()).find(Boolean) || '';
  if (firstLine) return firstLine.slice(0, 95);

  return 'Video publicado desde Arias CRM';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { post_id, company_id, account_id } = await req.json();

    const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single();

    if (postErr || !post) {
      return jsonRes({ success: false, error: 'Publicación no encontrada.' }, 404);
    }

    let accountQuery = supabase
      .from('social_accounts')
      .select('*')
      .eq('company_id', company_id || post.company_id)
      .eq('platform', 'youtube')
      .eq('is_active', true);

    if (account_id) {
      accountQuery = accountQuery.eq('account_id', account_id);
    } else {
      accountQuery = accountQuery.order('is_default', { ascending: false }).order('created_at');
    }

    const { data: accounts } = await accountQuery;
    const account = accounts?.[0];

    if (!account?.access_token || !account?.account_id) {
      const msg = 'Canal de YouTube no conectado. Ve a Planning → Conexiones para vincularlo.';
      await supabase
        .from('social_posts')
        .update({ results: { ...(post.results || {}), youtube: { error: msg } } })
        .eq('id', post_id);
      return jsonRes({ success: false, error: msg }, 400);
    }

    const mediaUrl = String(post.content_url || '').trim();
    const looksLikeVideoUrl = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(mediaUrl);
    const isDeclaredVideo = post.content_type === 'video' || post.content_type === 'reel';

    if (!mediaUrl || (!isDeclaredVideo && !looksLikeVideoUrl)) {
      const msg = 'YouTube solo admite videos o Shorts (MP4/MOV), no imágenes estáticas.';
      await supabase
        .from('social_posts')
        .update({
          results: {
            ...(post.results || {}),
            youtube: { error: msg },
            [`youtube_${account.account_id}`]: { error: msg, account_name: account.account_name },
          },
        })
        .eq('id', post_id);
      return jsonRes({ success: false, error: msg }, 400);
    }

    // Refresh access token if expired or within 2 minutes of expiring
    let accessToken = account.access_token;
    const expTime = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    if (!expTime || expTime - Date.now() < 120_000) {
      const refreshToken = account.metadata?.refresh_token;
      if (!refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        const msg = 'Token de YouTube expirado. Reconecta el canal desde Conexiones en 2 clics.';
        await supabase
          .from('social_posts')
          .update({ results: { ...(post.results || {}), [`youtube_${account.account_id}`]: { error: msg } } })
          .eq('id', post_id);
        return jsonRes({ success: false, error: msg }, 401);
      }

      const refRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const refData = await refRes.json();
      if (!refRes.ok || !refData.access_token) {
        const msg = 'La sesión de YouTube expiró. Reconecta el canal desde Conexiones.';
        await supabase
          .from('social_accounts')
          .update({ is_active: false })
          .eq('id', account.id);
        await supabase
          .from('social_posts')
          .update({ results: { ...(post.results || {}), [`youtube_${account.account_id}`]: { error: msg } } })
          .eq('id', post_id);
        return jsonRes({ success: false, error: msg }, 401);
      }
      accessToken = refData.access_token;
      await supabase
        .from('social_accounts')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + Number(refData.expires_in || 3600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);
    }

    // Download video bytes
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) {
      throw new Error(`No se pudo descargar el archivo de video (${mediaRes.status}).`);
    }
    const contentTypeHeader = mediaRes.headers.get('content-type') || 'video/mp4';
    if (contentTypeHeader.startsWith('image/')) {
      const msg = 'YouTube solo admite videos o Shorts (MP4/MOV), no imágenes estáticas.';
      return jsonRes({ success: false, error: msg }, 400);
    }
    const videoBytes = new Uint8Array(await mediaRes.arrayBuffer());

    const title = buildYouTubeTitle(post);
    const description = String(post.captions?.youtube || post.captions?.default || '').slice(0, 5000);

    // 1. Initiate YouTube Resumable Upload Session
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(videoBytes.byteLength),
          'X-Upload-Content-Type': contentTypeHeader.startsWith('video/') ? contentTypeHeader : 'video/mp4',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            categoryId: '22',
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        }),
      },
    );

    if (!initRes.ok) {
      const errJson = await initRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `YouTube rechazó iniciar la subida (${initRes.status}).`;
      await supabase
        .from('social_posts')
        .update({
          results: {
            ...(post.results || {}),
            youtube: { error: msg },
            [`youtube_${account.account_id}`]: { error: msg, account_name: account.account_name },
          },
        })
        .eq('id', post_id);
      return jsonRes({ success: false, error: msg }, 400);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      throw new Error('YouTube no devolvió la URL de carga resumible.');
    }

    // 2. Upload binary video buffer
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentTypeHeader.startsWith('video/') ? contentTypeHeader : 'video/mp4',
        'Content-Length': String(videoBytes.byteLength),
      },
      body: videoBytes,
    });

    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadData.id) {
      const msg = uploadData?.error?.message || `Error subiendo video a YouTube (${uploadRes.status}).`;
      await supabase
        .from('social_posts')
        .update({
          results: {
            ...(post.results || {}),
            youtube: { error: msg },
            [`youtube_${account.account_id}`]: { error: msg, account_name: account.account_name },
          },
        })
        .eq('id', post_id);
      return jsonRes({ success: false, error: msg }, 400);
    }

    const videoUrl = `https://www.youtube.com/watch?v=${uploadData.id}`;
    const resultRecord = {
      video_id: uploadData.id,
      url: videoUrl,
      channel_name: account.account_name,
      published_at: new Date().toISOString(),
    };

    await supabase
      .from('social_posts')
      .update({
        results: {
          ...(post.results || {}),
          youtube: resultRecord,
          [`youtube_${account.account_id}`]: { ...resultRecord, account_name: account.account_name },
        },
      })
      .eq('id', post_id);

    console.log(`[publish-youtube] ✅ Uploaded to ${account.account_name}: ${videoUrl}`);
    return jsonRes({ success: true, result: { id: uploadData.id, url: videoUrl, channel_name: account.account_name } });
  } catch (err: any) {
    console.error('[publish-youtube] Error:', err);
    return jsonRes({ success: false, error: err?.message || 'Error publicando en YouTube' }, 500);
  }
});
