import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Read from .env copy specifically since TiDB keys are there
dotenv.config({ path: '.env copy' });

const SPREADSHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';
const RANGE = '1.ข้อมูลVlookup!A:Z'; 

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

async function syncToTiDB() {
  console.log("🚀 เริ่มต้นกระบวนการเชื่อมต่อ TiDB และดึง Sheet...");
  
  let connection;
  try {
     connection = await mysql.createConnection(dbConfig);
     console.log("✅ เชื่อมต่อ TiDB สำเร็จ");

     // สร้างตารางถ้ายังไม่มี
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
            q5_prefTime TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            q6_addLine TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
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
     const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
     });

     const rows = response.data.values;
     if (!rows || rows.length === 0) {
        console.log('❌ ไม่พบข้อมูลใน Google Sheet');
        return;
     }

     const headers = rows[0];
     const dataRows = rows.slice(1);
     console.log(`✅ พบรายชื่อทั้งหมด ${dataRows.length} เบอร์ จาก Sheet...`);

     let totalInserted = 0;
     let batchValues = [];

     for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        const no = parseInt(row[0]) || 0;
        const nameText = row[1] ? row[1].trim() : '';
        const phoneRaw = row[2] ? row[2].replace(/\D/g, '') : '';
        
        if (!nameText && !phoneRaw) continue;

        let mainPhone = '';
        const addPhones = [];
        const matches = phoneRaw.match(/\d{9,10}/g);
        if (matches && matches.length > 0) {
            mainPhone = matches[0];
            for (let i = 1; i < matches.length; i++) {
                addPhones.push(matches[i]);
            }
        } else {
            mainPhone = phoneRaw;
        }

        const docId = mainPhone ? `pool_${mainPhone}` : `pool_no_${no}`;
        
        const q1 = row[4] ? row[4].trim() : '';
        const q2 = row[5] ? row[5].trim() : '';
        const q3 = row[6] ? row[6].trim() : '';
        const q4 = row[7] ? row[7].trim() : '';
        const q5 = row[8] ? row[8].trim() : '';
        const q6 = row[9] ? row[9].trim() : '';
        const botRating = row[10] ? row[10].trim() : '';
        const botScoreStr = row[11] ? row[11].replace(/\D/g, '') : '';
        const botScore = botScoreStr ? parseInt(botScoreStr) : 0;

        const stage = "pool";
        const status = "รอติดต่อ";
        const now = new Date();

        batchValues.push([
            docId, no, nameText, mainPhone, JSON.stringify(addPhones), stage, status, 'sheet_import', null, botRating, botScore,
            q1, q2, q3, q4, q5, q6, now, now
        ]);

        // Insert every 1000 rows
        if (batchValues.length === 1000 || i === dataRows.length - 1) {
            await connection.query(
                `INSERT INTO coldcall_customers 
                (id, customerNo, name, phone, additionalPhones, stage, status, source, responsibleId, bot_ratingText, bot_score, q1_business, q2_usage, q3_sample, q4_visit, q5_prefTime, q6_addLine, created_at, updated_at) 
                VALUES ?
                ON DUPLICATE KEY UPDATE 
                customerNo = VALUES(customerNo), name = VALUES(name), additionalPhones = VALUES(additionalPhones), 
                bot_ratingText = VALUES(bot_ratingText), bot_score = VALUES(bot_score), 
                q1_business = VALUES(q1_business), q2_usage = VALUES(q2_usage), q3_sample = VALUES(q3_sample), q4_visit = VALUES(q4_visit), q5_prefTime = VALUES(q5_prefTime), q6_addLine = VALUES(q6_addLine), updated_at = VALUES(updated_at)`,
                [batchValues]
            );
            totalInserted += batchValues.length;
            console.log(`...นำเข้า TiDB ไปแล้ว ${totalInserted} รายการ`);
            batchValues = [];
        }
     }

     console.log(`🎉 นำเข้าข้อมูลลง TiDB สำเร็จทั้งหมด ${totalInserted} รายการ!`);
     
  } catch (error) {
     console.error("❌ เกิดข้อผิดพลาด:", error);
  } finally {
     if (connection) {
         await connection.end();
     }
  }
}

syncToTiDB();
