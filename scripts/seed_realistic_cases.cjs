const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'creds.json');
const CUSTOMERS_COL = 'coldcall_customers';
const LOGS_COL = 'coldcall_logs';

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`❌ Missing creds.json at: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// We will inject 3 extremely detailed, realistic customers with logical progression logs.
const adminA4Id = 'a4';
const adminA4Name = 'แอดมิน ไนซ์';

const topicsBase = [
    { id: 1, title: 'สนใจสมัครใช้บริการ', checked: false, detail: '', problem: '' },
    { id: 2, title: 'สอบถามโปรโมชั่น', checked: false, detail: '', problem: '' },
    { id: 3, title: 'ร้องเรียนการบริการ', checked: false, detail: '', problem: '' },
    { id: 4, title: 'ขอเสนอความร่วมมือ', checked: false, detail: '', problem: '' },
];

const mockCustomers = [
    // CASE 1: Closed Won - Logical progression from initial contact to sending sample to closing the sale.
    {
        id: "0891234567",
        data: {
            customerNo: "H9001",
            name: "บริษัท สยามฟู้ดส์ จำกัด (คุณสมหญิง)",
            phone: "0891234567",
            stage: "customer",
            status: "✅ สั่งซื้อแล้ว (Closed Won)",
            type: "ลูกค้าเก่า",
            businessType: "ร้านอาหาร",
            usageQuantity: "50-100 kg/month",
            lineId: "@siamfoods",
            facebookUrl: "https://fb.com/siamfoods",
            responsibleId: adminA4Id,
            responsibleName: adminA4Name,
            createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-10T10:00:00")),
            updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-15T14:30:00")),
            wonAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-15T14:30:00")),
            followUpFrequencyDays: 30,
            formState: {
                checklist: { chat: true, group: true, remark: "ดึงเข้ากลุ่ม VIP แล้ว ดูแลพิเศษ" },
                callTracking: { date: "2026-04-15", count: 3, remark: "ติดต่อสำเร็จ" },
                sampleStatus: { catalogue: true, sampleReceived: true, date: "2026-04-12" },
                visitStatus: { visit: true, month: "เมษายน", remark: "แวะไปที่ร้านเพื่อเทสสินค้าด้วยตัวเอง" },
                status: "✅ สั่งซื้อแล้ว (Closed Won)",
                orderDetail: "สั่งซื้อน้ำจิ้มซีฟู้ด 50 แกลลอน ล็อตแรก โอนเงินเต็มจำนวน",
                score: 5,
                prefTime: "13:00 - 15:00",
                remark: "ลูกค้าร้านอาหารใหญ่ มีสาขา 3 แห่ง เดิมใช้ของเจ้าอื่นแต่มีปัญหาเรื่องรสชาติไม่นิ่ง พอได้เทสสินค้าของเราแล้วชอบมาก ตัดสินใจสั่งล็อตใหญ่ทันที ควรโทรเช็คสต็อกก่อนสิ้นเดือนทุกครั้ง"
            },
            matchingTopics: [
                { id: 1, title: 'สนใจสมัครใช้บริการ', checked: true, detail: 'ต้องการสินค้าส่งด่วน', problem: 'ซัพพลายเออร์เก่าส่งช้า' },
                { id: 2, title: 'สอบถามโปรโมชั่น', checked: true, detail: 'ขอดูเรทส่ง 50 แกลลอนขึ้นไป', problem: 'ต้นทุนพุ่ง' },
                { id: 3, title: 'ร้องเรียนการบริการ', checked: false, detail: '', problem: '' },
                { id: 4, title: 'ขอเสนอความร่วมมือ', checked: false, detail: '', problem: '' }
            ]
        },
        logs: [
            {
                date: new Date("2026-04-10T10:15:00"),
                type: 'call', action: 'โทรออก',
                comment: "โทรครั้งที่ 1: ลูกค้ายุ่งเรื่องเปิดร้าน ขอให้ส่งแคตตาล็อคทางไลน์ @siamfoods แอดไลน์ไปแล้ว",
                outcome: "pending", reasons: []
            },
            {
                date: new Date("2026-04-10T10:30:00"),
                type: 'save', action: 'บันทึกข้อมูล',
                comment: "ส่งแคตตาล็อคและเสนอส่งตัวอย่างฟรี",
                outcome: "pending", reasons: [],
                snapshot: { formState: { sampleStatus: { catalogue: true } } }
            },
            {
                date: new Date("2026-04-13T11:00:00"),
                type: 'call', action: 'โทรออก',
                comment: "โทรครั้งที่ 2: ลูกค้าได้รับตัวอย่างแล้ว บอกว่าเดี๋ยวเชฟเทสพรุ่งนี้",
                outcome: "pending", reasons: []
            },
            {
                date: new Date("2026-04-15T14:30:00"),
                type: 'save', action: 'บันทึกข้อมูล',
                comment: "เชฟเทสผ่าน สั่งซื้อ 50 แกลลอน โอนแล้ว 45,000 บาท",
                outcome: "won", reasons: [],
                snapshot: { formState: { status: "✅ สั่งซื้อแล้ว (Closed Won)" } }
            }
        ]
    },

    // CASE 2: Closed Lost - Logical progression of price objection
    {
        id: "0819876543",
        data: {
            customerNo: "H9002",
            name: "คุณกิตติ (ขายส่งตลาดไทย)",
            phone: "0819876543",
            stage: "qualified",
            status: "❌ ปฏิเสธการขาย (Closed Lost)",
            type: "ยังไม่เคยเปิดบิล",
            businessType: "ยี่ปั๊ว/ซาปั๊ว",
            usageQuantity: "200+ kg/month",
            lineId: "kitti_wholesale",
            facebookUrl: "",
            responsibleId: adminA4Id,
            responsibleName: adminA4Name,
            createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-12T09:00:00")),
            updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-18T10:00:00")),
            lostAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-18T10:00:00")),
            formState: {
                checklist: { chat: true, group: false, remark: "ทักไลน์ส่วนตัว คุยเรื่องราคาเป็นหลัก" },
                callTracking: { date: "2026-04-18", count: 2, remark: "ติดต่อสำเร็จ" },
                sampleStatus: { catalogue: true, sampleReceived: false, date: "" },
                visitStatus: { visit: false, month: "", remark: "" },
                status: "❌ ปฏิเสธการขาย (Closed Lost)",
                orderDetail: "สู้ราคาไม่ไหว เจ้าเดิมให้เครดิต 60 วัน",
                score: 2,
                prefTime: "08:00 - 09:00",
                remark: "ลูกค้ารับของเยอะมาก แต่เน้นเรื่องเครดิตเทอมยาวๆ และราคาถูกเป็นหลัก ไม่ได้สนใจเรื่องคุณภาพมากนัก ตอนนี้ยังไม่เหมาะกับสินค้าระดับพรีเมียมของเรา อาจจะ follow up อีกทีปีหน้าถ้าเรามีแบรนด์รอง"
            },
            matchingTopics: [
                { id: 1, title: 'สนใจสมัครใช้บริการ', checked: false, detail: '', problem: '' },
                { id: 2, title: 'สอบถามโปรโมชั่น', checked: true, detail: 'ต้องการเครดิต 60 วัน', problem: 'หมุนเงินไม่ทัน' },
                { id: 3, title: 'ร้องเรียนการบริการ', checked: false, detail: '', problem: '' },
                { id: 4, title: 'ขอเสนอความร่วมมือ', checked: true, detail: 'ขอเป็นตัวแทนจำหน่ายผูกขาดเขต', problem: '' }
            ]
        },
        logs: [
            {
                date: new Date("2026-04-12T09:30:00"),
                type: 'call', action: 'โทรออก',
                comment: "โทรครั้งที่ 1: ลูกค้ารับสาย คุยเบื้องต้นสนใจ แต่บอกว่าปกติซื้อถูกกว่านี้ 30% ส่งใบเสนอราคาให้พิจารณาทางไลน์",
                outcome: "pending", reasons: []
            },
            {
                date: new Date("2026-04-18T10:00:00"),
                type: 'save', action: 'บันทึกข้อมูล',
                comment: "ติดตามผล ลูกค้าปฏิเสธชัดเจน ไม่สามารถให้เครดิต 60 วันตามที่ขอได้",
                outcome: "lost", reasons: ["ราคาแพงกว่าเจ้าเดิม", "เงื่อนไขเครดิตไม่ตรงความต้องการ"],
                snapshot: { formState: { status: "❌ ปฏิเสธการขาย (Closed Lost)" } }
            }
        ]
    },

    // CASE 3: Pending (Follow up) - Still negotiating
    {
        id: "0855554444",
        data: {
            customerNo: "H9003",
            name: "คลินิกความงามบิวตี้แคร์",
            phone: "0855554444",
            stage: "qualified",
            status: "⏳ รอการตัดสินใจ (Pending)",
            type: "ยังไม่เคยเปิดบิล",
            businessType: "คลินิกความงาม",
            usageQuantity: "20-30 pcs/month",
            lineId: "@beautycare",
            facebookUrl: "https://fb.com/beautycareclinic",
            responsibleId: adminA4Id,
            responsibleName: adminA4Name,
            createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-18T13:00:00")),
            updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-20T16:00:00")),
            formState: {
                checklist: { chat: true, group: false, remark: "รอคุณหมออนุมัติ" },
                callTracking: { date: "2026-04-20", count: 4, remark: "ติดต่อสำเร็จ" },
                sampleStatus: { catalogue: true, sampleReceived: true, date: "2026-04-19" },
                visitStatus: { visit: false, month: "", remark: "" },
                status: "⏳ รอการตัดสินใจ (Pending)",
                orderDetail: "รอประชุมบอร์ดบริหารเดือนหน้า",
                score: 4,
                prefTime: "17:00 - 18:00",
                remark: "ผู้จัดการคลินิกเห็นชอบแล้ว แต่ต้องรอการอนุมัติจากแพทย์เจ้าของคลินิก ซึ่งจะเข้าคลินิกเฉพาะวันพฤหัส แนะนำให้โทรตามอีกทีวันพฤหัสช่วงเย็น"
            },
            matchingTopics: [
                { id: 1, title: 'สนใจสมัครใช้บริการ', checked: true, detail: 'สนใจเซ็ตทดลอง 10 ชุด', problem: 'ลูกค้าบ่นเรื่องแพ็คเกจเก่า' },
                { id: 2, title: 'สอบถามโปรโมชั่น', checked: false, detail: '', problem: '' },
                { id: 3, title: 'ร้องเรียนการบริการ', checked: false, detail: '', problem: '' },
                { id: 4, title: 'ขอเสนอความร่วมมือ', checked: false, detail: '', problem: '' }
            ]
        },
        logs: [
            {
                date: new Date("2026-04-18T13:15:00"),
                type: 'call', action: 'โทรออก',
                comment: "สายไม่ว่าง",
                outcome: "pending", reasons: []
            },
            {
                date: new Date("2026-04-18T17:30:00"),
                type: 'call', action: 'โทรออก',
                comment: "คุยกับ ผจก. คลินิก สนใจสินค้ามาก ส่งของตัวอย่างไปให้ทดลอง",
                outcome: "pending", reasons: []
            },
            {
                date: new Date("2026-04-20T16:00:00"),
                type: 'save', action: 'บันทึกข้อมูล',
                comment: "ผจก.แจ้งว่าของถึงแล้ว แต่ต้องรอคุณหมอเข้ามาดูวันพฤหัสหน้า ให้ตั้งเตือนโทรไปวันพฤหัส",
                outcome: "pending", reasons: [],
                snapshot: { formState: { status: "⏳ รอการตัดสินใจ (Pending)" } }
            }
        ]
    }
];

async function seedRealisticCases() {
    console.log('🚀 Seeding 3 highly detailed, realistic customer cases...');
    let batch = db.batch();

    for (const customer of mockCustomers) {
        const custRef = db.collection(CUSTOMERS_COL).doc(customer.id);
        batch.set(custRef, customer.data);

        for (const log of customer.logs) {
            const logRef = db.collection(LOGS_COL).doc();
            batch.set(logRef, {
                adminId: customer.data.responsibleId,
                adminName: customer.data.responsibleName,
                customerId: customer.id,
                customerName: customer.data.name,
                customerPhone: customer.phone || customer.id,
                customerStage: customer.data.stage,
                timestamp: admin.firestore.Timestamp.fromDate(log.date),
                type: log.type,
                action: log.action,
                comment: log.comment,
                outcome: log.outcome,
                reasons: log.reasons || [],
                snapshot: log.snapshot || null
            });
        }
    }

    await batch.commit();
    console.log('✅ Done! 3 detailed cases have been inserted into the database.');
    process.exit(0);
}

seedRealisticCases().catch(err => {
    console.error(err);
    process.exit(1);
});
