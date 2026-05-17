// สร้างไฟล์ใหม่ชื่อ seed_ploy_demo.js ในโฟลเดอร์ scripts/
// หรือรันโค้ดนี้ใน browser console หลังจาก import leadService

import { leadService } from './src/services/leadService.js';

async function seedPloyRandomDemo() {
  try {
    // 1. ดึงลูกค้าของแอดมินพลอย (a1)
    const ployCustomers = await leadService.getCustomersByStage('qualified', 'a1');
    const ployRetention = await leadService.getCustomersByStage('customer', 'a1');
    const allPloyCustomers = [...ployCustomers, ...ployRetention];
    
    if (allPloyCustomers.length === 0) {
      console.log('ไม่มีลูกค้าของแอดมินพลอย');
      return;
    }
    
    // 2. เลือกลูกค้าแบบสุ่ม 10-15 คน (ไม่เกินจำนวนที่มี)
    const numToSeed = Math.min(15, Math.max(10, Math.floor(allPloyCustomers.length * 0.5)));
    const shuffled = allPloyCustomers.sort(() => 0.5 - Math.random());
    const selectedCustomers = shuffled.slice(0, numToSeed);
    const customerIds = selectedCustomers.map(c => c.id);
    
    console.log(`เลือก ${customerIds.length} ลูกค้าของพลอยสำหรับการ seed:`, customerIds);
    
    // 3. Seed logs สำหรับลูกค้าที่เลือก (62 วันย้อนหลัง, 30 saves ต่อลูกค้า, 14 วันล่าสุด)
    const result = await leadService.seedDemoAuditLogs({
      customerIds: customerIds,
      daysBack: 62,  // 1 ม.ค. - 3 มี.ค. 2026
      savesPerCustomer: 30,
      ensureRecentDays: 14
    });
    
    console.log('การ seed เสร็จสิ้น:', result);
    
    // 4. ตรวจสอบข้อมูลที่สร้างขึ้น
    for (const id of customerIds.slice(0, 3)) {  // ตรวจสอบ 3 คนแรก
      const summary = await leadService.debugGetSaveSnapshotSummary(id);
      console.log(`ลูกค้า ${id} มี ${summary.recentSaves} saves ล่าสุด`);
    }
    
  } catch (error) {
    console.error('เกิดข้อผิดพลาด:', error);
  }
}

// รันฟังก์ชัน
seedPloyRandomDemo();