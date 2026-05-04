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

let statusDropdownBlock = findBlock('const StatusDropdown =');
let priorityDropdownBlock = findBlock('const PriorityDropdown =');
let lossReasonBlock = findBlock('const LossReasonDropdown =');
let lossStageBlock = findBlock('const LossStageDropdown =');

let effectStart = -1;
let effectEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleClickOutside =')) {
        effectStart = i - 1; // useEffect
        for(let j=i; j<lines.length; j++){
            if(lines[j].includes('document.removeEventListener')) {
                effectEnd = j + 1; // }, []);
                break;
            }
        }
        break;
    }
}

// Find inline AssignedDropdown and DateRange
let assignedStart = -1;
let assignedEnd = -1;
let dateRangeStart = -1;
let dateRangeEnd = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<div className="relative" ref={assignedFilterRef}>')) {
        assignedStart = i;
        // Search down for </div> wrapper end
        for(let j=i; j<lines.length; j++){
            if(lines[j].includes('</button>') && lines[j+1] && lines[j+1].includes('{isAssignedFilterOpen && (')) {
                // Keep going until the inner div is closed
                for(let k=j+1; k<lines.length; k++){
                    if(lines[k].includes(')}')) {
                        assignedEnd = k + 1; // closing </div>
                        break;
                    }
                }
                break;
            }
        }
    }
    if (lines[i].includes('<div className="relative" ref={dateRangeRef}>')) {
        dateRangeStart = i;
        for(let j=i; j<lines.length; j++){
            if(lines[j].includes(')}')) {
                if(lines[j+1] && lines[j+1].includes('</div>')) {
                    dateRangeEnd = j + 1;
                    break;
                }
            }
        }
    }
}

let removeIndices = new Set();
const addRange = (start, end) => {
    if(start > -1 && end > -1) {
        for(let i=start; i<=end; i++) removeIndices.add(i);
    }
}
addRange(statusDropdownBlock.start, statusDropdownBlock.end);
// Wait! PriorityDropdown was missed earlier? Let's not delete priority badge!
// PriorityBadge is line 981 to 995. If PriorityDropdown doesn't exist, this will be -1.
addRange(priorityDropdownBlock.start, priorityDropdownBlock.end);
addRange(lossReasonBlock.start, lossReasonBlock.end);
addRange(lossStageBlock.start, lossStageBlock.end);
addRange(effectStart, effectEnd);
addRange(assignedStart, assignedEnd);
addRange(dateRangeStart, dateRangeEnd);

// Also remove the states for isOpen and refs (ONLY the ones we're replacing, keep mobile)
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
        lines[i].includes('const assignedFilterRef =')
    ) {
        removeIndices.add(i);
    }
}

let newLines = [];
for (let i = 0; i < lines.length; i++) {
    if (i === assignedStart) {
        newLines.push(`                    <AssignedDropdown value={assignedFilter} onChange={setAssignedFilter} teamMembers={teamMembers} />`);
    } else if (i === dateRangeStart) {
        newLines.push(`                    <DateRangeDropdown startDate={startDateFilter} endDate={endDateFilter} setStartDate={setStartDateFilter} setEndDate={setEndDateFilter} />`);
    } else if (!removeIndices.has(i)) {
        let line = lines[i];
        line = line.replace('<StatusDropdown />', '<StatusDropdown value={statusFilter} onChange={setStatusFilter} />');
        line = line.replace('<PriorityDropdown />', '<PriorityDropdown value={priorityFilter} onChange={setPriorityFilter} />');
        line = line.replace('<LossReasonDropdown />', '<LossReasonDropdown value={lossReasonFilter} onChange={setLossReasonFilter} lossReasons={lossReasons} />');
        line = line.replace('<LossStageDropdown />', '<LossStageDropdown value={lostAtStageFilter} onChange={setLostAtStageFilter} />');
        newLines.push(line);
    }
}

let finalCode = newLines.join('\n');
finalCode = finalCode.replace("import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';", 
`import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';
import { StatusDropdown } from '../components/leads/filters/StatusDropdown';
import { PriorityDropdown } from '../components/leads/filters/PriorityDropdown';
import { LossReasonDropdown } from '../components/leads/filters/LossReasonDropdown';
import { LossStageDropdown } from '../components/leads/filters/LossStageDropdown';
import { AssignedDropdown } from '../components/leads/filters/AssignedDropdown';
import { DateRangeDropdown } from '../components/leads/filters/DateRangeDropdown';`);

fs.writeFileSync('src/pages/Leads.tsx', finalCode);
console.log('Applied filters!');
