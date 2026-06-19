const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'creds.json');
const PROJECT_ID = 'catalogue21-92e8b'; 
const CUSTOMERS_COL = 'coldcall_customers';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`❌ ไม่พบไฟล์ creds.json`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID
});

const db = admin.firestore();

async function deleteInvalidNumbers() {
    console.log('🧹 กำลังค้นหาเบอร์โทรศัพท์ที่นำหน้าด้วย 66 เพื่อลบทิ้ง...');
    try {
        const snapshot = await db.collection(CUSTOMERS_COL)
            .get(); // ดึงมาทั้งหมดแล้วใช้วิธีเช็คใน loop (หรือใช้ query startAt ก็ได้ แต่นี่ชัวร์กว่า)

        let batch = db.batch();
        let count = 0;
        let deleteCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            // เช็คว่าเบอร์โทร หรือ ID ของ Document ขึ้นต้นด้วย 66
            if (doc.id.startsWith('66') || (data.phone && data.phone.startsWith('66'))) {
                batch.delete(doc.ref);
                count++;
                deleteCount++;
            }

            if (count >= 400) {
                batch.commit();
                batch = db.batch();
                count = 0;
            }
        });

        if (count > 0) {
            await batch.commit();
        }

        console.log(`✅ ทำความสะอาดเสร็จสิ้น! ลบข้อมูลขยะที่ขึ้นต้นด้วย 66 ออกไปทั้งหมด ${deleteCount} รายการ`);
        process.exit(0);
    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาด:', err);
        process.exit(1);
    }
}

deleteInvalidNumbers();
