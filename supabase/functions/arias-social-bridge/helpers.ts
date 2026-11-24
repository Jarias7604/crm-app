export interface ActiveSocialAccountLike {
  id?: string;
  platform: string;
  account_id: string | null;
  account_name: string | null;
  display_name?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export interface TargetAccountRef {
  platform: string;
  account_id: string;
  account_name?: string | null;
}

export interface ImageCandidate {
  url: string | null;
  base64: string | null;
  fileName: string;
  mimeType: string;
}

export function normalizeBridgeText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSecureToken(prefix = 'arias_gpt_'): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}${hex}`;
}

export function extractImageCandidate(body: any): ImageCandidate {
  const fallback: ImageCandidate = {
    url: null,
    base64: null,
    fileName: `flyer-${Date.now()}.png`,
    mimeType: 'image/png',
  };
  if (!body || typeof body !== 'object') return fallback;

  // 1. OpenAI Custom GPT Actions file reference array (ChatGPT generated or uploaded images)
  const fileRefs = Array.isArray(body.openaiFileIdRefs) ? body.openaiFileIdRefs : [];
  for (const ref of fileRefs) {
    if (!ref) continue;
    if (typeof ref === 'string' && /^https?:\/\//i.test(ref)) {
      return {
        url: ref.trim(),
        base64: null,
        fileName: `chatgpt-flyer-${Date.now()}.png`,
        mimeType: 'image/png',
      };
    }
    if (typeof ref === 'object') {
      const link = String(ref.download_link || ref.url || '').trim();
      const mime = String(ref.mime_type || 'image/png').trim() || 'image/png';
      const ext = mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpg'
        : mime.includes('webp')
        ? 'webp'
        : mime.includes('mp4')
        ? 'mp4'
        : 'png';
      const name = String(ref.name || `chatgpt-flyer-${Date.now()}.${ext}`).trim();
      if (/^https?:\/\//i.test(link)) {
        return {
          url: link,
          base64: null,
          fileName: name,
          mimeType: mime,
        };
      }
    }
  }

  // 2. Direct URL fields
  const rawUrl = String(body.image_url || body.media_url || body.content_url || '').trim();
  if (/^https?:\/\//i.test(rawUrl)) {
    return {
      url: rawUrl,
      base64: null,
      fileName: `flyer-${Date.now()}.png`,
      mimeType: /\.mp4(\?|$)/i.test(rawUrl)
        ? 'video/mp4'
        : /\.jpe?g(\?|$)/i.test(rawUrl)
        ? 'image/jpeg'
        : 'image/png',
    };
  }

  // 3. Base64 payload fallback
  const rawB64 = String(body.image_base64 || '').trim();
  if (rawB64) {
    const dataUriMatch = rawB64.match(/^data:([^;]+);base64,(.+)$/s);
    if (dataUriMatch) {
      const mime = dataUriMatch[1].trim();
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
      return {
        url: null,
        base64: dataUriMatch[2].replace(/\s+/g, ''),
        fileName: `flyer-${Date.now()}.${ext}`,
        mimeType: mime,
      };
    }
    return {
      url: null,
      base64: rawB64.replace(/\s+/g, ''),
      fileName: `flyer-${Date.now()}.png`,
      mimeType: 'image/png',
    };
  }

  return fallback;
}

export function normalizeTargetAccounts(
  input: {
    target_account_ids?: Array<string | TargetAccountRef>;
    page_names?: string[];
    platforms?: string[];
  },
  activeAccounts: ActiveSocialAccountLike[],
): TargetAccountRef[] {
  const valid = (activeAccounts || []).filter(
    (a) => a && a.is_active !== false && Boolean(a.account_id),
  );
  if (valid.length === 0) return [];

  const resolved: TargetAccountRef[] = [];
  const seen = new Set<string>();
  const pushAccount = (acc: ActiveSocialAccountLike) => {
    const plat = String(acc.platform || '').toLowerCase().trim();
    const id = String(acc.account_id || '').trim();
    if (!plat || !id) return;
    const key = `${plat}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    resolved.push({
      platform: plat,
      account_id: id,
      account_name: acc.account_name || acc.display_name || null,
    });
  };

  // 1. Explicit target_account_ids (either account_id strings or { platform, account_id } objects)
  if (Array.isArray(input.target_account_ids) && input.target_account_ids.length > 0) {
    for (const item of input.target_account_ids) {
      if (typeof item === 'string') {
        const clean = item.trim();
        const match = valid.find((a) => String(a.account_id) === clean || String(a.id) === clean);
        if (match) pushAccount(match);
      } else if (item && typeof item === 'object') {
        const cleanId = String(item.account_id || '').trim();
        const cleanPlat = String(item.platform || '').toLowerCase().trim();
        const match = valid.find(
          (a) =>
            String(a.account_id) === cleanId &&
            (!cleanPlat || String(a.platform).toLowerCase() === cleanPlat),
        );
        if (match) pushAccount(match);
      }
    }
  }

  // 2. Human page_names matching (e.g., ["Jimmy Arias AI + Lean", "Arias Group"])
  if (Array.isArray(input.page_names) && input.page_names.length > 0) {
    for (const rawName of input.page_names) {
      const needle = normalizeBridgeText(rawName);
      if (!needle) continue;
      const requestedPlat =
        needle.includes('instagram') || needle.startsWith('@') ? 'instagram' : null;
      const cleanNeedle = needle.replace(/^@/, '').trim();
      const match =
        valid.find((a) => {
          if (requestedPlat && String(a.platform).toLowerCase() !== requestedPlat) return false;
          const n1 = normalizeBridgeText(a.account_name);
          const n2 = normalizeBridgeText(a.display_name);
          return n1 === cleanNeedle || n2 === cleanNeedle;
        }) ||
        valid.find((a) => {
          if (requestedPlat && String(a.platform).toLowerCase() !== requestedPlat) return false;
          const n1 = normalizeBridgeText(a.account_name);
          const n2 = normalizeBridgeText(a.display_name);
          return n1.includes(cleanNeedle) || n2.includes(cleanNeedle) || cleanNeedle.includes(n1);
        });
      if (match) pushAccount(match);
    }
  }

  // 3. Fallback to requested platforms defaults, or Facebook default / first active
  if (resolved.length === 0) {
    const plats =
      Array.isArray(input.platforms) && input.platforms.length > 0
        ? input.platforms.map((p) => String(p).toLowerCase().trim()).filter(Boolean)
        : ['facebook'];
    for (const plat of plats) {
      const candidates = valid.filter((a) => String(a.platform).toLowerCase() === plat);
      const chosen = candidates.find((a) => a.is_default) || candidates[0];
      if (chosen) pushAccount(chosen);
    }
  }

  return resolved;
}

export function validateScheduledIso(
  raw?: string | null,
  defaultOffset = '-06:00',
): { valid: boolean; iso: string | null; error?: string } {
  const s = String(raw || '').trim();
  if (!s) return { valid: true, iso: null };

  // Normalize "YYYY-MM-DD HH:MM" or ISO without timezone offset using company default (El Salvador -06:00)
  let candidate = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(candidate)) {
    candidate = `${candidate}:00${defaultOffset}`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(candidate)) {
    candidate = `${candidate}${defaultOffset}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    candidate = `${candidate}T09:00:00${defaultOffset}`;
  }

  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) {
    return {
      valid: false,
      iso: null,
      error: 'Fecha programada inválida. Usa formato ISO como 2026-11-24T10:00:00-06:00.',
    };
  }
  return { valid: true, iso: d.toISOString() };
}

export function buildChatGptOpenApiSchema(baseUrl: string): Record<string, any> {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '');
  return {
    openapi: '3.1.0',
    info: {
      title: 'Arias CRM Social Planning Bridge',
      version: '1.0.0',
      description:
        'Conecta ChatGPT Plus directamente con Arias CRM Planning: consulta páginas conectadas, memoria permanente de episodios y publica o programa flyers en Facebook e Instagram.',
    },
    servers: [{ url: cleanBase }],
    paths: {
      '/accounts': {
        get: {
          operationId: 'listConnectedSocialPages',
          summary: 'Lista las páginas de Facebook e Instagram conectadas a tu empresa en Arias CRM',
          responses: {
            '200': {
              description: 'Páginas activas de la empresa autenticada',
            },
          },
        },
      },
      '/memory': {
        get: {
          operationId: 'getContentMemory',
          summary:
            'Consulta los últimos 30 episodios, principios y publicaciones guardadas en la memoria permanente del CRM para evitar repetir temas',
          responses: {
            '200': {
              description: 'Historial editorial reciente en PostgreSQL',
            },
          },
        },
      },
      '/posts': {
        post: {
          operationId: 'createOrPublishSocialPost',
          summary:
            'Envía el flyer generado y su descripción al CRM para publicarlo ahora, programarlo en Planning o guardarlo en borrador',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['caption', 'mode'],
                  properties: {
                    mode: {
                      type: 'string',
                      enum: ['publish_now', 'schedule', 'draft'],
                      description:
                        'Usa publish_now para publicar de inmediato, schedule para Planning en fecha/hora, o draft para borrador',
                    },
                    caption: {
                      type: 'string',
                      description: 'Texto completo de la publicación para Facebook/Instagram',
                    },
                    editorial_line: {
                      type: 'string',
                      description: 'Ejemplo: AI + LEAN™ o Motivación Empresarial',
                    },
                    episode_label: {
                      type: 'string',
                      description: 'Ejemplo: EPISODIO 15 o PRINCIPIO 11',
                    },
                    topic: {
                      type: 'string',
                      description: 'Título o tema principal del flyer',
                    },
                    scheduled_at: {
                      type: 'string',
                      description:
                        'Fecha y hora ISO con zona horaria (obligatorio si mode=schedule), ej. 2026-11-24T10:00:00-06:00',
                    },
                    page_names: {
                      type: 'array',
                      items: { type: 'string' },
                      description:
                        'Nombres exactos de páginas destino (ej. ["Jimmy Arias AI + Lean", "Arias Group"])',
                    },
                    platforms: {
                      type: 'array',
                      items: { type: 'string', enum: ['facebook', 'instagram'] },
                      description: 'Redes destino si no indicaste page_names',
                    },
                    openaiFileIdRefs: {
                      type: 'array',
                      description:
                        'Incluye aquí la referencia del flyer PNG/JPG recién generado o subido en esta conversación.',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          id: { type: 'string' },
                          mime_type: { type: 'string' },
                          download_link: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Post registrado en Arias CRM Planning y/o publicado en Meta',
            },
          },
        },
      },
      '/posts/{id}': {
        delete: {
          operationId: 'deletePlannedPost',
          summary: 'Mueve una publicación programada o borrador a Eliminados dentro de Planning',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': { description: 'Post movido a Eliminados' },
          },
        },
      },
    },
  };
}

export function buildChatGptSystemInstructions(companyName = 'Arias Defense'): string {
  return [
    `Eres el Director Creativo y Estratega Editorial de ${companyName} conectado directamente a Arias CRM Planning.`,
    '',
    'FLUJO OBLIGATORIO EN CADA PUBLICACIÓN:',
    '1. Antes de proponer un tema o número de episodio, llama siempre a `getContentMemory` para revisar los últimos episodios y no repetir temas ni principios.',
    '2. Si necesitas saber qué páginas de Facebook/Instagram están disponibles, llama a `listConnectedSocialPages`.',
    '3. Diseña el flyer manteniendo fidelidad facial de las fotos maestras cargadas, tipografía legible en español y la línea editorial elegida (AI + LEAN™ o Motivación Empresarial).',
    '4. Redacta la descripción (caption) lista para Facebook/Instagram y pregunta SIEMPRE antes de enviar:',
    '   "¿Deseas que lo publique de una vez o lo pongo en Planning (dime día, hora y en qué página o páginas)?"',
    '5. Cuando el usuario confirme, llama a `createOrPublishSocialPost` enviando el flyer generado en `openaiFileIdRefs`, el `caption`, `editorial_line`, `episode_label`, `topic`, `page_names` y `mode` (`publish_now` o `schedule` con `scheduled_at` ISO en hora local -06:00).',
  ].join('\n');
}

export async function verifyPkceS256(codeVerifier: string, expectedChallenge: string): Promise<boolean> {
  if (!codeVerifier || !expectedChallenge) return false;
  const data = new TextEncoder().encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  const actualChallenge = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return actualChallenge === expectedChallenge;
}

export const MCP_TOOL_DEFINITIONS = [
  {
    name: 'list_connected_social_pages',
    description:
      'Lista las páginas de Facebook e Instagram conectadas y autorizadas para tu empresa en Arias CRM.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_content_memory',
    description:
      'Consulta los últimos 30 episodios, principios y publicaciones guardadas en la memoria permanente del CRM para evitar repetir temas o numeración.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'create_or_publish_social_post',
    description:
      'Envía el flyer generado y su descripción a Arias CRM para publicarlo de inmediato (publish_now), programarlo en Planning (schedule con scheduled_at) o guardarlo en borrador (draft). Pregunta SIEMPRE antes al usuario si desea publicarlo de una vez o ponerlo en Planning.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['caption', 'mode'],
      properties: {
        mode: {
          type: 'string',
          enum: ['publish_now', 'schedule', 'draft'],
          description: 'publish_now = publicar ya, schedule = Planning con fecha/hora, draft = borrador',
        },
        caption: {
          type: 'string',
          description: 'Texto completo de la publicación para Facebook / Instagram',
        },
        editorial_line: {
          type: 'string',
          description: 'Ejemplo: AI + LEAN™ o Motivación Empresarial',
        },
        episode_label: {
          type: 'string',
          description: 'Ejemplo: EPISODIO 15 o PRINCIPIO 11',
        },
        topic: {
          type: 'string',
          description: 'Título o tema principal del flyer',
        },
        scheduled_at: {
          type: 'string',
          description: 'Fecha/hora ISO en El Salvador -06:00 (obligatorio si mode=schedule), ej. 2026-11-24T10:00:00-06:00',
        },
        page_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Nombres de páginas destino (ej. ["Arias Group", "Jimmy Arias AI + Lean"])',
        },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['facebook', 'instagram'] },
          description: 'Plataformas destino si no se especifican page_names',
        },
        image_url: {
          type: 'string',
          description: 'URL HTTPS de la imagen o flyer si aplica',
        },
        image_base64: {
          type: 'string',
          description: 'Contenido Base64 o Data URL PNG/JPG de la imagen si no se envía download_link',
        },
        openaiFileIdRefs: {
          type: 'array',
          description: 'Referencia del flyer recién generado en ChatGPT',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              id: { type: 'string' },
              mime_type: { type: 'string' },
              download_link: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'delete_planned_post',
    description: 'Mueve una publicación programada o borrador a Eliminados dentro de Planning (recuperable).',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['post_id'],
      properties: {
        post_id: {
          type: 'string',
          description: 'UUID de la publicación en Arias CRM Planning',
        },
      },
    },
  },
];

export function buildOAuthProtectedResourceMetadata(origin = 'https://www.ariascrm.com') {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return {
    resource: `${cleanOrigin}/mcp`,
    authorization_servers: [cleanOrigin],
    scopes_supported: ['social:read', 'social:write'],
    bearer_methods_supported: ['header'],
  };
}

export function buildOAuthAuthorizationServerMetadata(origin = 'https://www.ariascrm.com') {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return {
    issuer: cleanOrigin,
    authorization_endpoint: `${cleanOrigin}/oauth/chatgpt-authorize`,
    token_endpoint: `${cleanOrigin}/oauth/token`,
    registration_endpoint: `${cleanOrigin}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['social:read', 'social:write'],
  };
}
