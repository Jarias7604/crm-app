const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.local')));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking columns on database: ", supabaseUrl);
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('id, rejection_reason, approved_by, approved_at, submitted_at')
    .limit(1);

  if (error) {
    console.error("SELECT Query failed with error:", error);
  } else {
    console.log("SUCCESS! Columns exist. Task sample:", data);
  }
}

check();
