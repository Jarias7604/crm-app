const fs = require('fs');

let content = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

const pStart = content.indexOf('const PriorityBadge = ({ priority }: { priority: LeadPriority }) => {');
const pEnd = content.indexOf('};', pStart) + 2;

if (pStart !== -1) {
    content = content.substring(0, pStart) + content.substring(pEnd);
}

const sStart = content.indexOf('const StatusBadge = ({ status }: { status: LeadStatus }) => {');
const sEnd = content.indexOf('};', sStart) + 2;

if (sStart !== -1) {
    content = content.substring(0, sStart) + content.substring(sEnd);
}

fs.writeFileSync('src/pages/Leads.tsx', content);
console.log('Removed badges');
