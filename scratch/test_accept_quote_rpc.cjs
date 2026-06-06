const { createClient } = require('@supabase/supabase-js');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4';
const URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const supabase = createClient(URL, SERVICE_KEY);

async function run() {
  const quoteId = '52af8a90-6fd8-45b7-af86-25491b7b0745';
  console.log('Calling accept_quote_public for quote:', quoteId);
  const { data, error } = await supabase.rpc('accept_quote_public', {
    quote_id: quoteId,
    acceptor_name: 'Test Acceptor'
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}
run();
