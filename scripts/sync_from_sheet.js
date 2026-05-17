import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load Environment Variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCyJuWH6NYUIehFib7NVBGkLGG7vhKuv9g",
  authDomain: "catalogue21-92e8b.firebaseapp.com",
  projectId: "catalogue21-92e8b",
  storageBucket: "catalogue21-92e8b.firebasestorage.app",
  messagingSenderId: "828111651708",
  appId: "1:828111651708:web:4fbad148fc3e30e1cc2cbd",
  measurementId: "G-GMDD62SYD0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';
const COL_CUSTOMERS = 'coldcall_customers';

async function runSync() {
  console.log("🚀 เริ่มต้นกระบวนการดึงข้อมูลจาก Google Sheets ลงระบบ...");

  try {
    const credsPath = path.join(__dirname, '..', 'creds.json');
    if (!fs.existsSync(credsPath)) {
       throw new Error(`ไม่พบไฟล์ creds.json ที่โฟลเดอร์รัน! (Path: ${credsPath})`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const targetTab = '1.ข้อมูลVlookup';
    const range = `${targetTab}!A2:L`; 

    console.log(`📥 กำลังดึงข้อมูลจากแท็บ: ${targetTab}...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log(`ไม่พบข้อมูลให้ดึง`);
      return;
    }

    console.log(`✅ พบรายชื่อทั้งหมด ${rows.length} เบอร์ จาก Google Sheet กำลังอัปเดตลง Database...`);

    let currentBatch = writeBatch(db);
    let batchCount = 0;
    let totalImported = 0;

    // List of known admins for fuzzy match
    const KNOWN_ADMINS = [
      { name: "พลอย", id: "a1", fullName: "แอดมิน พลอย" },
      { name: "ก้อง", id: "a2", fullName: "แอดมิน ก้อง" },
      { name: "แนน", id: "a3", fullName: "แอดมิน แนน" },
      { name: "บอย", id: "a4", fullName: "แอดมิน บอย" },
      { name: "ใหม่", id: "a5", fullName: "แอดมิน ใหม่" },
      { name: "Toey", id: "a2", fullName: "แอดมิน Toey" } // Using Toey mapping to a2 for now if it exists, or just use generic logic
    ];

    for (const row of rows) {
      // row[0] No
      // row[1] Name
      // row[2] Phone
      // row[3] Assignee
      // row[4] Q1
      // row[5] Q2
      // row[6] Q3
      // row[7] Q4
      // row[8] Q5
      // row[9] Q6
      // row[10] Rating (like 5/5)
      // row[11] Score
      
      const no = row[0] ? String(row[0]).trim() : "";
      const rawPhonesString = row[2] ? String(row[2]) : "";
      
      // Extract all phone numbers using regex
      const phoneMatches = rawPhonesString.match(/[0-9]{9,10}/g);
      if (!phoneMatches || phoneMatches.length === 0) continue;
      
      let allPhones = phoneMatches.map(p => {
        let clean = p.replace(/[^0-9]/g, '');
        if (clean.startsWith('66')) clean = '0' + clean.slice(2);
        return clean;
      });

      const primaryPhone = allPhones[0];
      const additionalPhones = allPhones.slice(1);

      const rawScore = row[11] ? String(row[11]) : "0/5";
      const scoreNum = parseInt(rawScore.split('/')[0]) || 0;
      
      // Admin Assignment
      const assigneeRaw = row[3] ? String(row[3]).trim().toLowerCase() : "";
      let responsibleId = null;
      let responsibleName = "Unassigned";
      let stage = 'pool';
      let status = '🆕 เบอร์ใหม่';
      
      if (assigneeRaw) {
         const matched = KNOWN_ADMINS.find(a => assigneeRaw.includes(a.name.toLowerCase()));
         if (matched) {
            responsibleId = matched.id;
            responsibleName = matched.fullName;
            stage = 'qualified'; // Assign immediately to qualified list
            status = '⏳ รอการตัดสินใจ';
         }
      }

      const customerData = {
        customerNo: no,
        name: row[1] ? String(row[1]).trim() : "",
        phone: primaryPhone,
        additionalPhones: additionalPhones,
        
        // Q&A
        q1_business: row[4] ? String(row[4]).trim() : "",
        q2_usage: row[5] ? String(row[5]).trim() : "",
        q3_sample: row[6] ? String(row[6]).trim() : "",
        q4_visit: row[7] ? String(row[7]).trim() : "",
        q5_prefTime: row[8] ? String(row[8]).trim() : "",
        q6_addLine: row[9] ? String(row[9]).trim() : "",
        
        bot_ratingText: row[10] ? String(row[10]).trim() : "",
        bot_score: scoreNum,
        
        stage: stage,
        status: status,
        responsibleId,
        responsibleName,
        type: 'ยังไม่เคยเปิดบิล',
        updatedAt: serverTimestamp()
      };

      const docId = `pool_${primaryPhone}`;
      const docRef = doc(db, COL_CUSTOMERS, docId);
      
      // Merge: true ทำให้ถ้าเบอร์เก่าเคยมีในระบบ จะเป็นการอัปเดตฟิลด์ใหม่ (ประเภทธุรกิจ บลาๆ) เข้าไปหา ไม่ลบข้อมูลแอดมินเดิม
      currentBatch.set(docRef, customerData, { merge: true });
      
      batchCount++;
      totalImported++;

      if (batchCount === 495) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchCount = 0;
        console.log(`...อัปโหลดไปแล้ว ${totalImported} รายการ (กำลังหยุดพัก 2 วินาทีกันระบบบล็อก...)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (batchCount > 0) {
      await currentBatch.commit();
    }

    console.log(`🎉 ดึงข้อมูลเสร็จสิ้นสมบูรณ์! อัปเดต/เพิ่ม เข้าคลังเบอร์สำเร็จรวม ${totalImported} เบอร์!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    process.exit(1);
  }
}

runSync();
