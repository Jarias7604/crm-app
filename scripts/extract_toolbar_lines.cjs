const fs = require('fs');

let lines = fs.readFileSync('src/pages/Leads.tsx', 'utf8').split('\n');

function findBlock(startStr) {
    let start = -1;
    let end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(startStr)) {
            start = i;
            let openBraces = 0;
            let foundFirstBrace = false;
            for (let j = i; j < lines.length; j++) {
                openBraces += (lines[j].match(/\{/g) || []).length;
                openBraces -= (lines[j].match(/\}/g) || []).length;
                openBraces += (lines[j].match(/\(/g) || []).length;
                openBraces -= (lines[j].match(/\)/g) || []).length;
                
                if (openBraces > 0) foundFirstBrace = true;
                if (foundFirstBrace && openBraces === 0) {
                    end = j;
                    break;
                }
            }
            break;
        }
    }
    return { start, end };
}

function getLines(start, end) {
    if (start === -1 || end === -1) return '';
    return lines.slice(start, end + 1).join('\n');
}

let statusBadgeBlock = findBlock('const StatusBadge =');
console.log('StatusBadge:', statusBadgeBlock);

let priorityBadgeBlock = findBlock('const PriorityBadge =');
console.log('PriorityBadge:', priorityBadgeBlock);

let statusDropdownBlock = findBlock('const StatusDropdown =');
console.log('StatusDropdown:', statusDropdownBlock);

let priorityDropdownBlock = findBlock('const PriorityDropdown =');
console.log('PriorityDropdown:', priorityDropdownBlock);

let lossReasonBlock = findBlock('const LossReasonDropdown =');
console.log('LossReasonDropdown:', lossReasonBlock);

let lossStageBlock = findBlock('const LossStageDropdown =');
console.log('LossStageDropdown:', lossStageBlock);

let mobileModalBlock = findBlock('const MobileFilterModal =');
console.log('MobileFilterModal:', mobileModalBlock);

// For the render row:
let renderStart = -1;
let renderEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* -- ROW 1: Title + Stats · Search + Actions -- */}')) {
        renderStart = i - 1; // start from <div className="flex flex-col...
    }
    if (lines[i].includes('{/* Desktop Table */}')) {
        renderEnd = i - 1;
        break;
    }
}
console.log('Render Block:', {start: renderStart, end: renderEnd});

const toolbarCode = `import React, { useState, useRef, useEffect } from 'react';
import { Search, LayoutGrid, List, Layout, Download, Upload, Loader2, Plus, SlidersHorizontal, ChevronDown, CheckCircle, Filter, Calendar, X, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG } from '../../types';
import type { Lead, LeadStatus, LeadPriority, LossReason, Industry } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { csvHelper } from '../../utils/csvHelper';
import toast from 'react-hot-toast';

interface LeadToolbarProps {
    filteredLeads: Lead[];
    leads: Lead[];
    filteredPipelineTotal: number;
    teamMembers: any[];
    lossReasons: LossReason[];
    
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    viewMode: 'grid' | 'list' | 'kanban';
    setViewMode: (v: 'grid' | 'list' | 'kanban') => void;
    
    statusFilter: LeadStatus | 'all' | LeadStatus[];
    setStatusFilter: (v: any) => void;
    priorityFilter: LeadPriority | 'all' | LeadPriority[];
    setPriorityFilter: (v: any) => void;
    assignedFilter: string | 'all' | string[];
    setAssignedFilter: (v: any) => void;
    sourceFilter: string | 'all' | string[];
    setSourceFilter: (v: any) => void;
    lossReasonFilter: string | 'all' | string[];
    setLossReasonFilter: (v: any) => void;
    lostAtStageFilter: string | 'all' | string[];
    setLostAtStageFilter: (v: any) => void;
    
    startDateFilter: string | null;
    setStartDateFilter: (v: string | null) => void;
    endDateFilter: string | null;
    setEndDateFilter: (v: string | null) => void;
    
    filteredLeadId: string | null;
    setFilteredLeadId: (v: string | null) => void;
    filteredLeadIds: string[] | null;
    setFilteredLeadIds: (v: string[] | null) => void;
    completedLeadIds: string[] | null;
    setCompletedLeadIds: (v: string[] | null) => void;
    calendarDateLabel: string | null;
    setCalendarDateLabel: (v: string | null) => void;
    
    handleDownloadTemplate: () => void;
    handleImportCSV: (e: any) => void;
    isImporting: boolean;
    setIsModalOpen: (v: boolean) => void;
}

export const LeadToolbar: React.FC<LeadToolbarProps> = ({
    filteredLeads, leads, filteredPipelineTotal, teamMembers, lossReasons,
    searchTerm, setSearchTerm, viewMode, setViewMode,
    statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    assignedFilter, setAssignedFilter, sourceFilter, setSourceFilter,
    lossReasonFilter, setLossReasonFilter, lostAtStageFilter, setLostAtStageFilter,
    startDateFilter, setStartDateFilter, endDateFilter, setEndDateFilter,
    filteredLeadId, setFilteredLeadId, filteredLeadIds, setFilteredLeadIds,
    completedLeadIds, setCompletedLeadIds, calendarDateLabel, setCalendarDateLabel,
    handleDownloadTemplate, handleImportCSV, isImporting, setIsModalOpen
}) => {
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);
    const [isAssignedFilterOpen, setIsAssignedFilterOpen] = useState(false);
    const [isLossReasonFilterOpen, setIsLossReasonFilterOpen] = useState(false);
    const [isLostAtStageFilterOpen, setIsLostAtStageFilterOpen] = useState(false);
    const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);

    const statusFilterRef = useRef<HTMLDivElement>(null);
    const priorityFilterRef = useRef<HTMLDivElement>(null);
    const assignedFilterRef = useRef<HTMLDivElement>(null);
    const lossReasonFilterRef = useRef<HTMLDivElement>(null);
    const lostAtStageFilterRef = useRef<HTMLDivElement>(null);
    const dateRangeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (priorityFilterRef.current && !priorityFilterRef.current.contains(event.target as Node)) setIsPriorityFilterOpen(false);
            if (assignedFilterRef.current && !assignedFilterRef.current.contains(event.target as Node)) setIsAssignedFilterOpen(false);
            if (lossReasonFilterRef.current && !lossReasonFilterRef.current.contains(event.target as Node)) setIsLossReasonFilterOpen(false);
            if (lostAtStageFilterRef.current && !lostAtStageFilterRef.current.contains(event.target as Node)) setIsLostAtStageFilterOpen(false);
            if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) setIsStatusFilterOpen(false);
            if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) setIsDateRangeOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

${getLines(statusDropdownBlock.start, statusDropdownBlock.end)}

${getLines(priorityDropdownBlock.start, priorityDropdownBlock.end)}

${getLines(lossReasonBlock.start, lossReasonBlock.end)}

${getLines(lossStageBlock.start, lossStageBlock.end)}

${getLines(mobileModalBlock.start, mobileModalBlock.end)}

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-3">
            {MobileFilterModal()}
${getLines(renderStart, renderEnd)}
        </div>
    );
};
`;

fs.writeFileSync('src/components/leads/LeadToolbar.tsx', toolbarCode);
console.log('Corrected LeadToolbar.tsx!');
