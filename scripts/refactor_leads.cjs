const fs = require('fs');

// 1. Fix LeadDetailPanel.tsx
let panelContent = fs.readFileSync('src/components/leads/LeadDetailPanel.tsx', 'utf8');
const panelEndIndex = panelContent.indexOf('            )\n            }\n\n            {/* Won Modal */}');
if (panelEndIndex !== -1) {
    panelContent = panelContent.substring(0, panelEndIndex) + '            );\n};\n';
    fs.writeFileSync('src/components/leads/LeadDetailPanel.tsx', panelContent);
}

// 2. Refactor Leads.tsx
let leadsContent = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

// Replace Table
const tableBlockStart = leadsContent.indexOf('<table\n                                    className="divide-y divide-gray-50"');
const tableBlockEnd = leadsContent.indexOf('</table>\n                                </div>\n                            </div>\n                        </div>\n                    )}');

if (tableBlockStart !== -1 && tableBlockEnd !== -1) {
    const tableReplacement = `<LeadTable
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
                                    />\n                                </div>\n                            </div>\n                        </div>\n                    )}`;
    
    const endSlice = tableBlockEnd + '</table>\n                                </div>\n                            </div>\n                        </div>\n                    )}'.length;
    leadsContent = leadsContent.substring(0, tableBlockStart) + tableReplacement + leadsContent.substring(endSlice);
}

// Replace LeadDetailPanel
const panelStart = leadsContent.indexOf('{/* Lead Detail Slide-Over */}');
const panelEnd = leadsContent.indexOf('            {/* Won Modal */}');

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
            />\n\n`;

    leadsContent = leadsContent.substring(0, panelStart) + panelReplacement + leadsContent.substring(panelEnd);
}

// Add Imports
leadsContent = leadsContent.replace("import { callActivityService } from '../services/callActivity';", "import { callActivityService } from '../services/callActivity';\nimport { LeadTable } from '../components/leads/LeadTable';\nimport { LeadDetailPanel } from '../components/leads/LeadDetailPanel';");

// Remove states
leadsContent = leadsContent.replace(/const \[followUps, setFollowUps\] = useState[^\n]+\n/g, '');
leadsContent = leadsContent.replace(/const \[messages, setMessages\] = useState[^\n]+\n/g, '');
leadsContent = leadsContent.replace(/const \[callActivities, setCallActivities\] = useState[^\n]+\n/g, '');
leadsContent = leadsContent.replace(/const loadFollowUps = async [\s\S]+?catch \(error\) \{\s+logger\.error\([\s\S]+?\)\s+\}\s+\};\n/g, '');
leadsContent = leadsContent.replace(/\s*loadFollowUps\(.*?\);\n/g, '\n');

fs.writeFileSync('src/pages/Leads.tsx', leadsContent);
console.log('Successfully refactored Leads.tsx');
