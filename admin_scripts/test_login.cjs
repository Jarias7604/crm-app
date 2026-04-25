require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function testLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.log(`❌ ${email}: ${error.message}`);
    return false;
  } else {
    console.log(`✅ ${email}: LOGIN OK! User ID: ${data.user.id}`);
    await supabase.auth.signOut();
    return true;
  }
}

async function main() {
  console.log('Testing logins with password: AriasCRM2026!\n');
  
  await testLogin('jarias7604@gmail.com', 'AriasCRM2026!');
  await testLogin('jarias@ariasdefense.com', 'AriasCRM2026!');
  await testLogin('pm2106@hotmail.com', 'AriasCRM2026!');
  await testLogin('mrodriguez@ariasdefense.com', 'AriasCRM2026!');
  await testLogin('dmorales@ariasdefense.com', 'AriasCRM2026!');
  await testLogin('ggutierrez@ariasdefense.com', 'AriasCRM2026!');
  await testLogin('jimmy@ensivar.com', 'AriasCRM2026!');
  await testLogin('pmartinez@ensivar.com', 'AriasCRM2026!');
  await testLogin('melvin@ensivar.com', 'AriasCRM2026!');
}

main();
