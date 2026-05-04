import fs from 'fs';

const content = fs.readFileSync('src/pages/Leads.tsx', 'utf8');

const startMarker = "export default function Leads() {";
const endMarker = "const PriorityDropdown = () => (";

const startIndex = content.indexOf(startMarker) + startMarker.length;
const endIndex = content.indexOf(endMarker);

const logicBlock = content.substring(startIndex, endIndex);

let exports = new Set();

const useStateRegex = /const \s*\[\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\]\s*=\s*useState/g;
let match;
while ((match = useStateRegex.exec(logicBlock)) !== null) {
    exports.add(match[1]);
    exports.add(match[2]);
}

const topLevelConstRegex = /^\s{4}const \s+([a-zA-Z0-9_]+)\s*(:([^=]+))?=\s*/gm;
while ((match = topLevelConstRegex.exec(logicBlock)) !== null) {
    exports.add(match[1]);
}

const topLevelDestructRegex = /^\s{4}const \s*\{\s*([^}]+)\s*\}\s*=\s*/gm;
while ((match = topLevelDestructRegex.exec(logicBlock)) !== null) {
    const vars = match[1].split(',').map(v => v.split(':')[0].trim().split(' ')[0]);
    vars.forEach(v => {
        if (v && v !== 'data' && v !== 'isLoading' && !v.includes('...')) {
            exports.add(v);
        }
    });
}

exports.add('profile');
exports.add('hasPermission');
exports.add('leadsTableRef');
exports.add('leadsWrapperRef');
exports.add('leadsData');
exports.add('loading');
exports.add('paginatedLeads');
exports.add('filteredLeads');
exports.add('sortedLeads');
exports.add('totalPages');
exports.add('filteredPipelineTotal');
exports.add('DEFAULT_COL_WIDTHS');

const exportsList = Array.from(exports).filter(x => !['', 'const', 'let', 'var'].includes(x));

console.log('Variables to return:', exportsList.join(', '));
