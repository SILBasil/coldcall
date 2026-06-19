import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, writeBatch, serverTimestamp, getDocs, query, select } from "firebase/firestore";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function runSync() {
  console.log("🚀 เริ่มต้นกระบวนการดึงข้อมูลจาก Google Sheets (3 แท็บ) ลงระบบ...");

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

    // ดึงสถานะปัจจุบันของลูกค้าทั้งหมดมารอไว้
    console.log(`🔍 กำลังอ่านสถานะปัจจุบันของลูกค้าบนระบบ...`);
    const existingSnap = await getDocs(collection(db, COL_CUSTOMERS));
    const existingStages = new Map();
    existingSnap.docs.forEach(d => existingStages.set(d.id, d.data().stage));

    // 1. ดึงสำเนาข้อมูลcoldcall
    console.log(`📥 กำลังดึงข้อมูลจากแท็บ: สำเนาข้อมูลcoldcall...`);
    const res1 = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'สำเนาข้อมูลcoldcall!A2:N20000',
    });
    await processTab(res1.data.values, 'coldcall', existingStages);

    // 2. ดึง 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด
    console.log(`📥 กำลังดึงข้อมูลจากแท็บ: 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด...`);
    const res2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: '2.ลูกค้าใหม่ที่ยังไม่เคยเปิด!A4:Z20000',
    });
    await processTab(res2.data.values, 'qualified', existingStages);

    // 3. ดึง 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว
    console.log(`📥 กำลังดึงข้อมูลจากแท็บ: 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว...`);
    const res3 = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: '3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว!A4:Z20000',
    });
    await processTab(res3.data.values, 'customer', existingStages);

    console.log(`🎉 ดึงข้อมูลและอัปเดตลง Firestore สำเร็จทั้งหมดเรียบร้อย!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    process.exit(1);
  }
}

async function processTab(rows, tabType, existingStages = new Map()) {
  if (!rows || rows.length === 0) {
    console.log(`ไม่พบข้อมูลให้ดึงสำหรับแท็บ ${tabType}`);
    return;
  }

  let currentBatch = writeBatch(db);
  let batchCount = 0;
  let totalImported = 0;

  for (const row of rows) {
    let phoneIdx = 3; 
    if (tabType === 'qualified' || tabType === 'customer') {
        phoneIdx = 2;
    }

    const rawPhonesString = row[phoneIdx] ? String(row[phoneIdx]) : "";
    const allPhones = extractPhones(rawPhonesString);
    if (allPhones.length === 0) continue;

    const primaryPhone = allPhones[0];
    const additionalPhones = allPhones.slice(1);

    let no = "";
    let name = "ไม่ระบุชื่อ";
    let assigneeRaw = "";
    let stage = 'pool';
    let status = '🆕 รอดำเนินการ';
    let type = 'ยังไม่เคยเปิดบิล';
    let customFields = {};

    if (tabType === 'coldcall') {
        no = row[1] ? String(row[1]).trim() : "";
        name = row[2] ? String(row[2]).trim() : "ไม่ระบุชื่อ";
        
        customFields.q1_business = row[4] ? String(row[4]).trim() : "";
        customFields.q2_usage = row[5] ? String(row[5]).trim() : "";
        customFields.q3_sample = row[6] ? String(row[6]).trim() : "";
        customFields.q4_visit = row[7] ? String(row[7]).trim() : "";
        customFields.q7_interestVisit = row[8] ? String(row[8]).trim() : "";
        customFields.q8_visitAddress = row[9] ? String(row[9]).trim() : "";
        customFields.q5_prefTime = row[10] ? String(row[10]).trim() : "";
        customFields.q6_addLine = row[11] ? String(row[11]).trim() : "";
        
        const rawScore = row[12] ? String(row[12]) : "0/5";
        customFields.bot_ratingText = row[12] ? String(row[12]).trim() : "";
        customFields.bot_score = parseInt(rawScore.split('/')[0]) || 0;
        
        stage = 'pool';
        status = '🆕 รอดำเนินการ';
        type = 'ยังไม่เคยเปิดบิล';
        
    } else if (tabType === 'qualified') {
        no = row[0] ? String(row[0]).trim() : "";
        name = row[1] ? String(row[1]).trim() : "ไม่ระบุชื่อ";
        assigneeRaw = row[3] ? String(row[3]).trim().toLowerCase() : "";
        
        if (row[6]) customFields.q1_business = String(row[6]).trim();
        if (row[9]) customFields.q2_usage = String(row[9]).trim();
        if (row[18]) customFields.q4_visit = String(row[18]).trim();
        if (row[21]) customFields.q8_visitAddress = String(row[21]).trim();
        
        stage = 'qualified';
        status = '⏳ รอการตัดสินใจ (Pending)';
        type = 'ยังไม่เคยเปิดบิล';
        
    } else if (tabType === 'customer') {
        no = row[0] ? String(row[0]).trim() : "";
        name = row[1] ? String(row[1]).trim() : "ไม่ระบุชื่อ";
        assigneeRaw = row[3] ? String(row[3]).trim().toLowerCase() : "";
        
        type = row[4] ? String(row[4]).trim() : 'เคยสั่งซื้อแล้ว';
        
        if (type === 'เคยสั่งซื้อแล้ว' || type.includes('เคยสั่งซื้อ')) {
            stage = 'customer';
            status = row[5] ? String(row[5]).trim() : '✅ สั่งซื้อแล้ว';
        } else {
            stage = 'qualified';
            status = row[5] ? String(row[5]).trim() : '⏳ รอการตัดสินใจ (Pending)';
        }
        
        if (row[6]) customFields.latestFollowUpNote = String(row[6]).trim();
        if (row[7]) customFields.lastCallDate = String(row[7]).trim();
        if (row[8]) customFields.lastOrderDate = String(row[8]).trim();
        
        customFields.freqAmount = parseInt(row[9]) || 1;
        customFields.freqUnit = row[10] ? String(row[10]).trim() : 'สัปดาห์';
    }

    // จัดการเรื่องสถานะ Assignee
    let responsibleId = null;
    let responsibleName = "Unassigned";
    if (assigneeRaw) {
       const matched = KNOWN_ADMINS.find(a => assigneeRaw.includes(a.name.toLowerCase()));
       if (matched) {
          responsibleId = matched.id;
          responsibleName = matched.fullName;
          if (stage === 'pool') {
             stage = 'qualified';
             status = '⏳ รอการตัดสินใจ (Pending)';
          }
       }
    }

    // Downgrade Control
    const existingStage = existingStages.get(primaryPhone);
    if (existingStage) {
        const stagePriority = { 'customer': 3, 'qualified': 2, 'pool': 1 };
        const currentPriority = stagePriority[existingStage] || 0;
        const newPriority = stagePriority[stage] || 0;
        
        if (currentPriority > newPriority) {
            continue; 
        }
    }

    const docId = primaryPhone;
    const docRef = doc(db, COL_CUSTOMERS, docId);

    const customerData = {
      customerNo: no,
      name: name,
      phone: primaryPhone,
      additionalPhones: additionalPhones,
      stage: stage,
      status: status,
      type: type,
      updatedAt: serverTimestamp(),
      ...customFields
    };

    if (!existingStage) {
      customerData.createdAt = serverTimestamp();
    }

    if (stage === 'customer' && !responsibleId) {
        responsibleId = 'a4';
        responsibleName = 'แอดมิน ไนซ์';
    }

    if (responsibleId) {
        customerData.responsibleId = responsibleId;
        customerData.responsibleName = responsibleName;
    } else {
        customerData.responsibleId = null;
        customerData.responsibleName = "Unassigned";
    }

    currentBatch.set(docRef, customerData, { merge: true });
    existingStages.set(primaryPhone, stage);
    
    batchCount++;
    totalImported++;

    if (batchCount === 490) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      batchCount = 0;
      console.log(`   [${tabType}] ...อัปโหลดไปแล้ว ${totalImported} รายการ`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  if (batchCount > 0) {
    await currentBatch.commit();
  }

  console.log(`✅ แท็บ [${tabType}] โหลดเสร็จสิ้นสมบูรณ์ รวม ${totalImported} รายการ`);
}

runSync();
