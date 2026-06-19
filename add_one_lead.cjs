const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'creds.json');
const PROJECT_ID = 'catalogue21-92e8b';
const CUSTOMERS_COL = 'coldcall_customers';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ ไม่พบ creds.json');
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
  projectId: PROJECT_ID
});

const db = admin.firestore();

async function addOneLead() {
    const phone = '0812345678'; // เบอร์ทดสอบ
    const docRef = db.collection(CUSTOMERS_COL).doc(phone);

    await docRef.set({
        name: 'บริษัท ทดสอบระบบ จำกัด',
        phone: phone,
        customerNo: 'TEST001',
        stage: 'pool',
        status: '🆕 เบอร์ใหม่',
        type: 'เบอร์ใหม่',
        additionalPhones: [],
        responsibleId: null,
        responsibleName: 'Unassigned',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ เพิ่มเบอร์ ${phone} เข้าคลัง (Pool) สำเร็จ!`);
    console.log(`   ชื่อ: บริษัท ทดสอบระบบ จำกัด`);
    console.log(`   Stage: pool`);
    setTimeout(() => process.exit(0), 1000);
}

addOneLead().catch(err => {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
});
