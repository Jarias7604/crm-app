const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function listTables() {
    console.log('=== DATABASE TABLES ===\n');
    const { data, error } = await supabase.rpc('get_tables_list'); // Wait, get_tables_list might not exist.
    // Let's run a query to get table names from pg_tables.
    // Wait, since we can't run raw SQL, let's try to query some standard tables or check if we can query pg_catalog.
    // Actually, can we query pg_catalog tables via supabase client?
    // No, by default PostgREST only exposes tables in the 'public' schema (or other schemas configured, but not pg_catalog).
    // Let's check if we can fetch all tables using a standard fetch or if there is an RPC we can use.
}

async function tryFetchTables() {
    const res = await fetch('https://mtxqqamitglhehaktgxm.supabase.co/rest/v1/', {
        headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
        }
    });
    const spec = await res.json();
    const rpcs = Object.keys(spec.paths).filter(p => p.startsWith('/rpc/'));
    console.log('All RPCs:', rpcs);
}

tryFetchTables().catch(console.error);

