const fs = require('fs');

let c = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

c = c.replace(/<LeadDetailPanel([\s\S]+?)\/>/g, `<LeadDetailPanel$1 StatusBadge={StatusBadge} PriorityBadge={PriorityBadge} />`);
c = c.replace(/setFollowUps[^\n]+\n/g, '');
c = c.replace(/setMessages[^\n]+\n/g, '');
c = c.replace(/setCallActivities[^\n]+\n/g, '');

fs.writeFileSync('src/pages/Leads.tsx', c);
console.log('Fixed Leads.tsx completely!');
