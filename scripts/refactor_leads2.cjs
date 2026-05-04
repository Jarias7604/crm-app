const fs = require('fs');

let lines = fs.readFileSync('src/pages/Leads.tsx', 'utf8').split('\n');

let tableStart = -1;
let tableEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<table') && lines[i + 1] && lines[i + 1].includes('className="divide-y divide-gray-50"')) {
        tableStart = i;
    }
    if (tableStart !== -1 && lines[i].includes('</table>')) {
        tableEnd = i;
        break;
    }
}

if (tableStart !== -1 && tableEnd !== -1) {
    const tableReplacement = `                                    <LeadTable
                                        leads={paginatedLeads}
                                        columnOrder={columnOrder}
                                        columnWidths={columnWidths}
                                        DEFAULT_COL_WIDTHS={DEFAULT_COL_WIDTHS}
                                        handleOnDragEnd={handleOnDragEnd}
                                        handleColResizeStart={handleColResizeStart}
                                        selectedLeadIds={selectedLeadIds}
                                        toggleLeadSelection={toggleLeadSelection}
                                        toggleSelectAll={toggleSelectAll}
                                        sortedLeads={sortedLeads}
                                        sortConfig={sortConfig}
                                        setSortConfig={setSortConfig}
                                        teamMembers={teamMembers}
                                        openLeadDetail={openLeadDetail}
                                        completedLeadIds={null}
                                        isAdmin={isAdmin}
                                        handleDeleteLead={handleDeleteLead}
                                        StatusBadge={StatusBadge}
                                        PriorityBadge={PriorityBadge}
                                        storageService={storageService}
                                        navigate={navigate}
                                    />`;
    
    lines.splice(tableStart, tableEnd - tableStart + 1, tableReplacement);
    console.log('Table replaced');
} else {
    console.log('Table not found');
}

let panelStart = -1;
let panelEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Lead Detail Slide-Over */}')) {
        panelStart = i;
    }
    if (panelStart !== -1 && lines[i].includes('{/* Won Modal */}')) {
        panelEnd = i - 1;
        break;
    }
}

if (panelStart !== -1 && panelEnd !== -1) {
    const panelReplacement = `{/* Lead Detail Slide-Over */}
            <LeadDetailPanel
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                lead={selectedLead!}
                onUpdateLead={handleUpdateLead}
                teamMembers={teamMembers}
                profile={profile}
                isAdmin={isAdmin}
                navigate={navigate}
                storageService={storageService}
            />\n`;
            
    lines.splice(panelStart, panelEnd - panelStart + 1, panelReplacement);
    console.log('Panel replaced');
} else {
    console.log('Panel not found');
}

// Remove the loadFollowUps body
let loadStart = -1;
let loadEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const loadFollowUps = async')) {
        loadStart = i;
    }
    if (loadStart !== -1 && lines[i].includes('};') && lines[i - 1].includes('logger.error')) {
        loadEnd = i;
        break;
    }
}
if (loadStart !== -1) {
    lines.splice(loadStart, loadEnd - loadStart + 1);
}

// Remove setFollowUps etc states
lines = lines.filter(line => !line.includes('const [followUps, setFollowUps] = useState') 
    && !line.includes('const [messages, setMessages] = useState') 
    && !line.includes('const [callActivities, setCallActivities] = useState'));

let finalContent = lines.join('\n');
finalContent = finalContent.replace(/loadFollowUps\(.*?\);/g, '');

if (!finalContent.includes('import { LeadTable }')) {
    finalContent = finalContent.replace("import { callActivityService } from '../services/callActivity';", "import { callActivityService } from '../services/callActivity';\nimport { LeadTable } from '../components/leads/LeadTable';\nimport { LeadDetailPanel } from '../components/leads/LeadDetailPanel';");
}

fs.writeFileSync('src/pages/Leads.tsx', finalContent);
console.log('Done refactoring Leads.tsx');
