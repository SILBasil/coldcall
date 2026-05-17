import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { importDataPipeline } from './import_pipeline_lib.js';

// Setup paths for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG - ยึดตาม Sheet ID ของคุณ
const SHEET_ID = '1HWiH1V11YF1F0k7F8vW5D8CjBn-pzErEEz-UJDfdLSE';
const CREDS_PATH = path.join(__dirname, '..', 'creds.json');

async function getSheetData(sheets, tabName) {
    console.log(`📡 Fetching data from tab: ${tabName}...`);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tabName}!A2:Z15000`, // ดึงคอลัมน์ A ถึง Z ยาว 15,000 แถว
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
                tab: '1.ข้อมูลVlookup', 
                stage: 'pool', 
                mapper: (row) => ({
                    phone: row[2], 
                    name: row[1], 
                    businessType: row[4], 
                    bot_score: parseInt(row[12]) || 0 
                })
            },
            { 
                tab: '2.ลูกค้าใหม่ที่ยังไม่เคยเปิด', 
                stage: 'qualified', 
                mapper: (row) => ({
                    phone: row[2], 
                    name: row[1], 
                    location: row[6],
                    bot_score: parseInt(row[29]) || 0
                })
            },
            { 
                tab: '3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว', 
                stage: 'customer', 
                mapper: (row) => ({
                    phone: row[1], 
                    name: row[0],
                    lastOrderDate: row[6]
                })
            }
        ];

        // 3. รันทีละแผนงาน (ลำดับ 1 -> 2 -> 3 สำคัญมาก)
        for (const phase of phases) {
            console.log(`\n--- Processing Phase: ${phase.tab} ---`);
            const rows = await getSheetData(sheets, phase.tab);
            
            if (rows.length === 0) {
                console.log(`⚠️ Tab ${phase.tab} is empty or not found.`);
                continue;
            }

            // แปลงข้อมูลแถวเป็น Object
            const records = rows.map(phase.mapper).filter(r => r.phone);
            
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
