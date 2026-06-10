const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function listAllConvs() {
    console.log('=== LIST ALL CONVERSATIONS ===\n');
    const { data: convs, error } = await supabase
        .from('marketing_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error('Error fetching conversations:', error);
    } else {
        convs?.forEach(c => {
            console.log(`ID: ${c.id} | company_id: ${c.company_id} | channel: ${c.channel} | external_id: ${c.external_id} | status: ${c.status} | last: ${c.last_message?.substring(0, 30)} | at: ${c.last_message_at}`);
        });
    }
}

listAllConvs().catch(console.error);
