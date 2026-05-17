import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnection() {
  console.log('เริ่มทดสอบการเชื่อมต่อ Google Sheets...');

  try {
    const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!credentialPath) {
      throw new Error('ไม่พบ GOOGLE_APPLICATION_CREDENTIALS ในไฟล์ .env');
    }
    if (!sheetId) {
      throw new Error('ไม่พบ GOOGLE_SHEET_ID ในไฟล์ .env');
    }

    console.log(`กำลังอ่านไฟล์กุญแจ: ${credentialPath}`);
    
    // ตั้งค่าการยืนยันตัวตน (Authentication)
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    console.log('กำลังดึงข้อมูลชีท (Sheet ID: ' + sheetId + ') ...');

    // ทดสอบดึงข้อมูลทั่วไปของแผ่นงาน (ยังไม่ดึงข้อมูลในเซลล์)
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    console.log('\n✅ เชื่อมต่อสำเร็จ!');
    console.log(`ชื่อไฟล์ Google Sheet ของคุณคือ: "${response.data.properties.title}"`);
    console.log('\n--- รายชื่อแท็บ (แผนงาน) ในไฟล์นี้ ---');
    response.data.sheets.forEach((sheet) => {
      console.log(`- ${sheet.properties.title}`);
    });

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาดในการเชื่อมต่อ:');
    if (error.message.includes('ENOENT')) {
      console.error('หาไฟล์ .json (กุญแจ) ไม่เจอ กรุณาตรวจสอบชื่อไฟล์และที่อยู่ให้ตรงกัน');
    } else {
      console.error(error.message);
    }
  }
}

testConnection();
