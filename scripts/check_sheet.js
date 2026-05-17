import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ลองใช้ ID ที่เจอในรูป
const SHEET_ID = '1HWiH1V11YF1F0k7F8vW5D8CjBn-pzErEEz-UJDfdLSE';
const CREDS_PATH = path.join(__dirname, '..', 'creds.json');

async function checkSheet() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDS_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        
        console.log("🔍 Checking Spreadsheet metadata...");
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        
        console.log("✅ Connection Successful!");
        console.log("Sheet Title:", meta.data.properties.title);
        console.log("Tabs found:", meta.data.sheets.map(s => s.properties.title).join(', '));
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.message.includes('404')) {
            console.log("💡 Tip: อาจจะเป็นที่ ID ของ Sheet ผิด หรือ Service Account ยังไม่ได้รับสิทธิ์แชร์ไฟล์ครับ");
        }
    }
}

checkSheet();
