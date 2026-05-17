import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, setDoc, doc } from "firebase/firestore";

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

const seedLeads = async () => {
    console.log("🌱 Seeding Sample Leads to Firebase...");
    
    const customers = [
        { name: "คุณสมชาย ใจดี", phone: "0812345678", stage: "qualified", responsibleId: "a1", responsibleName: "ข้าวฟ่าง", bot_score: 5, updatedAt: new Date() },
        { name: "คุณสมหญิง รักดี", phone: "0898765432", stage: "qualified", responsibleId: "a1", responsibleName: "ข้าวฟ่าง", bot_score: 3, updatedAt: new Date() },
        { name: "เบอร์ใหม่จากบอท 1", phone: "0990001111", stage: "pool", updatedAt: new Date() },
        { name: "เบอร์ใหม่จากบอท 2", phone: "0990002222", stage: "pool", updatedAt: new Date() }
    ];

    for (const c of customers) {
        await addDoc(collection(db, "coldcall_customers"), {
            ...c,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }

    console.log("✅ Seeded 4 sample leads successfully!");
    process.exit(0);
};

seedLeads().catch(err => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
