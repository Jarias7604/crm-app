const fs = require('fs');
const content = fs.readFileSync('src/pages/marketing/FollowupSettings.tsx', 'utf8');
const lines = content.split('\n');
// Lines 678-821 (1-indexed) = indices 677-820 (0-indexed) — the old duplicate escalation code
const cleaned = [...lines.slice(0, 677), ...lines.slice(821)].join('\n');
fs.writeFileSync('src/pages/marketing/FollowupSettings.tsx', cleaned, 'utf8');
console.log('✅ Removed lines 678-821. New total:', cleaned.split('\n').length);
