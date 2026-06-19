async function getFrequencyReport(req, res) {
  const { targetDate } = req.query; // วันที่ของสัปดาห์ที่ต้องการดูรายงาน
  const startOfWeek = dayjs(targetDate).startOf('week');
  const endOfWeek = dayjs(targetDate).endOf('week');

  // ดึงเฉพาะลูกค้าประจำที่มีกำหนดต้องตามในสัปดาห์นี้
  const customers = await db.Customer.find({
    segment: 'Regular',
    next_follow_up: { $gte: startOfWeek, $lte: endOfWeek }
  });

  // เตรียมโครงสร้างข้อมูล 6 แท่ง
  const report = {
    '1W': { total: 0, ordered: 0, lost: 0, remaining: 0 },
    '2W': { total: 0, ordered: 0, lost: 0, remaining: 0 },
    '3W': { total: 0, ordered: 0, lost: 0, remaining: 0 },
    '1M': { total: 0, ordered: 0, lost: 0, remaining: 0 },
    '2M': { total: 0, ordered: 0, lost: 0, remaining: 0 },
    '3M': { total: 0, ordered: 0, lost: 0, remaining: 0 }
  };

  customers.forEach(customer => {
    const freq = customer.frequency; // เช่น '2W'
    report[freq].total++;

    // เช็คประวัติการโทรในสัปดาห์นี้
    const callStatus = customer.last_call_status; 
    
    if (callStatus === 'ordered') {
      report[freq].ordered++;
    } else if (callStatus === 'lost') {
      report[freq].lost++;
    } else {
      report[freq].remaining++; // ยังไม่ได้ตาม หรือโทรแล้วแต่ยังไม่สรุป
    }
  });

  res.json(report);
}