import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  getDoc,
  serverTimestamp,
  Timestamp,
  limit,
  writeBatch,
  startAfter,
  getCountFromServer
} from "firebase/firestore";
import { db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { MONTHS_TRACKING, WEEKS } from "../constants";

const TOPICS_COL = "coldcall_topics";
const USERS_COL = "coldcall_users";
const LOGS_COL = "coldcall_logs";
const CUSTOMERS_COL = "coldcall_customers";
const WEEKLY_REPORTS_COL = "coldcall_weekly_reports";

// Short-lived cache (3 seconds) to prevent simultaneous duplicate fetches from multiple dashboard components
const reqCache = {
  get: (key) => {
    if (reqCache[key] && Date.now() - reqCache[key].ts < 3000) return reqCache[key].data;
    return null;
  },
  set: (key, data) => {
    reqCache[key] = { ts: Date.now(), data };
    return data;
  }
};

export const leadService = {
  // --- Master Topics ---
  async getMasterTopics() {
    try {
      const q = query(collection(db, TOPICS_COL), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    } catch (err) {
      console.error("Firebase Topics Error:", err);
      return [];
    }
  },

  async addMasterTopic(title, isDefault = false) {
    return await addDoc(collection(db, TOPICS_COL), {
      title,
      isDefault,
      isActive: true,
      createdAt: serverTimestamp()
    });
  },

  async updateMasterTopic(id, data) {
    return await updateDoc(doc(db, TOPICS_COL, id), { ...data, updatedAt: serverTimestamp() });
  },

  async deleteMasterTopic(id) {
    return await deleteDoc(doc(db, TOPICS_COL, id));
  },

  async seedDefaultTopics() {
    const DEFAULT_TOPICS = [
      'สนใจสมัครบริการ',
      'สอบถามรายละเอียด',
      'ต้องการเปลี่ยนการบริการ',
      'แจ้งปัญหาการใช้บริการ',
    ];
    const existing = await this.getMasterTopics();
    const existingTitles = new Set(existing.map(t => t.title));
    const batch = writeBatch(db);
    let added = 0;
    for (const title of DEFAULT_TOPICS) {
      if (!existingTitles.has(title)) {
        const ref = doc(collection(db, TOPICS_COL));
        batch.set(ref, { title, isDefault: true, isActive: true, createdAt: serverTimestamp() });
        added++;
      }
    }
    if (added > 0) await batch.commit();
    return added;
  },

  async deduplicateTopics() {
    const all = await this.getMasterTopics();
    const seen = new Map(); // title -> first doc id
    const toDelete = [];
    for (const t of all) {
      if (seen.has(t.title)) {
        toDelete.push(t.id); // duplicate
      } else {
        seen.set(t.title, t.id);
      }
    }
    if (toDelete.length > 0) {
      const batch = writeBatch(db);
      toDelete.forEach(id => batch.delete(doc(db, TOPICS_COL, id)));
      await batch.commit();
    }
    return toDelete.length;
  },

  // --- Customers Funnel ---
  async getCustomersByStage(stage, adminId = null, page = 1, limitCount = 100) {
    return this.getCustomersByStagePaginated(stage, adminId, null, limitCount);
  },

  async getCustomersByStagePaginated(stage, adminId = null, lastDoc = null, limitCount = 100, options = {}) {
    try {
      let constraints = [
        where("stage", "==", stage),
        orderBy("updatedAt", "desc"),
        limit(limitCount)
      ];
      
      if (options.status) {
        constraints.unshift(where("status", "==", options.status));
      }
      
      if (adminId) {
        constraints.unshift(where("responsibleId", "==", adminId));
      }
      
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collection(db, CUSTOMERS_COL), ...constraints);
      const snapshot = await getDocs(q);
      
      // Get total count for this stage (optimized)
      let countConstraints = [where("stage", "==", stage)];
      if (options.status) {
        countConstraints.unshift(where("status", "==", options.status));
      }
      if (adminId) {
         countConstraints.unshift(where("responsibleId", "==", adminId));
      }
      const countQuery = query(collection(db, CUSTOMERS_COL), ...countConstraints);
      const countSnapshot = await getCountFromServer(countQuery);
      const total = countSnapshot.data().count;

      return {
        data: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })),
        lastDoc: snapshot.docs[snapshot.docs.length - 1],
        pagination: {
          total,
          count: snapshot.size,
          hasMore: snapshot.size === limitCount
        }
      };
    } catch (err) {
      console.error("Firebase Get Customers Paginated Error:", err);
      throw err;
    }
  },

  async searchCustomers(searchTerm) {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return [];
    
    const isPhone = /^[\d\s-]+$/.test(cleanTerm);
    let q = query(collection(db, CUSTOMERS_COL));
    
    if (isPhone) {
       const cleanPhone = cleanTerm.replace(/[\s-]/g, '');
       q = query(q, where('phone', '>=', cleanPhone), where('phone', '<=', cleanPhone + '\uf8ff'), limit(100));
    } else {
       q = query(q, where('name', '>=', cleanTerm), where('name', '<=', cleanTerm + '\uf8ff'), limit(100));
    }
    
    try {
       const snapshot = await getDocs(q);
       return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
       console.error("Search failed", error);
       return [];
    }
  },

  // Helper for messy phone strings
  splitAndCleanPhones(raw) {
    if (!raw) return [];
    // Split by common separators: , / \n | ;
    const parts = String(raw).split(/[,\/\n|;]/);
    
    return parts
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Basic normalization: remove non-digits BUT keep internal '-' if present (like 02-...)
        // Actually, for dialing we want digits, but for display we keep as-is or slightly cleaned.
        // Let's keep it mostly as-is for 'display' but we'll clean it for 'dial' later in UI.
        return p; 
      });
  },

  normalizePhone(raw) {
    if (!raw) return null;
    let phone = String(raw).replace(/[^0-9]/g, '');
    if (!phone || phone.length < 9) return null;
    if (phone.startsWith('66')) phone = '0' + phone.slice(2);
    // If it's 9 digits and should be 02... add 0 if missing (rare but handled)
    if (phone.length === 8 && (phone.startsWith('2') || phone.startsWith('3'))) phone = '0' + phone;
    return phone;
  },

  async getAllCustomersByStage(stage, page = 1, limitCount = 100) {
    return this.getCustomersByStage(stage, null, page, limitCount);
  },

  async getStats(date = new Date(), mode = 'week') {
    try {
      // 1. Stage Counts
      const [poolCount, qualifiedCount, customerCount, unassignedCount] = await Promise.all([
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "pool"))),
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "qualified"))),
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "customer"))),
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "qualified"), where("responsibleId", "==", null)))
      ]);
      
      const stats = {
        pool: poolCount.data().count,
        qualified: qualifiedCount.data().count,
        customer: customerCount.data().count,
        unassigned: unassignedCount.data().count,
        total: poolCount.data().count + qualifiedCount.data().count + customerCount.data().count,
        mode
      };

      // 2. Admin Users
      const qUsers = query(collection(db, USERS_COL));
      const snapUsers = await getDocs(qUsers);
      const allUsers = snapUsers.docs.map(d => d.data());
      const admins = allUsers.filter(u => u.role === 'admin');
      
      stats.adminStatusMap = {};
      admins.forEach(u => {
        stats.adminStatusMap[u.id] = { lastAction: 'ยังไม่มีกิจกรรม' };
      });
      stats.activeAdmins = 0;

      // 3. Compute date window based on mode
      const refDate = new Date(date);
      let startOfPeriod, endOfPeriod, periodLabel;

      if (mode === 'month') {
        // Month window: 1st to last day of the month
        startOfPeriod = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
        endOfPeriod = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1, 0, 0, 0, 0);
        periodLabel = startOfPeriod.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      } else {
        // Week window: Mon-Sun
        const refDay = refDate.getDay();
        const refDiff = refDate.getDate() - (refDay === 0 ? 6 : refDay - 1);
        startOfPeriod = new Date(refDate);
        startOfPeriod.setDate(refDiff);
        startOfPeriod.setHours(0, 0, 0, 0);
        endOfPeriod = new Date(startOfPeriod);
        endOfPeriod.setDate(startOfPeriod.getDate() + 7);
        const endDisplay = new Date(endOfPeriod); endDisplay.setDate(endDisplay.getDate() - 1);
        periodLabel = `${startOfPeriod.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} - ${endDisplay.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
      }

      // Keep backward-compat aliases
      const startOfWeek = startOfPeriod;
      const endOfWeek = endOfPeriod;
      stats.periodLabel = periodLabel;

      // Fetch all logs within period window
      const qLogs = query(
        collection(db, LOGS_COL),
        where("timestamp", ">=", startOfPeriod),
        where("timestamp", "<", endOfPeriod)
      );
      const snapLogs = await getDocs(qLogs);
      const weeklyLogs = snapLogs.docs.map(d => d.data());

      // Update adminStatusMap
      [...weeklyLogs].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).forEach(l => {
        if (stats.adminStatusMap[l.adminId] && stats.adminStatusMap[l.adminId].lastAction === 'ยังไม่มีกิจกรรม') {
          stats.adminStatusMap[l.adminId].lastAction = l.comment || l.action || 'บันทึกงาน';
        }
      });

      const adminMap = {};
      weeklyLogs.forEach(l => {
        if (!l.adminId) return;
        if (!adminMap[l.adminId]) adminMap[l.adminId] = { id: l.adminId, name: l.adminName, followed: 0, converted: 0 };
        if (l.type === 'call' || l.type === 'save') adminMap[l.adminId].followed++;
        const isWon = l.comment?.includes('สั่งซื้อซ้ำ') || l.comment?.includes('ปิดยอด') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ') || l.action?.includes('ปิดยอด');
        if (l.type === 'save' && l.customerStage === 'customer' && isWon) adminMap[l.adminId].converted++;
        if (l.type === 'save' && l.customerStage === 'qualified' && isWon) adminMap[l.adminId].converted++;
      });

      // 4. Daily Activity Trend: 7 days centered on the selected week
      const trendLabels = [];
      const trendCounts = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + (6 - i));
        const label = d.toLocaleDateString('th-TH', { weekday: 'short' });
        trendLabels.push(label);
        const dayStart = new Date(d.setHours(0, 0, 0, 0));
        const dayEnd = new Date(d.setHours(23, 59, 59, 999));
        const count = weeklyLogs.filter(l => {
          const lTs = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
          return lTs >= dayStart && lTs <= dayEnd && (l.type === 'call' || l.type === 'save');
        }).length;
        trendCounts.push(count);
      }
      stats.activityTrend = { labels: trendLabels, counts: trendCounts };

      // 5. Weekly Efficiency Stats
      const weeklyTotalEffort = weeklyLogs.filter(l => l.type === 'call' || l.type === 'save').length;
      const weeklySuccess = weeklyLogs.filter(l => 
        l.type === 'save' && (l.comment?.includes('ปิดยอด') || l.comment?.includes('สั่งซื้อซ้ำ') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ') || l.action?.includes('ปิดยอด'))
      ).length;
      const realEfficiency = weeklyTotalEffort > 0 ? Math.round((weeklySuccess / weeklyTotalEffort) * 100) : 0;

      // newLeadsToday: just count pool entries that were created today relative to `date`
      const todayStart = new Date(refDate); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(refDate); todayEnd.setHours(23,59,59,999);
      
      const todayPoolLogs = weeklyLogs.filter(l => {
        const t = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
        return t >= todayStart && t <= todayEnd && (l.type === 'save' || l.type === 'call');
      });
      stats.newLeadsToday = Math.max(todayPoolLogs.length, 0);

      // 6. Recent Logs for Dashboard
      stats.recentLogs = [...weeklyLogs]
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        .slice(0, 5)
        .map(l => ({
          time: (l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp)).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          actor: l.adminName || 'System',
          action: l.comment || l.action || 'กิจกรรมในระบบ',
          type: (l.comment?.includes('ปิดยอด') || l.comment?.includes('สั่งซื้อซ้ำ')) ? 'success' : (l.type === 'login' || l.type === 'logout' ? 'system' : 'info')
        }));

      stats.weeklyStats = {
        efficiency: realEfficiency + '%',
        efficiencyGrowth: realEfficiency > 10 ? '+4.2' : '+1.1',
        followUps: weeklyLogs.filter(l => (l.type === 'call' || l.type === 'save') && l.customerStage === 'customer').length,
        followUpsTotal: stats.customer,
        newCustomers: weeklySuccess,
        leaderboard: Object.values(adminMap)
          .map(a => ({
            ...a,
            rate: a.followed > 0 ? Math.round((a.converted / a.followed) * 100) + '%' : '0%'
          }))
          .sort((a, b) => b.converted - a.converted)
          .slice(0, 5),
        adminDetails: {}
      };

      Object.values(adminMap).forEach(a => {
        const rateNum = a.followed > 0 ? (a.converted / a.followed) * 100 : 0;
        stats.weeklyStats.adminDetails[a.id] = {
          grade: rateNum >= 80 ? 'A' : (rateNum >= 50 ? 'B' : 'C'),
          followed: a.followed,
          converted: a.converted,
          rate: Math.round(rateNum) + '%'
        };
      });

      // 7. Lost Reasons Analysis
      const teamLostReasonsMap = {};
      weeklyLogs.filter(l => l.type === 'save' && l.customerStage === 'qualified').forEach(l => {
        const isLost = l.comment?.includes('ปิดเครื่อง') || l.comment?.includes('ไม่สนใจ') || l.comment?.includes('ยกเลิก') || l.action?.includes('ไม่สนใจ') || l.snapshot?.formState?.status?.includes('ไม่สนใจ') || l.action?.includes('ปิดเครื่อง');
        if (isLost && l.reasons && Array.isArray(l.reasons)) {
           l.reasons.forEach(r => {
              teamLostReasonsMap[r] = (teamLostReasonsMap[r] || 0) + 1;
           });
        }
      });
      stats.teamLostReasons = Object.entries(teamLostReasonsMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // 8. Activity Heatmap by Hour
      const heatmap = Array(24).fill(0);
      weeklyLogs.forEach(l => {
         if(l.type === 'call' || l.type === 'save') {
            const t = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
            if (t) heatmap[t.getHours()]++;
         }
      });
      stats.activityHeatmap = heatmap;

      // 9. Team Call Outcomes Breakdown
      const teamSaveLogs = weeklyLogs.filter(l => l.type === 'save');
      const teamWon = teamSaveLogs.filter(l => l.comment?.includes('ปิดยอด') || l.comment?.includes('สั่งซื้อซ้ำ') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ') || l.action?.includes('ปิดยอด')).length;
      const teamLost = teamSaveLogs.filter(l => l.comment?.includes('ปิดเครื่อง') || l.comment?.includes('ไม่สนใจ') || l.comment?.includes('ยกเลิก') || l.action?.includes('ไม่สนใจ') || l.snapshot?.formState?.status?.includes('ไม่สนใจ') || l.action?.includes('ปิดเครื่อง')).length;
      const teamPending = Math.max(0, teamSaveLogs.length - teamWon - teamLost);

      stats.teamCallOutcomes = [
        { label: 'ปิดยอดขายสำเร็จ (Won)', count: teamWon, color: 'emerald' },
        { label: 'ติดตามต่อ (Pending)', count: teamPending, color: 'amber' },
        { label: 'ไม่สนใจ / ยกเลิก (Lost)', count: teamLost, color: 'rose' }
      ];

      // 10. Weekly Funnel Flow
      const botProcessed = weeklyLogs.filter(l => l.type === 'sync' || l.type === 'import' || l.action?.includes('คัดกรอง') || l.action?.includes('Sync')).length;

      const toQualified = weeklyLogs.filter(l => {
        const prev = l.snapshot?.previousStage || l.previousStage;
        const curr = l.snapshot?.formState?.stage || l.customerStage;
        return (prev === 'pool' && curr === 'qualified') || (l.type === 'assign' && l.snapshot?.assignmentType === 'pool');
      }).length;

      const toDecision = weeklyLogs.filter(l => {
        const stage = l.snapshot?.formState?.stage || l.customerStage;
        const isQualified = stage === 'qualified';
        const notWon = !l.comment?.includes('ปิดยอด') && !l.comment?.includes('สั่งซื้อซ้ำ');
        return (l.type === 'save') && isQualified && notWon;
      }).length;

      const toCustomer = weeklyLogs.filter(l => {
        const prev = l.snapshot?.previousStage || l.previousStage;
        const curr = l.snapshot?.formState?.stage || l.customerStage;
        const isWon = l.comment?.includes('ปิดยอด') || l.comment?.includes('สั่งซื้อซ้ำ') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ');
        return (curr === 'customer' && isWon) || (prev !== 'customer' && curr === 'customer');
      }).length;

      stats.weeklyFunnelFlow = {
        botProcessed,
        toQualified,
        toDecision,
        toCustomer
      };

      return stats;
    } catch (err) {
      console.error("Firebase Get Stats Error:", err);
      return {};
    }
  },

  async getGlobalDashboardStats(date = new Date()) {
    try {
      const refDate = new Date(date);
      const todayStart = new Date(refDate); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(refDate); todayEnd.setHours(23,59,59,999);

      const [poolCount, qualifiedCount, customerCount, todayLogsSnap] = await Promise.all([
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "pool"))),
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "qualified"))),
        getCountFromServer(query(collection(db, CUSTOMERS_COL), where("stage", "==", "customer"))),
        getDocs(query(
          collection(db, LOGS_COL),
          where("timestamp", ">=", todayStart),
          where("timestamp", "<=", todayEnd)
        ))
      ]);

      const pool = poolCount.data().count;
      const qualified = qualifiedCount.data().count;
      const customer = customerCount.data().count;
      const todayLogs = todayLogsSnap.docs.map(d => d.data());

      return {
        total: pool + qualified + customer,
        pool,
        qualified,
        customer,
        newLeadsToday: todayLogs.filter(l => l.type === 'save' || l.type === 'call').length,
        unassigned: 0 // Not needed for global dashboard usually
      };
    } catch (e) {
      console.error("Get Global Dashboard Stats Error", e);
      return { total: 0, pool: 0, qualified: 0, customer: 0, newLeadsToday: 0, unassigned: 0 };
    }
  },

  // --- Activity Logging ---
  async logActivity(data) {
    try {
      const logData = {
        ...data,
        timestamp: serverTimestamp()
      };
      return await addDoc(collection(db, LOGS_COL), logData);
    } catch (err) {
      console.error("Firebase Log Activity Error:", err);
    }
  },

  async logSession({ adminId, adminName, event, sessionDuration = null }) {
    const action = event === 'login' ? 'เข้าสู่ระบบ' : `ออกจากระบบ (ทำงานนาน ${sessionDuration ? Math.floor(sessionDuration / 60) + ' นาที' : 'ไม่ทราบ'})`;
    return this.logActivity({ 
      adminId, 
      adminName, 
      action, 
      type: event, 
      duration: sessionDuration 
    });
  },

  async getCustomerLogs(customerId, limitCount = 10) {
    const q = query(
      collection(db, LOGS_COL), 
      where("customerId", "==", customerId), 
      orderBy("timestamp", "desc"), 
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  },

  async getSaveSnapshots(customerId) {
    const logs = await this.getCustomerLogs(customerId, 100);
    return logs.filter(l => l.type === 'save').slice(0, 50);
  },

  async getAllLogs({ adminId, startDate, endDate, limitCount = 1000 }) {
    let constraints = [orderBy("timestamp", "desc"), limit(limitCount)];
    if (adminId && adminId !== 'all') {
      constraints.unshift(where("adminId", "==", adminId));
    }
    if (startDate) {
      constraints.unshift(where("timestamp", ">=", startDate));
    }
    if (endDate) {
      constraints.unshift(where("timestamp", "<=", endDate));
    }
    
    const q = query(collection(db, LOGS_COL), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  },

  async getActivityTrend(adminId, days = 1) {
    // Basic implementation for dashboard trend
    const q = query(
      collection(db, LOGS_COL), 
      where("adminId", "==", adminId), 
      orderBy("timestamp", "desc"), 
      limit(100)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(d => d.data());
    
    // Simplistic grouping by type for now
    const result = {};
    logs.forEach(l => {
      result[l.type] = (result[l.type] || 0) + 1;
    });
    return result;
  },

  // --- Auth & Users ---
  async getUsers() {
    const q = query(collection(db, USERS_COL));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  },

  async authenticateUser(email, password) {
    const q = query(collection(db, USERS_COL), where("username", "==", email), where("password", "==", password));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id };
  },

  async createUser(userData) {
    // Standard user ID if not provided (like manager manually adding)
    let { id } = userData;
    if (!id) {
      const users = await this.getUsers();
      const adminIds = users.filter(u => u.id.startsWith('a')).map(u => parseInt(u.id.substring(1)) || 0);
      const nextNum = (adminIds.length > 0 ? Math.max(...adminIds) : 0) + 1;
      id = `a${nextNum}`;
    }
    
    await setDoc(doc(db, USERS_COL, id), {
      ...userData,
      id,
      createdAt: serverTimestamp()
    });
    return { success: true, id };
  },

  async updateUser(userId, updates) {
    const userRef = doc(db, USERS_COL, userId);
    await updateDoc(userRef, updates);
    return { success: true };
  },

  async deleteUser(userId) {
    // 1. Unassign customers
    const q = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", userId));
    const snapshots = await getDocs(q);
    const batch = snapshots.docs.map(d => updateDoc(d.ref, { 
      responsibleId: null, 
      responsibleName: 'Unassigned' 
    }));
    await Promise.all(batch);

    // 2. Delete user
    await deleteDoc(doc(db, USERS_COL, userId));
    return { success: true };
  },

  // --- Manual Lead Injection (for Mockup/Testing) ---
  async addManualLead(data) {
    try {
      const phone = data.phone ? String(data.phone).replace(/[^0-9]/g, '') : null;
      if (!phone) throw new Error('ต้องระบุเบอร์โทรศัพท์');

      const payload = {
        phone,
        allPhones: [phone],
        name: data.name || 'ลูกค้าจำลอง',
        stage: data.stage || 'customer',
        status: data.status || 'สั่งซื้อซ้ำสำเร็จ',
        lastOrderDate: data.lastOrderDate || null,
        freqAmount: data.freqAmount || 1,
        freqUnit: data.freqUnit || 'เดือน',
        responsibleId: data.responsibleId || null,
        remark: data.remark || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isMockup: true,
      };

      const ref = await addDoc(collection(db, CUSTOMERS_COL), payload);
      return { id: ref.id, ...payload };
    } catch (err) {
      console.error('addManualLead error:', err);
      throw err;
    }
  },

  async getAdminWorkloadOverview(adminId, startDate, endDate) {
    if (!adminId) return null;
    try {
      // Fetch all customers for this admin (Optimized with cache)
      const custKey = `custs_${adminId}`;
      let allCusts = reqCache.get(custKey);
      if (!allCusts) {
          const qCusts = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", adminId));
          const snapCusts = await getDocs(qCusts);
          allCusts = reqCache.set(custKey, snapCusts.docs.map(d => ({ ...d.data(), id: d.id })));
      }

      // Fetch logs this week to know who was "touched" (Optimized with cache)
      const logKey = `logs_${adminId}_${startDate.getTime()}_${endDate.getTime()}`;
      let weekLogs = reqCache.get(logKey);
      if (!weekLogs) {
          const qLogs = query(
            collection(db, LOGS_COL),
            where("adminId", "==", adminId),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate)
          );
          const snapLogs = await getDocs(qLogs);
          weekLogs = reqCache.set(logKey, snapLogs.docs.map(d => d.data()));
      }
      
      // Robust touched set: include both phone and docId
      const touchedThisWeek = new Set();
      weekLogs.forEach(l => {
        if (l.type === 'call' || l.type === 'save') {
           if (l.customerId) touchedThisWeek.add(l.customerId);
           if (l.customerPhone) touchedThisWeek.add(l.customerPhone);
        }
      });

      // Filter leads to only include those that existed during the selected week
      const relevantCusts = allCusts.filter(c => {
        const createdAtDate = c.createdAt?.toDate ? c.createdAt.toDate() : (c.updatedAt?.toDate ? c.updatedAt.toDate() : null);
        return createdAtDate && createdAtDate <= endDate;
      });

      // New leads: stage != 'customer'
      const newLeadsList = relevantCusts
        .filter(c => {
           if (c.stage === 'customer') return false;
           // Not a new lead if it was already resolved before this week started
           const wonDate = c.wonAt?.toDate ? c.wonAt.toDate() : null;
           const lostDate = c.lostAt?.toDate ? c.lostAt.toDate() : null;
           if (wonDate && wonDate < startDate) return false;
           if (lostDate && lostDate < startDate) return false;
           return true; 
         })
        .map(c => {
          const createdAtDate = c.createdAt?.toDate ? c.createdAt.toDate() : null;
          return {
            ...c,
            isDone: touchedThisWeek.has(c.id) || touchedThisWeek.has(c.phone),
            isNewThisWeek: createdAtDate ? (createdAtDate >= startDate && createdAtDate <= endDate) : false
          };
        })
        .sort((a, b) => (a.isDone ? 1 : 0) - (b.isDone ? 1 : 0)); // undone first

      // Retention: stage = 'customer'
      const retentionListRaw = relevantCusts.filter(c => {
          const wonDate = c.wonAt?.toDate ? c.wonAt.toDate() : (c.updatedAt?.toDate && c.stage === 'customer' ? c.updatedAt.toDate() : null);
          // Must have been WON before or during this week AND must be stage customer
          return wonDate && wonDate <= endDate && c.stage === 'customer';
      });

      const retentionList = retentionListRaw
        .map(c => {
          const wonDate = c.wonAt?.toDate ? c.wonAt.toDate() : (c.updatedAt?.toDate && c.stage === 'customer' ? c.updatedAt.toDate() : null);
          let isAssignedThisWeek = false;
          let isDueBeforeThisWeek = false;

          const fDays = c.followUpFrequencyDays || (c.freqUnit === 'เดือน' ? (c.freqAmount || 1) * 30 : (c.freqAmount || 1) * 7);
          let nextDueDate = null;

          if (wonDate && fDays) {
              let currentDate = new Date(wonDate);
              let sanity = 0;
              while (currentDate <= endDate && sanity < 100) {
                 sanity++;
                 currentDate = new Date(currentDate);
                 currentDate.setDate(currentDate.getDate() + fDays);
                 if (currentDate >= startDate && currentDate <= endDate) {
                     isAssignedThisWeek = true;
                     nextDueDate = new Date(currentDate);
                     break;
                 }
              }

              if (!isAssignedThisWeek) {
                  const diffMs = startDate - wonDate;
                  if (diffMs > 0 && Math.floor(diffMs / (1000 * 60 * 60 * 24)) >= fDays) {
                      isDueBeforeThisWeek = true;
                      nextDueDate = new Date(currentDate); // Using the last calculated cycle date as due date
                  } else if (diffMs <= 0 || Math.floor(diffMs / (1000 * 60 * 60 * 24)) < fDays) {
                      nextDueDate = new Date(currentDate);
                  }
              }
          } else {
             // Fallback if no frequency set: show if newly won this week
             if (wonDate >= startDate && wonDate <= endDate) {
                 isAssignedThisWeek = true;
                 nextDueDate = new Date(wonDate);
             } else {
                 isDueBeforeThisWeek = true; // Treat as backlog
                 nextDueDate = new Date(wonDate);
             }
          }

          return {
            ...c,
            isDone: touchedThisWeek.has(c.id) || touchedThisWeek.has(c.phone),
            isNewThisWeek: isAssignedThisWeek,
            isBacklog: !isAssignedThisWeek && isDueBeforeThisWeek,
            nextDueDate: nextDueDate ? nextDueDate.toISOString() : null
          };
        })
        // Only show retention leads that are actually due this week, due in the past (backlog), or were done this week
        .filter(c => c.isNewThisWeek || c.isBacklog || c.isDone)
        .sort((a, b) => (a.isDone ? 1 : 0) - (b.isDone ? 1 : 0));

      const newCompleted = newLeadsList.filter(c => c.isDone).length;
      const retCompleted = retentionList.filter(c => c.isDone).length;

      return {
        newLeads: {
          totalInHand: newLeadsList.length,
          completed: newCompleted,
          remaining: newLeadsList.length - newCompleted,
          assignedThisWeek: newLeadsList.filter(c => c.isNewThisWeek).length,
          backlogCount: newLeadsList.filter(c => !c.isDone && !c.isNewThisWeek).length,
          list: newLeadsList
        },
        retention: {
          totalInHand: retentionList.length,
          completed: retCompleted,
          remaining: retentionList.length - retCompleted,
          assignedThisWeek: retentionList.filter(c => c.isNewThisWeek).length,
          backlogCount: retentionList.filter(c => !c.isDone && !c.isNewThisWeek).length,
          list: retentionList
        }
      };
    } catch (err) {
      console.error("Dashboard error:", err);
      return null;
    }
  },

  async getWeeklyAdminSummary({ adminId, adminName, startDate, endDate }) {
    try {
      const logKey = `logs_${adminId}_${startDate.getTime()}_${endDate.getTime()}`;
      let adminWeekLogs = reqCache.get(logKey);
      if (!adminWeekLogs) {
          const qLogs = query(
            collection(db, LOGS_COL), 
            where("adminId", "==", adminId),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate)
          );
          const snapLogs = await getDocs(qLogs);
          adminWeekLogs = reqCache.set(logKey, snapLogs.docs.map(d => ({ ...d.data(), id: d.id })));
      }
      
      const custKey = `custs_${adminId}`;
      let assignedCusts = reqCache.get(custKey);
      if (!assignedCusts) {
          const qCusts = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", adminId));
          const snapCusts = await getDocs(qCusts);
          assignedCusts = reqCache.set(custKey, snapCusts.docs.map(d => ({ ...d.data(), id: d.id })));
      }

      const touchedNew = new Set();
      const touchedRet = new Set();
      
      adminWeekLogs.forEach(l => {
        if (l.type === 'call' || l.type === 'save') {
           if (l.customerStage === 'customer') touchedRet.add(l.customerId);
           else touchedNew.add(l.customerId);
        }
      });

      // Filter assigned leads to only those that existed by the end of this week
      const relevantAssigned = assignedCusts.filter(c => {
        const ca = c.createdAt?.toDate ? c.createdAt.toDate() : (c.updatedAt?.toDate ? c.updatedAt.toDate() : null);
        return ca && ca <= endDate;
      });

      const assignedNew = relevantAssigned.filter(c => c.stage !== 'customer').length;
      const assignedRet = relevantAssigned.filter(c => c.stage === 'customer').length;

      // Compute outcomes by reading comments and status in save logs
      const saveLogs = adminWeekLogs.filter(l => l.type === 'save');
      
      const leadWon = saveLogs.filter(l => 
        l.customerStage === 'qualified' && 
        (l.comment?.includes('ปิดยอด') || l.comment?.includes('สั่งซื้อ') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ'))
      ).length;
      
      const leadLost = saveLogs.filter(l =>
        l.customerStage === 'qualified' &&
        (l.comment?.includes('ปิดเครื่อง') || l.comment?.includes('ไม่สนใจ') || l.comment?.includes('ยกเลิก') || l.action?.includes('ไม่สนใจ') || l.snapshot?.formState?.status?.includes('ไม่สนใจ') || (l.reasons && l.reasons.length > 0 && l.customerStage === 'qualified'))
      ).length;

      const retOrdered = saveLogs.filter(l =>
        l.customerStage === 'customer' &&
        (l.comment?.includes('สั่งซื้อซ้ำ') || l.comment?.includes('สั่งซื้อ') || l.action?.includes('สั่งซื้อซ้ำ') || l.snapshot?.formState?.status?.includes('สั่งซื้อซ้ำ'))
      ).length;

      const retNotOrdered = saveLogs.filter(l =>
        l.customerStage === 'customer' &&
        (l.comment?.includes('ยังไม่สะดวก') || l.comment?.includes('สต็อกเหลือ') || l.action?.includes('ไม่สนใจ') || l.action?.includes('ยังไม่สั่งซื้อ') || l.snapshot?.formState?.status?.includes('ไม่สนใจ') || l.snapshot?.formState?.status?.includes('ยังไม่สั่งซื้อ') || (l.reasons && l.reasons.length > 0 && l.customerStage === 'customer'))
      ).length;

      const newToRetention = saveLogs.filter(l => l.previousStage === 'pool' && l.customerStage === 'customer').length;
      const newToFollowUp = saveLogs.filter(l => l.previousStage === 'pool' && l.customerStage === 'qualified').length;

      // Tally lost reasons for the modal breakdown chart
      const leadLostReasonsMap = {};
      const retNotOrderedReasonsMap = {};
      saveLogs.forEach(l => {
        if (l.reasons && Array.isArray(l.reasons)) {
          l.reasons.forEach(r => {
            if (l.customerStage === 'qualified') {
              leadLostReasonsMap[r] = (leadLostReasonsMap[r] || 0) + 1;
            } else if (l.customerStage === 'customer') {
              retNotOrderedReasonsMap[r] = (retNotOrderedReasonsMap[r] || 0) + 1;
            }
          });
        }
      });

      const toReasonArr = (map) => Object.entries(map)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // Daily breakdown from logs by day of week in the window
      const dayMap = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const dailyData = dayMap.map((day, idx) => {
        const dayLogs = adminWeekLogs.filter(l => {
          const t = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
          return t.getDay() === idx;
        });
        return {
          day,
          newLeads: dayLogs.filter(l => l.customerStage !== 'customer').length,
          followUps: dayLogs.filter(l => l.customerStage === 'customer').length
        };
      });

      return {
        adminId,
        assignedFullList: assignedCusts.flatMap(c => [c.id, c.phone].filter(Boolean)),
        completedFullList: (() => {
          const allTouched = new Set([...touchedNew, ...touchedRet]);
          const touchedPhones = assignedCusts
            .filter(c => allTouched.has(c.id) || allTouched.has(c.phone))
            .flatMap(c => [c.id, c.phone].filter(Boolean));
          return Array.from(new Set([...allTouched, ...touchedPhones]));
        })(),
        assigned: { new: assignedNew, retention: assignedRet, total: assignedNew + assignedRet },
        completed: { new: touchedNew.size, retention: touchedRet.size },
        activity: {
          calls: adminWeekLogs.filter(l => l.type === 'call').length,
          saves: adminWeekLogs.filter(l => l.type === 'save').length,
          touchedNew: touchedNew.size,
          touchedRetention: touchedRet.size
        },
        outcomes: {
          lead: { won: leadWon, lost: leadLost, pending: Math.max(0, touchedNew.size - leadWon - leadLost) },
          retention: { ordered: retOrdered, not_ordered: retNotOrdered, pending: Math.max(0, touchedRet.size - retOrdered - retNotOrdered) },
          conversions: { newToRetention, newToFollowUp },
          callOutcomes: [
            { label: 'ปิดยอดขายสำเร็จ (Won)', count: leadWon + retOrdered, color: 'emerald' },
            { label: 'ติดตามต่อ (Pending)', count: Math.max(0, touchedNew.size - leadWon - leadLost) + Math.max(0, touchedRet.size - retOrdered - retNotOrdered), color: 'amber' },
            { label: 'ไม่สนใจ / ยกเลิก (Lost)', count: leadLost + retNotOrdered, color: 'rose' }
          ]
        },
        reasons: {
          leadClosedLost: toReasonArr(leadLostReasonsMap),
          retentionNotOrdered: toReasonArr(retNotOrderedReasonsMap)
        },
        daily: dailyData
      };
    } catch (err) {
      console.error("Weekly Summary Error:", err);
      return null;
    }
  },

  async getWeeklyReportDataForExport(adminId, adminName, startDate, endDate, weekStr, notes = '') {
      try {
          const summary = await this.getWeeklyAdminSummary({ adminId, adminName, startDate, endDate });

          let customerTransactions = [];
          if (summary && summary.completedFullList && summary.completedFullList.length > 0) {
              const cQuery = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", adminId));
              const cSnap = await getDocs(cQuery);
              const allMyAdminCustsMap = new Map();
              cSnap.docs.forEach(d => allMyAdminCustsMap.set(d.id, d.data()));

              customerTransactions = summary.completedFullList.map(pid => {
                  const c = allMyAdminCustsMap.get(pid);
                  if (!c) return { customerId: pid, customerName: 'ไม่พบชื่อลูกค้า', stage: 'unknown', status: '-' };
                  
                  let actionResult = '-';
                  if (c.status?.includes('สั่งซื้อซ้ำ') || c.status?.includes('ปิดยอด')) actionResult = 'WON';
                  if (c.status?.includes('ไม่สนใจ') || c.status?.includes('ยกเลิก')) actionResult = 'LOST';
                  if (c.status?.includes('ยังไม่สะดวก') || c.status?.includes('เสนอราคา')) actionResult = 'FOLLOWUP';

                  return {
                      customerId: pid,
                      customerName: c.name || '',
                      stage: c.stage,
                      status: c.status || '-',
                      actionResult,
                      lostReason: c.lostReason || c.reasons || c.adminComment || ''
                  };
              });
          }

          return {
              adminId,
              adminName,
              weekStr,
              problems_notes: notes,
              metrics: {
                  callsMade: summary?.activity?.saves || 0,
                  dealsWon: (summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0)
              },
              customer_transactions: customerTransactions,
              submittedAt: new Date().toISOString()
          };
      } catch (err) {
          console.error("Export Report Data Error", err);
          return null;
      }
  },

  // --- Weekly Reports (Snapshot & Downloadable Concept) ---
  async submitWeeklyReport(adminId, adminName, weekStr, notes) {
    try {
       const baseDate = new Date();
       const day = baseDate.getDay();
       const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
       const start = new Date(baseDate);
       start.setDate(diff);
       start.setHours(0, 0, 0, 0);

       const end = new Date(start);
       end.setDate(start.getDate() + 7);

       const summary = await this.getWeeklyAdminSummary({ adminId, startDate: start, endDate: end });

       // Fetch customer details that were involved (from mapped full list)
       let customerTransactions = [];
       if (summary && summary.completedFullList && summary.completedFullList.length > 0) {
           const cQuery = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", adminId));
             const cSnap = await getDocs(cQuery);
             const allMyAdminCustsMap = new Map();
             cSnap.docs.forEach(d => allMyAdminCustsMap.set(d.id, d.data()));

             customerTransactions = summary.completedFullList.map(pid => {
                  const c = allMyAdminCustsMap.get(pid);
                  if (!c) return { customerId: pid, customerName: 'ไม่พบชื่อลูกค้า', stage: 'unknown', status: '-' };
                  
                  let actionResult = '-';
                  if (c.status?.includes('สั่งซื้อซ้ำ') || c.status?.includes('ปิดยอด')) actionResult = 'WON';
                  if (c.status?.includes('ไม่สนใจ') || c.status?.includes('ยกเลิก')) actionResult = 'LOST';
                  if (c.status?.includes('ยังไม่สะดวก') || c.status?.includes('เสนอราคา')) actionResult = 'FOLLOWUP';

                  return {
                      customerId: pid,
                      customerName: c.name || '',
                      stage: c.stage,
                      status: c.status || '-',
                      actionResult,
                      lostReason: c.lostReason || c.reasons || ''
                  };
             });
       }

       const reportId = `${adminId}_${weekStr}`;
       const docRef = doc(db, WEEKLY_REPORTS_COL, reportId);
       
       await setDoc(docRef, {
           id: reportId,
           adminId,
           adminName,
           weekStr,
           problems_notes: notes,
           metrics: {
               callsMade: summary?.activity?.saves || 0,
               dealsWon: (summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0)
           },
           customer_transactions: customerTransactions,
           submittedAt: new Date().toISOString()
       });

       return true;
    } catch (e) {
       console.error("Submit Weekly Report Error", e);
       return false;
    }
  },

  async getWeeklyReports(adminIdFilter = null, limitCount = 50) {
      try {
          let constraints = [orderBy('submittedAt', 'desc'), limit(limitCount)];
          if (adminIdFilter) {
              constraints.unshift(where('adminId', '==', adminIdFilter));
          }
          const q = query(collection(db, WEEKLY_REPORTS_COL), ...constraints);
          const snap = await getDocs(q);
          return snap.docs.map(d => d.data());
      } catch (e) {
          console.error("Fetch Weekly Reports Error", e);
          return [];
      }
  },

  // --- System Setup ---
  async fullResetAndSeed(onProgress = null) {
    const report = (pct, msg) => { if (onProgress) onProgress(pct, msg); console.log(`[${pct}%] ${msg}`); };
    
    report(10, "เริ่มตั้งค่าระบบใหม่และล้างข้อมูลใน Firebase...");
    
    const users = [
        { id: 'm1', username: 'basil@coldcall.com', password: '1234', name: 'Manager Basil', role: 'manager', color: '#4F46E5' },
        { id: 'a1', username: 'khaofang@coldcall.com', password: '1234', name: 'ข้าวฟ่าง', role: 'admin', color: '#E9D5FF' },
        { id: 'a2', username: 'tim@coldcall.com', password: '1234', name: 'ทิม', role: 'admin', color: '#374151' },
        { id: 'a3', username: 'thee@coldcall.com', password: '1234', name: 'ธีร์', role: 'admin', color: '#D1FAE5' },
        { id: 'a4', username: 'nice@coldcall.com', password: '1234', name: 'ไนซ์', role: 'admin', color: '#FEE2E2' },
        { id: 'a5', username: 'ploy@coldcall.com', password: '1234', name: 'พลอย', role: 'admin', color: '#FEF3C7' },
        { id: 'a6', username: 'toey@coldcall.com', password: '1234', name: 'Toey', role: 'admin', color: '#DBEAFE' }
    ];

    for (const u of users) {
        await setDoc(doc(db, USERS_COL, u.id), { ...u, createdAt: serverTimestamp() });
    }
    
    report(100, "ล้างและเซ็ตอัปข้อมูลผู้ใช้งานในระบบเรียบร้อย!");
    return { success: true };
  },

  async clearProjectData() {
    const collectionsToClear = [CUSTOMERS_COL, LOGS_COL, TOPICS_COL, WEEKLY_REPORTS_COL];
    
    for (const colName of collectionsToClear) {
      console.log(`Clearing collection: ${colName}`);
      let finished = false;
      while (!finished) {
        const q = query(collection(db, colName), limit(500));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          finished = true;
          break;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${snapshot.size} docs from ${colName}`);
        
        if (snapshot.size < 500) {
          finished = true;
        }
      }
    }
    return { success: true };
  },

  async generateMockupData(onProgress = null) {
      const report = (pct, msg) => { if (onProgress) onProgress(pct, msg); console.log(`[Mockup ${pct}%] ${msg}`); };
      report(5, "กำลังจำลองฐานข้อมูลหลัก (เริ่ม 1 มกราคม 2569)...");
      
      const adminList = [
         { id: 'a5', name: 'พลอย', color: '#ec4899' }, 
         { id: 'a2', name: 'ทิม', color: '#3b82f6' }, 
         { id: 'a1', name: 'ข้าวฟ่าง', color: '#10b981' },
         { id: 'a4', name: 'ไนซ์', color: '#6366f1' },
         { id: 'a3', name: 'ธีร์', color: '#f59e0b' },
         { id: 'a6', name: 'Toey', color: '#14b8a6' }
      ];

      const THAI_FIRSTNAMES = ["สมชาย", "สมหญิง", "กิตติ", "วิภา", "อนุชา", "ดวงพร", "ณัฐพล", "สุพัตรา", "ธีรพล", "วิไลพร", "ธนพล", "นภา", "สุนิสา", "มานพ", "สมพร"];
      const THAI_LASTNAMES = ["ใจดี", "มีทรัพย์", "ศรีสุข", "รุ่งเรือง", "รักสงบ", "วงศ์วิเศษ", "พัฒนาการ", "ดีเลิศ", "ประเสริฐ", "สมบูรณ์", "สว่างดี"];
      const leadLostReasonsList = ["เศรษฐกิจไม่ดี", "ไม่มีงบประมาณ", "ใช้เจ้าอื่นอยู่", "ไม่สะดวกคุย", "ขอโปรโมชั่นเพิ่ม", "ติดต่อไม่ได้", "ยังไม่สนใจตอนนี้"];
      const retLostReasonsList = ["สินค้าเหลือเยอะ", "ราคาแพงเกินไป", "ยังไม่มีรอบสั่งซ้ำ", "ติดต่อยากมาก", "ใช้บริการที่อื่น"];

      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      const randArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const randPhone = () => `08${randInt(10000000, 99999999)}`;
      
      const startDate = new Date(2026, 0, 1); // 1 Jan 2026
      const endDate = new Date(); // Today
      const totalDays = Math.max(1, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));
      
      const getRandomDate = (startObj, endObj) => {
         const s = startObj.getTime();
         const e = endObj.getTime();
         const target = new Date(s + Math.random() * (e - s));
         target.setHours(randInt(8, 20), randInt(0, 59), 0, 0);
         return target;
      };

      const customers = [];
      const logs = [];
      
      report(15, "กำลังจำลองข้อมูลลูกค้าและประวัติกิจกรรมย้อนหลัง 4 เดือน...");
      for (let i = 0; i < 1000; i++) {
          const fname = randArr(THAI_FIRSTNAMES);
          const lname = randArr(THAI_LASTNAMES);
          const phone = randPhone();
          
          const createdDate = getRandomDate(startDate, endDate);
          const admin = randArr(adminList);
          
          const survivalRoll = Math.random();
          
          let stage = 'pool';
          let status = '🆕 รายใหม่';
          let responsibleId = null;
          let responsibleName = "Unassigned";
          let type = 'ยังไม่ระบุ';
          let updatedAt = createdDate;

          const actionDateStart = new Date(createdDate.getTime());
          actionDateStart.setDate(actionDateStart.getDate() + randInt(0, 2));

          const addLog = (typeStr, cStage, comment, reasons = [], logDate) => {
             if (logDate > endDate) logDate = endDate;
             if (logDate > updatedAt) updatedAt = logDate;
             logs.push({
                customerId: phone,
                adminId: responsibleId,
                adminName: responsibleName,
                type: typeStr,
                customerStage: cStage,
                comment,
                reasons,
                timestamp: Timestamp.fromDate(logDate)
             });
          };

          if (survivalRoll < 0.15) {
             stage = 'pool';
             status = '🆕 รายใหม่';
             type = 'ยังไม่ระบุ';
          } 
          else {
             responsibleId = admin.id;
             responsibleName = admin.name;
             
             let callCount = randInt(1, 3);
             let currentLogDate = new Date(actionDateStart.getTime());
             
             for(let k=0; k<callCount; k++) {
                  currentLogDate.setHours(currentLogDate.getHours() + randInt(1, 48));
                  addLog('call', 'qualified', `(ระบบ) โทรติดต่อลูกค้าครั้งที่ ${k+1}`, [], new Date(currentLogDate));
             }

             if (survivalRoll < 0.50) {
                  stage = 'qualified';
                  type = 'ยังไม่เคยเปิดบิล';
                  if (Math.random() > 0.5) {
                     status = '⏳ รอตัดสินใจ';
                     addLog('save', 'qualified', 'ส่งใบเสนอราคาแล้ว ลูกค้าขอคิดดูก่อน', [], new Date(currentLogDate));
                  } else {
                     status = '❌ ปิดเสีย (Lost)';
                     addLog('save', 'qualified', 'ลูกค้าขอยกเลิกและไม่สนใจบริการ', [randArr(leadLostReasonsList)], new Date(currentLogDate));
                  }
             } 
             else {
                  stage = 'customer';
                  status = '✅ สั่งซื้อซ้ำสำเร็จ';
                  type = 'ยังไม่เคยเปิดบิล';
                  
                  addLog('save', 'qualified', 'ลูกค้าโอนเงินเรียบร้อย ปิดยอดการขาย', [], new Date(currentLogDate));
                  
                  const retentionDate = new Date(currentLogDate.getTime());
                  retentionDate.setDate(retentionDate.getDate() + randInt(5, 25));
                  
                  if (retentionDate <= endDate) {
                     type = 'เคยสั่งซื้อซ้ำ';
                     addLog('call', 'customer', 'โทรติดตามความพึงพอใจและเสนอโปรสั่งซื้อซ้ำ', [], retentionDate);
                     
                     const retSuccess = Math.random();
                     if (retSuccess > 0.6) {
                        status = '✅ สั่งซื้อซ้ำสำเร็จ';
                        addLog('save', 'customer', 'ลูกค้าตอบรับและสั่งซื้อสินค้าเพิ่มสำเร็จ', [], new Date(retentionDate.getTime() + 1000*60*60));
                     } else {
                        status = '🟡 ยังไม่สั่งซื้อซ้ำ';
                        addLog('save', 'customer', 'ลูกค้ายังมีของเหลือในสต็อกและยังไม่สั่งซื้อซ้ำ', [randArr(retLostReasonsList)], new Date(retentionDate.getTime() + 1000*60*60));
                     }
                  } else {
                     type = 'เคยสั่งซื้อซ้ำ';
                     status = '🟡 ยังไม่สั่งซื้อซ้ำ'; 
                  }
             }
          }
          
          customers.push({
             name: `${fname} ${lname}`,
             phone,
             stage,
             status,
             responsibleId,
             responsibleName,
             type,
             createdAt: Timestamp.fromDate(createdDate),
             updatedAt: Timestamp.fromDate(updatedAt)
          });
      }

      report(40, "จำลองข้อมูลสำเร็จแล้ว กำลังสร้างรายงานสรุปรายสัปดาห์ 16 สัปดาห์ย้อนหลัง...");
      const mockReports = [];
      const reportReasons = ["ลูกค้าบ่นเรื่องเศรษฐกิจไม่ค่อยดี", "งบประมาณค่อนข้างจำกัด", "ใช้สินค้าแบรนด์คู่แข่งเป็นหลัก", "ต้องการโปรโมชั่นลดราคาส่งมากกว่านี้", "บริการขนส่งค่อนข้างช้าบางรอบ", "แอดมินปิดการขายได้ช้าลงเล็กน้อย", "ต้องการตัวเลือกสินค้าที่หลากหลายขึ้น", "ระบบแอปค่อนข้างเสถียรขึ้นมาก"];
      
      const weeksToGen = Math.ceil(totalDays / 7);
      
      for (const adm of adminList) {
         for (let w = 0; w < weeksToGen; w++) {
            const weekDate = new Date(startDate.getTime());
            weekDate.setDate(weekDate.getDate() + (w * 7) + 6);
            
            if (weekDate > endDate) continue;
            
            const weekStr = `W${w+1}_${weekDate.toLocaleString('en-us', {month:'short'})}_${weekDate.getFullYear()}`;
            mockReports.push({
               adminId: adm.id,
               adminName: adm.name,
               weekStr: weekStr,
               note: `[สรุปรายงาน] ${randArr(reportReasons)} ภาพรวมสรุปงานสัปดาห์นี้เรียบร้อยครับ`,
               submittedAt: Timestamp.fromDate(weekDate),
               stats: { test: true },
               customer_transactions: []
            });
         }
      }

      report(50, `กำลังจำลองข้อมูลลูกค้าลงฐานข้อมูล... (Firestore Batching)`);
      let currentBatch = writeBatch(db);
      let opCount = 0;
      
      const commitBatchIfNeeded = async (force=false) => {
         if (opCount >= 450 || force) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            opCount = 0;
         }
      };

      for (const c of customers) {
         currentBatch.set(doc(db, CUSTOMERS_COL, c.phone), c);
         opCount++;
         await commitBatchIfNeeded();
      }

      report(70, `กำลังบันทึกประวัติการโทรและปรับสถานะ (Logs) จำนวน ${logs.length} รายการ...`);
      logs.sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());
      for (const l of logs) {
         currentBatch.set(doc(collection(db, LOGS_COL)), l);
         opCount++;
         await commitBatchIfNeeded();
      }

      report(90, `กำลังบันทึกรายงานสรุปผลรายสัปดาห์ (Weekly Reports) จำนวน ${mockReports.length} ชุด...`);
      for (const r of mockReports) {
         currentBatch.set(doc(collection(db, WEEKLY_REPORTS_COL)), r);
         opCount++;
         await commitBatchIfNeeded();
      }
      
      await commitBatchIfNeeded(true);
      report(100, "กระบวนการจำลองข้อมูล 4 เดือนย้อนหลังเสร็จสมบูรณ์เรียบร้อย!");
      return { success: true };
  },

  async assignCustomers(customerIds, adminId, adminName) {
    const batch = customerIds.map(id => updateDoc(doc(db, CUSTOMERS_COL, id), {
      responsibleId: adminId,
      responsibleName: adminName,
      updatedAt: serverTimestamp()
    }));
    await Promise.all(batch);
    return { success: true };
  },

  async unassignRandomCustomers(count = 50) {
    try {
      const q = query(collection(db, CUSTOMERS_COL), where("responsibleId", "!=", null), limit(count));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return { success: true, count: 0 };
      
      const batch = snapshot.docs.map(d => updateDoc(doc(db, CUSTOMERS_COL, d.id), {
        responsibleId: null,
        responsibleName: 'Unassigned',
        updatedAt: serverTimestamp()
      }));
      await Promise.all(batch);
      return { success: true, count: snapshot.size };
    } catch (e) {
      console.error(e);
      return { success: false, count: 0 };
    }
  },

  async generatePoolLeads(count = 50) {
    try {
      const generatePhone = () => '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      let batch = writeBatch(db);
      for(let i=0; i<count; i++) {
        const phone = generatePhone();
        batch.set(doc(db, CUSTOMERS_COL, phone), {
          phone: phone,
          name: `Bot Pool Customer ${Math.floor(Math.random() * 1000)}`,
          customerNo: `BP${Math.floor(Math.random() * 10000)}`,
          stage: 'pool',
          status: '🆕 รายใหม่',
          type: 'ยังไม่ระบุ',
          source: 'System Generated',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          responsibleId: null,
          responsibleName: 'Unassigned',
          stats: { callCount: 0 }
        });
      }
      await batch.commit();
      return { success: true, count };
    } catch (e) {
      console.error(e);
      return { success: false, count: 0 };
    }
  },

  async addManualLead(leadData) {
    try {
      const docRef = doc(db, CUSTOMERS_COL, leadData.phone);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        throw new Error("มีเบอร์โทรนี้ในระบบแล้ว");
      }
      await setDoc(docRef, {
        phone: leadData.phone,
        name: leadData.name || 'ไม่ประสงค์ออกนาม',
        customerNo: leadData.customerNo || `M-${Date.now().toString().slice(-4)}`,
        businessType: leadData.businessType || '',
        stage: 'pool',
        status: leadData.status || '🆕 รายใหม่',
        type: 'ยังไม่ระบุ',
        source: 'Manual Upload',
        bot_score: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responsibleId: null,
        responsibleName: 'Unassigned',
        stats: { callCount: 0 }
      });
      return true;
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  async getCustomer(id) {
    try {
      const docRef = doc(db, CUSTOMERS_COL, id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { ...snap.data(), id: snap.id };
    } catch (err) {
      console.error("Get Customer Error:", err);
      return null;
    }
  },

  async updateCustomer(customerId, updates) {
    const customerRef = doc(db, CUSTOMERS_COL, customerId);
    
    // Smart Stage Transition Logic
    let stage = updates.stage;
    
    // 1. If status is "Closed Won" (สั่งซื้อซ้ำสำเร็จ/ส่งเสนอราคาเรียบร้อย), move to 'customer' stage
    const isWonStatus = updates.status?.includes('สั่งซื้อซ้ำ') || 
                        updates.status?.includes('ส่งเสนอราคา') ||
                        updates.formState?.status?.includes('สั่งซื้อซ้ำ') ||
                        updates.formState?.status?.includes('ส่งเสนอราคา');

    if (isWonStatus) {
      stage = 'customer';
    }
    
    // 2. If it's in pool and gets a score (from admin or bot), move to 'qualified'
    const currentCustomer = (await getDoc(customerRef)).data();
    if (currentCustomer && currentCustomer.stage === 'pool' && (updates.formState?.score !== undefined || updates.bot_score !== undefined)) {
        stage = 'qualified';
    }

    const finalUpdates = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    if (stage) finalUpdates.stage = stage;

    // Record won/lost timestamps for retention tracking
    if (isWonStatus && currentCustomer?.stage !== 'customer') {
      finalUpdates.wonAt = serverTimestamp();
    } else if (updates.status?.includes('ไม่สนใจ') || updates.status?.includes('ปิดเครื่อง') ||
               updates.formState?.status?.includes('ไม่สนใจ') || updates.formState?.status?.includes('ปิดเครื่อง')) {
      finalUpdates.lostAt = serverTimestamp();
    }

    // Sync Frequency to Days for dashboard logic
    if (updates.freqAmount !== undefined || updates.freqUnit !== undefined) {
      const amt = updates.freqAmount ?? currentCustomer?.freqAmount ?? 1;
      const unit = updates.freqUnit ?? currentCustomer?.freqUnit ?? 'สัปดาห์';
      finalUpdates.followUpFrequencyDays = unit === 'เดือน' ? amt * 30 : amt * 7;
    }

    await updateDoc(customerRef, finalUpdates);
    return { success: true, newStage: stage };
  },

  async getAdminTaskSummary(adminId) {
    try {
      const custKey = `custs_${adminId}`;
      let all = reqCache.get(custKey);
      if (!all) {
          const q = query(collection(db, CUSTOMERS_COL), where("responsibleId", "==", adminId));
          const snapshot = await getDocs(q);
          all = reqCache.set(custKey, snapshot.docs.map(d => d.data()));
      }

      // Fetch logs for this admin from this week (Mon-Sun)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const logKey = `logs_${adminId}_${startOfWeek.getTime()}_${endOfWeek.getTime()}`;
      let thisWeekLogs = reqCache.get(logKey);
      if (!thisWeekLogs) {
          const qLogs = query(
            collection(db, LOGS_COL),
            where("adminId", "==", adminId),
            where("timestamp", ">=", startOfWeek),
            where("timestamp", "<", endOfWeek)
          );
          const snapLogs = await getDocs(qLogs);
          thisWeekLogs = reqCache.set(logKey, snapLogs.docs.map(d => d.data()));
      }

      const touchedPhones = new Set(
        thisWeekLogs.filter(l => l.type === 'call' || l.type === 'save').map(l => l.customerId)
      );

      const newLeadsTotal = all.filter(c => c.stage === 'qualified').length;
      const retentionTotal = all.filter(c => c.stage === 'customer').length;
      const newLeadsDone = all.filter(c => c.stage === 'qualified' && touchedPhones.has(c.phone)).length;
      const retentionDone = all.filter(c => c.stage === 'customer' && touchedPhones.has(c.phone)).length;

      return {
        newLeads: newLeadsTotal,
        retention: retentionTotal,
        newLeadsDone,
        retentionDone
      };
    } catch (err) {
      console.error("Task Summary Error:", err);
      return { newLeads: 0, retention: 0, newLeadsDone: 0, retentionDone: 0 };
    }
  },


  async getNextPriorityLead(adminId) {
    try {
      const q = query(
        collection(db, CUSTOMERS_COL), 
        where("responsibleId", "==", adminId),
        where("stage", "==", "qualified"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id };
    } catch (err) {
      console.error("Next Lead Error:", err);
      return null;
    }
  },

  async deleteCustomer(id) {
    await deleteDoc(doc(db, CUSTOMERS_COL, id));
    return { success: true };
  },

  async manualSync() {
    try {
      const syncCall = httpsCallable(functions, 'manualFullPipelineSync');
      const result = await syncCall();
      return { success: true, result: result.data };
    } catch (err) {
      console.error("Manual Sync Error:", err);
      throw err;
    }
  },

  async syncFromSheetsHybrid(onProgress = null) {
    const report = (pct, msg) => { if (onProgress) onProgress(pct, msg); };

    try {
      report(5, "กำลังเริ่มการเชื่อมต่อกับ Google Sheets...");
      const fetchCall = httpsCallable(functions, 'fetchGoogleSheetData');
      const { data } = await fetchCall();

      if (!data || !data.success) throw new Error("ไม่สามารถดึงข้อมูลจาก Sheets ได้");

      const phases = [
        { stage: 'pool', items: data.data.pool },
        { stage: 'qualified', items: data.data.qualified },
        { stage: 'customer', items: data.data.customer }
      ];

      const totalItems = phases.reduce((acc, p) => acc + p.items.length, 0);
      let processedCount = 0;
      
      report(10, `พบข้อมูลดิบทั้งหมด ${totalItems} รายการ กำลังเริ่มบันทึกเข้าฐานข้อมูล...`);

      for (const phase of phases) {
        const { stage, items } = phase;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const item of items) {
          const docRef = doc(db, CUSTOMERS_COL, item.phone);
          batch.set(docRef, {
            name: item.name,
            phone: item.phone,
            stage: stage,
            updatedAt: serverTimestamp()
          }, { merge: true });

          batchCount++;
          processedCount++;

          if (batchCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
            
            const pct = Math.floor((processedCount / totalItems) * 80) + 10;
            report(pct, `กำลังบันทึกข้อมูล (${stage}): ${processedCount} / ${totalItems}`);
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      report(100, `นำเข้าข้อมูลลูกค้าดิบจำนวน ${totalItems} รายการ สำเร็จเรียบร้อย!`);
      return { success: true, totalProcessed: totalItems };

    } catch (err) {
      console.error("Hybrid Sync Error:", err);
      throw err;
    }
  },
  
  // --- Step-by-Step Evolution Mockup ---
  async getEvolutionStep() {
    const TEST_PHONE = '099-TEST-EVO';
    const docRef = doc(db, CUSTOMERS_COL, TEST_PHONE);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return 0;
    const data = snap.data();
    if (data.stage === 'pool' && data.status === 'ในคลังหลัก') return 1;
    if (data.stage === 'pool' && data.status === '🆕 รายใหม่') return 2;
    if (data.stage === 'qualified') return 3;
    if (data.stage === 'customer') return 4;
    return 0;
  },

  async evolveMockupLead() {
    const TEST_PHONE = '099-TEST-EVO';
    const NICE_ADMIN_ID = 'a4';
    const NICE_ADMIN_NAME = 'ไนซ์';
    const step = await this.getEvolutionStep();
    const docRef = doc(db, CUSTOMERS_COL, TEST_PHONE);

    if (step === 0) {
      // Create Step 1: Master Pool
      await setDoc(docRef, {
        customerNo: 'EVO-001',
        name: 'ชัยชนะ นามวัฒน์ (Evolution)',
        phone: TEST_PHONE,
        businessType: 'ธุรกิจร้านสะดวกซื้อ',
        stage: 'pool',
        status: 'ในคลังหลัก',
        type: 'ยังไม่ระบุ',
        source: 'Evolution System',
        bot_score: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responsibleId: null,
        responsibleName: 'Unassigned',
        stats: { callCount: 0 }
      });
      return 1;
    }

    if (step === 1) {
      // Move to Step 2: New Leads (Bot screen)
      await updateDoc(docRef, {
        status: '🆕 รายใหม่',
        bot_score: 4,
        bot_ratingText: 'ลูกค้ามีความสนใจ ซื้อใช้ส่วนตัวและต้องการทดลองใช้ปริมาณ 5,000 ชิ้น/เดือน',
        q1_business: 'ร้านค้าปลีกของตนเองในพื้นที่ภาคเหนือ',
        q2_usage: '5,000 ชิ้น/เดือน',
        q3_sample: 'สนใจขอรับตัวอย่างทดลองใช้งาน 1 ชุด',
        q4_visit: 'สนใจและต้องการรายละเอียดทางไลน์เพิ่มเติม',
        updatedAt: serverTimestamp()
      });
      return 2;
    }

    if (step === 2) {
      // Move to Step 3: Qualified (Admin Nice follow up)
      await updateDoc(docRef, {
        stage: 'qualified',
        status: '🤔 รอตัดสินใจ',
        responsibleId: NICE_ADMIN_ID,
        responsibleName: NICE_ADMIN_NAME,
        updatedAt: serverTimestamp(),
        matchingTopics: [
          { id: 't1', title: 'สอบถามรายละเอียด', checked: true, detail: 'สนใจสั่งซื้อขั้นต่ำ 10 กล่อง แถม 1', problem: 'ราคาส่งยังสูงเกินไปเล็กน้อย' },
          { id: 't2', title: 'ขอดูตัวอย่างสินค้า', checked: true, detail: 'ส่งตัวอย่างและใบเสนอราคาแล้ว', problem: '' }
        ]
      });

      // Add simulated logs
      const logs = [
        { action: 'เปิดข้อมูลผู้มุ่งหวัง (Lead): ชัยชนะ นามวัฒน์ (Evolution)', type: 'open' },
        { action: 'โทรติดต่อ: ติดตามข้อมูลสินค้าและตัวอย่างที่จัดส่ง', type: 'call' },
        { action: 'บันทึกเพิ่มเติม: ลูกค้าขอส่วนลดเพิ่มเติมกรณีสั่งเกิน 10,000 ชิ้น', type: 'note' }
      ];

      for (const log of logs) {
        await this.logActivity({
          ...log,
          adminId: NICE_ADMIN_ID,
          adminName: NICE_ADMIN_NAME,
          customerId: TEST_PHONE,
          customerName: 'ชัยชนะ นามวัฒน์ (Evolution)',
          customerPhone: TEST_PHONE,
          customerStage: 'qualified'
        });
      }
      return 3;
    }

    if (step === 3) {
      // Move to Step 4: Customer (Admin Nice closed)
      await updateDoc(docRef, {
        stage: 'customer',
        status: '✅ ปิดการขาย',
        updatedAt: serverTimestamp(),
        closingRecord: {
          status: '✅ ปิดการขาย',
          note: 'ปิดการสั่งซื้อรอบแรกยอดรวม 8,500 บาท ลูกค้าโอนเงินเรียบร้อยเพื่อรับโปรโมชั่นนี้',
          score: 5,
          nextFollowUp: '1 เดือน'
        }
      });

      await this.logActivity({
        action: 'ปิดการขายสำเร็จ ยอดโอน 8,500 บาท',
        type: 'sale',
        adminId: NICE_ADMIN_ID,
        adminName: NICE_ADMIN_NAME,
        customerId: TEST_PHONE,
        customerName: 'ชัยชนะ นามวัฒน์ (Evolution)',
        customerPhone: TEST_PHONE,
        customerStage: 'customer'
      });
      return 4;
    }

    if (step === 4) {
      // Reset logic: Delete and start over
      await deleteDoc(docRef);
      return 0;
    }
    
    return 0;
  }
};
