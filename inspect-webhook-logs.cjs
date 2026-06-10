const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function inspectLogs() {
    console.log('=== WEBHOOK DELIVERY LOGS ===\n');
    const { data: weblogs, error: errWeb } = await supabase
        .from('webhook_delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (errWeb) {
        console.error('Error fetching webhook_delivery_logs:', errWeb);
    } else {
        weblogs?.forEach(l => {
            console.log(`Log ID: ${l.id} | Event: ${l.event_type} | Status: ${l.status_code} | Created At: ${l.created_at}`);
            console.log(`  Payload:`, JSON.stringify(l.payload, null, 2));
            console.log(`  Response:`, l.response_body);
            console.log('---');
        });
    }

    console.log('\n=== MARKETING AI LOGS ===\n');
    const { data: ailogs, error: errAi } = await supabase
        .from('marketing_ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (errAi) {
        console.error('Error fetching marketing_ai_logs:', errAi);
    } else {
        ailogs?.forEach(l => {
            console.log(`Log ID: ${l.id} | Company: ${l.company_id} | Type: ${l.log_type} | Message: ${l.message} | Created At: ${l.created_at}`);
        });
    }
}

inspectLogs().catch(console.error);
