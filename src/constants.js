export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS_TRACKING = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const WEEKS = [1, 2, 3, 4];

export const ADMINS = [];
export const MANAGER = { id: 'm1', name: 'Manager Basil', role: 'manager' };

export const MOCK_LEADS = [
  // --- 1. Pool (เบอร์ใหม่ รอรับมอบ) ---
  { id: 101, name: '', phone: '0810001111', stage: 'pool', bot_score: 0, location: 'เมือง', responsibleId: null, responsibleName: 'Unassigned' },
  { id: 102, name: '', phone: '0810002222', stage: 'pool', bot_score: 0, location: 'ลาดพร้าว', responsibleId: null, responsibleName: 'Unassigned' },
  { id: 103, name: '', phone: '0810003333', stage: 'pool', bot_score: 0, location: 'บึงกุ่ม', responsibleId: null, responsibleName: 'Unassigned' },
  { id: 104, name: '', phone: '0810004444', stage: 'pool', bot_score: 0, location: 'ปราจีน', responsibleId: null, responsibleName: 'Unassigned' },
  { id: 105, name: '', phone: '0810005555', stage: 'pool', bot_score: 0, location: 'สมุทร', responsibleId: null, responsibleName: 'Unassigned' },

  // --- 2. Qualified (โทรหาแล้ว มีคะแนน อยู่ในขั้นตอนสนใจ) ---
  { 
    id: 201, name: 'นาย. สมหมายใจดี', phone: '081223344', stage: 'qualified', bot_score: 4, location: 'สมุทรปราการ', responsibleId: null, responsibleName: 'Unassigned',
    status: '⏳ รอการตัดสินใจ', date: '22/01/2026', type: 'ยังไม่ได้ตัดสิน', 
    remark: 'โทรหาลูกค้าแล้ว กำลังรอดูผลิตภัณฑ์ สนใจดูตัวอย่าง'
  },
  { 
    id: 202, name: 'ร้านค้า สินค้าดี', phone: '026644454', stage: 'qualified', bot_score: 5, location: 'ดอนเมือง', responsibleId: null, responsibleName: 'Unassigned',
    status: '⏳ รอการตัดสินใจ', date: '19/01/2026', type: 'ยังไม่ได้ตัดสิน',
    remark: 'โทรระบุลูกค้าสนใจบรรจุภัณฑ์คุณภาพส่วนตัวมากสุด'
  },
  { 
    id: 203, name: 'หจก. สินค้าคุณ', phone: '0834455667', stage: 'qualified', bot_score: 3, location: 'เมือง', responsibleId: null, responsibleName: 'Unassigned',
    status: '⏳ รอการตัดสินใจ', date: '05/02/2026', type: 'ยังไม่ได้ตัดสิน'
  },

  // --- 3. Customer (สั่งซื้อแล้ว/ลูกค้าประจำ รอรับติดตามซื้อซ้ำ) ---
  { 
    id: 301, name: 'ร้านสินค้าดี (สำนักงานใหญ่)', phone: '0818139529', stage: 'customer', bot_score: 5, location: 'กรุงเทพฯ', responsibleId: null, responsibleName: 'Unassigned',
    status: '✅ สั่งซื้อแล้ว', type: 'ลูกค้าประจำ', lastCallDate: '17/02/2026', lastOrderDate: '12/11/2021',
    freqAmount: 2, freqUnit: 'สัปดาห์',
    gridData: { 'มกราคม-2-followup': true, 'มกราคม-2-order': true }
  },
  { 
    id: 302, name: 'หจก. สินค้าชัย', phone: '024455667', stage: 'customer', bot_score: 4, location: 'นนทบุรี', responsibleId: null, responsibleName: 'Unassigned',
    status: '✅ สั่งซื้อแล้ว', type: 'ลูกค้าประจำ', lastCallDate: '16/03/2026', lastOrderDate: '16/03/2026', 
    freqAmount: 1, freqUnit: 'สัปดาห์', 
    gridData: { 'มีนาคม-3-followup': true, 'มีนาคม-3-order': true } 
  },
  { 
    id: 303, name: 'นาย. คุณนายใจดี', phone: '0856677889', stage: 'customer', bot_score: 5, location: 'ชลบุรี', responsibleId: null, responsibleName: 'Unassigned',
    status: '✅ สั่งซื้อแล้ว', type: 'ลูกค้าประจำ', lastCallDate: '15/03/2026', 
    freqAmount: 1, freqUnit: 'เดือน', 
    gridData: { 'กุมภาพันธ์-1-followup': true, 'กุมภาพันธ์-1-order': true } 
  }
];
