const fs = require('fs');

const leadsPath = 'src/pages/Leads.tsx';
let leadsContent = fs.readFileSync(leadsPath, 'utf8');

const gridStartIdx = leadsContent.indexOf('/* Grid View */');
const listStartIdx = leadsContent.indexOf(") : viewMode === 'list' ? (");

if (gridStartIdx === -1 || listStartIdx === -1) {
    console.log('Grid View not found in Leads.tsx');
    process.exit(1);
}

const gridDivStart = leadsContent.indexOf('<div className="hidden md:grid', gridStartIdx);
const gridDivEnd = listStartIdx - 1; 

const gridJsx = leadsContent.substring(gridDivStart, gridDivEnd).trim();

const newLeadGridContent = `import React from 'react';
import { ChevronRight, FileText, Clock, Trash2, Calendar, Phone, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SOURCE_CONFIG } from '../../types';
import type { Lead } from '../../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ResponseVelocityBadge } from '../ui/ResponseVelocityBadge';

interface LeadGridProps {
    paginatedLeads: Lead[];
    teamMembers: any[];
    openLeadDetail: (lead: Lead) => void;
    handleDeleteLead: (id: string, name: string) => void;
    isAdmin: boolean;
    callTracker: { start: (id: string) => void };
}

export const LeadGrid: React.FC<LeadGridProps> = ({
    paginatedLeads,
    teamMembers,
    openLeadDetail,
    handleDeleteLead,
    isAdmin,
    callTracker
}) => {
    return (
        ${gridJsx}
    );
};
`;

fs.writeFileSync('src/components/leads/LeadGrid.tsx', newLeadGridContent);
console.log('Wrote LeadGrid.tsx');

const componentUsage = `<LeadGrid 
                        paginatedLeads={paginatedLeads}
                        teamMembers={teamMembers}
                        openLeadDetail={openLeadDetail}
                        handleDeleteLead={handleDeleteLead}
                        isAdmin={isAdmin}
                        callTracker={callTracker}
                    />`;

const newLeadsContent = leadsContent.substring(0, gridDivStart) + componentUsage + '\n                    ' + leadsContent.substring(gridDivEnd);
fs.writeFileSync(leadsPath, newLeadsContent);
console.log('Updated Leads.tsx to use LeadGrid component.');
