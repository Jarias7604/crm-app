const fs = require('fs');

// --- LEADS.TSX ---
let leads = fs.readFileSync('src/pages/Leads.tsx', 'utf8').split('\n');
let loadStart = -1, loadEnd = -1;
for (let i = 0; i < leads.length; i++) {
    if (leads[i].includes('const loadFollowUps = async')) loadStart = i;
    if (loadStart !== -1 && leads[i].includes('};') && leads[i - 1].includes('logger.error')) {
        loadEnd = i;
        break;
    }
}
if (loadStart !== -1) leads.splice(loadStart, loadEnd - loadStart + 1);
let leadsContent = leads.join('\n');
leadsContent = leadsContent.replace(/onUpdateLead={handleUpdateLead}/g, 'handleUpdateLead={handleUpdateLead}\n                handleDeleteLead={handleDeleteLead}');
fs.writeFileSync('src/pages/Leads.tsx', leadsContent);


// --- LEADDETAILPANEL.TSX ---
let panel = fs.readFileSync('src/components/leads/LeadDetailPanel.tsx', 'utf8');

// Add Smartphone import
if (!panel.includes('Smartphone')) {
    panel = panel.replace(/import \{ User, Phone, Mail/g, 'import { User, Phone, Mail, Smartphone');
}

// Rename onUpdateLead to handleUpdateLead in destructured args
panel = panel.replace(/onUpdateLead,/g, ''); // remove it since we already added handleUpdateLead in previous script

// Add handleDeleteLead prop
if (!panel.includes('handleDeleteLead: (id: string, name: string) => void;')) {
    panel = panel.replace(/handleUpdateLead: \(updates/g, 'handleDeleteLead: (id: string, name: string) => void;\n    handleUpdateLead: (updates');
}
if (!panel.includes('handleDeleteLead,')) {
    panel = panel.replace(/handleUpdateLead\}\) => \{/, 'handleUpdateLead, handleDeleteLead}) => {');
}

// Add loadFollowUps function inside component
if (!panel.includes('const loadFollowUps = async')) {
    const loadFollowUpsCode = `
    const loadFollowUps = async (leadId: string) => {
        try {
            const [followUpsData, messagesData, activitiesData] = await Promise.all([
                leadsService.getFollowUps(leadId),
                leadsService.getLeadMessages(leadId),
                callActivityService.getLeadCalls(leadId),
            ]);
            setFollowUps(followUpsData || []);
            setMessages(messagesData || []);
            setCallActivities(activitiesData || []);
        } catch (error) {
            logger.error('Failed to load history', error, { action: 'loadFollowUps', leadId });
        }
    };

    useEffect(() => {
        if (isOpen && lead?.id) {
            loadFollowUps(lead.id);
        }
    }, [isOpen, lead?.id]);
`;
    // Insert after states
    panel = panel.replace(/(const \[callActivities, setCallActivities\] = useState<CallActivity\[\]>\(\[\]\);)/, `$1\n${loadFollowUpsCode}`);
}

fs.writeFileSync('src/components/leads/LeadDetailPanel.tsx', panel);
console.log('Final fixes applied!');
