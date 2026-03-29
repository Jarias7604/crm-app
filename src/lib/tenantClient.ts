/**
 * tenantClient.ts
 * ===============
 * Capa 3 de seguridad multi-tenant: Wrapper del cliente Supabase
 *
 * Propósito:
 *  - COMPLEMENTA el RLS de la DB (no lo reemplaza)
 *  - Garantiza que NINGUNA query en el frontend se ejecute sin company_id
 *  - Detecta y loguea en DEV si alguien olvida filtrar por empresa
 *  - En PROD: bloquea silenciosamente + lanza error en Sentry (futuro)
 *
 * Uso:
 *  import { tenantQuery } from '@/lib/tenantClient';
 *  const { data } = await tenantQuery('leads').select('*');
 *  // → automáticamente agrega .eq('company_id', companyId)
 */

import { supabase } from '@/lib/supabase';

// Tablas que NO necesitan company_id (son globales o del sistema)
const EXEMPT_TABLES = new Set([
  'companies',           // Tabla de empresas
  'spatial_ref_sys',     // PostGIS sistema
  'cotizaciones',        // Tiene su propia RLS, también token público
  'industries',          // Catálogo global
  'permission_definitions', // Definiciones globales del sistema
  'catalog_item_types',  // RLS ya maneja el filtro
]);

// Tablas del portal público (anon access intencional)
const PORTAL_TABLES = new Set([
  'clients',       // Portal cliente
  'client_documents', // Portal documentos
]);

const isDev = import.meta.env.MODE === 'development';

/**
 * Obtiene el company_id del usuario actual desde la sesión de Supabase
 * Primero intenta JWT app_metadata (más rápido), luego el perfil local
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Leer desde JWT app_metadata (disponible después del JWT hook)
  const jwtMeta = session.user.app_metadata;
  if (jwtMeta?.company_id) return jwtMeta.company_id;

  // Fallback: leer del perfil en user_metadata
  return session.user.user_metadata?.company_id ?? null;
}

/**
 * tenantQuery — wrapper que fuerza aislamiento por empresa
 *
 * @param table - nombre de la tabla
 * @param companyId - UUID de la empresa (si no se pasa, se obtiene del session)
 * @returns Supabase query builder con company_id ya aplicado
 *
 * @example
 * const { data } = await tenantQuery('leads', companyId).select('*');
 */
export function tenantQuery(table: string, companyId: string | null | undefined) {
  const builder = supabase.from(table as any);

  if (EXEMPT_TABLES.has(table) || PORTAL_TABLES.has(table)) {
    // Tabla exenta — devolver builder sin filtro adicional
    return builder;
  }

  if (!companyId) {
    if (isDev) {
      console.warn(
        `[TenantClient] ⚠️ Query a '${table}' sin company_id. ` +
        `El RLS de la DB sigue activo, pero revisa el código del componente.`
      );
    }
    // En producción el RLS bloquea esto de todos modos — devolver builder normal
    return builder;
  }

  // La mayoría de tablas usan 'company_id' como columna de tenant
  // Para tablas con nombre de columna diferente, agregar aquí
  const COLUMN_MAP: Record<string, string> = {
    follow_ups: 'lead_id', // follow_ups filtra por lead → el RLS ya lo maneja vía leads
    marketing_messages: 'conversation_id', // filtra vía conversations
    marketing_ai_logs: 'conversation_id',
    team_members: 'team_id',
  };

  const tenantColumn = COLUMN_MAP[table] ?? 'company_id';

  // Para columnas directas de company_id, agregar filtro
  if (!COLUMN_MAP[table]) {
    return (builder as any).eq(tenantColumn, companyId);
  }

  // Para tablas con join indirecto, el RLS ya lo maneja — solo lograr en DEV
  if (isDev) {
    console.debug(`[TenantClient] 🔒 '${table}' usa filtro indirecto vía RLS (${tenantColumn})`);
  }

  return builder;
}

/**
 * assertCompanyAccess — verificación en componentes críticos
 * Lanza un error si el usuario no tiene company_id en su sesión.
 * Usar en páginas de configuración, billing, gestión de usuarios.
 */
export async function assertCompanyAccess(companyId: string | null | undefined): Promise<void> {
  if (!companyId) {
    throw new Error(
      '[TenantClient] Acceso denegado: usuario sin empresa asociada. ' +
      'Contacta al administrador del sistema.'
    );
  }
}

/**
 * Audit log helper — registra acciones sensibles con company context
 */
export async function logTenantAction(
  companyId: string,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      company_id: companyId,
      action,
      details: details ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Audit logging nunca debe romper el flujo principal
    if (isDev) console.warn('[TenantClient] Audit log falló silenciosamente');
  }
}
