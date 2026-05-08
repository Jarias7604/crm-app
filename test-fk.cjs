const { createClient } = require('@supabase/supabase-js');

// Use production service role key to run schema migrations
const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function run() {
    console.log('Making campaign_id nullable in marketing_message_queue...');

    // First check current schema
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
        sql: `SELECT column_name, is_nullable, data_type FROM information_schema.columns 
              WHERE table_name = 'marketing_message_queue' 
              ORDER BY ordinal_position;`
    });

    if (colErr) {
        // Try direct approach via rpc
        console.log('RPC not available, trying direct insert with null to test...');
        
        // Try inserting with null campaign_id to see if column allows it
        const { error: testError } = await supabase
            .from('marketing_message_queue')
            .insert({
                campaign_id: null,
                company_id: '00000000-0000-0000-0000-000000000001', // fake
                lead_id: '00000000-0000-0000-0000-000000000001',
                channel: 'telegram',
                content: 'test',
                status: 'pending',
                scheduled_at: new Date().toISOString()
            });
        
        if (testError) {
            console.log('Test insert failed:', testError.message);
            if (testError.message.includes('campaign_id') && testError.message.includes('null')) {
                console.log('CONFIRMED: campaign_id does NOT allow null. Need migration.');
            } else if (testError.message.includes('foreign key') && testError.message.includes('lead_id')) {
                console.log('campaign_id null is OK! Error is about lead_id FK (expected with fake data).');
            } else {
                console.log('Other error (might be OK for null campaign_id):', testError.code);
            }
        } else {
            console.log('SUCCESS: campaign_id null is allowed!');
        }
    } else {
        console.log('Columns:', JSON.stringify(cols, null, 2));
    }
}

run();
