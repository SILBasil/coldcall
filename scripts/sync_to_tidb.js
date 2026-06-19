import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env copy' });

const SPREADSHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
      ca: fs.readFileSync(path.resolve(process.env.DB_SSL_CA || 'isrgrootx1.pem')),
      rejectUnauthorized: true
  }
};

const KNOWN_ADMINS = [
  { name: "ข้าวฟ่าง", id: "a1", fullName: "แอดมิน ข้าวฟ่าง" },
  { name: "ทิม", id: "a2", fullName: "แอดมิน ทิม" },
  { name: "ธีร์", id: "a3", fullName: "แอดมิน ธีร์" },
  { name: "ไนซ์", id: "a4", fullName: "แอดมิน ไนซ์" },
  { name: "พลอย", id: "a5", fullName: "แอดมิน พลอย" },
  { name: "toey", id: "a6", fullName: "แอดมิน Toey" }
];

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

async function syncToTiDB() {
  console.log("🚀 เริ่มต้นกระบวนการเชื่อมต่อ TiDB และดึง Sheet (3 แท็บ)...");
  
  let connection;
  try {
     connection = await mysql.createConnection(dbConfig);
     console.log("✅ เชื่อมต่อ TiDB สำเร็จ");

     // สร้างตาราง
     await connection.query(`
         CREATE TABLE IF NOT EXISTS coldcall_customers (
             id VARCHAR(255) PRIMARY KEY,
             customerNo INT,
             name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             phone VARCHAR(50),
             additionalPhones JSON,
             stage VARCHAR(50),
             status VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             source VARCHAR(50),
             responsibleId VARCHAR(255),
             bot_ratingText VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             bot_score INT,
             q1_business TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q2_usage TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q3_sample TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q4_visit TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q7_interestVisit TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q8_visitAddress TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q5_prefTime TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q6_addLine TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             latestFollowUpNote TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             lastCallDate VARCHAR(100),
             lastOrderDate VARCHAR(100),
             freqAmount INT,
             freqUnit VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             created_at DATETIME,
             updated_at DATETIME
         );
     `);
     console.log("✅ ตรวจสอบ/สร้างตาราง สำเร็จ");

     const auth = new google.auth.GoogleAuth({
        keyFile: './creds.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
     });
    
     const sheets = google.sheets({ version: 'v4', auth });

     // ดึงสถานะปัจจุบันมารอเทียบเพื่อป้องกันดาวน์เกรด
     const [existingRows] = await connection.query("SELECT id, stage FROM coldcall_customers");
     const existingStages = new Map(existingRows.map(r => [r.id, r.stage]));

     // 1. ดึงสำเนาข้อมูลcoldcall
     console.log("📥 กำลังอ่าน สำเนาข้อมูลcoldcall...");
     const res1 = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'สำเนาข้อมูลcoldcall!A2:N20000',
     });
     await processTab(connection, res1.data.values, 'coldcall', existingStages);

     // 2. ดึง 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด
     console.log("📥 กำลังอ่าน 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด...");
     const res2 = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '2.ลูกค้าใหม่ที่ยังไม่เคยเปิด!A4:Z20000',
     });
     await processTab(connection, res2.data.values, 'qualified', existingStages);

     // 3. ดึง 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว
     console.log("📥 กำลังอ่าน 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว...");
     const res3 = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: '3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว!A4:Z20000',
     });
     await processTab(connection, res3.data.values, 'customer', existingStages);

     console.log(`🎉 นำเข้าข้อมูลลง TiDB สำเร็จทั้งหมดเรียบร้อย!`);
     
  } catch (error) {
     console.error("❌ เกิดข้อผิดพลาด:", error);
  } finally {
     if (connection) {
         await connection.end();
     }
  }
}

async function processTab(connection, rows, tabType, existingStages) {
  if (!rows || rows.length === 0) {
     console.log(`❌ ไม่พบข้อมูลสำหรับแท็บ ${tabType}`);
     return;
  }

  let totalInserted = 0;
  let batchValues = [];

  for (let i = 0; i < rows.length; i++) {
     const row = rows[i];
     
     let phoneIdx = 3; 
     if (tabType === 'qualified' || tabType === 'customer') {
         phoneIdx = 2;
     }

     const rawPhonesString = row[phoneIdx] ? String(row[phoneIdx]) : "";
     const allPhones = extractPhones(rawPhonesString);
     if (allPhones.length === 0) continue;

     const mainPhone = allPhones[0];
     const addPhones = allPhones.slice(1);
     const docId = mainPhone;

     let no = 0;
     let nameText = "ไม่ระบุชื่อ";
     let assigneeRaw = "";
     let stage = 'pool';
     let status = '🆕 รอดำเนินการ';
     
     let q1 = '';
     let q2 = '';
     let q3 = '';
     let q4 = '';
     let q7 = '';
     let q8 = '';
     let q5 = '';
     let q6 = '';
     let botRating = '';
     let botScore = 0;
     
     let latestNote = null;
     let lastCall = null;
     let lastOrder = null;
     let freqAmount = 1;
     let freqUnit = 'สัปดาห์';

     if (tabType === 'coldcall') {
         no = parseInt(row[1]) || 0;
         nameText = row[2] ? row[2].trim() : 'ไม่ระบุชื่อ';
         
         q1 = row[4] ? row[4].trim() : '';
         q2 = row[5] ? row[5].trim() : '';
         q3 = row[6] ? row[6].trim() : '';
         q4 = row[7] ? row[7].trim() : '';
         q7 = row[8] ? row[8].trim() : '';
         q8 = row[9] ? row[9].trim() : '';
         q5 = row[10] ? row[10].trim() : '';
         q6 = row[11] ? row[11].trim() : '';
         botRating = row[12] ? row[12].trim() : '';
         botScore = botRating ? (parseInt(botRating.split('/')[0]) || 0) : 0;
         
         stage = 'pool';
         status = '🆕 รอดำเนินการ';
         
     } else if (tabType === 'qualified') {
         no = parseInt(row[0]) || 0;
         nameText = row[1] ? row[1].trim() : 'ไม่ระบุชื่อ';
         assigneeRaw = row[3] ? row[3].trim().toLowerCase() : "";
         
         q1 = row[6] ? row[6].trim() : '';
         q2 = row[9] ? row[9].trim() : '';
         q4 = row[18] ? row[18].trim() : '';
         q8 = row[21] ? row[21].trim() : '';
         
         stage = 'qualified';
         status = '⏳ รอการตัดสินใจ (Pending)';
         
     } else if (tabType === 'customer') {
         no = parseInt(row[0]) || 0;
         nameText = row[1] ? row[1].trim() : 'ไม่ระบุชื่อ';
         assigneeRaw = row[3] ? row[3].trim().toLowerCase() : "";
         
         status = row[5] ? row[5].trim() : '✅ สั่งซื้อแล้ว';
         latestNote = row[6] ? row[6].trim() : null;
         lastCall = row[7] ? row[7].trim() : null;
         lastOrder = row[8] ? row[8].trim() : null;
         freqAmount = parseInt(row[9]) || 1;
         freqUnit = row[10] ? row[10].trim() : 'สัปดาห์';
         
         stage = 'customer';
     }

     // จัดการ Assignee
     let responsibleId = null;
     if (assigneeRaw) {
        const matched = KNOWN_ADMINS.find(a => assigneeRaw.includes(a.name.toLowerCase()));
        if (matched) {
           responsibleId = matched.id;
           if (stage === 'pool') {
              stage = 'qualified';
              status = '⏳ รอการตัดสินใจ (Pending)';
           }
        }
     }

     if (stage === 'customer' && !responsibleId) {
         responsibleId = 'a4'; // ไนซ์
     }

     // Downgrade Control
     const existingStage = existingStages.get(docId);
     if (existingStage) {
         const stagePriority = { 'customer': 3, 'qualified': 2, 'pool': 1 };
         const currentPriority = stagePriority[existingStage] || 0;
         const newPriority = stagePriority[stage] || 0;
         if (currentPriority > newPriority) {
             continue;
         }
     }

     const now = new Date();

     batchValues.push([
         docId, no, nameText, mainPhone, JSON.stringify(addPhones), stage, status, 'sheet_import', responsibleId, botRating, botScore,
         q1, q2, q3, q4, q7, q8, q5, q6, latestNote, lastCall, lastOrder, freqAmount, freqUnit, now, now
     ]);

     // Insert every 1000 rows
     if (batchValues.length === 1000 || i === rows.length - 1) {
         await connection.query(
             `INSERT INTO coldcall_customers 
             (id, customerNo, name, phone, additionalPhones, stage, status, source, responsibleId, bot_ratingText, bot_score, q1_business, q2_usage, q3_sample, q4_visit, q7_interestVisit, q8_visitAddress, q5_prefTime, q6_addLine, latestFollowUpNote, lastCallDate, lastOrderDate, freqAmount, freqUnit, created_at, updated_at) 
             VALUES ?
             ON DUPLICATE KEY UPDATE 
             customerNo = VALUES(customerNo), name = VALUES(name), additionalPhones = VALUES(additionalPhones), 
             bot_ratingText = VALUES(bot_ratingText), bot_score = VALUES(bot_score), stage = VALUES(stage), status = VALUES(status), responsibleId = VALUES(responsibleId),
             q1_business = VALUES(q1_business), q2_usage = VALUES(q2_usage), q3_sample = VALUES(q3_sample), q4_visit = VALUES(q4_visit), q7_interestVisit = VALUES(q7_interestVisit), q8_visitAddress = VALUES(q8_visitAddress), q5_prefTime = VALUES(q5_prefTime), q6_addLine = VALUES(q6_addLine),
             latestFollowUpNote = VALUES(latestFollowUpNote), lastCallDate = VALUES(lastCallDate), lastOrderDate = VALUES(lastOrderDate), freqAmount = VALUES(freqAmount), freqUnit = VALUES(freqUnit), updated_at = VALUES(updated_at)`,
             [batchValues]
         );
         totalInserted += batchValues.length;
         console.log(`   [${tabType}] ...นำเข้า TiDB ไปแล้ว ${totalInserted} รายการ`);
         batchValues = [];
     }
  }

  console.log(`✅ แท็บ [${tabType}] ลง TiDB สำเร็จทั้งหมด ${totalInserted} รายการ!`);
}

syncToTiDB();
