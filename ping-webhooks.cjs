async function pingWebhooks() {
    console.log('=== PINGING WEBHOOKS ===\n');

    const urls = {
        'mtxqq (Prod DB)': 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=crm_secure_verify&hub.challenge=hello_mtxqq',
        'ikofyyp (Edge Project)': 'https://ikofyypxphrqkncimszt.supabase.co/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=crm_secure_verify&hub.challenge=hello_ikofyyp',
        'ubqscy (Testing)': 'https://ubqscyfefgfbmndnypbp.supabase.co/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=crm_secure_verify&hub.challenge=hello_ubqscy',
    };

    for (const [name, url] of Object.entries(urls)) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            console.log(`${name}:`);
            console.log(`  Status: ${res.status}`);
            console.log(`  Response: ${text.trim()}`);
        } catch (err) {
            console.error(`${name} failed:`, err.message);
        }
        console.log('');
    }
}

pingWebhooks().catch(console.error);
