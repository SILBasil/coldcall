import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { importDataPipeline } from './import_pipeline_lib.js';

// Setup paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG - ยึดตาม Sheet ID ของคุณ
const SHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';
const CREDS_PATH = path.join(__dirname, '..', 'creds.json');

function extractPhones(raw) {
    if (!raw) return [];
    const parts = String(raw).split(/[,\/\\\n;]|\s+และ\s+|\s+or\s+/i);
    const validPhones = [];
    
    for (let part of parts) {
        let clean = part.replace(/[^0-9]/g, '');
        if (!clean) continue;
        
        if (clean.startsWith('66')) {
            clean = '0' + clean.slice(2);
        }
        
        if (clean.length === 9 && /^[8965]/.test(clean)) {
            clean = '0' + clean;
        }
        
        if (clean.length === 8 && /^[2347]/.test(clean)) {
            clean = '0' + clean;
        }
        
        if ((clean.length === 10 && clean.startsWith('0')) || (clean.length === 9 && clean.startsWith('0'))) {
            if (!validPhones.includes(clean)) {
                validPhones.push(clean);
            }
        }
    }
    return validPhones;
}

async function getSheetData(sheets, tabName, rangeSpec) {
    console.log(`📡 Fetching data from tab: ${tabName}...`);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tabName}!${rangeSpec}`, 
    });
    return response.data.values || [];
}

async function main() {
    try {
        console.log("🚀 Starting Lead Pipeline Sync (Local runner with Service Account)");

        // 1. Authenticate with Google
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDS_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // 2. กำหนดลำดับและรายละเอียดแต่ละแผนงาน
        const phases = [
            { 
                tab: 'สำเนาข้อมูลcoldcall', 
                range: 'A2:N20000',
                stage: 'pool', 
                mapper: (row) => ({
                    phone: row[3], 
                    name: row[2] || 'ไม่ระบุชื่อ', 
                    businessType: row[4], 
                    bot_score: parseInt(row[12]) || 0 
                })
            },
            { 
                tab: '2.ลูกค้าใหม่ที่ยังไม่เคยเปิด', 
                range: 'A4:Z20000',
                stage: 'qualified', 
                mapper: (row) => ({
                    phone: row[2], 
                    name: row[1] || 'ไม่ระบุชื่อ', 
                    businessType: row[6],
                    location: row[18]
                })
            },
            { 
                tab: '3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว', 
                range: 'A4:Z20000',
                stage: 'customer', 
                mapper: (row) => ({
                    phone: row[2], 
                    name: row[1] || 'ไม่ระบุชื่อ',
                })
            }
        ];

        // 3. รันทีละแผนงาน
        for (const phase of phases) {
            console.log(`\n--- Processing Phase: ${phase.tab} ---`);
            const rows = await getSheetData(sheets, phase.tab, phase.range);
            
            if (rows.length === 0) {
                console.log(`⚠️ Tab ${phase.tab} is empty or not found.`);
                continue;
            }

            // แปลงข้อมูลแถวเป็น Object
            const records = rows.map(phase.mapper)
                .map(r => {
                    const parsedPhones = extractPhones(r.phone);
                    return {
                        ...r,
                        phone: parsedPhones[0],
                        additionalPhones: parsedPhones.slice(1)
                    };
                })
                .filter(r => r.phone);
            
            console.log(`📦 Found ${records.length} valid records. Importing to Firebase...`);
            await importDataPipeline(records, phase.stage);
        }

        console.log("\n🏁 ALL PHASES COMPLETED SUCCESSFULLY!");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ Error during sync:", error.message);
        process.exit(1);
    }
}

main();
