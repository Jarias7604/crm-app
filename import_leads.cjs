require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseDomain = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseDomain || !supabaseKey) {
  console.log('No tokens');
  process.exit(1);
}

const supabase = createClient(supabaseDomain, supabaseKey);

async function main() {
    const csvData = fs.readFileSync('c:\\Users\\jaria\\Downloads\\leads_export (1) (3).csv', 'utf8');
    const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);
    const companyId = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

    const userMap = {
        'Patricia Martinez': '6dd1b1fe-c96c-4ff1-80cd-34a1449a6a90',
        'Melvin Rodriguez': '160a23cb-a8f2-4726-b6ad-cbf15b899a19',
        'Jimmy Arias': '292bc954-0d25-4147-9526-b7a7268be8e1'
    };

    const statusMap = {
        'prospecto': 'Prospecto',
        'calificado': 'Lead calificado', 'lead calificado': 'Lead calificado',
        'frio': 'Prospecto', 'frío': 'Prospecto', 'llamada fría': 'Prospecto', 'llamada fria': 'Prospecto',
        'negociacion': 'Negociación', 'negociación': 'Negociación', 
        'en seguimiento': 'En seguimiento',
        'cerrado': 'Cerrado', 'cliente': 'Cliente'
    };
    
    const prioMap = { 'alta': 'high', 'media': 'medium', 'baja': 'low', 'altísima':'very_high', 'muy alta': 'very_high' };
    const sourceMap = { 'redes sociales': 'redes_sociales', 'referidos': 'referidos', 'visita campo': 'visita_campo', 'sitio web':'sitio_web','llamada fría':'llamada_fria','otro':'otro'}

    const payload = [];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        let match;
        const regex = new RegExp(`(,|^)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))`, 'gi');
        const cols = [];
        while (match = regex.exec(row)) {
            let val = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
            cols.push((val || '').trim());
            if (match.index === regex.lastIndex) regex.lastIndex++;
        }

        if (cols.length < 5 || !cols[0]) continue;

        let [name, company, email, phone, dir, source, priority, status, value, notes, created_at, closing_amount, assigned_to, next_date, resp] = cols;

        if (!name) continue;

        let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        if (cleanPhone.length === 8) cleanPhone = '503' + cleanPhone;
        if (cleanPhone.length >= 8) cleanPhone = '+' + cleanPhone;

        let createdIso = new Date().toISOString();
        if (created_at) {
            const parts = created_at.split('-');
            if (parts.length === 3) createdIso = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString() || createdIso;
        }

        let nextDateIso = null;
        if (next_date) {
            const parts = next_date.split('-');
            if (parts.length === 3) {
                const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`);
                if(!isNaN(d)) nextDateIso = d.toISOString();
            }
        }

        const assignedId = userMap[assigned_to] || null;

        payload.push({
            name,
            company_name: company || null,
            email: email || null,
            phone: cleanPhone || null,
            priority: prioMap[priority?.toLowerCase() || ''] || 'medium',
            status: statusMap[status?.toLowerCase() || ''] || 'Prospecto',
            value: parseFloat(value) || 0,
            source: sourceMap[source?.toLowerCase()||''] || 'otro',
            next_action_notes: notes || null,
            created_at: createdIso,
            closing_amount: parseFloat(closing_amount) || 0,
            assigned_to: assignedId,
            next_followup_date: nextDateIso,
            company_id: companyId,
        });
    }

    console.log(`Inserting ${payload.length} leads...`);
    // Insert in batches of 100
    for(let i=0; i<payload.length; i+=100) {
        const batch = payload.slice(i, i+100);
        // Supabase anon key cannot insert unless RLS allows it.
        // Wait, does RLS allow inserts? 
        // We will test the first batch
        const { error } = await supabase.from('leads').upsert(batch, { onConflict: 'company_id, name, phone' }).select();
        
        if (error) {
            console.error('Insert error:', error);
            // Wait, anon key has no rights to insert without Auth.
            // But if the server accepts it, it works.
        } else {
            console.log(`Inserted batch ${i/100 + 1}`);
        }
    }
}

main();
