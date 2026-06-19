/**
 * Fix double-encoded Thai text.
 * PowerShell read UTF-8 as Windows-874, then wrote as UTF-8 causing double-encoding.
 * 
 * Correct reverse mapping: take each character, get its Windows-874 byte equivalent,
 * collect bytes, re-decode as UTF-8.
 * 
 * This version handles ALL Windows-874 mappings correctly including gaps.
 */
const fs = require('fs');
const path = require('path');

// Complete Windows-874 (cp874) byte -> Unicode mapping
// Based on official Unicode.org mapping
const CP874 = [
  // 0x00 - 0x7F: ASCII (same)
  0x0000,0x0001,0x0002,0x0003,0x0004,0x0005,0x0006,0x0007,
  0x0008,0x0009,0x000A,0x000B,0x000C,0x000D,0x000E,0x000F,
  0x0010,0x0011,0x0012,0x0013,0x0014,0x0015,0x0016,0x0017,
  0x0018,0x0019,0x001A,0x001B,0x001C,0x001D,0x001E,0x001F,
  0x0020,0x0021,0x0022,0x0023,0x0024,0x0025,0x0026,0x0027,
  0x0028,0x0029,0x002A,0x002B,0x002C,0x002D,0x002E,0x002F,
  0x0030,0x0031,0x0032,0x0033,0x0034,0x0035,0x0036,0x0037,
  0x0038,0x0039,0x003A,0x003B,0x003C,0x003D,0x003E,0x003F,
  0x0040,0x0041,0x0042,0x0043,0x0044,0x0045,0x0046,0x0047,
  0x0048,0x0049,0x004A,0x004B,0x004C,0x004D,0x004E,0x004F,
  0x0050,0x0051,0x0052,0x0053,0x0054,0x0055,0x0056,0x0057,
  0x0058,0x0059,0x005A,0x005B,0x005C,0x005D,0x005E,0x005F,
  0x0060,0x0061,0x0062,0x0063,0x0064,0x0065,0x0066,0x0067,
  0x0068,0x0069,0x006A,0x006B,0x006C,0x006D,0x006E,0x006F,
  0x0070,0x0071,0x0072,0x0073,0x0074,0x0075,0x0076,0x0077,
  0x0078,0x0079,0x007A,0x007B,0x007C,0x007D,0x007E,0x007F,
  // 0x80 - 0x9F: Windows-874 specials
  0x20AC,  // 0x80 = €
  null,    // 0x81 undefined
  null,    // 0x82 undefined
  null,    // 0x83 undefined
  null,    // 0x84 undefined
  0x2026,  // 0x85 = …
  null,    // 0x86 undefined
  null,    // 0x87 undefined
  null,    // 0x88 undefined
  null,    // 0x89 undefined
  null,    // 0x8A undefined
  null,    // 0x8B undefined
  null,    // 0x8C undefined
  null,    // 0x8D undefined
  null,    // 0x8E undefined
  null,    // 0x8F undefined
  null,    // 0x90 undefined
  0x2018,  // 0x91 = '
  0x2019,  // 0x92 = '
  0x201C,  // 0x93 = "
  0x201D,  // 0x94 = "
  0x2022,  // 0x95 = •
  0x2013,  // 0x96 = –
  0x2014,  // 0x97 = —
  null,    // 0x98 undefined
  null,    // 0x99 undefined
  null,    // 0x9A undefined
  null,    // 0x9B undefined
  null,    // 0x9C undefined
  null,    // 0x9D undefined
  null,    // 0x9E undefined
  null,    // 0x9F undefined
  // 0xA0 - 0xFF: Thai block
  0x00A0,  // 0xA0 NBSP
  0x0E01,0x0E02,0x0E03,0x0E04,0x0E05,0x0E06,0x0E07,  // 0xA1-0xA7
  0x0E08,0x0E09,0x0E0A,0x0E0B,0x0E0C,0x0E0D,0x0E0E,0x0E0F,  // 0xA8-0xAF
  0x0E10,0x0E11,0x0E12,0x0E13,0x0E14,0x0E15,0x0E16,0x0E17,  // 0xB0-0xB7
  0x0E18,0x0E19,0x0E1A,0x0E1B,0x0E1C,0x0E1D,0x0E1E,0x0E1F,  // 0xB8-0xBF
  0x0E20,0x0E21,0x0E22,0x0E23,0x0E24,0x0E25,0x0E26,0x0E27,  // 0xC0-0xC7
  0x0E28,0x0E29,0x0E2A,0x0E2B,0x0E2C,0x0E2D,0x0E2E,0x0E2F,  // 0xC8-0xCF
  0x0E30,0x0E31,0x0E32,0x0E33,0x0E34,0x0E35,0x0E36,0x0E37,  // 0xD0-0xD7
  0x0E38,0x0E39,0x0E3A,null,null,null,null,0x0E3F,           // 0xD8-0xDF
  0x0E40,0x0E41,0x0E42,0x0E43,0x0E44,0x0E45,0x0E46,0x0E47,  // 0xE0-0xE7
  0x0E48,0x0E49,0x0E4A,0x0E4B,0x0E4C,0x0E4D,0x0E4E,0x0E4F,  // 0xE8-0xEF
  0x0E50,0x0E51,0x0E52,0x0E53,0x0E54,0x0E55,0x0E56,0x0E57,  // 0xF0-0xF7
  0x0E58,0x0E59,0x0E5A,0x0E5B,null,null,null,null            // 0xF8-0xFF
];

// Reverse: Unicode -> CP874 byte
const unicodeToCP874 = new Map();
for (let i = 0; i < CP874.length; i++) {
  if (CP874[i] !== null) {
    unicodeToCP874.set(CP874[i], i);
  }
}

function fixFile(filePath) {
  const buf = fs.readFileSync(filePath);
  
  // Strip BOM if present
  let start = 0;
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    start = 3;
  }
  
  // Check if file is double-encoded
  // Signature: Thai chars U+0E40-U+0E5F followed by U+0E00-U+0E7F
  // This shouldn't happen in normal Thai text (these are leading vowels followed by consonants
  // but the pattern is very specific for double-encoded UTF-8)
  const content = buf.slice(start).toString('utf8');
  
  // Quick check: look for the specific double-encoding signature
  // When UTF-8 byte 0xE0 (Thai prefix) gets decoded as CP874, it becomes เ (U+0E40)
  // When 0xB8 (Thai prefix) gets decoded as CP874, it becomes ธ (U+0E18)
  // So double-encoded Thai will have เธ, เน, เน€ etc. patterns
  const doubleEncodedPattern = /\u0E40[\u0E00-\u0E7F]|\u0E41[\u0E00-\u0E7F]/;
  
  if (!doubleEncodedPattern.test(content) && start === 0) {
    return { fixed: false, content };
  }
  
  // Fix: convert each character back to its CP874 byte, then decode as UTF-8
  const bytes = [];
  for (const char of content) {
    const cp = char.codePointAt(0);
    if (unicodeToCP874.has(cp)) {
      const byte = unicodeToCP874.get(cp);
      if (byte > 0x7F) {
        // This is a non-ASCII char mapped through CP874 - reverse it
        bytes.push(byte);
        continue;
      }
    }
    // ASCII or unmappable - write as-is (as UTF-8 bytes)
    const charBuf = Buffer.from(char, 'utf8');
    for (const b of charBuf) bytes.push(b);
  }
  
  const fixed = Buffer.from(bytes).toString('utf8');
  return { fixed: true, content: fixed };
}

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { count += processDir(full); continue; }
    const ext = path.extname(e.name);
    if (!['.jsx', '.js', '.css', '.ts', '.tsx'].includes(ext)) continue;
    
    try {
      const { fixed, content } = fixFile(full);
      if (fixed) {
        fs.writeFileSync(full, content, 'utf8');
        // Verify no replacement chars
        const hasReplacement = content.includes('\uFFFD');
        console.log(`  FIXED: ${full}${hasReplacement ? ' [WARNING: has replacement chars]' : ''}`);
        count++;
      } else {
        console.log(`  OK: ${full}`);
      }
    } catch (err) {
      console.log(`  ERROR: ${full}: ${err.message}`);
    }
  }
  return count;
}

console.log('Fixing double-encoded Thai text...\n');
const count = processDir('src');
console.log(`\nTotal fixed: ${count} files`);

// Verify key file
const sample = fs.readFileSync('src/components/views/CustomerListView.jsx', 'utf8');
const hasThai = /\u0E40\u0E1E\u0E34\u0E48\u0E21/.test(sample); // เพิ่ม
const hasReplacement = sample.includes('\uFFFD');
console.log('\nVerification of CustomerListView.jsx:');
console.log('  Contains เพิ่ม?', hasThai);
console.log('  Has replacement chars?', hasReplacement);
if (!hasThai) {
  // Show sample
  const idx = sample.search(/[\u0E00-\u0E7F]/);
  console.log('  Sample Thai:', JSON.stringify(sample.substring(Math.max(0, idx-5), idx+40)));
}
