const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.local')));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Logging in as jarias7604@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jarias7604@gmail.com',
    password: 'Arias2026!'
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("Logged in successfully! User ID:", authData.user.id);

  console.log("Checking tasks...");
  const { data: tasks, error: fetchError } = await supabase
    .from('crm_tasks')
    .select('id, title, status')
    .limit(1);

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log("No tasks found even after login.");
    return;
  }

  console.log("Found task:", tasks[0]);

  console.log("Triggering check constraint error...");
  const { error: updateError } = await supabase
    .from('crm_tasks')
    .update({ status: 'invalid_status_for_testing_constraint' })
    .eq('id', tasks[0].id);

  if (updateError) {
    console.log("\n--- TRIGGERED ERROR DETAILS ---");
    console.log("Message:", updateError.message);
    console.log("Details:", updateError.details);
    console.log("Hint:", updateError.hint);
    console.log("--------------------------------");
  } else {
    console.log("Surprisingly, update succeeded without constraint error!");
  }
}

run();
