/**
 * reset_and_seed_full.js  — Batch-optimised version
 * Firestore batch writes: max 500 ops per batch
 * Run: node scripts/reset_and_seed_full.js
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyJuWH6NYUIehFib7NVBGkLGG7vhKuv9g",
  authDomain: "catalogue21-92e8b.firebaseapp.com",
  projectId: "catalogue21-92e8b",
  storageBucket: "catalogue21-92e8b.firebasestorage.app",
  messagingSenderId: "828111651708",
  appId: "1:828111651708:web:d142df49753d1b77989af9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COL_CUSTOMERS = "coldcall_customers";
const COL_LOGS = "coldcall_logs";
const COL_USERS = "coldcall_users";
const COL_TOPICS = "coldcall_topics";

// ── batch helper: flush every 499 ops ────────────────────────────────────────
class BatchWriter {
  constructor(db) {
    this.db = db;
    this.batch = writeBatch(db);
    this.ops = 0;
    this.total = 0;
  }
  async set(ref, data) {
    this.batch.set(ref, data);
    this.ops++;
    this.total++;
    if (this.ops >= 499) await this.flush();
  }
  async delete(ref) {
    this.batch.delete(ref);
    this.ops++;
    this.total++;
    if (this.ops >= 499) await this.flush();
  }
  async flush() {
    if (this.ops > 0) {
      await this.batch.commit();
      this.batch = writeBatch(this.db);
      this.ops = 0;
    }
  }
}

// ── constants ─────────────────────────────────────────────────────────────────
const ADMINS = [
  { id: 'a1', username: 'khaofang@coldcall.com', password: '1234', name: 'ข้าวฟ่าง', color: '#E9D5FF' },
  { id: 'a2', username: 'tim@coldcall.com', password: '1234', name: 'ทิม', color: '#374151' },
  { id: 'a3', username: 'thee@coldcall.com', password: '1234', name: 'ธีร์', color: '#DCFCE7' },
  { id: 'a4', username: 'nice@coldcall.com', password: '1234', name: 'ไนซ์', color: '#FEE2E2' },
  { id: 'a5', username: 'ploy@coldcall.com', password: '1234', name: 'พลอย', color: '#FEF3C7' },
  { id: 'a6', username: 'toey@coldcall.com', password: '1234', name: 'Toey', color: '#DBEAFE' }
];
const MANAGER = { id: "m1", name: "Manager Basil", color: "#0ea5e9", role: "manager", username: "basil", password: "password123" };
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const WEEKS = [1, 2, 3, 4];
const PROVINCES = ["กรุงเทพฯ","นนทบุรี","ปทุมธานี","สมุทรปราการ","สมุทรสาคร","ชลบุรี","ระยอง","จันทบุรี","ตราด","สระแก้ว","เชียงใหม่","เชียงราย","ลำปาง","ภูเก็ต","สุราษฎร์ธานี","กระบี่","ขอนแก่น","อุดรธานี","นครราชสีมา","บุรีรัมย์","อุบลราชธานี","พิษณุโลก","นครสวรรค์","อยุธยา","ราชบุรี","เพชรบุรี"];
const BIZ_PREFIX = ["บจก.","หจก.","ร้าน","โรงงาน","ศูนย์บริการ","บริษัท"];
const BIZ_NAME = ["ก้าวหน้า","รุ่งเรือง","มั่งคั่ง","ทวีโชค","ไทยเจริญ","สยาม","สมบูรณ์","โชคชัย","มณีรัตน์","พรประเสริฐ","วิวัฒน์","เจริญทรัพย์","ภูมิใจ","นวัตกรรม","ทองดี","สุขใจ","เพชรทอง","เอกชัย","ศิริมงคล","อนันต์"];
const BIZ_SUFFIX = ["พลาสติก","วิศวกรรม","เคหะภัณฑ์","การไฟฟ้า","โลหะการ","ก่อสร้าง","เอ็นจิเนียริ่ง","เทรดดิ้ง","ซัพพลาย","อุตสาหกรรม","ออโตเมชั่น","เซอร์วิส","กรุ๊ป","อินเตอร์","โฮลดิ้ง"];
const CALL_OUTCOMES = ["ลูกค้าไม่รับสาย โทรใหม่รอบบ่าย","คุยข้อมูลเบื้องต้น ลูกค้าสนใจขอรายละเอียดทาง Line","ลูกค้าติดประชุม ขอโทรกลับพรุ่งนี้","แจ้งโปรโมชั่นประจำเดือน ลูกค้ารอตัดสินใจกับหัวหน้า","ลูกค้าสนใจ ขอใบเสนอราคา","ส่งแคตตาล็อกทาง Line แล้ว","ลูกค้าขอเวลาเช็คสต๊อกก่อน","คุยนานประมาณ 15 นาที ลูกค้าสนใจมาก","โทรไม่ติด เปลี่ยนเบอร์ใหม่แล้ว","ลูกค้าแจ้งว่าต้องการราคาพิเศษสำหรับล็อตใหญ่"];
const PAGE_NAMES = ["ภาพรวมระบบ","จัดการลูกค้าใหม่","การติดตามลูกค้า (Retention)","มอบหมายงานพนักงาน","ประวัติการทำงานแอดมิน","ตั้งค่าระบบ","คลังรายชื่อ (เบอร์รอโทร)","ผลงานของฉัน"];
const LOST_REASONS = ["ราคาแพงเกินไป","ยังไม่พร้อมซื้อในตอนนี้","เทียบราคากับเจ้าอื่นอยู่","ขอคุยกับหัวหน้าก่อน","งบประมาณไม่เพียงพอ","ไม่ตรงกับความต้องการ","รอตัดสินใจเดือนหน้า","เลือกใช้แบรนด์อื่น"];
const WON_REASONS = ["โปรโมชั่นดีมาก","ส่งสินค้าเร็ว มีสต๊อก","คุณภาพดี ราคาสมเหตุสมผล","แนะนำโดยลูกค้าเก่า","เคยใช้แล้วดี สั่งซ้ำ","เซลล์บริการดีมาก"];

// ── helpers ───────────────────────────────────────────────────────────────────
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const sample = (arr, n) => shuffle(arr).slice(0, Math.min(n, arr.length));
const randomPhone = () => pick(["081","089","092","064","095","086","062","065","097","098"]) + rand(1000000, 9999999);
const randomBiz = () => `${pick(BIZ_PREFIX)} ${pick(BIZ_NAME)}${pick(BIZ_SUFFIX)}`;
const NOW = new Date("2026-04-05T22:00:00+07:00");
const randDate = (daysBack) => { const d=new Date(NOW); d.setDate(d.getDate()-rand(0,daysBack)); d.setHours(rand(8,19),rand(0,59),0,0); return d; };
const ts = (d) => Timestamp.fromDate(d);
const newId = () => doc(collection(db, "_")).id; // auto-id trick

// ── snapshots ─────────────────────────────────────────────────────────────────
function makeLeadSnap(outcome = "pending") {
  const topics = [
    { id:1, title:"สินค้า (Product)", checked:Math.random()>0.3, detail:"สอบถามคุณภาพ", problem:"" },
    { id:2, title:"ราคา (Pricing)", checked:Math.random()>0.4, detail:"ขอส่วนลดล็อตใหญ่", problem:"" },
    { id:3, title:"บริการ (Service)", checked:Math.random()>0.6, detail:"สอบถามการส่ง", problem:outcome==="lost"?pick(LOST_REASONS):"" },
    { id:4, title:"สนใจสินค้าตัวอย่าง", checked:Math.random()>0.5, detail:"", problem:"" },
    { id:5, title:"สนใจให้เซลล์เข้าพบ", checked:Math.random()>0.7, detail:"นัดคุยเพิ่ม", problem:"" },
  ].filter(t => t.checked || Math.random()>0.5);

  let status = "🟡 รอการตัดสินใจ (Pending)";
  let orderDetail = pick(["ขอเวลา 2-3 วัน","รอเช็คสต๊อก","ขอใบเสนอราคา","ขอเทียบราคา"]);
  let remark = pick(["ติดตามพรุ่งนี้","นัดคุยอีกครั้ง","ส่งแคตตาล็อกแล้ว"]);

  if (outcome === "won") { status="✅ สั่งซื้อแล้ว (Closed Won)"; orderDetail=pick(WON_REASONS); remark=pick(["คอนเฟิร์มออเดอร์","นัดส่งของ","ส่งรายละเอียดไลน์แล้ว"]); }
  if (outcome === "lost") { status="❌ ปฏิเสธการขาย (Closed Lost)"; orderDetail=pick(LOST_REASONS); remark=pick(["ปิดงานแล้ว","ลูกค้าไม่สนใจ","จะติดตามอนาคต"]); if(!topics.some(t=>t.problem)) topics.push({id:99,title:"ปัญหา",checked:true,detail:"",problem:orderDetail}); }

  return {
    formState: {
      checklist: { chat:Math.random()>0.4, group:Math.random()>0.8, remark:Math.random()>0.5?"ทักแล้ว":"" },
      callTracking: { date:randDate(30).toISOString().slice(0,10), count:rand(0,8), remark:pick(["โทรแล้ว","ส่ง Line แล้ว",""]) },
      sampleStatus: { catalogue:Math.random()>0.5, sampleReceived:Math.random()>0.7, date:Math.random()>0.6?randDate(30).toISOString().slice(0,10):"" },
      visitStatus: { visit:Math.random()>0.8, month:Math.random()>0.7?pick(MONTHS_TH):"", remark:Math.random()>0.7?"นัดไว้แล้ว":"" },
      status, orderDetail, score:rand(0,5),
      prefTime: pick(["10:00-12:00","13:00-15:00","15:00-17:00",""]),
      remark,
    },
    matchingTopics: topics,
    _demo: true, _form: "lead",
  };
}

function makeRetentionSnap(includeOrder = false) {
  const gridData = {};
  const months = MONTHS_TH.slice(0, 4);
  for (let i=0; i<rand(5,18); i++) gridData[`${pick(months)}-${pick(WEEKS)}-followup`] = true;
  if (includeOrder) for (let i=0; i<rand(1,5); i++) gridData[`${pick(months)}-${pick(WEEKS)}-order`] = true;
  return {
    gridData,
    status: includeOrder ? pick(["สั่งสินค้าแล้ว","เปลี่ยนไปสั่ง shopee/zort/online","มีสินค้าอยู่"]) : pick(["ยังไม่สนใจออเดอร์","ซื้อกับยี่ห้ออื่น","รอของเก่าหมด","ขอคิดดูก่อน"]),
    remark: includeOrder ? pick(["ลูกค้าสั่งเพิ่ม","คอนเฟิร์มยอดแล้ว","สั่งออนไลน์แล้วแจ้งยอด"]) : pick(["งบไม่พอ","ยังไม่พร้อม","รอของเก่าใช้หมด","ขอเทียบราคา"]),
    type: pick(["ยังไม่เคยเปิดบิล","เคยสั่งซื้อแล้ว"]),
    freqAmount: rand(1,6), freqUnit: pick(["สัปดาห์","เดือน"]),
    _demo: true, _form: "retention",
  };
}

// ── wipe collection ────────────────────────────────────────────────────────────
async function wipeCol(colName, bw) {
  const snap = await getDocs(collection(db, colName));
  for (const d of snap.docs) await bw.delete(doc(db, colName, d.id));
  return snap.size;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("🚀 ColdCall — Full Reset & Seed  (Batch mode)");
  console.log("═══════════════════════════════════════════════════\n");

  const bw = new BatchWriter(db);

  // ── Phase 1: Wipe ──────────────────────────────────────────────────────────
  console.log("🧹 Phase 1: ลบข้อมูลเก่า...");
  const delC = await wipeCol(COL_CUSTOMERS, bw);
  const delL = await wipeCol(COL_LOGS, bw);
  await bw.flush();
  console.log(`  ✅ ลบ customers: ${delC}, logs: ${delL}`);

  // ── Phase 2: Users & Topics ────────────────────────────────────────────────
  console.log("\n👤 Phase 2: Users & Topics...");
  const allUsers = [
    ...ADMINS.map(a => ({ ...a, role:"admin" })),
    { ...MANAGER },
  ];
  for (const u of allUsers) {
    await bw.set(doc(db, COL_USERS, u.id), { ...u, currentStatus:"offline", lastActive:serverTimestamp(), createdAt:serverTimestamp() });
  }

  const TOPICS = ["สินค้า (Product)","ราคา (Pricing)","บริการ (Service)","สนใจสินค้าตัวอย่าง","สนใจให้เซลล์เข้าพบ","สอบถามโปรโมชั่น","ขอใบเสนอราคา","ร้องเรียนบริการ","ขอเสนอความร่วมมือ"];
  for (const title of TOPICS) {
    const q = query(collection(db, COL_TOPICS), where("title","==",title));
    const snap = await getDocs(q);
    if (snap.empty) {
      await bw.set(doc(collection(db, COL_TOPICS)), { title, isActive:true, createdAt:serverTimestamp() });
    }
  }
  await bw.flush();
  console.log(`  ✅ ${allUsers.length} users, ${TOPICS.length} topics`);

  // ── Phase 3: Customers ─────────────────────────────────────────────────────
  console.log("\n📦 Phase 3: สร้างลูกค้า...");
  const allCustomers = [];

  // Pool: 80
  for (let i=0; i<80; i++) {
    const ref = doc(collection(db, COL_CUSTOMERS));
    const d = randDate(60); 
    // Pool usually untouched, updatedAt = createdAt
    await bw.set(ref, { name:"", phone:randomPhone(), stage:"pool", bot_score:0, location:pick(PROVINCES), responsibleId:null, responsibleName:"Unassigned", status:"🆕 รอดำเนินการ", additionalPhones:[], createdAt:ts(d), updatedAt:ts(d) });
    allCustomers.push({ id:ref.id, name:"", phone:"", stage:"pool", responsibleId:null });
  }
  console.log("  ✅ Pool: 80");

  // Qualified: 120
  const qualifiedList = [];
  for (let i=0; i<120; i++) {
    const ref = doc(collection(db, COL_CUSTOMERS));
    const name = randomBiz(); const phone = randomPhone();
    const admin = Math.random()>0.2 ? pick(ADMINS) : null;
    const createdAt = randDate(120);
    // Guarantee some updates happened in the last 28 days for dashboard stats
    const updatedAt = Math.random()>0.3 ? randDate(28) : createdAt; 
    const score = rand(2,5);
    await bw.set(ref, { name, phone, stage:"qualified", bot_score:score, location:pick(PROVINCES), responsibleId:admin?.id||null, responsibleName:admin?.name||"Unassigned", status:"⏳ รอการตัดสินใจ (Pending)", type:"ยังไม่เคยเปิดบิล", date:updatedAt.toLocaleDateString("th-TH"), remark:pick(["บอทแจ้งว่าลูกค้าสนใจรายการสินค้าใหม่","ลูกค้าถามเรื่องการส่งสินค้า ต้องการตัวอย่างก่อน","บอทระบุว่าลูกค้าสนใจให้เซลล์เข้าพบ","ลูกค้าเน้นเรื่องคุณภาพ สนใจเกรดพรีเมียม"]), additionalPhones:Math.random()>0.7?[randomPhone()]:[], createdAt:ts(createdAt), updatedAt:ts(updatedAt) });
    const c = { id:ref.id, name, phone, stage:"qualified", responsibleId:admin?.id||null, responsibleName:admin?.name||"Unassigned" };
    allCustomers.push(c); qualifiedList.push(c);
  }
  console.log("  ✅ Qualified: 120");

  // Customer/Retention: 100
  const retentionList = [];
  for (let i=0; i<100; i++) {
    const ref = doc(collection(db, COL_CUSTOMERS));
    const name = randomBiz(); const phone = randomPhone();
    const admin = Math.random()>0.15 ? pick(ADMINS) : null;
    const createdAt = randDate(180); 
    // Guarantee some updates happened in the last 28 days for dashboard stats
    const updatedAt = Math.random()>0.2 ? randDate(28) : randDate(90);
    const hasOrders = Math.random()>0.3;
    const gridData = {};
    const months = MONTHS_TH.slice(0,4);
    for (let k=0; k<rand(4,14); k++) gridData[`${pick(months)}-${pick(WEEKS)}-followup`] = true;
    if (hasOrders) for (let k=0; k<rand(1,6); k++) gridData[`${pick(months)}-${pick(WEEKS)}-order`] = true;
    await bw.set(ref, { name, phone, stage:"customer", bot_score:5, location:pick(PROVINCES), responsibleId:admin?.id||null, responsibleName:admin?.name||"Unassigned", status:hasOrders?"✅ ปิดดีลสำเร็จ (Closed Won)":"⏳ รอการตัดสินใจ (Pending)", type:pick(["ลูกค้าเก่า","เคยสั่งซื้อแล้ว","ลูกค้า VIP"]), lastCallDate:updatedAt.toLocaleDateString("th-TH"), lastOrderDate:hasOrders?updatedAt.toLocaleDateString("th-TH"):"", freqAmount:rand(1,6), freqUnit:pick(["สัปดาห์","เดือน"]), gridData, additionalPhones:Math.random()>0.6?[randomPhone()]:[], createdAt:ts(createdAt), updatedAt:ts(updatedAt) });
    const c = { id:ref.id, name, phone, stage:"customer", responsibleId:admin?.id||null, responsibleName:admin?.name||"Unassigned" };
    allCustomers.push(c); retentionList.push(c);
  }
  await bw.flush();
  console.log("  ✅ Customer: 100");
  console.log(`  📊 รวม: ${allCustomers.length} รายการ`);

  // ── Phase 4: Logs ──────────────────────────────────────────────────────────
  console.log("\n📜 Phase 4: สร้าง Activity Logs...");
  const assigned = allCustomers.filter(c => c.responsibleId && c.stage !== "pool");
  let logCount = 0;

  const addLog = async (data) => {
    const ref = doc(collection(db, COL_LOGS));
    await bw.set(ref, data);
    logCount++;
  };

  // 4A. Login / Logout
  for (const admin of ADMINS) {
    for (let s=0; s<rand(18,35); s++) {
      const loginTime = randDate(90);
      const mins = rand(60,480);
      const logoutTime = new Date(loginTime.getTime() + mins*60000);
      await addLog({ adminId:admin.id, adminName:admin.name, customerId:null, customerName:null, action:"เข้าสู่ระบบ", type:"login", details:"", duration:null, timestamp:ts(loginTime) });
      await addLog({ adminId:admin.id, adminName:admin.name, customerId:null, customerName:null, action:`ออกจากระบบ (ทำงานนาน ${mins} นาที)`, type:"logout", details:`Session duration: ${mins*60} seconds`, duration:mins*60, timestamp:ts(logoutTime) });
    }
  }

  // 4B. Navigate
  for (const admin of ADMINS) {
    for (let n=0; n<rand(40,100); n++) {
      await addLog({ adminId:admin.id, adminName:admin.name, customerId:null, customerName:null, action:`เปิดหน้า: ${pick(PAGE_NAMES)}`, type:"navigate", details:"", duration:null, timestamp:ts(randDate(90)) });
    }
  }

  // 4C. Assign (Manager → Admin)
  for (const admin of ADMINS) {
    const myCusts = assigned.filter(c => c.responsibleId === admin.id);
    if (myCusts.length === 0) continue;
    for (let b=0; b<rand(3,8); b++) {
      const batch = sample(myCusts, rand(3,12));
      const when = randDate(90);
      const atype = batch[0]?.stage === "customer" ? "customer" : "qualified";
      const snap = { timestamp:ts(when), assignedToId:admin.id, assignedToName:admin.name, customerIds:batch.map(c=>c.id), assignmentType:atype, count:batch.length };
      await addLog({ adminId:MANAGER.id, adminName:MANAGER.name, customerId:null, customerName:null, action:`มอบหมายงานให้ ${admin.name} (${batch.length} รายการ)`, type:"assign", details:`IDs: ${batch.map(c=>c.id).join(",")}`, duration:null, timestamp:ts(when), snapshot:snap });
    }
  }

  // 4D. Call logs
  for (const admin of ADMINS) {
    const myCusts = assigned.filter(c => c.responsibleId === admin.id);
    if (myCusts.length === 0) continue;
    for (let c=0; c<rand(50,120); c++) {
      const cust = pick(myCusts);
      const when = randDate(90);
      await addLog({ adminId:admin.id, adminName:admin.name, customerId:cust.id, customerName:cust.name, customerPhone:cust.phone, customerStage:cust.stage, action:`โทรติดตามลูกค้า${cust.stage==="customer"?" (Retention)":" (New)"}`, type:"call", details:pick(CALL_OUTCOMES), duration:rand(30,900), timestamp:ts(when) });
    }
  }

  // 4E. Save + Snapshot (Lead)
  for (const admin of ADMINS) {
    const myQ = qualifiedList.filter(c => c.responsibleId === admin.id);
    for (const cust of myQ) {
      for (let s=0; s<rand(3,10); s++) {
        const when = randDate(90);
        const outcome = pick(["won","lost","pending","pending","pending"]);
        const snap = makeLeadSnap(outcome);
        await addLog({ adminId:admin.id, adminName:admin.name, customerId:cust.id, customerName:cust.name, customerPhone:cust.phone, customerStage:"qualified", action:"บันทึกข้อมูลลูกค้าใหม่", type:"save", details:snap.formState?.remark||"", duration:rand(30,600), timestamp:ts(when), snapshot:{ timestamp:ts(when), ...snap } });
      }
    }
  }

  // 4F. Save + Snapshot (Retention)
  for (const admin of ADMINS) {
    const myR = retentionList.filter(c => c.responsibleId === admin.id);
    for (const cust of myR) {
      for (let s=0; s<rand(4,12); s++) {
        const when = randDate(90);
        const snap = makeRetentionSnap(Math.random()>0.45);
        await addLog({ adminId:admin.id, adminName:admin.name, customerId:cust.id, customerName:cust.name, customerPhone:cust.phone, customerStage:"customer", action:"บันทึกข้อมูล Retention", type:"save", details:snap.remark||"", duration:rand(30,480), timestamp:ts(when), snapshot:{ timestamp:ts(when), ...snap } });
      }
    }
  }

  // 4G. Click / Open
  for (const admin of ADMINS) {
    const myCusts = assigned.filter(c => c.responsibleId === admin.id);
    if (myCusts.length === 0) continue;
    for (let c=0; c<rand(25,60); c++) {
      const cust = pick(myCusts);
      const when = randDate(90);
      await addLog({ adminId:admin.id, adminName:admin.name, customerId:cust.id, customerName:cust.name, customerPhone:cust.phone, customerStage:cust.stage, action:`เปิดดูข้อมูลลูกค้า: ${cust.name||cust.phone}`, type:pick(["open","click"]), details:"", duration:rand(10,120), timestamp:ts(when) });
    }
  }

  // 4H. Stage Move
  const moveCandidates = sample(qualifiedList.filter(c=>c.responsibleId), 20);
  for (const cust of moveCandidates) {
    const admin = ADMINS.find(a=>a.id===cust.responsibleId)||pick(ADMINS);
    const when = randDate(60);
    await addLog({ adminId:admin.id, adminName:admin.name, customerId:cust.id, customerName:cust.name, customerPhone:cust.phone, customerStage:"qualified", action:"ย้ายลูกค้าไปยัง: customer (Retention)", type:"stage_move", details:"เปลี่ยนจาก qualified → customer", duration:null, timestamp:ts(when), snapshot:{ timestamp:ts(when), fromStage:"qualified", toStage:"customer" } });
  }

  await bw.flush();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("🎉 เสร็จสมบูรณ์!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`\n📊 สรุปข้อมูลทั้งหมด:`);
  console.log(`   👥 ลูกค้า    : Pool=80  Qualified=120  Customer=100`);
  console.log(`   📜 Logs       : ${logCount} รายการ`);
  console.log(`      (Login/Logout, Navigate, Assign, Call, Save+Snapshot, Click, Stage Move)`);
  console.log(`   👤 Users      : 5 Admins + 1 Manager`);
  console.log(`   📋 Topics     : 9 หัวข้อ`);
  console.log(`\n✅ ระบบพร้อมใช้งาน!`);
  process.exit(0);
}

main().catch(err => { console.error("❌ Error:", err); process.exit(1); });
