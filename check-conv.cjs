const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function checkConv() {
    console.log('=== CONVERSATION DETAIL ===\n');
    const { data: conv, error } = await supabase
        .from('marketing_conversations')
        .select('*')
        .eq('id', 'fbbc1144-83fa-415e-a83d-2699fb73add8')
        .single();

    if (error) {
        console.error('Error fetching conversation:', error);
    } else {
        console.log(JSON.stringify(conv, null, 2));
    }
}

checkConv().catch(console.error);
