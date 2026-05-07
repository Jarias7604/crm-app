const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeam() {
  const { data: team, error } = await supabase
    .from('team_members')
    .select('*');
    
  if (error) console.error(error);
  else {
    console.log("Team members:");
    console.log(team);
  }
}

checkTeam();
