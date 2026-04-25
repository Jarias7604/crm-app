require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test(email, pw) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) console.log(`❌ ${email}: ${error.message}`);
  else { console.log(`✅ ${email}: OK (${data.user.id})`); await supabase.auth.signOut(); }
}

async function main() {
  console.log('Testing EnSivar logins:\n');
  await test('jimmy@ensivar.com', 'AriasCRM2026!');
  await test('pmartinez@ensivar.com', 'AriasCRM2026!');
  await test('melvin@ensivar.com', 'AriasCRM2026!');
}
main();
