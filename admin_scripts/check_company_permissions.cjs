require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data, error } = await supabase.from('companies').select('id, name, allowed_permissions');
  if (error) {
    console.error('Error fetching companies:', error);
  } else {
    console.log('Companies:', JSON.stringify(data, null, 2));
  }
}

main();
