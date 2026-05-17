import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyJuWH6NYUIehFib7NVBGkLGG7vhKuv9g",
  authDomain: "catalogue21-92e8b.firebaseapp.com",
  projectId: "catalogue21-92e8b",
  storageBucket: "catalogue21-92e8b.firebasestorage.app",
  messagingSenderId: "828111651708",
  appId: "1:828111651708:web:d142df49753d1b77989af9"
};

const ADMINS = [
  { id: 'a1', name: 'แอดมิน พลอย' },
  { id: 'a2', name: 'แอดมิน ก้อง' },
  { id: 'a3', name: 'แอดมิน แนน' },
  { id: 'a4', name: 'แอดมิน บอย' },
  { id: 'a5', name: 'แอดมิน ใหม่' }
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PROVINCES = ['กรุงเทพฯ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'ชลบุรี', 'ระยอง', 'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'นครราชสีมา'];
const BUSINESS_PREFIXES = ['บจก.', 'หจก.', 'ร้าน', 'โรงงาน', 'ศูนย์บริการ'];
const BUSINESS_NAMES = ['ก้าวหน้า', 'รุ่งเรือง', 'มั่งคั่ง', 'ทวีโชค', 'ไทยเจริญ', 'สยามวัสดุ', 'สมบูรณ์', 'โชคชัย', 'มณีรัตน์', 'พรประเสริฐ'];
const BUSINESS_SUFFIXES = ['พลาสติก', 'วิศวกรรม', 'เคหะภัณฑ์', 'การไฟฟ้า', 'โลหะการ', 'ก่อสร้าง', 'เอ็นจิเนียริ่ง', 'เทรดดิ้ง', 'ซัพพลาย'];

const randomPhone = () => {
  const prefix = ['081', '089', '092', '064', '095', '086'][Math.floor(Math.random() * 6)];
  const num = Math.floor(1000000 + Math.random() * 9000000).toString();
  return prefix + num;
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateData = async () => {
  console.log("🚀 Starting Bulk Mock Data Generation...");
  const colRef = collection(db, "coldcall_customers");
  const logRef = collection(db, "coldcall_logs");

  // Wipe Phase
  console.log("🧹 Wiping existing customers and logs...");
  const custSnap = await getDocs(colRef);
  for (const d of custSnap.docs) {
    await deleteDoc(doc(db, "coldcall_customers", d.id));
  }
  const logSnap = await getDocs(logRef);
  for (const d of logSnap.docs) {
    await deleteDoc(doc(db, "coldcall_logs", d.id));
  }
  console.log("✅ Database cleared.");

  const createdCustomers = [];

  // 1. Bot Pool (100)
  console.log("📦 Generating 100 Bot Pool leads...");
  for (let i = 0; i < 100; i++) {
    const docRef = await addDoc(colRef, {
      name: '',
      phone: randomPhone(),
      stage: 'pool',
      bot_score: 0,
      location: randomItem(PROVINCES),
      responsibleId: null,
      responsibleName: 'Unassigned',
      status: '🆕 เบอร์ใหม่',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    createdCustomers.push({ id: docRef.id, name: '', phone: '', stage: 'pool' });
  }

  // 2. Qualified (100)
  console.log("⚡ Generating 100 Qualified leads...");
  for (let i = 0; i < 100; i++) {
    const bizName = `${randomItem(BUSINESS_PREFIXES)} ${randomItem(BUSINESS_NAMES)}${randomItem(BUSINESS_SUFFIXES)}`;
    const shouldAssign = Math.random() > 0.3;
    const admin = shouldAssign ? randomItem(ADMINS) : { id: null, name: 'Unassigned' };
    const phone = randomPhone();
    const docRef = await addDoc(colRef, {
      name: bizName,
      phone: phone,
      stage: 'qualified',
      bot_score: Math.floor(Math.random() * 3) + 3, // 3-5
      location: randomItem(PROVINCES),
      responsibleId: admin.id,
      responsibleName: admin.name,
      status: '⏳ รอการตัดสินใจ',
      type: 'ยังไม่เคยเปิดบิล',
      date: new Date().toLocaleDateString('th-TH'),
      remark: 'บอทแจ้งว่าลูกค้าสนใจรายการสินค้าใหม่ ต้องการเปรียบเทียบราคา',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    createdCustomers.push({ id: docRef.id, name: bizName, phone: phone, stage: 'qualified' });
  }

  // 3. Customer (100)
  console.log("✅ Generating 100 Retention customers...");
  for (let i = 0; i < 100; i++) {
    const bizName = `${randomItem(BUSINESS_PREFIXES)} ${randomItem(BUSINESS_NAMES)}${randomItem(BUSINESS_SUFFIXES)}`;
    const shouldAssign = Math.random() > 0.3; // 70% chance to assign
    const admin = shouldAssign ? randomItem(ADMINS) : { id: null, name: 'Unassigned' };

    const phone = randomPhone();
    const docRef = await addDoc(colRef, {
      name: bizName,
      phone: phone,
      stage: 'customer',
      bot_score: 5,
      location: randomItem(PROVINCES),
      responsibleId: admin.id,
      responsibleName: admin.name,
      status: '✅ สั่งซื้อแล้ว',
      type: 'ลูกค้าเก่า',
      lastCallDate: '15/03/2026',
      lastOrderDate: '01/02/2026',
      freqAmount: Math.floor(Math.random() * 4) + 1,
      freqUnit: randomItem(['สัปดาห์', 'เดือน']),
      gridData: {}, // Empty grid initially
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    createdCustomers.push({ id: docRef.id, name: bizName, phone: phone, stage: 'customer' });
  }

  // 4. Activity Logs (150)
  console.log("📜 Generating 150 Activity Logs...");
  const ACTIONS = [
    { action: 'โทรหาลูกค้า', type: 'call', details: 'ลูกค้าไม่รับสาย พยายามติดต่อใหม่รอบบ่าย' },
    { action: 'โทรหาลูกค้า', type: 'call', details: 'คุยข้อมูลเบื้องต้น ลูกค้าสนใจขอรายละเอียดทาง Line' },
    { action: 'บันทึกข้อมูล', type: 'save', details: 'อัปเดตที่อยู่จัดส่งและเบอร์ติดต่อสำรอง' },
    { action: 'เปลี่ยนสถานะ', type: 'status_change', details: 'เปลี่ยนสถานะเป็น: สนใจ (Hot Lead)' },
    { action: 'บันทึกหมายเหตุ', type: 'note', details: 'ลูกค้าแจ้งว่าต้องการราคาพิเศษสำหรับล็อตใหญ่' },
    { action: 'โทรหาลูกค้า', type: 'call', details: 'แจ้งโปรโมชั่นประจำเดือน ลูกค้ารอตัดสินใจกับหัวหน้า' }
  ];

  for (let i = 0; i < 150; i++) {
    const admin = randomItem(ADMINS);
    const customer = randomItem(createdCustomers.filter(c => c.stage !== 'pool'));
    const act = randomItem(ACTIONS);
    
    await addDoc(logRef, {
      adminId: admin.id,
      adminName: admin.name,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerStage: customer.stage,
      action: act.action,
      type: act.type,
      details: act.details,
      timestamp: serverTimestamp()
    });
  }

  console.log("✨ Done! 300 mock records and 150 logs added successfully.");
  process.exit(0);
};

generateData().catch(err => {
  console.error("❌ Error generating data:", err);
  process.exit(1);
});
