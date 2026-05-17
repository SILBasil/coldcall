const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 1. Setup
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'creds.json');
const CUSTOMERS_COL = 'coldcall_customers';
const LOGS_COL = 'coldcall_logs';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`❌ Missing creds.json at: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Target Admin: Nice (a4)
const TARGET_ADMIN_ID = 'a4';
const TARGET_ADMIN_NAME = 'แอดมิน ไนซ์';

// Helpers
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generatePastDate = (weeksAgo, dayOfWeek = null) => {
    const d = new Date();
    // Move back weeks
    d.setDate(d.getDate() - (weeksAgo * 7));
    
    // If specific day of week (0=Sun, 1=Mon)
    if (dayOfWeek !== null) {
        const currentDay = d.getDay();
        const diff = dayOfWeek - currentDay;
        d.setDate(d.getDate() + diff);
    } else {
        // Random day in that week
        d.setDate(d.getDate() - getRandomInt(0, 6));
    }
    
    d.setHours(getRandomInt(9, 18), getRandomInt(0, 59), 0, 0);
    return d;
};

const SUCCESS_COMMENTS = ['ปิดยอดแล้วครับลูกค้าโอนไว', 'ลูกค้าตกลงสั่งซื้อเรียบร้อย', 'ปิดยอด โอนเงินแล้ว', 'สั่งซื้อเพิ่ม 2 กล่อง', 'โอนเงินเรียบร้อยครับ'];
const LOST_COMMENTS = ['ลูกค้าขอดูเจ้าอื่นก่อน', 'ราคาแพงไป', 'ยังไม่สะดวกคุย', 'บล็อกเบอร์ไปแล้ว', 'ลูกค้าแจ้งว่ามีของเจ้าเดิมอยู่เยอะ'];
const FOLLOWUP_COMMENTS = ['ยุ่งอยู่ ไว้โทรใหม่พรุ่งนี้', 'รอปรึกษาแฟน', 'ขอคิดดูก่อน', 'ส่งแคตตาล็อกให้แล้วในไลน์', 'ยังไม่รับสาย เดี๋ยวโทรซ้ำ'];
const REASONS = ['ราคาแรง', 'มีเจ้าประจำยู่แล้ว', 'ไม่ว่างคุย', 'ติดปัญหาขนส่ง', 'ลองใช้ตัวอย่างก่อน'];

async function seedHistory() {
    console.log('🚀 Seeding Historical Demo Data for "Nice" (a4)...');

    // 1. Fetch some of Nice's leads
    const snap = await db.collection(CUSTOMERS_COL)
        .where('responsibleId', '==', TARGET_ADMIN_ID)
        .limit(600)
        .get();

    if (snap.empty) {
        console.log('❌ No leads found for admin a4. Run sync_local.cjs first!');
        process.exit(1);
    }

    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`📦 Found ${leads.length} leads to jitter.`);

    let batch = db.batch();
    let count = 0;
    let logCount = 0;

    // Distribute leads across 4 weeks
    for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const weeksAgo = i % 4; // 0, 1, 2, 3 weeks ago
        const createdAt = generatePastDate(weeksAgo);
        
        // Update the lead's creation date
        const leadRef = db.collection(CUSTOMERS_COL).doc(lead.id);
        batch.update(leadRef, {
            createdAt: admin.firestore.Timestamp.fromDate(createdAt),
            updatedAt: admin.firestore.Timestamp.fromDate(createdAt)
        });

        // Potentially create logs for this lead in its creation week
        const shouldHaveLog = Math.random() > 0.4;
        if (shouldHaveLog) {
            const numLogs = getRandomInt(1, 3);
            for (let j = 0; j < numLogs; j++) {
                const logType = Math.random() > 0.3 ? 'save' : 'call';
                const logDate = new Date(createdAt);
                logDate.setHours(logDate.getHours() + j + 1); // A bit later

                let comment = getRandomItem(FOLLOWUP_COMMENTS);
                let outcome = 'pending';
                let reasons = [];

                if (logType === 'save') {
                    const coin = Math.random();
                    if (coin > 0.8) {
                        comment = getRandomItem(SUCCESS_COMMENTS);
                        outcome = 'won';
                    } else if (coin > 0.6) {
                        comment = getRandomItem(LOST_COMMENTS);
                        outcome = 'lost';
                        reasons = [getRandomItem(REASONS)];
                    }
                }

                const logRef = db.collection(LOGS_COL).doc();
                batch.set(logRef, {
                    adminId: TARGET_ADMIN_ID,
                    adminName: TARGET_ADMIN_NAME,
                    customerId: lead.id,
                    customerName: lead.name,
                    customerPhone: lead.phone,
                    customerStage: lead.stage,
                    timestamp: admin.firestore.Timestamp.fromDate(logDate),
                    type: logType,
                    action: logType === 'call' ? 'โทรออก' : 'บันทึกข้อมูล',
                    comment: comment,
                    outcome: outcome,
                    reasons: reasons
                });
                logCount++;
            }
        }

        count++;
        if (count >= 400) {
            await batch.commit();
            console.log(`| Processed ${count} leads and ${logCount} logs...`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`\n✅ Done! Jittered ${leads.length} leads and created ${logCount} historical logs.`);
    process.exit(0);
}

seedHistory();
