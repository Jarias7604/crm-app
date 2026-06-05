const { execSync } = require('child_process');
const fs = require('fs');
try {
  const diff = execSync('git diff 81e49abd 21e92b8c -- src/pages/ProjectManagement.tsx', { encoding: 'utf8' });
  fs.writeFileSync('scratch/diff_utf8.txt', diff, 'utf8');
  console.log('Diff written to scratch/diff_utf8.txt successfully.');
} catch (err) {
  console.error(err);
}
