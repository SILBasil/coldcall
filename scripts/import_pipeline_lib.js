import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc, 
    doc, 
    serverTimestamp 
} from "firebase/firestore";

// Firebase Configuration from your system
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

const CUSTOMERS_COL = "coldcall_customers";

/**
 * Smart Importer: Handles 3 phases of data pipeline
 * 1. Inventory (Pool)
 * 2. New Customers (Qualified)
 * 3. Retention (Customer)
 */
export async function importDataPipeline(records, targetStage) {
    console.log(`🚀 Starting Import for Stage: ${targetStage} (${records.length} records)`);
    
    let createdCount = 0;
    let updatedCount = 0;

    for (const record of records) {
        try {
            const phone = record.phone?.toString().trim();
            if (!phone) continue;

            // 1. Check if customer already exists by phone
            const q = query(collection(db, CUSTOMERS_COL), where("phone", "==", phone));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // UPDATE EXISTING: Upgrade stage if needed and merge notes
                const existingDoc = snapshot.docs[0];
                const existingData = existingDoc.data();
                
                // Define stage priority: customer > qualified > pool
                const stagePriority = { 'customer': 3, 'qualified': 2, 'pool': 1 };
                const currentPriority = stagePriority[existingData.stage] || 0;
                const newPriority = stagePriority[targetStage] || 0;

                const updatePayload = {
                    updatedAt: serverTimestamp(),
                    // Merge notes/details
                    businessType: record.businessType || existingData.businessType || "",
                    usageInfo: record.usageInfo || existingData.usageInfo || "",
                    location: record.location || existingData.location || "",
                    bot_score: record.bot_score !== undefined ? record.bot_score : (existingData.bot_score || 0),
                    // Only update stage if it's a promotion
                    stage: newPriority > currentPriority ? targetStage : existingData.stage,
                    importTimestamp: serverTimestamp() // Current upload marker
                };

                await updateDoc(doc(db, CUSTOMERS_COL, existingDoc.id), updatePayload);
                updatedCount++;
            } else {
                // CREATE NEW
                await addDoc(collection(db, CUSTOMERS_COL), {
                    ...record,
                    stage: targetStage,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    importTimestamp: serverTimestamp()
                });
                createdCount++;
            }
        } catch (err) {
            console.error(`❌ Error processsing ${record.phone}:`, err.message);
        }
    }

    console.log(`✅ Done: Created ${createdCount}, Updated/Promoted ${updatedCount}`);
    return { createdCount, updatedCount };
}
