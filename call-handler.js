/**
 * ฟังก์ชันบันทึกผลการโทรสำหรับลูกค้าประจำ
 * @param {string} customerId - ID ลูกค้า
 * @param {string} callResult - 'ordered', 'no_answer', 'no_purchase'
 */
async function recordCallResult(pool, customerId, callResult) {
  const [customers] = await pool.query('SELECT * FROM coldcall_customers WHERE id = ?', [customerId]);
  const customer = customers[0];
  
  let status = '⏳ รอติดตาม';
  let nextDate = new Date(customer.nextFollowUp || new Date());

  if (callResult === 'ordered') {
    status = '✅ สั่งซื้อแล้ว';
    nextDate = calculateNextDate(new Date(), customer.frequency);
  } else if (callResult === 'no_answer' || callResult === 'no_purchase') {
    status = '❌ ไม่รับ/ไม่ซื้อ'; // "หาย" ในรายงานสัปดาห์นี้
    nextDate = calculateNextDate(nextDate, customer.frequency);
  }

  await pool.query(`
    UPDATE coldcall_customers 
    SET status = ?, nextFollowUp = ?, updatedAt = NOW() 
    WHERE id = ?
  `, [status, nextDate, customerId]);
  
  // บันทึกลง Logs ด้วย
  await pool.query(`
    INSERT INTO coldcall_logs (customerId, action, type, details, timestamp)
    VALUES (?, ?, ?, ?, NOW())
  `, [customerId, 'ติดตามลูกค้าประจำ', 'call', callResult]);
}

function calculateNextDate(startDate, frequency) {
    const date = new Date(startDate);
    if (frequency === '1W') date.setDate(date.getDate() + 7);
    else if (frequency === '2W') date.setDate(date.getDate() + 14);
    else if (frequency === '3W') date.setDate(date.getDate() + 21);
    else if (frequency === '1M') date.setMonth(date.getMonth() + 1);
    else if (frequency === '2M') date.setMonth(date.getMonth() + 2);
    else if (frequency === '3M') date.setMonth(date.getMonth() + 3);
    return date;
}