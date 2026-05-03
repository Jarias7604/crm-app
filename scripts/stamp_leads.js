const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://ikofyypxphrqkncimszt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrb2Z5eXB4cGhycWtuY2ltc3p0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc2NTk5NSwiZXhwIjoyMDg0MzQxOTk1fQ.QWYzT-BFNIH3u7x0cVODMXFfNqfJr8ediPq1psSP8fk'
);

async function main() {
    // Get all cotizaciones that have a lead_id
    const { data: cots, error: e1 } = await supabase
        .from('cotizaciones')
        .select('id, lead_id')
        .not('lead_id', 'is', null);

    if (e1) { console.error('Error fetching cotizaciones:', e1); return; }
    console.log(`Found ${cots.length} cotizaciones with lead_id`);

    let updated = 0;
    for (const cot of cots) {
        const { error } = await supabase
            .from('leads')
            .update({ document_path: `cotizacion:${cot.id}` })
            .eq('id', cot.lead_id);
        
        if (!error) updated++;
        else console.error(`Failed lead ${cot.lead_id}:`, error.message);
    }
    console.log(`DONE: Updated ${updated} leads with cotizacion badge`);
}

main();
