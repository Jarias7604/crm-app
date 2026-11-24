// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function jsonRes(body: Record<string, any>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.code ? 'exchange_code' : 'get_auth_url');
    const company_id = String(body.company_id || '').trim();
    const redirect_uri = String(body.redirect_uri || '').trim();

    if (!company_id) return jsonRes({ success: false, error: 'Falta company_id para conectar YouTube.' }, 400);

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return jsonRes(
        { success: false, error: 'Credenciales GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configuradas en Supabase.' },
        500,
      );
    }

    const safeRedirect = redirect_uri || 'https://ariascrm.com/integrations/google/callback';

    if (action === 'get_auth_url') {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: safeRedirect,
        response_type: 'code',
        scope: YOUTUBE_SCOPES,
        access_type: 'offline',
        prompt: 'select_account consent',
        state: `youtube:${company_id}`,
      });
      return jsonRes({
        success: true,
        auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      });
    }

    const code = String(body.code || '').trim();
    if (!code) return jsonRes({ success: false, error: 'Falta el código de autorización de Google.' }, 400);

    // 1. Exchange code -> tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: safeRedirect,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || tokens.error || !tokens.access_token) {
      const msg = tokens.error_description || tokens.error || 'No se pudo intercambiar el código de Google.';
      return jsonRes({ success: false, error: msg }, 400);
    }

    // 2. Fetch YouTube channels managed by the selected Google / Brand Account
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&maxResults=50',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    const chData = await chRes.json();

    if (!chRes.ok || chData.error) {
      const errReason = String(chData.error?.errors?.[0]?.reason || '');
      const rawMsg = String(chData.error?.message || '');
      if (errReason === 'accessNotConfigured' || rawMsg.toLowerCase().includes('youtube data api v3')) {
        return jsonRes(
          {
            success: false,
            error:
              'Falta habilitar "YouTube Data API v3" en Google Cloud Console. Actívala una vez y vuelve a conectar tu canal.',
          },
          403,
        );
      }
      return jsonRes({ success: false, error: rawMsg || 'Error consultando canales de YouTube.' }, 400);
    }

    const channels = Array.isArray(chData.items) ? chData.items : [];
    if (channels.length === 0) {
      return jsonRes(
        {
          success: false,
          error: 'La cuenta de Google elegida no tiene un canal de YouTube activo.',
        },
        400,
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
    const saved: any[] = [];

    for (const ch of channels) {
      const channelTitle = ch.snippet?.title || `Canal ${ch.id}`;
      const avatarUrl =
        ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || null;
      const subscriberCount = Number(ch.statistics?.subscriberCount || 0);

      // Preserve existing refresh_token if Google didn't send one on re-authorization
      const { data: existingRow } = await supabase
        .from('social_accounts')
        .select('id, metadata')
        .eq('company_id', company_id)
        .eq('platform', 'youtube')
        .eq('account_id', ch.id)
        .maybeSingle();

      const refreshToken =
        tokens.refresh_token || existingRow?.metadata?.refresh_token || null;

      const { data: upserted, error: upErr } = await supabase
        .from('social_accounts')
        .upsert(
          {
            company_id,
            platform: 'youtube',
            account_name: channelTitle,
            display_name: channelTitle,
            account_id: ch.id,
            avatar_url: avatarUrl,
            access_token: tokens.access_token,
            token_expires_at: expiresAt,
            is_active: true,
            follower_count: subscriberCount,
            metadata: {
              channel_id: ch.id,
              custom_url: ch.snippet?.customUrl || null,
              refresh_token: refreshToken,
              connected_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,platform,account_id' },
        )
        .select()
        .single();

      if (upErr) throw upErr;
      if (upserted) saved.push(upserted);
    }

    // Ensure at least one active YouTube channel is marked default
    const { data: existingDefault } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('company_id', company_id)
      .eq('platform', 'youtube')
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    if (!existingDefault && saved[0]?.id) {
      await supabase.from('social_accounts').update({ is_default: true }).eq('id', saved[0].id);
    }

    return jsonRes({
      success: true,
      channels_connected: saved.length,
      accounts: saved.map((a) => ({
        id: a.id,
        platform: a.platform,
        account_id: a.account_id,
        account_name: a.account_name,
        avatar_url: a.avatar_url,
      })),
    });
  } catch (err: any) {
    console.error('[youtube-oauth] Error:', err);
    return jsonRes({ success: false, error: err?.message || 'Error conectando YouTube' }, 500);
  }
});
