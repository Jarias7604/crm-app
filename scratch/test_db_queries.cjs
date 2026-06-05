const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envConfig = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env.local')));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Using Database URL:", supabaseUrl);
  
  // Find a task to test on
  const { data: tasks, error: fetchError } = await supabase
    .from('crm_tasks')
    .select('id, status, title')
    .limit(1);

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log("No tasks found to test update on.");
    return;
  }

  const testTask = tasks[0];
  console.log("Testing update on task:", testTask);

  const now = new Date().toISOString();
  
  // Attempt the update that failed in handleSubmitForApproval
  console.log("\nAttempting UPDATE for approval...");
  const updateResult = await supabase
    .from('crm_tasks')
    .update({ 
      status: 'pending_approval', 
      submitted_at: now, 
      rejection_reason: null, 
      updated_at: now 
    })
    .eq('id', testTask.id)
    .select()
    .single();

  if (updateResult.error) {
    console.error("UPDATE error:", updateResult.error);
    console.error("Error Code:", updateResult.error.code);
    console.error("Error Message:", updateResult.error.message);
    console.error("Error Details:", updateResult.error.details);
    console.error("Error Hint:", updateResult.error.hint);
  } else {
    console.log("UPDATE successful! Updated task:", updateResult.data);
  }
}

run();
