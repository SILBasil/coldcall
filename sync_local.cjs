const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// 1. ตั้งค่าพื้นฐาน
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'creds.json');
const PROJECT_ID = 'catalogue21-92e8b'; 
const SPREADSHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';
const CUSTOMERS_COL = 'coldcall_customers';

// 2. ตรวจสอบไฟล์ Creds
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`❌ ไม่พบไฟล์ creds.json ที่: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// 3. Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID
  });
}

const db = admin.firestore();

const KNOWN_ADMINS = [
  { name: "ข้าวฟ่าง", id: "a1", fullName: "แอดมิน ข้าวฟ่าง" },
  { name: "ทิม", id: "a2", fullName: "แอดมิน ทิม" },
  { name: "ธีร์", id: "a3", fullName: "แอดมิน ธีร์" },
  { name: "ไนซ์", id: "a4", fullName: "แอดมิน ไนซ์" },
  { name: "พลอย", id: "a5", fullName: "แอดมิน พลอย" },
  { name: "toey", id: "a6", fullName: "แอดมิน Toey" }
];

// ฟังก์ชันสกัดและจัดฟอร์แมตเบอร์โทรศัพท์ (สกัดหลายเบอร์ได้)
function extractPhones(raw) {
    if (!raw) return [];
    const parts = String(raw).split(/[,\/\\\n;]|\s+และ\s+|\s+or\s+/i);
    const validPhones = [];
    
    for (let part of parts) {
        let clean = part.replace(/[^0-9]/g, '');
        if (!clean) continue;
        
        // แปลงรหัส 66 -> 0
        if (clean.startsWith('66')) {
            clean = '0' + clean.slice(2);
        }
        
        // เติม 0 เบอร์มือถือ 9 หลัก
        if (clean.length === 9 && /^[8965]/.test(clean)) {
            clean = '0' + clean;
        }
        
        // เติม 0 เบอร์บ้าน 8 หลัก
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

async function syncAll() {
    console.log('🚀 เริ่มกระบวนการ Local Sync แบบ Full Data จาก 3 แท็บ...');
    
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // ดึงสถานะปัจจุบันของลูกค้าทั้งหมดมารอไว้ เพื่อป้องกันไม่ให้ข้อมูลลดระดับความสำคัญ
        console.log(`🔍 กำลังอ่านสถานะปัจจุบันของลูกค้าบนระบบ...`);
        const existingSnap = await db.collection(CUSTOMERS_COL).select('stage').get();
        const existingStages = new Map();
        existingSnap.docs.forEach(d => existingStages.set(d.id, d.data().stage));

        // 1. ดึงสำเนาข้อมูลcoldcall (บ่อพัก)
        console.log(`📖 กำลังอ่านหน้า: สำเนาข้อมูลcoldcall ...`);
        const response1 = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `สำเนาข้อมูลcoldcall!A2:N20000`, 
        });
        await processRows(response1.data.values, 'coldcall', existingStages);

        // 2. ดึง 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด (ลูกค้ารอตัดสินใจ)
        console.log(`📖 กำลังอ่านหน้า: 2.ลูกค้าใหม่ที่ยังไม่เคยเปิด (qualified) ...`);
        const response2 = await sheets.spreadsheets.values.get({
           spreadsheetId: SPREADSHEET_ID,
           range: `2.ลูกค้าใหม่ที่ยังไม่เคยเปิด!A4:Z20000`, 
        });
        await processRows(response2.data.values, 'qualified', existingStages);

        // 3. ดึง 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว (ลูกค้าซื้อซ้ำ/เก่า)
        console.log(`📖 กำลังอ่านหน้า: 3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว (customer) ...`);
        const response3 = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว!A4:Z20000`, 
        });
        await processRows(response3.data.values, 'customer', existingStages);

        console.log(`🎉 ภารกิจเสร็จสิ้น! นำเข้าข้อมูลและจัดตำแหน่งเสร็จสิ้นสมบูรณ์`);
        console.log('ปิดระบบใน 3 วินาที...');
        setTimeout(() => process.exit(0), 3000);

    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดร้ายแรง:');
        console.error(error.message);
        process.exit(1);
    }
}

async function processRows(rows, tabType, existingStages = new Map()) {
    if (!rows || rows.length === 0) {
        console.log(`⚠️ ไม่พบข้อมูลสำหรับแท็บ ${tabType}`);
        return;
    }

    let batch = db.batch();
    let count = 0;
    let phaseCount = 0;

    for (const row of rows) {
        // ดึงเบอร์โทรศัพท์และทำความสะอาดตามประเภทหน้า
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

        // --- ควบคุมการทับซ้อนและลำดับความสำคัญของแต่ละ Stage ---
        const existingStage = existingStages.get(primaryPhone);
        if (existingStage) {
            const stagePriority = { 'customer': 3, 'qualified': 2, 'pool': 1 };
            const currentPriority = stagePriority[existingStage] || 0;
            const newPriority = stagePriority[stage] || 0;
            
            if (currentPriority > newPriority) {
                // ห้ามถอยกลับ (Downgrade Control)
                continue; 
            }
        }

        const docRef = db.collection(CUSTOMERS_COL).doc(primaryPhone);
        
        const customerData = {
            customerNo: no,
            name: name,
            phone: primaryPhone,
            additionalPhones: additionalPhones,
            stage: stage,
            status: status,
            type: type,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            ...customFields
        };

        if (!existingStage) {
            customerData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }

        // Demo Hack: ลูกค้าประจำที่ไม่มีผู้รับผิดชอบ ให้ไนซ์ (a4) ดูแล
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

        batch.set(docRef, customerData, { merge: true });
        existingStages.set(primaryPhone, stage);

        count++;
        phaseCount++;

        if (count >= 450) {
            await batch.commit();
            process.stdout.write(`| [${tabType}] บันทึกแล้ว ${phaseCount} รายการ...\r`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }
    console.log(`\n✨ หน้า [${tabType}] เสร็จสมบูรณ์! (นำเข้า ${phaseCount} รายการ)`);
}

syncAll();
