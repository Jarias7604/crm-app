const fs = require('fs');

// 1. Leads.tsx
let lines = fs.readFileSync('src/pages/Leads.tsx', 'utf8').split('\n');

let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const loadFollowUps = async')) start = i;
    if (start !== -1 && lines[i].includes('};') && lines[i - 1].includes('logger.error')) {
        end = i;
        break;
    }
}
if (start !== -1 && end !== -1) {
    lines.splice(start, end - start + 1);
}

let c = lines.join('\n');
fs.writeFileSync('src/pages/Leads.tsx', c);

// 2. LeadDetailPanel.tsx
let panel = fs.readFileSync('src/components/leads/LeadDetailPanel.tsx', 'utf8');
if (!panel.includes('handleUpdateLead: (updates: Partial<Lead>) => Promise<void>;')) {
    panel = panel.replace(/interface LeadDetailPanelProps \{([\s\S]+?)\}/, 
`interface LeadDetailPanelProps {$1
    handleUpdateLead: (updates: Partial<Lead>) => Promise<void>;
}`);
}
if (!panel.includes('handleUpdateLead, industries')) {
    panel = panel.replace(/export const LeadDetailPanel: React\.FC<LeadDetailPanelProps> = \(\{([^}]+)\}\) => \{/,
`export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({(...args) => {}, $1, handleUpdateLead}) => {`);
    // I will just let the regex be simple. Actually, let's just replace it exactly.
    let exportLineStart = panel.indexOf('export const LeadDetailPanel: React.FC<LeadDetailPanelProps> = ({');
    let exportLineEnd = panel.indexOf('}) => {', exportLineStart);
    if (exportLineStart !== -1 && exportLineEnd !== -1) {
        let inside = panel.substring(exportLineStart + 65, exportLineEnd);
        if (!inside.includes('handleUpdateLead')) {
            panel = panel.substring(0, exportLineStart + 65) + inside + ', handleUpdateLead' + panel.substring(exportLineEnd);
        }
    }
}
fs.writeFileSync('src/components/leads/LeadDetailPanel.tsx', panel);
console.log('Fixed loadFollowUps and handleUpdateLead');
