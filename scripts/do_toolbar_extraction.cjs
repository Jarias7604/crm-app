const fs = require('fs');

let leads = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

const getBlock = (startString, endString) => {
    const start = leads.indexOf(startString);
    if(start === -1) throw new Error("Could not find start: " + startString);
    let end;
    if (endString) {
        end = leads.indexOf(endString, start);
        if(end === -1) throw new Error("Could not find end: " + endString);
    } else {
        // Find matching closing brace
        // This is a naive brace matcher
        let braces = 0;
        let foundFirst = false;
        for(let i=start; i<leads.length; i++){
            if(leads[i]==='{') { braces++; foundFirst=true; }
            if(leads[i]==='}') { braces--; }
            if(foundFirst && braces===0) {
                end = i + 1; // including the brace
                break;
            }
        }
    }
    return { start, end, content: leads.substring(start, end) };
};

try {
    const priority = getBlock('    const PriorityDropdown = () => (', '    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {');
    const status = getBlock('    const StatusDropdown = () => (', '    const LossReasonDropdown = () => (');
    const lossR = getBlock('    const LossReasonDropdown = () => (', '    const LossStageDropdown = () => (');
    const lossS = getBlock('    const LossStageDropdown = () => (', '    const MobileFilterModal = () => {');
    
    // Mobile modal ends right before the main return statement
    const mobile = getBlock('    const MobileFilterModal = () => {', '    return (\n        <>\n            {MobileFilterModal()}');

    const render = getBlock('{/* -- ROW 1: Title + Stats · Search + Actions -- */}', '{/* VIEW SELECTOR & MAIN CONTENT - Mobile Cards (only for Grid mode) */}');

    // Make sure we replace from bottom to top so indices don't shift!
    // But since we just indexOf on the original string, we can do substring slicing.

    console.log('Extracted chunks successfully.');

    // Construct LeadToolbar.tsx
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
    setIsModalOpen: (v: boolean) => void;
    navigate: any;
    cameFromRef: any;
    setMinContactCountFilter: (v: any) => void;
    csvHelper: any;
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
    handleDownloadTemplate, handleImportCSV, isImporting, setIsModalOpen,
    navigate, cameFromRef, setMinContactCountFilter, csvHelper
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

${priority.content}
${status.content}
${lossR.content}
${lossS.content}
${mobile.content}

    return (
        <>
            {MobileFilterModal()}
            ${render.content}
        </>
    );
};
`;

    fs.writeFileSync('src/components/leads/LeadToolbar.tsx', toolbarCode);
    console.log('Wrote LeadToolbar.tsx!');

    // Now remove from Leads.tsx
    // The safest way is to replace each block with empty string, but we have to do it exactly.
    // Let's create the component usage string:
    const usage = `<LeadToolbar 
                filteredLeads={filteredLeads}
                leads={leads}
                filteredPipelineTotal={filteredPipelineTotal}
                teamMembers={teamMembers}
                lossReasons={lossReasons}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                viewMode={viewMode}
                setViewMode={setViewMode}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                assignedFilter={assignedFilter}
                setAssignedFilter={setAssignedFilter}
                sourceFilter={sourceFilter}
                setSourceFilter={setSourceFilter}
                lossReasonFilter={lossReasonFilter}
                setLossReasonFilter={setLossReasonFilter}
                lostAtStageFilter={lostAtStageFilter}
                setLostAtStageFilter={setLostAtStageFilter}
                startDateFilter={startDateFilter}
                setStartDateFilter={setStartDateFilter}
                endDateFilter={endDateFilter}
                setEndDateFilter={setEndDateFilter}
                filteredLeadId={filteredLeadId}
                setFilteredLeadId={setFilteredLeadId}
                filteredLeadIds={filteredLeadIds}
                setFilteredLeadIds={setFilteredLeadIds}
                completedLeadIds={completedLeadIds}
                setCompletedLeadIds={setCompletedLeadIds}
                calendarDateLabel={calendarDateLabel}
                setCalendarDateLabel={setCalendarDateLabel}
                handleDownloadTemplate={handleDownloadTemplate}
                handleImportCSV={handleImportCSV}
                isImporting={isImporting}
                setIsModalOpen={setIsModalOpen}
                navigate={navigate}
                cameFromRef={cameFromRef}
                setMinContactCountFilter={setMinContactCountFilter}
                csvHelper={csvHelper}
            />\n`;

    let newLeads = leads;
    
    // Replace the massive render block with the usage
    newLeads = newLeads.substring(0, render.start) + usage + newLeads.substring(render.end);

    // Remove the inline functions
    // Note: since we replace by string value, it doesn't matter what order as long as they are unique
    newLeads = newLeads.replace(mobile.content, '');
    newLeads = newLeads.replace(lossS.content, '');
    newLeads = newLeads.replace(lossR.content, '');
    newLeads = newLeads.replace(status.content, '');
    newLeads = newLeads.replace(priority.content, '');

    // The `{MobileFilterModal()}` might still be inside `return (<> ... {MobileFilterModal()} ... <div className="w-full max-w-[1500px]`
    // Let's remove it manually
    newLeads = newLeads.replace('{MobileFilterModal()}', '');
    newLeads = newLeads.replace('<div className="w-full max-w-[1500px] mx-auto pb-6 space-y-3">', '<div className="w-full max-w-[1500px] mx-auto pb-6 space-y-3">');

    // Inject import
    const importStr = "import { LeadToolbar } from '../components/leads/LeadToolbar';\\n";
    newLeads = newLeads.replace("import { LeadGrid } from '../components/leads/LeadGrid';", "import { LeadGrid } from '../components/leads/LeadGrid';\\n" + importStr);

    fs.writeFileSync('src/pages/Leads.tsx', newLeads);
    console.log('Updated Leads.tsx!');

} catch (err) {
    console.error(err);
}
