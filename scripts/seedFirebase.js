import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

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

const seedData = async () => {
    console.log("🌱 Starting Firebase Seeding...");

    // 1. Seed Users
    const users = [
        { id: 'm1', username: 'basil@coldcall.com', password: '1234', name: 'Manager Basil', role: 'manager', color: '#4F46E5' },
        { id: 'a1', username: 'khaofang@coldcall.com', password: '1234', name: 'ข้าวฟ่าง', role: 'admin', color: '#E9D5FF' },
        { id: 'a2', username: 'tim@coldcall.com', password: '1234', name: 'ทิม', role: 'admin', color: '#374151' },
        { id: 'a3', username: 'thee@coldcall.com', password: '1234', name: 'ธีร์', role: 'admin', color: '#DCFCE7' },
        { id: 'a4', username: 'nice@coldcall.com', password: '1234', name: 'ไนซ์', role: 'admin', color: '#FEE2E2' },
        { id: 'a5', username: 'ploy@coldcall.com', password: '1234', name: 'พลอย', role: 'admin', color: '#FEF3C7' },
        { id: 'a6', username: 'toey@coldcall.com', password: '1234', name: 'Toey', role: 'admin', color: '#DBEAFE' }
    ];

    for (const u of users) {
        await setDoc(doc(db, "coldcall_users", u.id), {
            ...u,
            currentStatus: 'offline',
            lastActive: serverTimestamp()
        });
        console.log(` ✅ User ${u.name} seeded.`);
    }

    // 2. Seed Topics
    const topics = ["บทสนทนาทั่วไป", "สนใจสินค้าใหม่", "ร้องเรียนบริการ"];
    for (const t of topics) {
        await addDoc(collection(db, "coldcall_topics"), {
            title: t,
            isActive: true,
            createdAt: serverTimestamp()
        });
    }
    console.log(" ✅ Topics seeded.");

    console.log("⭐ Seeding Completed Successfully!");
    process.exit(0);
};

seedData().catch(err => {
    console.error("❌ Seeding Failed:", err);
    process.exit(1);
});
