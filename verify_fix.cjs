const fs = require('fs');
const buf = fs.readFileSync('src/components/views/CustomerListView.jsx');
const c = buf.toString('utf8');
console.log('BOM?', buf[0].toString(16));
console.log('File size bytes:', buf.length);
const stillBad = /[\u0E40-\u0E5F][\u0E00-\u0E7F][\u20AC\u0E40-\u0E5F]/.test(c);
console.log('Still double-encoded?', stillBad);
// Check for proper Thai word sequences
const thaiWord = c.includes('\u0E40\u0E1E\u0E34\u0E48\u0E21'); // เพิ่ม
console.log('Has proper Thai word (เพิ่ม)?', thaiWord);
// Show a sample of Thai text
const idx = c.search(/[\u0E00-\u0E7F]/);
if (idx >= 0) {
  console.log('Sample Thai context:', JSON.stringify(c.substring(idx, idx+30)));
}
