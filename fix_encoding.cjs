/**
 * Fix double-encoded Thai text in a file.
 * 
 * What happened: PowerShell's Get-Content read UTF-8 file as Windows-874,
 * then Set-Content -Encoding UTF8 wrote it back. Each Thai UTF-8 byte
 * (e.g. 0xE0 0xB8 0xA1 for ม) was interpreted as Windows-874 chars and
 * re-encoded to UTF-8, making the file 3x larger with garbled Thai.
 * 
 * Fix: Re-encode each character back to its Windows-874 byte, then re-decode as UTF-8.
 */
const fs = require('fs');
const path = require('path');

// Build Windows-874 decode table (byte → Unicode codepoint)
// Windows-874 is TIS-620 compatible with some extras in 0x80-0xA0
const win874 = new Array(256);
for (let i = 0; i < 128; i++) win874[i] = i; // ASCII same
// Special chars in 0x80-0x9F (Windows-874 specific)
const specials = {
  0x80: 0x20AC, 0x85: 0x2026, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013,
  0x97: 0x2014
};
for (let i = 0x80; i <= 0x9F; i++) win874[i] = specials[i] || 0xFFFD;
win874[0xA0] = 0x00A0; // NBSP
// Thai range: 0xA1-0xFB -> U+0E01-U+0E5B
for (let i = 0xA1; i <= 0xFB; i++) win874[i] = 0x0E01 + (i - 0xA1);
// Gaps
win874[0xDB] = 0xFFFD;
win874[0xDC] = 0xFFFD;
win874[0xDD] = 0xFFFD;
win874[0xDE] = 0xFFFD;
win874[0xFC] = 0xFFFD;
win874[0xFD] = 0xFFFD;
win874[0xFE] = 0xFFFD;
win874[0xFF] = 0xFFFD;

// Build reverse table: Unicode codepoint → Windows-874 byte
const reverseWin874 = new Map();
for (let i = 0; i < 256; i++) {
  if (win874[i] !== undefined && win874[i] !== 0xFFFD) {
    reverseWin874.set(win874[i], i);
  }
}

function fixDoubleEncodedThai(content) {
  // Convert string to array of codepoints
  const chars = [...content];
  const resultBytes = [];
  let i = 0;
  
  while (i < chars.length) {
    const cp = chars[i].codePointAt(0);
    
    // Check if this character has a Windows-874 byte representation
    // (i.e., it could be part of a double-encoded sequence)
    if (reverseWin874.has(cp)) {
      const byte = reverseWin874.get(cp);
      
      // Only attempt reversal if this byte is in the non-ASCII range
      // (ASCII chars are not affected by the encoding issue)
      if (byte > 0x7F) {
        resultBytes.push(byte);
        i++;
        continue;
      }
    }
    
    // ASCII or unmappable: write as UTF-8
    const char = chars[i];
    const encoded = Buffer.from(char, 'utf8');
    for (const b of encoded) resultBytes.push(b);
    i++;
  }
  
  // Now decode the raw bytes as UTF-8
  const fixed = Buffer.from(resultBytes).toString('utf8');
  return fixed;
}

function processFile(filePath) {
  let buf = fs.readFileSync(filePath);
  
  // Strip BOM if present
  let start = 0;
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    start = 3;
    console.log(`  Stripped BOM from ${filePath}`);
  }
  
  const content = buf.slice(start).toString('utf8');
  const originalSize = content.length;
  
  // Check if file has double-encoded Thai
  // Pattern: Thai chars (U+0E00-U+0E7F) that appear in groups of 2-3 
  // where each group decodes to a single Thai char
  const hasDoubleEncoded = /[\u0E40-\u0E5F][\u0E00-\u0E7F][\u20AC\u0E40-\u0E5F]/.test(content);
  
  if (!hasDoubleEncoded && start === 0) {
    console.log(`  Skipping ${filePath} (no corruption detected)`);
    return false;
  }
  
  const fixed = fixDoubleEncodedThai(content);
  
  // Write back as UTF-8 without BOM
  fs.writeFileSync(filePath, fixed, 'utf8');
  console.log(`  Fixed ${filePath}: ${originalSize} → ${fixed.length} chars`);
  return true;
}

// Scan all JS/JSX/CSS files in src/
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let fixed = 0;
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { fixed += scanDir(full); continue; }
    if (!['.jsx', '.js', '.css', '.ts', '.tsx'].includes(path.extname(e.name))) continue;
    if (processFile(full)) fixed++;
  }
  return fixed;
}

console.log('Scanning src/ for encoding corruption...');
const count = scanDir('src');
console.log(`\nDone. Fixed ${count} file(s).`);
