const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function getRpcDef() {
    console.log('=== RPC DEFINITION ===\n');
    const { data, error } = await supabase.rpc('get_rpc_definition', {
        // Wait, does get_rpc_definition exist? No, let's query pg_proc directly using a sql query or postgres catalogs
    });
    // Wait, since we can't run arbitrary RPCs if they don't exist, let's execute a query to find the definition.
    // Wait, can we execute arbitrary SQL queries from supabase client? No, unless we have a specific RPC like raw sql or similar.
    // Let's check if there is an RPC for running SQL, or we can just query the marketing_messages table to see what it contains.
}

async function inspectMessages() {
    console.log('=== MARKETING MESSAGES ===\n');
    const { data: msgs, error: errMsgs } = await supabase
        .from('marketing_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (errMsgs) {
        console.error('Error fetching marketing messages:', errMsgs);
    } else {
        msgs?.forEach(m => {
            console.log(`Msg ID: ${m.id} | Conv ID: ${m.conversation_id} | Sender: ${m.sender_type} | Content: ${m.content} | Created At: ${m.created_at}`);
        });
    }
}

inspectMessages().catch(console.error);
