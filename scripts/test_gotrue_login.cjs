async function run() {
  const url = 'https://ubqscyfefgfbmndnypbp.supabase.co';
  const anon = 'sb_publishable_1dt5o9J7DLRvL7ZSUGNgEA_4wBaM56E';
  const email = 'jarias7604@gmail.com';
  const password = 'Arias2026!';

  console.log('Testing GoTrue login via fetch...');
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': anon,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: password
    })
  });

  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
run();
