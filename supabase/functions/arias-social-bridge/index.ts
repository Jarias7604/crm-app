import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  buildChatGptOpenApiSchema,
  buildChatGptSystemInstructions,
  extractImageCandidate,
  generateSecureToken,
  normalizeTargetAccounts,
  sha256Hex,
  validateScheduledIso,
  type ActiveSocialAccountLike,
  type TargetAccountRef,
} from './helpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getSubpath(reqUrl: string): string {
  const pathname = new URL(reqUrl).pathname;
  const idx = pathname.indexOf('arias-social-bridge');
  if (idx === -1) return '/';
  const rest = pathname.slice(idx + 'arias-social-bridge'.length);
  return rest.startsWith('/') ? rest.replace(/\/+$/, '') || '/' : `/${rest}`;
}

interface BridgeAuth {
  kind: 'bridge_token' | 'crm_jwt';
  userId: string;
  email: string;
  fullName: string;
  companyId: string;
  companyName: string;
  isSuperAdmin: boolean;
  canPublishDirectly: boolean;
  tokenId: string | null;
}

async function resolveBridgeAuth(
  req: Request,
  supabase: any,
  requestedCompanyId?: string | null,
): Promise<{ auth: BridgeAuth | null; error?: string; status?: number }> {
  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return { auth: null, error: 'Missing Authorization token', status: 401 };

  // 1. Personal/team ChatGPT bridge token (`arias_gpt_...`)
  if (bearer.startsWith('arias_gpt_')) {
    const tokenHash = await sha256Hex(bearer);
    const { data: tok } = await supabase
      .from('social_bridge_tokens')
      .select('id, company_id, user_id, can_publish_directly, is_active, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!tok || tok.is_active === false) {
      return { auth: null, error: 'Token de ChatGPT inválido o revocado', status: 401 };
    }
    if (tok.expires_at && new Date(tok.expires_at).getTime() <= Date.now()) {
      return { auth: null, error: 'Token de ChatGPT expirado', status: 401 };
    }

    const [{ data: profile }, { data: company }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, full_name, company_id, role, is_active')
        .eq('id', tok.user_id)
        .maybeSingle(),
      supabase.from('companies').select('id, name, features').eq('id', tok.company_id).maybeSingle(),
    ]);

    if (!profile || profile.is_active === false) {
      return { auth: null, error: 'Usuario del CRM desactivado', status: 403 };
    }
    if (!company || company.features?.ai_content_studio_enabled !== true) {
      return {
        auth: null,
        error: 'Social Planning / ChatGPT Bridge no está habilitado para esta empresa',
        status: 403,
      };
    }

    // Touch last_used_at asynchronously (non-blocking)
    supabase
      .from('social_bridge_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tok.id)
      .then(() => {});

    return {
      auth: {
        kind: 'bridge_token',
        userId: profile.id,
        email: String(profile.email || ''),
        fullName: String(profile.full_name || profile.email || 'Usuario CRM'),
        companyId: tok.company_id,
        companyName: String(company.name || 'Empresa CRM'),
        isSuperAdmin: false,
        canPublishDirectly: Boolean(tok.can_publish_directly),
        tokenId: tok.id,
      },
    };
  }

  // 2. Authenticated Supabase user JWT from CRM frontend
  const { data: userData, error: userErr } = await supabase.auth.getUser(bearer);
  if (userErr || !userData?.user) {
    return { auth: null, error: 'Sesión JWT inválida o expirada', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, company_id, role, is_active, is_platform_owner')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return { auth: null, error: 'Perfil inactivo', status: 403 };
  }

  const isSuperAdmin = profile.role === 'super_admin' || profile.is_platform_owner === true;
  const headerCompanyId = req.headers.get('x-company-id') || '';
  const targetCompanyId =
    isSuperAdmin && (requestedCompanyId || headerCompanyId)
      ? String(requestedCompanyId || headerCompanyId).trim()
      : String(profile.company_id || '').trim();

  if (!targetCompanyId) {
    return { auth: null, error: 'Empresa no resuelta para el usuario', status: 400 };
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, features')
    .eq('id', targetCompanyId)
    .maybeSingle();

  if (!company) return { auth: null, error: 'Empresa no encontrada', status: 404 };
  if (company.features?.ai_content_studio_enabled !== true) {
    return {
      auth: null,
      error: 'Módulo Social Planning / ChatGPT exclusivo para empresas autorizadas',
      status: 403,
    };
  }

  return {
    auth: {
      kind: 'crm_jwt',
      userId: profile.id,
      email: String(profile.email || userData.user.email || ''),
      fullName: String(profile.full_name || profile.email || 'Usuario CRM'),
      companyId: targetCompanyId,
      companyName: String(company.name || 'Empresa CRM'),
      isSuperAdmin,
      canPublishDirectly: true,
      tokenId: null,
    },
  };
}

function extensionFromMime(mimeType: string, fallbackName = ''): string {
  const m = mimeType.toLowerCase();
  if (m.includes('mp4') || /\.mp4$/i.test(fallbackName)) return 'mp4';
  if (m.includes('jpeg') || m.includes('jpg') || /\.jpe?g$/i.test(fallbackName)) return 'jpg';
  if (m.includes('webp') || /\.webp$/i.test(fallbackName)) return 'webp';
  return 'png';
}

async function persistIncomingMediaToStorage(
  supabase: any,
  companyId: string,
  body: any,
): Promise<{ publicUrl: string | null; isVideo: boolean }> {
  const candidate = extractImageCandidate(body);
  if (!candidate.url && !candidate.base64) {
    return { publicUrl: null, isVideo: false };
  }

  let bytes: Uint8Array;
  let mimeType = candidate.mimeType || 'image/png';

  if (candidate.base64) {
    bytes = decodeBase64(candidate.base64);
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new Error('La imagen excede el límite de 15 MB.');
    }
  } else {
    const url = candidate.url!;
    // Reuse existing permanent public Supabase Storage URL cleanly without re-uploading
    if (url.includes('/storage/v1/object/public/')) {
      return {
        publicUrl: url,
        isVideo: mimeType.includes('video') || /\.mp4(\?|$)/i.test(url),
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`No se pudo descargar el archivo desde ChatGPT/origen (HTTP ${resp.status}).`);
      }
      const respType = resp.headers.get('content-type');
      if (respType && !respType.includes('octet-stream')) {
        mimeType = respType.split(';')[0].trim();
      }
      const arr = new Uint8Array(await resp.arrayBuffer());
      if (arr.byteLength > MAX_MEDIA_BYTES) {
        throw new Error('El archivo multimedia supera el límite máximo de 15 MB.');
      }
      bytes = arr;
    } finally {
      clearTimeout(timer);
    }
  }

  const ext = extensionFromMime(mimeType, candidate.fileName);
  const isVideo = ext === 'mp4' || mimeType.startsWith('video/');
  const rand = Math.random().toString(36).slice(2, 8);
  const filePath = `public/social-planning/${companyId}/${Date.now()}-${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(filePath, bytes, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true,
    });

  if (upErr) {
    throw new Error(`Error guardando multimedia en Storage: ${upErr.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filePath);

  return { publicUrl, isVideo };
}

async function dispatchMetaPublish(
  supabaseUrl: string,
  serviceKey: string,
  supabase: any,
  post: any,
): Promise<{ success: boolean; partialError: string | null; results: Record<string, any> }> {
  const { data: activeAccounts } = await supabase
    .from('social_accounts')
    .select('id, platform, account_id, account_name, display_name, is_default, is_active')
    .eq('company_id', post.company_id)
    .eq('is_active', true);

  let targets: TargetAccountRef[] = Array.isArray(post.target_account_ids)
    ? post.target_account_ids.filter((t: any) => t && t.platform && t.account_id)
    : [];

  if (targets.length === 0) {
    targets = normalizeTargetAccounts(
      { platforms: Array.isArray(post.platforms) ? post.platforms : ['facebook'] },
      (activeAccounts || []) as ActiveSocialAccountLike[],
    );
  }

  if (targets.length === 0) {
    const errMsg = 'No hay páginas activas de Facebook/Instagram conectadas para esta empresa.';
    await supabase
      .from('social_posts')
      .update({
        status: 'failed',
        error_message: errMsg,
        results: { ...(post.results || {}), error: errMsg },
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id);
    return { success: false, partialError: errMsg, results: { error: errMsg } };
  }

  const combinedResults: Record<string, any> = { ...(post.results || {}) };
  const errors: string[] = [];
  let anySuccess = false;

  for (const target of targets) {
    const fnName =
      target.platform === 'facebook'
        ? 'publish-facebook'
        : target.platform === 'instagram'
        ? 'publish-instagram'
        : null;
    if (!fnName) {
      const msg = `Plataforma aún no soportada: ${target.platform}`;
      combinedResults[`${target.platform}_${target.account_id}`] = { error: msg };
      errors.push(msg);
      continue;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          post_id: post.id,
          company_id: post.company_id,
          account_id: target.account_id,
        }),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const label = target.account_name || target.account_id;
      combinedResults[`${target.platform}_${target.account_id}`] = {
        ...data,
        account_name: target.account_name || null,
      };
      if (res.ok && data?.success) {
        anySuccess = true;
      } else {
        const errDetail =
          data?.result?.error?.message ||
          data?.detail?.error?.message ||
          data?.error ||
          `Error publicando en ${target.platform} (${label})`;
        errors.push(`${label}: ${errDetail}`);
      }
    } catch (callErr: any) {
      const msg = callErr?.message || `Error invocando ${fnName}`;
      combinedResults[`${target.platform}_${target.account_id}`] = { error: msg };
      errors.push(msg);
    }
  }

  const nowIso = new Date().toISOString();
  const finalStatus = anySuccess ? 'published' : 'failed';
  const partialError = errors.length > 0 ? errors.join(' | ') : null;

  await supabase
    .from('social_posts')
    .update({
      status: finalStatus,
      published_at: anySuccess ? nowIso : post.published_at,
      error_message: partialError,
      results: combinedResults,
      updated_at: nowIso,
    })
    .eq('id', post.id);

  return { success: anySuccess, partialError, results: combinedResults };
}

async function parseBodyFlexible(req: Request): Promise<Record<string, any>> {
  const ctype = (req.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const out: Record<string, any> = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  return await req.json().catch(() => ({}));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'Missing Supabase environment variables' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const subpath = getSubpath(req.url);

  try {
    // ── Public OAuth 2.0 Token Exchange for Custom GPTs (/oauth/token) ──────
    if (req.method === 'POST' && subpath === '/oauth/token') {
      const body = await parseBodyFlexible(req);
      const grantType = String(body.grant_type || 'authorization_code').trim();
      const rawCode = String(body.code || '').trim();
      if (grantType !== 'authorization_code' || !rawCode) {
        return json({ error: 'invalid_request', error_description: 'code y grant_type requeridos' }, 400);
      }

      const codeHash = await sha256Hex(rawCode);
      const nowIso = new Date().toISOString();
      const { data: codeRow } = await supabase
        .from('social_bridge_oauth_codes')
        .select('*')
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (!codeRow) {
        return json({ error: 'invalid_grant', error_description: 'Código inválido o expirado' }, 400);
      }

      // Claim single-use code atomically
      const { data: claimed } = await supabase
        .from('social_bridge_oauth_codes')
        .update({ used_at: nowIso })
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .select('code_hash')
        .maybeSingle();
      if (!claimed) {
        return json({ error: 'invalid_grant', error_description: 'Código ya utilizado' }, 400);
      }

      const [{ data: profile }, { data: company }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, is_active')
          .eq('id', codeRow.user_id)
          .maybeSingle(),
        supabase
          .from('companies')
          .select('id, features')
          .eq('id', codeRow.company_id)
          .maybeSingle(),
      ]);

      if (!profile || profile.is_active === false || company?.features?.ai_content_studio_enabled !== true) {
        return json({ error: 'access_denied', error_description: 'Empresa o usuario no habilitado' }, 403);
      }

      const rawToken = generateSecureToken('arias_gpt_');
      const tokenHash = await sha256Hex(rawToken);
      const { error: tokErr } = await supabase.from('social_bridge_tokens').insert({
        company_id: codeRow.company_id,
        user_id: codeRow.user_id,
        label: 'ChatGPT OAuth (1 clic)',
        token_prefix: rawToken.slice(0, 14),
        token_hash: tokenHash,
        can_publish_directly: Boolean(codeRow.can_publish_directly),
        is_active: true,
      });
      if (tokErr) {
        return json({ error: 'server_error', error_description: tokErr.message }, 500);
      }

      return json({
        access_token: rawToken,
        token_type: 'Bearer',
        expires_in: 31536000,
      });
    }

    const body = req.method === 'POST' ? await parseBodyFlexible(req) : {};

    // ── Scheduled Cron Sweep (`process_due_scheduled`) ──────────────────────
    if (req.method === 'POST' && subpath === '/' && body?.action === 'process_due_scheduled') {
      const nowIso = new Date().toISOString();
      const { data: dueRows, error: dueErr } = await supabase
        .from('social_posts')
        .select('id, company_id')
        .eq('status', 'scheduled')
        .is('deleted_at', null)
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (dueErr) return json({ ok: false, error: dueErr.message }, 500);

      let processed = 0;
      let published = 0;
      let failed = 0;

      for (const candidate of dueRows || []) {
        const { data: company } = await supabase
          .from('companies')
          .select('features')
          .eq('id', candidate.company_id)
          .maybeSingle();

        if (company?.features?.ai_content_studio_enabled !== true) continue;

        // Claim row atomically so concurrent cron runs never double-publish
        const { data: claimed } = await supabase
          .from('social_posts')
          .update({ status: 'publishing', updated_at: nowIso })
          .eq('id', candidate.id)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .select('*')
          .maybeSingle();

        if (!claimed) continue;
        processed++;

        const res = await dispatchMetaPublish(supabaseUrl, serviceKey, supabase, claimed);
        if (res.success) published++;
        else failed++;
      }

      return json({ ok: true, processed, published, failed });
    }

    // ── All remaining routes require authenticated user or scoped token ─────
    const authRes = await resolveBridgeAuth(req, supabase, body?.company_id || null);
    if (!authRes.auth) {
      return json({ ok: false, error: authRes.error || 'Unauthorized' }, authRes.status || 401);
    }
    const auth = authRes.auth;

    // ── REST: GET /accounts (for ChatGPT Actions) ───────────────────────────
    if (req.method === 'GET' && subpath === '/accounts') {
      const { data: accounts, error } = await supabase
        .from('social_accounts')
        .select('id, platform, account_name, display_name, account_id, is_default, follower_count')
        .eq('company_id', auth.companyId)
        .eq('is_active', true)
        .order('platform', { ascending: true })
        .order('is_default', { ascending: false });

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({
        ok: true,
        company_id: auth.companyId,
        company_name: auth.companyName,
        connected_by: auth.fullName,
        accounts: (accounts || []).map((a: any) => ({
          platform: a.platform,
          account_id: a.account_id,
          page_name: a.display_name || a.account_name,
          is_default: Boolean(a.is_default),
        })),
      });
    }

    // ── REST: GET /memory (last 30 episodes / posts) ────────────────────────
    if (req.method === 'GET' && subpath === '/memory') {
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(
          'id, editorial_line, episode_label, topic, captions, platforms, status, scheduled_at, published_at, source, created_at',
        )
        .eq('company_id', auth.companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) return json({ ok: false, error: error.message }, 500);
      return json({
        ok: true,
        company_name: auth.companyName,
        total_recent: (posts || []).length,
        episodes: (posts || []).map((p: any) => ({
          id: p.id,
          editorial_line: p.editorial_line || null,
          episode_label: p.episode_label || null,
          topic: p.topic || null,
          caption_preview: String(p.captions?.facebook || p.captions?.instagram || p.captions?.default || '').slice(
            0,
            220,
          ),
          platforms: p.platforms || [],
          status: p.status,
          scheduled_at: p.scheduled_at,
          published_at: p.published_at,
          source: p.source || 'crm',
        })),
      });
    }

    // ── REST: POST /posts (ChatGPT Action: publish_now / schedule / draft) ──
    if (req.method === 'POST' && subpath === '/posts') {
      const caption = String(body.caption || '').trim();
      if (!caption) {
        return json({ ok: false, error: 'El texto (caption) es obligatorio.' }, 400);
      }

      let mode = String(body.mode || 'schedule').toLowerCase().trim();
      if (!['publish_now', 'schedule', 'draft'].includes(mode)) {
        return json({ ok: false, error: 'mode debe ser publish_now, schedule o draft.' }, 400);
      }

      let permissionDowngraded = false;
      if (mode === 'publish_now' && !auth.canPublishDirectly) {
        mode = 'draft';
        permissionDowngraded = true;
      }

      const schedCheck = validateScheduledIso(body.scheduled_at);
      if (!schedCheck.valid) {
        return json({ ok: false, error: schedCheck.error }, 400);
      }
      if (mode === 'schedule' && !schedCheck.iso) {
        return json(
          {
            ok: false,
            error: 'Falta scheduled_at (fecha y hora) para ponerlo en Planning.',
          },
          400,
        );
      }

      const { data: activeAccounts } = await supabase
        .from('social_accounts')
        .select('id, platform, account_id, account_name, display_name, is_default, is_active')
        .eq('company_id', auth.companyId)
        .eq('is_active', true);

      const resolvedTargets = normalizeTargetAccounts(
        {
          target_account_ids: body.target_account_ids,
          page_names: body.page_names,
          platforms: body.platforms,
        },
        (activeAccounts || []) as ActiveSocialAccountLike[],
      );

      if (resolvedTargets.length === 0) {
        return json(
          {
            ok: false,
            error:
              'No encontré páginas activas de Facebook o Instagram conectadas en Cuentas Conectadas de esta empresa.',
          },
          400,
        );
      }

      const media = await persistIncomingMediaToStorage(supabase, auth.companyId, body);
      if (!media.publicUrl) {
        return json(
          {
            ok: false,
            error:
              'No recibí el archivo de imagen/flyer. Asegúrate de pasar openaiFileIdRefs (el flyer recién generado) o image_url.',
          },
          400,
        );
      }

      const distinctPlatforms = [...new Set(resolvedTargets.map((t) => t.platform))];
      const captionsObj: Record<string, string> = { default: caption };
      for (const plat of distinctPlatforms) {
        captionsObj[plat] = caption;
      }

      const initialStatus =
        mode === 'publish_now' ? 'publishing' : mode === 'schedule' ? 'scheduled' : 'draft';

      const { data: created, error: insErr } = await supabase
        .from('social_posts')
        .insert({
          company_id: auth.companyId,
          content_url: media.publicUrl,
          content_type: media.isVideo ? 'video' : 'image',
          captions: captionsObj,
          platforms: distinctPlatforms,
          target_account_ids: resolvedTargets,
          editorial_line: body.editorial_line ? String(body.editorial_line).trim() : null,
          episode_label: body.episode_label ? String(body.episode_label).trim() : null,
          topic: body.topic ? String(body.topic).trim() : null,
          source: auth.kind === 'bridge_token' ? 'chatgpt' : 'crm',
          status: initialStatus,
          scheduled_at: mode === 'schedule' ? schedCheck.iso : null,
          created_by: auth.userId,
        })
        .select('*')
        .single();

      if (insErr || !created) {
        return json({ ok: false, error: insErr?.message || 'Error creando publicación' }, 500);
      }

      if (mode === 'publish_now') {
        const pubRes = await dispatchMetaPublish(supabaseUrl, serviceKey, supabase, created);
        return json({
          ok: pubRes.success,
          post_id: created.id,
          status: pubRes.success ? 'published' : 'failed',
          content_url: media.publicUrl,
          targets: resolvedTargets,
          error: pubRes.partialError,
          message: pubRes.success
            ? `Publicado correctamente en ${resolvedTargets.map((t) => t.account_name || t.platform).join(', ')}.`
            : `Falló la publicación: ${pubRes.partialError}`,
        });
      }

      return json({
        ok: true,
        post_id: created.id,
        status: created.status,
        scheduled_at: created.scheduled_at,
        content_url: media.publicUrl,
        targets: resolvedTargets,
        permission_downgraded: permissionDowngraded,
        message: permissionDowngraded
          ? 'Tu token no tiene permiso de publicación directa, por lo que se guardó como Borrador en Planning para aprobación del administrador.'
          : created.status === 'scheduled'
          ? `Programado en Arias CRM Planning para ${created.scheduled_at} en ${resolvedTargets.map((t) => t.account_name || t.platform).join(', ')}.`
          : 'Guardado como Borrador en Arias CRM Planning.',
      });
    }

    // ── REST: DELETE /posts/:id (soft-delete into Eliminados) ───────────────
    if (req.method === 'DELETE' && subpath.startsWith('/posts/')) {
      const postId = subpath.slice('/posts/'.length).trim();
      if (!postId) return json({ ok: false, error: 'post_id requerido' }, 400);

      const { data: updated, error: delErr } = await supabase
        .from('social_posts')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: auth.userId,
          deleted_by_email: auth.email,
        })
        .eq('id', postId)
        .eq('company_id', auth.companyId)
        .select('id')
        .maybeSingle();

      if (delErr) return json({ ok: false, error: delErr.message }, 500);
      if (!updated) return json({ ok: false, error: 'Publicación no encontrada en esta empresa' }, 404);
      return json({ ok: true, id: updated.id, message: 'Movido a Eliminados en Planning.' });
    }

    // ── CRM UI Management Actions (requires CRM JWT, not external GPT token) ─
    if (req.method === 'POST' && subpath === '/') {
      if (auth.kind !== 'crm_jwt') {
        return json({ ok: false, error: 'Esta acción solo está permitida dentro de Arias CRM' }, 403);
      }

      const action = String(body.action || '').trim();

      if (action === 'get_chatgpt_setup') {
        const baseFnUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/arias-social-bridge`;
        return json({
          ok: true,
          authorization_url: 'https://ariascrm.com/oauth/chatgpt-authorize',
          token_url: `${baseFnUrl}/oauth/token`,
          openapi_schema: buildChatGptOpenApiSchema(baseFnUrl),
          instructions: buildChatGptSystemInstructions(auth.companyName),
        });
      }

      if (action === 'list_tokens') {
        const { data: rows, error } = await supabase
          .from('social_bridge_tokens')
          .select('id, label, token_prefix, can_publish_directly, is_active, last_used_at, created_at, user_id')
          .eq('company_id', auth.companyId)
          .order('created_at', { ascending: false });

        if (error) return json({ ok: false, error: error.message }, 500);

        const userIds = [...new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))];
        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          for (const p of profs || []) {
            profileMap[p.id] = { full_name: p.full_name, email: p.email };
          }
        }

        return json({
          ok: true,
          tokens: (rows || []).map((r: any) => ({
            ...r,
            user_name: profileMap[r.user_id]?.full_name || null,
            user_email: profileMap[r.user_id]?.email || null,
          })),
        });
      }

      if (action === 'create_token') {
        const rawToken = generateSecureToken('arias_gpt_');
        const tokenHash = await sha256Hex(rawToken);
        const label = String(body.label || `ChatGPT · ${auth.fullName}`).trim().slice(0, 80);
        const canPublishDirectly = body.can_publish_directly !== false;

        const { data: created, error } = await supabase
          .from('social_bridge_tokens')
          .insert({
            company_id: auth.companyId,
            user_id: auth.userId,
            label,
            token_prefix: rawToken.slice(0, 14),
            token_hash: tokenHash,
            can_publish_directly: canPublishDirectly,
            is_active: true,
          })
          .select('id, label, token_prefix, can_publish_directly, is_active, last_used_at, created_at, user_id')
          .single();

        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, token: rawToken, record: created });
      }

      if (action === 'revoke_token') {
        const tokenId = String(body.token_id || '').trim();
        if (!tokenId) return json({ ok: false, error: 'token_id requerido' }, 400);
        const { error } = await supabase
          .from('social_bridge_tokens')
          .update({ is_active: false })
          .eq('id', tokenId)
          .eq('company_id', auth.companyId);
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true });
      }

      if (action === 'toggle_token_publish') {
        const tokenId = String(body.token_id || '').trim();
        if (!tokenId) return json({ ok: false, error: 'token_id requerido' }, 400);
        const { error } = await supabase
          .from('social_bridge_tokens')
          .update({ can_publish_directly: Boolean(body.can_publish_directly) })
          .eq('id', tokenId)
          .eq('company_id', auth.companyId);
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true });
      }

      if (action === 'issue_oauth_code') {
        const clientId = String(body.client_id || 'chatgpt').trim();
        const redirectUri = String(body.redirect_uri || '').trim();
        if (!redirectUri || !/^https:\/\/chat\.openai\.com|^https:\/\/chatgpt\.com/i.test(redirectUri)) {
          // Allow standard OpenAI redirect URIs cleanly; also permit custom redirect only if https
          if (!/^https:\/\//i.test(redirectUri)) {
            return json({ ok: false, error: 'redirect_uri inválido (debe ser HTTPS)' }, 400);
          }
        }
        const rawCode = generateSecureToken('acode_');
        const codeHash = await sha256Hex(rawCode);
        const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

        const { error } = await supabase.from('social_bridge_oauth_codes').insert({
          code_hash: codeHash,
          company_id: auth.companyId,
          user_id: auth.userId,
          client_id: clientId,
          redirect_uri: redirectUri,
          can_publish_directly: body.can_publish_directly !== false,
          expires_at: expiresAt,
        });
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, code: rawCode });
      }

      if (action === 'publish_post_now') {
        const postId = String(body.post_id || '').trim();
        if (!postId) return json({ ok: false, error: 'post_id requerido' }, 400);

        const { data: post } = await supabase
          .from('social_posts')
          .select('*')
          .eq('id', postId)
          .eq('company_id', auth.companyId)
          .is('deleted_at', null)
          .maybeSingle();

        if (!post) return json({ ok: false, error: 'Publicación no encontrada en esta empresa' }, 404);

        await supabase
          .from('social_posts')
          .update({ status: 'publishing', updated_at: new Date().toISOString() })
          .eq('id', post.id);

        const pubRes = await dispatchMetaPublish(supabaseUrl, serviceKey, supabase, post);
        return json({
          ok: pubRes.success,
          status: pubRes.success ? 'published' : 'failed',
          error: pubRes.partialError,
          results: pubRes.results,
        });
      }

      return json({ ok: false, error: `Acción desconocida: ${action}` }, 400);
    }

    return json({ ok: false, error: `Ruta no soportada: ${req.method} ${subpath}` }, 404);
  } catch (err: any) {
    console.error('[arias-social-bridge] Error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'Error interno en arias-social-bridge' }, 500);
  }
});
