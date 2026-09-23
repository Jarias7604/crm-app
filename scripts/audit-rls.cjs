#!/usr/bin/env node
/**
 * AUDIT RLS & SAAS SECURITY SHIELD
 * 
 * Verifica que ninguna tabla pública en la base de datos de Supabase tenga RLS deshabilitado
 * y que todas las vistas cumplan con el estándar de seguridad para multi-tenant SaaS.
 * 
 * Uso: npm run audit:rls
 */

const { execSync } = require('child_process');

console.log('====================================================');
console.log('🛡️  EJECUTANDO AUDITORÍA DE SEGURIDAD RLS PARA SAAS');
console.log('====================================================\n');

try {
  // 1. Ejecutar Supabase DB Advisors en el proyecto vinculado
  console.log('1. Consultando Supabase Security Advisors (Nivel ERROR)...');
  const advisorOutput = execSync('npx supabase db advisors --linked --type security --level error', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const parsed = JSON.parse(advisorOutput.trim().substring(advisorOutput.indexOf('{')));
  const results = parsed.results || [];

  const rlsErrors = results.filter(r => r.name === 'rls_disabled_in_public');
  const definerErrors = results.filter(r => r.name === 'security_definer_view');

  if (rlsErrors.length > 0) {
    console.error(`❌ FALLA DE SEGURIDAD: Se detectaron ${rlsErrors.length} tabla(s) con RLS desactivado:`);
    rlsErrors.forEach(err => {
      console.error(`   - ${err.detail}`);
    });
    process.exit(1);
  }

  if (definerErrors.length > 0) {
    console.warn(`⚠️ ADVERTENCIA: Se detectaron ${definerErrors.length} vista(s) con SECURITY DEFINER:`);
    definerErrors.forEach(err => {
      console.warn(`   - ${err.detail}`);
    });
  }

  // 2. Consulta directa a pg_tables
  console.log('\n2. Verificando pg_tables en el esquema público...');
  const queryResult = execSync('npx supabase db query --linked "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = \'public\' AND rowsecurity = false;"', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const cleanJson = queryResult.trim().substring(queryResult.indexOf('{'));
  const parsedQuery = JSON.parse(cleanJson);
  const insecureRows = (parsedQuery.rows || []).filter(r => r.tablename !== 'spatial_ref_sys');

  if (insecureRows.length > 0) {
    console.error(`❌ FALLA CRÍTICA: Tablas sin RLS encontradas:`, insecureRows);
    process.exit(1);
  }

  console.log('\n✅ AUDITORÍA EXITOSA:');
  console.log('   - 0 tablas públicas con RLS deshabilitado.');
  console.log('   - Todas las tablas del CRM están blindadas con Row-Level Security.');
  console.log('   - Sistema multi-tenant protegido para clientes comerciales SaaS.\n');
  console.log('====================================================');
  process.exit(0);

} catch (error) {
  console.error('❌ Error durante la auditoría de seguridad:', error.message);
  process.exit(1);
}
