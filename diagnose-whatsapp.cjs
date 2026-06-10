const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function diagnose() {
    console.log('=== DIAGNÓSTICO WHATSAPP INTEGRATIONS ===\n');

    // 1. Check WhatsApp integrations
    console.log('1. Integraciones WhatsApp/Twilio:');
    const { data: whatsappInts, error: errInts } = await supabase
        .from('marketing_integrations')
        .select('*');

    if (errInts) {
        console.error('Error fetching integrations:', errInts);
    } else {
        whatsappInts?.forEach(i => {
            console.log(`- ID: ${i.id}`);
            console.log(`  company_id: ${i.company_id}`);
            console.log(`  provider: ${i.provider}`);
            console.log(`  is_active: ${i.is_active}`);
            console.log(`  settings:`, JSON.stringify(i.settings, null, 2));
            console.log('---');
        });
    }

    // 2. Check recent conversations for WhatsApp
    console.log('\n2. Últimas 10 conversaciones de WhatsApp:');
    const { data: convs, error: errConvs } = await supabase
        .from('marketing_conversations')
        .select(`id, company_id, external_id, status, last_message, last_message_at, lead_id`)
        .eq('channel', 'whatsapp')
        .order('last_message_at', { ascending: false })
        .limit(10);

    if (errConvs) {
        console.error('Error fetching conversations:', errConvs);
    } else {
        convs?.forEach(c => {
            console.log(`  Conv ID: ${c.id} | Company ID: ${c.company_id} | Chat ID: ${c.external_id} | Último msg: ${c.last_message?.substring(0, 30)} | ${c.last_message_at}`);
        });
    }
}

diagnose().catch(console.error);
