const fs = require('fs');

let leads = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

// 1. Extract MobileFilterModal
let mobileStart = leads.indexOf('const MobileFilterModal = () => {');
let mobileEnd = leads.indexOf('    return (', mobileStart);
let mobileModalCode = leads.substring(mobileStart, mobileEnd);

// 2. Extract StatusDropdown
let statusStart = leads.indexOf('const StatusDropdown = () => (');
let statusEnd = leads.indexOf('const StatusBadge =', statusStart);
let statusDropdownCode = leads.substring(statusStart, statusEnd);

// 3. Extract PriorityDropdown
let priorityStart = leads.indexOf('const PriorityDropdown = () => {');
let priorityEnd = leads.indexOf('const StatusDropdown =', priorityStart);
let priorityDropdownCode = leads.substring(priorityStart, priorityEnd);

// 4. Extract LossReasonDropdown
let lossReasonStart = leads.indexOf('const LossReasonDropdown = () => (');
let lossReasonEnd = leads.indexOf('const LossStageDropdown =', lossReasonStart);
let lossReasonDropdownCode = leads.substring(lossReasonStart, lossReasonEnd);

// 5. Extract LossStageDropdown
let lossStageStart = leads.indexOf('const LossStageDropdown = () => (');
let lossStageEnd = leads.indexOf('const MobileFilterModal =', lossStageStart);
let lossStageDropdownCode = leads.substring(lossStageStart, lossStageEnd);

// 6. Extract Rows 1-3 from render
let renderStart = leads.indexOf('{/* -- ROW 1: Title + Stats · Search + Actions -- */}');
let renderEnd = leads.indexOf('{/* Desktop Table */}');
// Wait, the active filters are Row 3. Then it goes into Lead Kanban/List rendering!
let gridKanbanStart = leads.indexOf('{/* VIEW SELECTOR & MAIN CONTENT');
let rowRenderCode = leads.substring(renderStart, gridKanbanStart);

console.log('Mobile length:', mobileModalCode.length);
console.log('Status length:', statusDropdownCode.length);
console.log('Priority length:', priorityDropdownCode.length);
console.log('Loss reason length:', lossReasonDropdownCode.length);
console.log('Loss stage length:', lossStageDropdownCode.length);
console.log('Render rows length:', rowRenderCode.length);

// Generate LeadToolbar.tsx
const toolbarCode = `import React, { useState, useRef, useEffect } from 'react';
import { Search, LayoutGrid, List, Layout, Download, Upload, Loader2, Plus, SlidersHorizontal, ChevronDown, CheckCircle, Filter, Calendar, X, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG } from '../../types';
import type { Lead, LeadStatus, LeadPriority, LossReason } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LeadToolbarProps {
    filteredLeads: Lead[];
    leads: Lead[];
    filteredPipelineTotal: number;
    teamMembers: any[];
    lossReasons: LossReason[];
    
    // States & Setters
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
    
    // Actions
    handleDownloadTemplate: () => void;
    handleImportCSV: (e: any) => void;
    isImporting: boolean;
    handleExportCSV: () => void;
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
    handleDownloadTemplate, handleImportCSV, isImporting, handleExportCSV, setIsModalOpen
}) => {
    // Local UI states
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

${priorityDropdownCode}
${statusDropdownCode}
${lossReasonDropdownCode}
${lossStageDropdownCode}
${mobileModalCode}

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-3">
            {MobileFilterModal()}
${rowRenderCode}
        </div>
    );
};
`;

fs.writeFileSync('src/components/leads/LeadToolbar.tsx', toolbarCode);
console.log('Created LeadToolbar.tsx!');
