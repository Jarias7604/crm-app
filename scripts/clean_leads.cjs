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

let statusBadgeBlock = findBlock('const StatusBadge =');
let priorityBadgeBlock = findBlock('const PriorityBadge =');
let statusDropdownBlock = findBlock('const StatusDropdown =');
let priorityDropdownBlock = findBlock('const PriorityDropdown =');
let lossReasonBlock = findBlock('const LossReasonDropdown =');
let lossStageBlock = findBlock('const LossStageDropdown =');
let mobileModalBlock = findBlock('const MobileFilterModal =');

let renderStart = -1;
let renderEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* -- ROW 1: Title + Stats · Search + Actions -- */}')) {
        renderStart = i - 1; 
    }
    if (lines[i].includes('{/* Desktop Table */}')) {
        renderEnd = i - 1;
        break;
    }
}

// Find useEffect for handleClickOutside
let effectStart = -1;
let effectEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleClickOutside =')) {
        // It's inside a useEffect. Start is slightly above.
        effectStart = i - 1; // useEffect(() => {
        effectEnd = i + 18; // approx, let's find the end manually
        for(let j=i; j<lines.length; j++){
            if(lines[j].includes('document.removeEventListener')) {
                effectEnd = j + 1; // }, []);
                break;
            }
        }
        break;
    }
}

// Lines to remove
let removeIndices = new Set();
const addRange = (start, end) => {
    if(start > -1 && end > -1) {
        for(let i=start; i<=end; i++) removeIndices.add(i);
    }
}
addRange(statusBadgeBlock.start, statusBadgeBlock.end);
addRange(priorityBadgeBlock.start, priorityBadgeBlock.end);
addRange(statusDropdownBlock.start, statusDropdownBlock.end);
addRange(priorityDropdownBlock.start, priorityDropdownBlock.end);
addRange(lossReasonBlock.start, lossReasonBlock.end);
addRange(lossStageBlock.start, lossStageBlock.end);
addRange(mobileModalBlock.start, mobileModalBlock.end);
addRange(renderStart, renderEnd);
addRange(effectStart, effectEnd);

// Also remove refs and UI states
for(let i=0; i<lines.length; i++){
    if (
        lines[i].includes('const [isPriorityFilterOpen') ||
        lines[i].includes('const priorityFilterRef =') ||
        lines[i].includes('const [isLossReasonFilterOpen') ||
        lines[i].includes('const lossReasonFilterRef =') ||
        lines[i].includes('const [isLostAtStageFilterOpen') ||
        lines[i].includes('const lostAtStageFilterRef =') ||
        lines[i].includes('const [isDateRangeOpen') ||
        lines[i].includes('const dateRangeRef =') ||
        lines[i].includes('const [isStatusFilterOpen') ||
        lines[i].includes('const statusFilterRef =') ||
        lines[i].includes('const [isAssignedFilterOpen') ||
        lines[i].includes('const assignedFilterRef =') ||
        lines[i].includes('const [isMobileFilterOpen')
    ) {
        removeIndices.add(i);
    }
}

let newLines = [];
for (let i = 0; i < lines.length; i++) {
    if (i === renderStart) {
        newLines.push(`            <LeadToolbar 
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
                handleExportCSV={() => {
                    const l = filteredLeads.length > 0 ? filteredLeads : leads;
                    csvHelper.exportLeads(l, teamMembers);
                    toast.success('Exportación iniciada');
                }}
                setIsModalOpen={setIsModalOpen}
            />`);
    }
    if (!removeIndices.has(i)) {
        newLines.push(lines[i]);
    }
}

// Import LeadToolbar, PriorityBadge, StatusBadge at the top
let finalCode = newLines.join('\n');
finalCode = finalCode.replace(/import \{ LeadTable \} from '\.\.\/components\/leads\/LeadTable';/, 
`import { LeadTable } from '../components/leads/LeadTable';
import { LeadToolbar } from '../components/leads/LeadToolbar';
import { StatusBadge } from '../components/leads/StatusBadge';
import { PriorityBadge } from '../components/leads/PriorityBadge';`);

fs.writeFileSync('src/pages/Leads.tsx', finalCode);
console.log('Cleaned Leads.tsx!');
