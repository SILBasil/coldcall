import { initializeApp } from "firebase/app";
import { getFirestore, collection, getCountFromServer } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyJuWH6NYUIehFib7NVBGkLGG7vhKuv9g",
  authDomain: "catalogue21-92e8b.firebaseapp.com",
  projectId: "catalogue21-92e8b",
  storageBucket: "catalogue21-92e8b.firebasestorage.app",
  messagingSenderId: "828111651708",
  appId: "1:828111651708:web:d142df49753d1b77989af9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const checkDatabase = async () => {
    console.log("🔍 Checking Firebase Data Status...");
    
    const customersCount = await getCountFromServer(collection(db, "coldcall_customers"));
    const logsCount = await getCountFromServer(collection(db, "coldcall_logs"));
    const usersCount = await getCountFromServer(collection(db, "coldcall_users"));
    
    console.log("-----------------------------------------");
    console.log(`📊 Customers (รายชื่อลูกค้า): ${customersCount.data().count} ราย`);
    console.log(`📊 Logs (ประวัติการทำงาน): ${logsCount.data().count} รายการ`);
    console.log(`📊 Users (สมาชิกทีม): ${usersCount.data().count} ท่าน`);
    console.log("-----------------------------------------");
    
    if (customersCount.data().count === 0) {
        console.log("⚠️ WARNING: No customer data found! Migration might be needed.");
    } else {
        console.log("✅ Data is present in Firebase.");
    }
    
    process.exit(0);
};

checkDatabase().catch(err => {
    console.error("❌ Failed to check database:", err);
    process.exit(1);
});
