import { collection, query, where, orderBy, getDocs, limit, startAfter } from "firebase/firestore";
import { db } from "../firebase";
import { leadService } from "./leadService";

const CUSTOMERS_COL = "coldcall_customers";

export const leadServicePaginated = {
  // Inherit everything from original leadService
  ...leadService,

  // New Paginated Fetch for Bot Pool
  async getCustomersByStagePaginated(stage, adminId = null, lastDoc = null, limitCount = 200) {
    let constraints = [
      where("stage", "==", stage),
      orderBy("updatedAt", "desc"),
      limit(limitCount)
    ];

    if (stage === 'pool') {
      // Per user request: pool leads with score MUST move to qualified.
      // So for the Pool view, we only show those WITHOUT a score.
      // Note: Firestore doesn't support "whereFieldNotExists", 
      // so we might need to filter client-side or check for a specific flag.
      // For now, we'll fetch and filter, or use a known null-like value.
    }

    if (adminId) {
      constraints.unshift(where("responsibleId", "==", adminId));
    }
    
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, CUSTOMERS_COL), ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = [];
    const migrateBatch = [];

    for (const d of snapshot.docs) {
      const data = d.data();
      const id = d.id;
      
      // Smart Auto-Migration if score exists in Pool
      if (stage === 'pool' && (data.bot_score !== undefined || data.formState?.score)) {
        migrateBatch.push(updateDoc(doc(db, CUSTOMERS_COL, id), {
          stage: 'qualified',
          updatedAt: serverTimestamp()
        }));
        // Don't add to docs list for current view (it's moving away)
      } else {
        docs.push({ ...data, id });
      }
    }

    if (migrateBatch.length > 0) {
      console.log(`🚀 Auto-migrated ${migrateBatch.length} leads with score to Qualified.`);
      await Promise.all(migrateBatch);
    }

    const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return { 
      docs, 
      lastDoc: newLastDoc, 
      hasMore: snapshot.docs.length === limitCount 
    };
  },

  // Database-level exact Search for specific phone numbers
  async searchCustomerByPhone(phoneQuery) {
    const q = query(
      collection(db, CUSTOMERS_COL),
      where("phone", "==", phoneQuery),
      limit(5)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }
};
