const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

const PRODUCTION_SUPABASE_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const REAL_COMPANY_ID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

async function fixWebhooks() {
    console.log('=== FIXING TELEGRAM WEBHOOKS ===\n');

    // Get all telegram integrations
    const { data: tgInts } = await supabase
        .from('marketing_integrations')
        .select('id, company_id, settings, is_active')
        .eq('provider', 'telegram');

    for (const integration of (tgInts || [])) {
        const token = integration.settings?.token;
        if (!token) continue;

        const masked = `...${token.slice(-8)}`;

        // Check current webhook
        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const info = await infoRes.json();
        const currentUrl = info.result?.url || '';

        console.log(`Token ${masked}:`);
        console.log(`  Current webhook: ${currentUrl}`);
        console.log(`  Company ID: ${integration.company_id}`);

        const pointsToOldProject = currentUrl.includes('ikofyypxphrqkncimszt');
        const hasFakeCompanyId = integration.company_id === '00000000-0000-0000-0000-000000000000';

        if (pointsToOldProject || hasFakeCompanyId) {
            console.log(`  ❌ BROKEN! Fixing...`);
            
            // Fix the webhook URL to point to current production
            const newWebhookUrl = `${PRODUCTION_SUPABASE_URL}/functions/v1/telegram-webhook?company_id=${REAL_COMPANY_ID}`;
            
            const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: newWebhookUrl })
            });
            const setResult = await setRes.json();
            console.log(`  Set webhook result: ${setResult.ok ? '✅ SUCCESS' : '❌ FAILED: ' + setResult.description}`);

            // Fix the company_id in the database if needed
            if (hasFakeCompanyId) {
                const { error } = await supabase
                    .from('marketing_integrations')
                    .update({ company_id: REAL_COMPANY_ID })
                    .eq('id', integration.id);
                
                if (error) {
                    console.log(`  DB update failed: ${error.message}`);
                } else {
                    console.log(`  ✅ Fixed company_id in DB`);
                }
            }
        } else {
            console.log(`  ✅ Already correct`);
        }
        console.log('');
    }

    // Final verification
    console.log('\n=== FINAL VERIFICATION ===');
    const { data: finalInts } = await supabase
        .from('marketing_integrations')
        .select('company_id, settings')
        .eq('provider', 'telegram');

    for (const i of (finalInts || [])) {
        const token = i.settings?.token;
        if (!token) continue;
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const data = await res.json();
        console.log(`Token ...${token.slice(-8)}: ${data.result?.url}`);
    }

    console.log('\n✅ Done! Both bots now point to production.');
    console.log('Ask Patricia to send a message to the bot again — it should appear in the inbox now.');
}

fixWebhooks().catch(console.error);
