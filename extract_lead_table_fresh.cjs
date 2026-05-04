const fs = require('fs');

const tableJsx = fs.readFileSync('table_dump.txt', 'utf8');

const newLeadTableContent = `import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, ArrowUpDown, Shield, ChevronRight, Trash2, CheckCircle, Target, FileText, Mail, Phone, Calendar, Send, User, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SOURCE_CONFIG } from '../../types';
import type { Lead } from '../../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ResponseVelocityBadge } from '../ResponseVelocityBadge';

interface LeadTableProps {
    columnOrder: string[];
    columnWidths: Record<string, number>;
    DEFAULT_COL_WIDTHS: Record<string, number>;
    handleOnDragEnd: (result: any) => void;
    handleColResizeStart: (e: React.MouseEvent, colId: string) => void;
    selectedLeadIds: string[];
    toggleLeadSelection: (id: string) => void;
    toggleSelectAll: () => void;
    sortedLeads: Lead[];
    paginatedLeads: Lead[];
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    setSortConfig: (config: { key: string; direction: 'asc' | 'desc' } | null) => void;
    teamMembers: any[];
    openLeadDetail: (lead: Lead) => void;
    completedLeadIds: string[] | null;
    isAdmin: boolean;
    handleDeleteLead: (id: string, name: string) => void;
    storageService: any;
    navigate: any;
}

export const LeadTable: React.FC<LeadTableProps> = ({
    columnOrder,
    columnWidths,
    DEFAULT_COL_WIDTHS,
    handleOnDragEnd,
    handleColResizeStart,
    selectedLeadIds,
    toggleLeadSelection,
    toggleSelectAll,
    sortedLeads,
    paginatedLeads,
    sortConfig,
    setSortConfig,
    teamMembers,
    openLeadDetail,
    completedLeadIds,
    isAdmin,
    handleDeleteLead,
    storageService,
    navigate
}) => {
    return (
        ${tableJsx}
    );
};
`;

fs.writeFileSync('src/components/leads/LeadTable.tsx', newLeadTableContent);
console.log('Wrote fixed LeadTable.tsx');

const leadsPath = 'src/pages/Leads.tsx';
let leadsContent = fs.readFileSync(leadsPath, 'utf8');

// Replace the old LeadTable instantiation
const oldUsageRegex = /<LeadTable[\s\S]*?\/>/;
const componentUsage = `<LeadTable 
                                        columnOrder={columnOrder}
                                        columnWidths={columnWidths}
                                        DEFAULT_COL_WIDTHS={DEFAULT_COL_WIDTHS}
                                        handleOnDragEnd={handleOnDragEnd}
                                        handleColResizeStart={handleColResizeStart}
                                        selectedLeadIds={selectedLeadIds}
                                        toggleLeadSelection={toggleLeadSelection}
                                        toggleSelectAll={toggleSelectAll}
                                        sortedLeads={sortedLeads}
                                        paginatedLeads={paginatedLeads}
                                        sortConfig={sortConfig}
                                        setSortConfig={setSortConfig}
                                        teamMembers={teamMembers}
                                        openLeadDetail={openLeadDetail}
                                        completedLeadIds={completedLeadIds}
                                        isAdmin={isAdmin}
                                        handleDeleteLead={handleDeleteLead}
                                        storageService={storageService}
                                        navigate={navigate}
                                    />`;

const newLeadsContent = leadsContent.replace(oldUsageRegex, componentUsage);
fs.writeFileSync(leadsPath, newLeadsContent);
console.log('Updated Leads.tsx to use fixed LeadTable component.');
