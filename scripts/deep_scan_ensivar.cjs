const fs = require('fs');

// Ensivar identifiers
const ENSIVAR_COMPANY_ID = 'ec88dff0-94a2-4544-ad2e-1f93a8163366';
const ENSIVAR_USER_IDS = [
  'ffc70ef8-d352-499f-86bb-f74ad16ec432',  // jimmy@ensivar.com
  '4f16d44f-a580-4306-9ea7-9ec8992c7726',  // pmartinez@ensivar.com
];

// ---- Check leads.json ----
const leadsRaw = JSON.parse(fs.readFileSync('./backups/leads.json', 'utf8'));
const ensivarLeads = leadsRaw.filter(l => l.company_id === ENSIVAR_COMPANY_ID);
const leadsByEnsivarUser = leadsRaw.filter(l => ENSIVAR_USER_IDS.includes(l.assigned_to));
console.log(`leads.json - Total: ${leadsRaw.length}, Ensivar company_id: ${ensivarLeads.length}, Assigned to Ensivar users: ${leadsByEnsivarUser.length}`);

// ---- Check follow_ups.json ----
const fups = JSON.parse(fs.readFileSync('./backups/follow_ups.json', 'utf8'));
const fupsByEnsivarUser = fups.filter(f => ENSIVAR_USER_IDS.includes(f.created_by) || ENSIVAR_USER_IDS.includes(f.user_id));
const fupsByEnsivarCompany = fups.filter(f => f.company_id === ENSIVAR_COMPANY_ID);
const ensivarLeadIdsFromFups = [...new Set([
  ...fupsByEnsivarUser.map(f => f.lead_id),
  ...fupsByEnsivarCompany.map(f => f.lead_id),
])].filter(Boolean);

console.log(`\nfollow_ups.json - Total: ${fups.length}, By Ensivar users: ${fupsByEnsivarUser.length}, By Ensivar company: ${fupsByEnsivarCompany.length}`);
console.log(`Unique lead_ids from Ensivar follow_ups: ${ensivarLeadIdsFromFups.length}`);

// Cross-reference those lead IDs with the leads backup
if (ensivarLeadIdsFromFups.length > 0) {
  const matchingLeads = leadsRaw.filter(l => ensivarLeadIdsFromFups.includes(l.id));
  console.log(`\nLeads in backup matching Ensivar follow_up lead_ids: ${matchingLeads.length}`);
  matchingLeads.slice(0, 10).forEach(l => {
    console.log(`  [${l.status}] ${l.name} | company_id: ${l.company_id}`);
  });
}

// ---- Check cotizaciones.json ----
const cots = JSON.parse(fs.readFileSync('./backups/cotizaciones.json', 'utf8'));
const cotsByEnsivar = cots.filter(c => c.company_id === ENSIVAR_COMPANY_ID || ENSIVAR_USER_IDS.includes(c.created_by));
console.log(`\ncotizaciones.json - Ensivar: ${cotsByEnsivar.length}`);
if (cotsByEnsivar.length > 0) {
  cotsByEnsivar.slice(0, 5).forEach(c => console.log(`  lead_id: ${c.lead_id} | company_id: ${c.company_id}`));
}

// ---- Check profiles.json ----
const profiles = JSON.parse(fs.readFileSync('./backups/profiles.json', 'utf8'));
const ensivarProfiles = profiles.filter(p => p.company_id === ENSIVAR_COMPANY_ID);
console.log(`\nprofiles.json - Ensivar profiles: ${ensivarProfiles.length}`);
ensivarProfiles.forEach(p => console.log(`  ${p.email} | id: ${p.id} | role: ${p.role}`));

// ---- Check clients.json ----
const clients = JSON.parse(fs.readFileSync('./backups/clients.json', 'utf8'));
const ensivarClients = clients.filter(c => c.company_id === ENSIVAR_COMPANY_ID);
console.log(`\nclients.json - Ensivar clients: ${ensivarClients.length}`);
