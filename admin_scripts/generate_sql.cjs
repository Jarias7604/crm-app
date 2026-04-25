const fs = require('fs');

const csvData = fs.readFileSync('c:\\Users\\jaria\\Downloads\\leads_export (1) (3).csv', 'utf8');
const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);
const headers = lines[0].split(',').map(h => h.trim());

// We need company_id for the CRM. We use Arias Defense company_id: '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
const companyId = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

const userMap = {
    'Patricia Martinez': '6dd1b1fe-c96c-4ff1-80cd-34a1449a6a90',
    'Melvin Rodriguez': '160a23cb-a8f2-4726-b6ad-cbf15b899a19',
    'Jimmy Arias': '292bc954-0d25-4147-9526-b7a7268be8e1',
    // Diana Morales not found in DB - will set to null
};

let sql = `INSERT INTO leads (name, company_name, email, phone, priority, status, value, source, next_action_notes, created_at, closing_amount, assigned_to, next_followup_date, company_id) VALUES \n`;

const valuesArr = [];

for (let i = 1; i < lines.length; i++) {
    // Basic CSV parser ignoring quotes
    const row = lines[i];
    let match;
    const regex = new RegExp(`(,|^)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))`, 'gi');
    const cols = [];
    while (match = regex.exec(row)) {
        let val = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
        cols.push((val || '').trim());
        if (match.index === regex.lastIndex) regex.lastIndex++; // PREVENT INFINITE LOOP
    }

    if (cols.length < 5 || !cols[0]) continue;

    let [name, company, email, phone, dir, source, priority, status, value, notes, created_at, closing_amount, assigned_to, next_date, resp] = cols;

    if (!name) continue;

    // Normalizations
    const statusMap = {
        'prospecto': 'Prospecto',
        'calificado': 'Lead calificado', 'lead calificado': 'Lead calificado',
        'frio': 'Prospecto', 'frío': 'Prospecto', 'llamada fría': 'Prospecto', 'llamada fria': 'Prospecto',
        'negociacion': 'Negociación', 'negociación': 'Negociación', 
        'en seguimiento': 'En seguimiento',
        'cerrado': 'Cerrado', 'cliente': 'Cliente'
    };
    status = statusMap[status?.toLowerCase() || ''] || 'Prospecto';

    const prioMap = { 'alta': 'high', 'media': 'medium', 'baja': 'low', 'altísima':'very_high', 'muy alta': 'very_high' };
    priority = prioMap[priority?.toLowerCase() || ''] || 'medium';

    const sourceMap = { 'redes sociales': 'redes_sociales', 'referidos': 'referidos', 'visita campo': 'visita_campo', 'sitio web':'sitio_web','llamada fría':'llamada_fria','otro':'otro'}
    source = sourceMap[source?.toLowerCase()||''] || 'otro';

    value = parseFloat(value) || 0;
    closing_amount = parseFloat(closing_amount) || 0;

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

    const escapeSql = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';

    valuesArr.push(`(${escapeSql(name)}, ${escapeSql(company)}, ${escapeSql(email)}, ${escapeSql(cleanPhone)}, ${escapeSql(priority)}, ${escapeSql(status)}, ${value}, ${escapeSql(source)}, ${escapeSql(notes)}, ${escapeSql(createdIso)}, ${closing_amount}, ${escapeSql(assignedId)}, ${escapeSql(nextDateIso)}, '${companyId}')`);
}

sql += valuesArr.join(',\n') + '\nON CONFLICT DO NOTHING;';

fs.writeFileSync('c:\\Users\\jaria\\OneDrive\\DELL\\Desktop\\crm-app\\import_leads.sql', sql);
console.log('Generated import_leads.sql with ' + valuesArr.length + ' rows.');
