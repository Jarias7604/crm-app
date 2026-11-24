import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  buildChatGptOpenApiSchema,
  buildChatGptSystemInstructions,
  buildOAuthAuthorizationServerMetadata,
  buildOAuthProtectedResourceMetadata,
  extractImageCandidate,
  generateSecureToken,
  MCP_TOOL_DEFINITIONS,
  normalizeTargetAccounts,
  sha256Hex,
  validateScheduledIso,
  verifyPkceS256,
  type ActiveSocialAccountLike,
  type TargetAccountRef,
} from './helpers.ts';

const PUBLIC_ORIGIN = 'https://www.ariascrm.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-company-id, mcp-session-id, mcp-protocol-version, accept',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};

const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
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
    try {
      bytes = decodeBase64(candidate.base64);
    } catch {
      throw new Error(
        'El contenido Base64 de la imagen está incompleto o malformado. Envía el archivo mediante `image_file` en lugar de transcribir Base64.',
      );
    }
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
  const filePath = `social/${companyId}/planning-${Date.now()}-${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('marketing_assets')
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
  } = supabase.storage.from('marketing_assets').getPublicUrl(filePath);

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

async function execListAccounts(supabase: any, auth: BridgeAuth) {
  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, platform, account_name, display_name, account_id, is_default, follower_count')
    .eq('company_id', auth.companyId)
    .eq('is_active', true)
    .order('platform', { ascending: true })
    .order('is_default', { ascending: false });

  if (error) return { ok: false, status: 500, error: error.message };
  return {
    ok: true,
    status: 200,
    company_id: auth.companyId,
    company_name: auth.companyName,
    connected_by: auth.fullName,
    accounts: (accounts || []).map((a: any) => ({
      platform: a.platform,
      account_id: a.account_id,
      page_name: a.display_name || a.account_name,
      is_default: Boolean(a.is_default),
    })),
  };
}

async function execGetMemory(supabase: any, auth: BridgeAuth) {
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select(
      'id, editorial_line, episode_label, topic, captions, platforms, status, scheduled_at, published_at, source, created_at',
    )
    .eq('company_id', auth.companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return { ok: false, status: 500, error: error.message };
  return {
    ok: true,
    status: 200,
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
  };
}

async function execCreateOrPublishPost(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  auth: BridgeAuth,
  body: Record<string, any>,
) {
  const caption = String(body.caption || '').trim();
  if (!caption) {
    return { ok: false, status: 400, error: 'El texto (caption) es obligatorio.' };
  }

  let mode = String(body.mode || 'schedule').toLowerCase().trim();
  if (!['publish_now', 'schedule', 'draft'].includes(mode)) {
    return { ok: false, status: 400, error: 'mode debe ser publish_now, schedule o draft.' };
  }

  let permissionDowngraded = false;
  if (mode === 'publish_now' && !auth.canPublishDirectly) {
    mode = 'draft';
    permissionDowngraded = true;
  }

  const schedCheck = validateScheduledIso(body.scheduled_at);
  if (!schedCheck.valid) {
    return { ok: false, status: 400, error: schedCheck.error };
  }
  if (mode === 'schedule' && !schedCheck.iso) {
    return {
      ok: false,
      status: 400,
      error: 'Falta scheduled_at (fecha y hora) para ponerlo en Planning.',
    };
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
    return {
      ok: false,
      status: 400,
      error: 'No encontré páginas activas de Facebook o Instagram conectadas en Cuentas Conectadas de esta empresa.',
    };
  }

  let media: { publicUrl: string | null; isVideo: boolean };
  try {
    media = await persistIncomingMediaToStorage(supabase, auth.companyId, body);
  } catch (mediaErr: any) {
    return {
      ok: false,
      status: 400,
      error: mediaErr?.message || 'Error procesando la imagen del flyer.',
    };
  }
  if (!media.publicUrl) {
    return {
      ok: false,
      status: 400,
      error:
        'No recibí el archivo de imagen/flyer. Pasa el archivo en `image_file` (file_id + download_url), `openaiFileIdRefs` o `image_url`.',
    };
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
    return { ok: false, status: 500, error: insErr?.message || 'Error creando publicación' };
  }

  if (mode === 'publish_now') {
    const pubRes = await dispatchMetaPublish(supabaseUrl, serviceKey, supabase, created);
    return {
      ok: pubRes.success,
      status: 200,
      post_id: created.id,
      post_status: pubRes.success ? 'published' : 'failed',
      content_url: media.publicUrl,
      targets: resolvedTargets,
      error: pubRes.partialError,
      message: pubRes.success
        ? `Publicado correctamente en ${resolvedTargets.map((t) => t.account_name || t.platform).join(', ')}.`
        : `Falló la publicación: ${pubRes.partialError}`,
    };
  }

  return {
    ok: true,
    status: 200,
    post_id: created.id,
    post_status: created.status,
    scheduled_at: created.scheduled_at,
    content_url: media.publicUrl,
    targets: resolvedTargets,
    permission_downgraded: permissionDowngraded,
    message: permissionDowngraded
      ? 'Tu token no tiene permiso de publicación directa, por lo que se guardó como Borrador en Planning para aprobación del administrador.'
      : created.status === 'scheduled'
      ? `Programado en Arias CRM Planning para ${created.scheduled_at} en ${resolvedTargets.map((t) => t.account_name || t.platform).join(', ')}.`
      : 'Guardado como Borrador en Arias CRM Planning.',
  };
}

async function execDeletePost(supabase: any, auth: BridgeAuth, postId: string) {
  const cleanId = String(postId || '').trim();
  if (!cleanId) return { ok: false, status: 400, error: 'post_id requerido' };

  const { data: updated, error: delErr } = await supabase
    .from('social_posts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth.userId,
      deleted_by_email: auth.email,
    })
    .eq('id', cleanId)
    .eq('company_id', auth.companyId)
    .select('id')
    .maybeSingle();

  if (delErr) return { ok: false, status: 500, error: delErr.message };
  if (!updated) return { ok: false, status: 404, error: 'Publicación no encontrada en esta empresa' };
  return { ok: true, status: 200, id: updated.id, message: 'Movido a Eliminados en Planning.' };
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
    // ── Public OAuth 2.1 Discovery Metadata (RFC 9728 & RFC 8414) ───────────
    if (
      req.method === 'GET' &&
      (subpath === '/.well-known/oauth-protected-resource' ||
        subpath === '/.well-known/oauth-protected-resource/mcp')
    ) {
      return json(buildOAuthProtectedResourceMetadata(PUBLIC_ORIGIN));
    }

    if (
      req.method === 'GET' &&
      (subpath === '/.well-known/oauth-authorization-server' ||
        subpath === '/.well-known/openid-configuration')
    ) {
      return json(buildOAuthAuthorizationServerMetadata(PUBLIC_ORIGIN));
    }

    // ── Public OAuth 2.0 Dynamic Client Registration (RFC 7591) for MCP ─────
    if (req.method === 'POST' && subpath === '/oauth/register') {
      const regBody = await parseBodyFlexible(req);
      const rawRedirects = Array.isArray(regBody.redirect_uris) ? regBody.redirect_uris : [];
      for (const u of rawRedirects) {
        if (typeof u !== 'string' || !/^https:\/\//i.test(u)) {
          return json(
            { error: 'invalid_redirect_uri', error_description: 'redirect_uris deben usar HTTPS' },
            400,
          );
        }
      }
      const clientId = generateSecureToken('arias_mcp_');
      return json(
        {
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          client_name: String(regBody.client_name || 'ChatGPT MCP Client'),
          redirect_uris: rawRedirects,
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: String(regBody.token_endpoint_auth_method || 'none'),
        },
        201,
      );
    }

    // ── Public OAuth 2.0/2.1 Token Exchange (/oauth/token) ──────────────────
    if (req.method === 'POST' && subpath === '/oauth/token') {
      const body = await parseBodyFlexible(req);
      const grantType = String(body.grant_type || 'authorization_code').trim();
      const rawCode = String(body.code || '').trim();
      const codeVerifier = String(body.code_verifier || '').trim();
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

      // Verify PKCE S256 challenge if bound to the authorization request
      if (codeRow.code_challenge) {
        const pkceOk = await verifyPkceS256(codeVerifier, codeRow.code_challenge);
        if (!pkceOk) {
          return json(
            { error: 'invalid_grant', error_description: 'PKCE code_verifier inválido o faltante' },
            400,
          );
        }
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
        label: 'ChatGPT MCP OAuth (1 clic)',
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
        scope: 'social:read social:write',
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

    // ── MCP Streamable HTTP Endpoint (/mcp) ─────────────────────────────────
    if (subpath === '/mcp') {
      if (req.method === 'DELETE') {
        return json({ ok: true }, 200);
      }

      const mcpAuthRes = await resolveBridgeAuth(req, supabase, body?.company_id || null);
      if (!mcpAuthRes.auth) {
        const challengeHeader =
          `Bearer resource_metadata="${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource", scope="social:read social:write"`;
        return json(
          {
            error: 'unauthorized',
            error_description: mcpAuthRes.error || 'Se requiere autorización OAuth en Arias CRM',
          },
          401,
          { 'WWW-Authenticate': challengeHeader },
        );
      }
      const mcpAuth = mcpAuthRes.auth;

      if (req.method === 'GET') {
        return json(
          { error: 'method_not_allowed', error_description: 'Usa POST JSON-RPC 2.0 sobre Streamable HTTP.' },
          405,
          { Allow: 'POST, DELETE, OPTIONS' },
        );
      }

      if (req.method !== 'POST') {
        return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, DELETE, OPTIONS' });
      }

      const rpcMethod = String(body?.method || '');
      const rpcId = body?.id;
      const rpcParams = body?.params || {};

      // JSON-RPC notifications (no id, e.g. notifications/initialized) receive HTTP 202 empty body
      if (rpcId === undefined || rpcId === null || rpcMethod.startsWith('notifications/')) {
        return new Response(null, { status: 202, headers: corsHeaders });
      }

      if (rpcMethod === 'initialize') {
        return json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            protocolVersion: String(rpcParams?.protocolVersion || '2025-03-26'),
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: 'Arias CRM Social Planning',
              version: '1.1.0',
            },
            instructions: buildChatGptSystemInstructions(mcpAuth.companyName),
          },
        });
      }

      if (rpcMethod === 'ping') {
        return json({ jsonrpc: '2.0', id: rpcId, result: {} });
      }

      if (rpcMethod === 'tools/list') {
        return json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            tools: MCP_TOOL_DEFINITIONS,
          },
        });
      }

      if (rpcMethod === 'tools/call') {
        const toolName = String(rpcParams?.name || '').trim();
        const toolArgs = (rpcParams?.arguments && typeof rpcParams.arguments === 'object')
          ? rpcParams.arguments
          : {};

        console.log('[arias-social-bridge][mcp tools/call]', toolName, 'argKeys=', Object.keys(toolArgs));

        try {
          let toolResult: Record<string, any>;
          if (toolName === 'list_connected_social_pages') {
            toolResult = await execListAccounts(supabase, mcpAuth);
          } else if (toolName === 'get_content_memory') {
            toolResult = await execGetMemory(supabase, mcpAuth);
          } else if (toolName === 'create_or_publish_social_post') {
            toolResult = await execCreateOrPublishPost(supabase, supabaseUrl, serviceKey, mcpAuth, toolArgs);
          } else if (toolName === 'delete_planned_post') {
            toolResult = await execDeletePost(supabase, mcpAuth, String(toolArgs.post_id || ''));
          } else {
            return json({
              jsonrpc: '2.0',
              id: rpcId,
              error: { code: -32601, message: `Herramienta MCP desconocida: ${toolName}` },
            });
          }

          return json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
              isError: !toolResult.ok,
            },
          });
        } catch (toolErr: any) {
          console.error('[arias-social-bridge][mcp tools/call error]', toolName, toolErr?.message || toolErr);
          return json({
            jsonrpc: '2.0',
            id: rpcId,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    { ok: false, error: toolErr?.message || 'Error ejecutando la herramienta MCP en Arias CRM' },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            },
          });
        }
      }

      return json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32601, message: `Método JSON-RPC no soportado: ${rpcMethod}` },
      });
    }

    // ── All remaining routes require authenticated user or scoped token ─────
    const authRes = await resolveBridgeAuth(req, supabase, body?.company_id || null);
    if (!authRes.auth) {
      return json({ ok: false, error: authRes.error || 'Unauthorized' }, authRes.status || 401);
    }
    const auth = authRes.auth;

    // ── REST: GET /accounts ─────────────────────────────────────────────────
    if (req.method === 'GET' && subpath === '/accounts') {
      const res = await execListAccounts(supabase, auth);
      return json(res, res.status || 200);
    }

    // ── REST: GET /memory ───────────────────────────────────────────────────
    if (req.method === 'GET' && subpath === '/memory') {
      const res = await execGetMemory(supabase, auth);
      return json(res, res.status || 200);
    }

    // ── REST: POST /posts ───────────────────────────────────────────────────
    if (req.method === 'POST' && subpath === '/posts') {
      const res = await execCreateOrPublishPost(supabase, supabaseUrl, serviceKey, auth, body);
      return json(
        {
          ...res,
          status: res.post_status || undefined,
        },
        res.status || 200,
      );
    }

    // ── REST: DELETE /posts/:id ─────────────────────────────────────────────
    if (req.method === 'DELETE' && subpath.startsWith('/posts/')) {
      const postId = subpath.slice('/posts/'.length).trim();
      const res = await execDeletePost(supabase, auth, postId);
      return json(res, res.status || 200);
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
          mcp_url: `${PUBLIC_ORIGIN}/mcp`,
          authorization_url: `${PUBLIC_ORIGIN}/oauth/chatgpt-authorize`,
          token_url: `${PUBLIC_ORIGIN}/oauth/token`,
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
          code_challenge: body.code_challenge ? String(body.code_challenge).trim() : null,
          code_challenge_method: body.code_challenge_method
            ? String(body.code_challenge_method).trim()
            : null,
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
