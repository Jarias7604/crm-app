const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function diagnose() {
    console.log('=== DIAGNÓSTICO TELEGRAM WEBHOOK ===\n');

    // 1. Check Telegram integrations and their webhook URLs
    console.log('1. Integraciones Telegram activas:');
    const { data: tgInts } = await supabase
        .from('marketing_integrations')
        .select('company_id, settings, is_active')
        .eq('provider', 'telegram');

    tgInts?.forEach(i => {
        const token = i.settings?.token;
        const masked = token ? `...${token.slice(-8)}` : 'MISSING';
        console.log(`  company_id: ${i.company_id} | token: ${masked} | active: ${i.is_active}`);
    });

    // 2. Check recent conversations - look for Patricia
    console.log('\n2. Últimas 10 conversaciones de Telegram:');
    const { data: convs } = await supabase
        .from('marketing_conversations')
        .select(`id, external_id, status, last_message, last_message_at, lead_id, leads(name)`)
        .eq('channel', 'telegram')
        .order('last_message_at', { ascending: false })
        .limit(10);

    convs?.forEach(c => {
        console.log(`  Lead: ${c.leads?.name || 'N/A'} | Chat ID: ${c.external_id} | Último msg: ${c.last_message?.substring(0, 30)} | ${c.last_message_at}`);
    });

    // 3. Look for Patricia in leads
    console.log('\n3. Buscando "Patricia" en leads:');
    const { data: patricias } = await supabase
        .from('leads')
        .select('id, name, phone, email, company_id')
        .ilike('name', '%patricia%');
    console.log(JSON.stringify(patricias, null, 2));

    // 4. Check Patricia in profiles (staff)
    console.log('\n4. Buscando "Patricia" en profiles (staff):');
    const { data: patriciaStaff } = await supabase
        .from('profiles')
        .select('id, full_name, email, telegram_chat_id, company_id')
        .ilike('full_name', '%patricia%');
    console.log(JSON.stringify(patriciaStaff, null, 2));

    // 5. Check the webhook is set up correctly on Telegram
    console.log('\n5. Verificando webhook URL en Telegram API...');
    for (const tgInt of (tgInts || [])) {
        const token = tgInt.settings?.token;
        if (!token) continue;
        
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const info = await res.json();
        const webhookUrl = info.result?.url;
        const hasCompanyId = webhookUrl?.includes('company_id');
        
        console.log(`  Token ...${token.slice(-8)}:`);
        console.log(`  Webhook URL: ${webhookUrl || 'NOT SET'}`);
        console.log(`  Has company_id: ${hasCompanyId ? '✅ YES' : '❌ NO - THIS IS THE BUG!'}`);
        console.log(`  Pending updates: ${info.result?.pending_update_count}`);
        console.log(`  Last error: ${info.result?.last_error_message || 'none'}`);
        console.log('');
    }
}

diagnose().catch(console.error);
