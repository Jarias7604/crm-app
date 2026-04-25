require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  // List all users to find Patricia and Melvin
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error('List error:', error); return; }
  
  console.log('All users in auth:\n');
  for (const u of users) {
    console.log(`  ${u.id} -> ${u.email}`);
  }
  
  // Try to find Patricia and Melvin
  const patricia = users.find(u => u.email === 'pm2106@hotmail.com');
  const melvin = users.find(u => u.email === 'mrodriguez@ariasdefense.com');
  
  console.log('\nPatricia found:', patricia ? 'YES' : 'NO');
  console.log('Melvin found:', melvin ? 'YES' : 'NO');
  
  // If not found, recreate them
  if (!patricia) {
    console.log('\nCreating Patricia...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'pm2106@hotmail.com',
      password: 'AriasCRM2026!',
      email_confirm: true,
      user_metadata: { full_name: 'Patricia Martinez' }
    });
    if (error) console.error('Create Patricia error:', error.message);
    else {
      console.log('Created Patricia with ID:', data.user.id);
      // Update profile to link to correct company
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: 'Patricia Martinez',
        role: 'company_admin',
        company_id: '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
      });
      if (profErr) console.error('Profile error:', profErr.message);
      else console.log('Profile linked to Arias Defense');
    }
  } else {
    // Reset password
    const { error } = await supabase.auth.admin.updateUserById(patricia.id, { password: 'AriasCRM2026!' });
    if (error) console.error('Update Patricia error:', error.message);
    else console.log('Updated Patricia password');
  }
  
  if (!melvin) {
    console.log('\nCreating Melvin...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'mrodriguez@ariasdefense.com',
      password: 'AriasCRM2026!',
      email_confirm: true,
      user_metadata: { full_name: 'Melvin Rodriguez' }
    });
    if (error) console.error('Create Melvin error:', error.message);
    else {
      console.log('Created Melvin with ID:', data.user.id);
      const { error: profErr } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: 'Melvin Rodriguez',
        role: 'collaborator',
        company_id: '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
      });
      if (profErr) console.error('Profile error:', profErr.message);
      else console.log('Profile linked to Arias Defense');
    }
  } else {
    const { error } = await supabase.auth.admin.updateUserById(melvin.id, { password: 'AriasCRM2026!' });
    if (error) console.error('Update Melvin error:', error.message);
    else console.log('Updated Melvin password');
  }
  
  // Also update EnSivar users
  for (const email of ['jimmy@ensivar.com', 'pmartinez@ensivar.com', 'melvin@ensivar.com']) {
    const user = users.find(u => u.email === email);
    if (user) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, { password: 'AriasCRM2026!' });
      if (error) console.error(`Update ${email} error:`, error.message);
      else console.log(`Updated ${email} password`);
    } else {
      console.log(`${email} not found in auth - skipping`);
    }
  }
}

main();
