import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch } from "firebase/firestore";
import dotenv from "dotenv";

// Load Environment Variables
dotenv.config();

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

const COLLECTIONS_TO_WIPE = ['coldcall_customers', 'coldcall_logs'];

async function wipeCol() {
  console.log(`⚠️ กำลังเริ่มลบข้อมูล ล้างกระดานระบบทั้งหมด...`);

  try {
    let totalDeleted = 0;

    for (const colName of COLLECTIONS_TO_WIPE) {
      console.log(`\n⏳ กำลังสแกนตาราง: ${colName}...`);
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);

      if (snapshot.empty) {
         console.log(`✅ ${colName} เกลี้ยงเกลา ไม่มีข้อมูลค้างแล้ว`);
         continue;
      }

      console.log(`🗑️ พบข้อมูลใน ${colName} จำนวน ${snapshot.size} รายการ กำลังลบทิ้ง...`);

      let currentBatch = writeBatch(db);
      let batchCount = 0;
      let deletedInCol = 0;

      for (const docSnap of snapshot.docs) {
        currentBatch.delete(docSnap.ref);
        batchCount++;
        deletedInCol++;
        totalDeleted++;

        if (batchCount === 495) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
          batchCount = 0;
          console.log(`   ...ลบไปแล้ว ${deletedInCol} รายการ`);
        }
      }

      if (batchCount > 0) {
        await currentBatch.commit();
      }
      console.log(`✅ ลบข้อมูลในตาราง ${colName} สำเร็จ`);
    }

    console.log(`\n🎉 ล้างข้อมูลสำเร็จทั้งหมด รวม ${totalDeleted} ราบการเรียบร้อยครับ! (ไปรีเฟรชหน้าเว็บได้เลยทุกอย่างจะเป็น 0 จริงๆ แล้ว)`);
    process.exit(0);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการลบ:", error);
    process.exit(1);
  }
}

wipeCol();
