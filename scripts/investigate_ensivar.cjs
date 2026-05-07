const { createClient } = require('@supabase/supabase-js');

// PRODUCTION - service role bypasses ALL RLS
const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ENSIVAR_CID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
const ENSIVAR_USERS = [
  'ffc70ef8-d352-499f-86bb-f74ad16ec432',  // jimmy@ensivar.com
  '4f16d44f-a580-4306-9ea7-9ec8992c7726',  // pmartinez@ensivar.com  
  '2f9132d1-a249-4db7-b219-e3b47014eb57',  // melvin@ensivar.com
];

async function fullInvestigation() {
  console.log('=== INVESTIGACION COMPLETA DE DATOS ENSIVAR ===\n');

  // 1. Check what the get_auth_company_id function returns for Ensivar user - 
  // simulate by signing in as Ensivar user with service role
  console.log('1. Verificando función get_auth_company_id para usuarios Ensivar...');
  const { data: funcCheck, error: funcErr } = await supabase.rpc('get_auth_company_id');
  console.log('  get_auth_company_id (service role):', funcCheck, funcErr?.message || '');

  // 2. Check if leads table even has Ensivar company_id ANYWHERE - absolute raw
  console.log('\n2. Busqueda RAW en tabla leads (sin filtros)...');
  const { data: rawLeads, error: rawErr } = await supabase
    .from('leads')
    .select('company_id')
    .eq('company_id', ENSIVAR_CID);
  console.log('  Leads con company_id Ensivar:', rawLeads?.length ?? 0, rawErr?.message || '');

  // 3. Check all RLS policies on leads table
  console.log('\n3. Checking RLS policies on leads table via pg_policies...');
  const { data: policies, error: polErr } = await supabase
    .rpc('get_leads_policies');
  if (polErr) {
    // Try direct SQL
    const { data: polData, error: polErr2 } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, qual, with_check')
      .eq('tablename', 'leads');
    if (polErr2) console.log('  Cannot query pg_policies:', polErr2.message);
    else console.log('  Policies:', polData);
  } else {
    console.log('  Policies:', policies);
  }

  // 4. Check the profiles table for Ensivar users to confirm their company_id
  console.log('\n4. Perfiles de usuarios Ensivar en profiles...');
  const { data: ensivarProfiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, email, company_id, role')
    .in('id', ENSIVAR_USERS);
  
  if (profErr) console.error('  Error:', profErr.message);
  else {
    ensivarProfiles?.forEach(p => {
      console.log(`  ${p.email} → company_id: ${p.company_id} | role: ${p.role}`);
    });
  }

  // 5. Try signing in as Ensivar user and then fetching leads
  console.log('\n5. Intentando login como jimmy@ensivar.com para ver que retorna leads query...');
  const ensivarClient = createClient(supabaseUrl, 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.8bkOFJr9IjJhqPBn2aSmT4G3h6Y-Ggd8E9p6xHBePOc');
  
  const { data: loginData, error: loginErr } = await ensivarClient.auth.signInWithPassword({
    email: 'jimmy@ensivar.com',
    password: 'AriasCRM2026!'
  });
  
  if (loginErr) {
    console.log('  Login error:', loginErr.message);
  } else {
    console.log('  Login OK - user company_id from JWT:', loginData.user?.user_metadata?.company_id);
    console.log('  app_metadata:', JSON.stringify(loginData.user?.app_metadata));
    
    // Now fetch leads as this user
    const { data: ensivarLeads, count, error: leadsErr } = await ensivarClient
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  Leads visible para jimmy@ensivar.com: ${count ?? 0}`, leadsErr?.message || '');
    
    // Check what company_id the RLS function returns for this user
    const { data: cidVal, error: cidErr } = await ensivarClient.rpc('get_auth_company_id');
    console.log('  get_auth_company_id() para jimmy@ensivar.com:', cidVal, cidErr?.message || '');
    
    await ensivarClient.auth.signOut();
  }

  // 6. Check the import_leads.sql for any DELETE statements
  const fs = require('fs');
  const importSql = fs.readFileSync('./import_leads.sql', 'utf8');
  const hasDelete = importSql.toLowerCase().includes('delete');
  const hasTruncate = importSql.toLowerCase().includes('truncate');
  console.log('\n6. import_leads.sql analisis:');
  console.log('  Contiene DELETE:', hasDelete);
  console.log('  Contiene TRUNCATE:', hasTruncate);
  
  // Check supabase_production_fixes.sql for DELETE/TRUNCATE
  const prodFixesSql = fs.readFileSync('./supabase_production_fixes.sql', 'utf8');
  const fixHasDelete = prodFixesSql.toLowerCase().includes('delete from leads');
  const fixHasTruncate = prodFixesSql.toLowerCase().includes('truncate');
  console.log('\n7. supabase_production_fixes.sql analisis:');
  console.log('  Contiene DELETE FROM leads:', fixHasDelete);
  console.log('  Contiene TRUNCATE:', fixHasTruncate);
  
  // Print relevant sections
  const lines = prodFixesSql.split('\n');
  const relevantLines = lines.filter(l => 
    l.toLowerCase().includes('delete') || 
    l.toLowerCase().includes('truncate') || 
    l.toLowerCase().includes('leads')
  );
  console.log('  Lineas relevantes:');
  relevantLines.slice(0, 20).forEach(l => console.log('   ', l));
}

fullInvestigation().catch(console.error);
