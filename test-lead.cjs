require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Must use Service Role key to bypass RLS or use the logged in session
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL, serviceKey);

async function run() {
    try {
        console.log('Searching for Jimmy...');
        const { data: leads, error } = await supabase.from('leads').select('*').ilike('name', '%Jimmy%');
        
        if (error) {
            console.error('Error fetching leads:', error);
            return;
        }

        if (leads && leads.length > 0) {
            console.log(`Found ${leads.length} matches for Jimmy. Updating...`);
            for (let lead of leads) {
                await supabase.from('leads').update({
                    phone: '+17039459240',
                    email: 'jarias7604@gmail.com'
                }).eq('id', lead.id);

                console.log(`Updated lead ${lead.id} (${lead.name})`);

                // Create follow up
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: f } = await supabase.from('follow_ups').select('*').eq('lead_id', lead.id).gte('date', todayStr).limit(1);

                if (!f || f.length === 0) {
                    await supabase.from('follow_ups').insert({
                        company_id: lead.company_id,
                        lead_id: lead.id,
                        date: new Date().toISOString(),
                        notes: 'Test lead for AI Assistant',
                        completed: false,
                        type: 'llamada'
                    });
                    console.log(`Created follow up for ${lead.name}`);
                }
            }
            console.log('Successfully prepared Jimmy for testing!');
        } else {
            console.log('Could not find Jimmy. Please make sure the lead exists in the CRM manually.');
        }

    } catch (e) {
        console.error(e);
    }
}
run();
