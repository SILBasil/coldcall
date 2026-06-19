const fs = require('fs');

// Check all src files for replacement chars and show context
const glob = require('fs');
const path = require('path');

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { checkDir(full); continue; }
    if (!['.jsx', '.js'].includes(path.extname(e.name))) continue;
    const content = fs.readFileSync(full, 'utf8');
    if (!content.includes('\uFFFD')) continue;
    
    // Find all replacement chars and show context
    const positions = [];
    let idx = 0;
    while ((idx = content.indexOf('\uFFFD', idx)) !== -1) {
      positions.push(idx);
      idx++;
    }
    console.log(`\n${full}: ${positions.length} replacement char(s)`);
    positions.slice(0, 5).forEach(pos => {
      const ctx = content.substring(Math.max(0, pos-20), pos+20);
      console.log(`  pos ${pos}: ${JSON.stringify(ctx)}`);
    });
  }
}

checkDir('src');
console.log('\nDone');
