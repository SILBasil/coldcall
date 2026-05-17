import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";

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

const migrateLeads = async () => {
    console.log("🚀 Starting Lead Migration (Pool -> Qualified)...");
    
    const q = query(collection(db, "coldcall_customers"), where("stage", "==", "pool"));
    const snapshot = await getDocs(q);
    
    console.log(`Found ${snapshot.size} leads in pool.`);
    let count = 0;
    let processed = 0;
    
    for (const d of snapshot.docs) {
        processed++;
        const data = d.data();
        if (data.bot_score !== undefined && data.bot_score !== null) {
            await updateDoc(doc(db, "coldcall_customers", d.id), {
                stage: 'qualified',
                updatedAt: serverTimestamp()
            });
            count++;
            if (count % 10 === 0) console.log(`🔄 Processed ${processed}/${snapshot.size}... Moved ${count} leads.`);
        }
    }
    
    console.log(`✅ Migration completed! Moved ${count} leads to Qualified.`);
    process.exit(0);
};

migrateLeads().catch(err => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
