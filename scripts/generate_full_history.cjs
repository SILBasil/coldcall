const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 1. Setup Firebase
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

// 2. Helper Functions
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  process.nextTick(() => deleteQueryBatch(query, resolve));
}

// Data Lists
const FIRST_NAMES = ["สมชาย", "สมหญิง", "กิตติ", "มานี", "ปิติ", "ชูใจ", "วีระ", "วิชัย", "ณัฐพงศ์", "สุปราณี", "พรศักดิ์", "สุชาติ", "นฤมล", "อรัญญา", "จิรายุ", "อภิสิทธิ์", "ธนากร", "ศรราม"];
const LAST_NAMES = ["รักดี", "ใจบุญ", "มีทรัพย์", "ยิ่งรวย", "ประกอบผล", "ไพศาล", "พานิช", "รุ่งเรือง", "แสงทอง"];
const LOG_FOLLOWUP = ['ยุ่งอยู่ ไว้โทรใหม่ความหน้า', 'ขอปรึกษาแฟนก่อน', 'ขอคิดดูก่อน', 'ส่งข้อมูลเข้าไลน์แล้วให้ทักมาอีกที'];
const LOG_WON = ['ปิดยอดแล้วจ้า โอนไวมาก', 'ตกลงสั่งแบบ 2 แถม 1', 'รับ 1 กล่องลองทาน', 'สั่งเพิ่มชุดเดิม'];
const LOG_LOST = ['ราคาแรงไป', 'ยังไม่พร้อมตอนนี้', 'แพ้ส่วนผสมบางตัว', 'กินตัวอื่นอยู่', 'โทรไปแล้วบล็อกเบอร์'];

// Process dates
// We will generate data from Jan 1st 2026 to Mid-April 2026
const START_DATE = new Date(2026, 0, 1);
const CURRENT_DATE = new Date(2026, 3, 21); // April 21, 2026 (Local test date)
const TOTAL_DAYS = Math.floor((CURRENT_DATE - START_DATE) / (1000 * 60 * 60 * 24));

async function seedHistory() {
    console.log('🔥 Wiping old data. This might take a minute...');
    await deleteCollection(CUSTOMERS_COL, 500);
    console.log('✅ Wiped customers!');
    await deleteCollection(LOGS_COL, 500);
    console.log('✅ Wiped logs!');

    console.log('🚀 Generating Full History (Jan 1 -> April 21, 2026)...');

    let totalCustomers = 0;
    let totalLogs = 0;
    
    // Day by day simulation
    for (let dayOffset = 0; dayOffset <= TOTAL_DAYS; dayOffset++) {
        let batch = db.batch();
        const simDate = new Date(START_DATE);
        simDate.setDate(START_DATE.getDate() + dayOffset);
        simDate.setHours(9, 0, 0, 0); // Start of working day

        // If it's a weekend, rarely add data
        const isWeekend = simDate.getDay() === 0 || simDate.getDay() === 6;
        const newLeadsCount = isWeekend ? getRandomInt(0, 2) : getRandomInt(10, 25);

        for (let i = 0; i < newLeadsCount; i++) {
            const phone = "0" + getRandomInt(6, 9) + getRandomInt(10000000, 99999999);
            const name = getRandomItem(FIRST_NAMES) + " " + getRandomItem(LAST_NAMES);

            // Assign to 'a4' (Nice) most of the time to ensure visible data
            const isAdminA4 = Math.random() < 0.7;
            const responsibleId = isAdminA4 ? 'a4' : 'a1';
            const responsibleName = isAdminA4 ? 'แอดมิน ไนซ์' : 'แอดมิน ข้าวฟ่าง';

            const cData = {
                customerNo: "H" + String(totalCustomers).padStart(4, '0'),
                name: name,
                phone: phone,
                stage: 'qualified', // Start as new lead
                status: '⏳ รอการตัดสินใจ',
                type: 'ยังไม่เคยเปิดบิล',
                responsibleId: responsibleId,
                responsibleName: responsibleName,
                createdAt: admin.firestore.Timestamp.fromDate(simDate),
                updatedAt: admin.firestore.Timestamp.fromDate(simDate),
            };

            const docHistory = {
                // Tracking future events for this user to happen further down the timeline
                events: []
            };

            // Simulate the life-cycle of this lead
            let lastEventDate = new Date(simDate);
            let closed = false;
            let loopCount = 0;

            // Generate 1-4 events for this new lead
            while (!closed && loopCount < 4) {
                lastEventDate = new Date(lastEventDate);
                lastEventDate.setDate(lastEventDate.getDate() + getRandomInt(1, 3)); // 1-3 days later
                lastEventDate.setHours(getRandomInt(9, 18), getRandomInt(0, 59), 0, 0);

                if (lastEventDate > CURRENT_DATE) break; // Don't generate in the future!

                const isFinal = loopCount === 3 || Math.random() < 0.4;
                if (isFinal) {
                    closed = true;
                    const isWon = Math.random() < 0.35; // 35% win rate
                    docHistory.events.push({
                        date: new Date(lastEventDate),
                        type: 'save',
                        outcome: isWon ? 'won' : 'lost',
                        comment: isWon ? getRandomItem(LOG_WON) : getRandomItem(LOG_LOST),
                        reasons: isWon ? [] : [getRandomItem(LOG_LOST)]
                    });

                    // If won, update customer doc fields that will be saved below
                    if (isWon) {
                        cData.stage = 'customer';
                        cData.status = '✅ สั่งซื้อแล้ว';
                        cData.type = 'ลูกค้าเก่า';
                        cData.wonAt = admin.firestore.Timestamp.fromDate(lastEventDate);
                        cData.updatedAt = admin.firestore.Timestamp.fromDate(lastEventDate);
                        
                        // Set retention frequency (7, 14, 30 days)
                        const freqs = [7, 14, 30];
                        cData.followUpFrequencyDays = getRandomItem(freqs);

                        // Schedule retention events
                        let retentionDate = new Date(lastEventDate);
                        while (true) {
                            retentionDate = new Date(retentionDate);
                            retentionDate.setDate(retentionDate.getDate() + cData.followUpFrequencyDays);
                            retentionDate.setHours(getRandomInt(9, 18), getRandomInt(0, 59), 0, 0);
                            
                            if (retentionDate > CURRENT_DATE) break;

                            const retWon = Math.random() < 0.4;
                            docHistory.events.push({
                                date: new Date(retentionDate),
                                type: 'save',
                                outcome: retWon ? 'ordered' : 'notInterested',
                                comment: retWon ? 'สั่งซื้อเพิ่มชุดเดิม' : 'ยังไม่พร้อม รับชุดใหม่เลย',
                                customerStage: 'customer' // Indicates it's a retention action
                            });
                            cData.updatedAt = admin.firestore.Timestamp.fromDate(retentionDate); // Keep updated
                        }
                    } else {
                        // Lost
                        cData.lostAt = admin.firestore.Timestamp.fromDate(lastEventDate);
                        cData.updatedAt = admin.firestore.Timestamp.fromDate(lastEventDate);
                        cData.status = '❌ ปฏิเสธการซื้อ';
                    }
                } else {
                    // Just follow up
                    docHistory.events.push({
                        date: new Date(lastEventDate),
                        type: 'call',
                        outcome: 'pending',
                        comment: getRandomItem(LOG_FOLLOWUP)
                    });
                    cData.updatedAt = admin.firestore.Timestamp.fromDate(lastEventDate);
                }
                loopCount++;
            }

            // Save Customer
            const custRef = db.collection(CUSTOMERS_COL).doc(phone);
            batch.set(custRef, cData);
            totalCustomers++;

            // Save generated Logs
            for (const ev of docHistory.events) {
                const logRef = db.collection(LOGS_COL).doc();
                batch.set(logRef, {
                    adminId: responsibleId,
                    adminName: responsibleName,
                    customerId: phone, // using phone as ID
                    customerName: name,
                    customerPhone: phone,
                    customerStage: ev.customerStage || 'qualified',
                    timestamp: admin.firestore.Timestamp.fromDate(ev.date),
                    type: ev.type,
                    action: ev.type === 'call' ? 'โทรออก' : 'บันทึกข้อมูล',
                    comment: ev.comment,
                    outcome: ev.outcome,
                    reasons: ev.reasons || []
                });
                totalLogs++;
            }
        }
        await batch.commit();

        if (dayOffset % 10 === 0) {
            process.stdout.write(`\r📅 Processing Date: ${simDate.toDateString()} | Customers: ${totalCustomers} | Logs: ${totalLogs}`);
        }
    }

    console.log(`\n\n🎉 Done creating history! \nTotal Customers: ${totalCustomers}\nTotal Logs: ${totalLogs}`);
    process.exit(0);
}

seedHistory();
