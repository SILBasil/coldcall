// src/utils/htmlExporter.js

export const downloadWeeklyHTML = (reportData) => {
  const { adminName, weekStr, problems_notes, metrics, customer_transactions, submittedAt } = reportData;

  // Basic styling - deliberately kept simple per business requirement
  const htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงานประจำสัปดาห์ - ${adminName} (${weekStr})</title>
    <style>
        body { font-family: Tahoma, sans-serif; padding: 20px; color: #333; line-height: 1.5; }
        h1 { border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        .summary-box { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; background-color: #f9f9f9; }
        .notes-box { border: 1px dashed #999; padding: 15px; margin-bottom: 20px; background-color: #fffbdd; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th, td { border: 1px solid #aaa; padding: 8px; text-align: left; }
        th { background-color: #eee; }
        .won { color: green; font-weight: bold; }
        .lost { color: red; }
    </style>
</head>
<body>
    <h1>📋 รายงานผลการทำงานประจำสัปดาห์</h1>
    <p><strong>แอดมิน:</strong> ${adminName}</p>
    <p><strong>ช่วงสัปดาห์:</strong> ${weekStr}</p>
    <p><strong>วันที่ส่งรายงาน:</strong> ${new Date(submittedAt).toLocaleString('th-TH')}</p>

    <div class="summary-box">
        <h3>📊 สรุปตัวเลข (Metrics)</h3>
        <ul>
            <li>จำนวนโทร (ที่บันทึก): ${metrics?.callsMade || 0} ครั้ง</li>
            <li>ปิดการขาย (Won): <span class="won">${metrics?.dealsWon || 0}</span> ครั้ง</li>
        </ul>
    </div>

    <div class="notes-box">
        <h3>📝 บันทึกจากการทำงานสัปดาห์ที่ผ่านมา</h3>
        <p>${problems_notes ? problems_notes.replace(/\\n/g, '<br/>') : '<i>ไม่มีการสรุปเพิ่มเติม</i>'}</p>
    </div>

    <h3>👥 รายละเอียดลูกค้าที่ได้รับการติดต่อ (Transactions)</h3>
    <table>
        <thead>
            <tr>
                <th>รหัสลูกค้า (PK)</th>
                <th>ชื่อลูกค้า</th>
                <th>ขั้นตอน</th>
                <th>สถานะการขาย/ทรัพย์สิน</th>
                <th>รายละเอียดเพิ่มเติม / เหตุผลประสิทธิ</th>
            </tr>
        </thead>
        <tbody>
            ${!customer_transactions || customer_transactions.length === 0 ? '<tr><td colspan="5" style="text-align:center;">ไม่มีข้อมูลลูกค้าสัปดาห์นี้</td></tr>' : ''}
            ${customer_transactions?.map(c => `
            <tr>
                <td>${c.customerId || c.phone || '-'}</td>
                <td>${c.customerName || '-'}</td>
                <td>${c.stage === 'customer' ? 'ลูกค้าประจำ' : 'เสนอขายสินค้า'}</td>
                <td class="${c.actionResult === 'WON' ? 'won' : c.actionResult === 'LOST' ? 'lost' : ''}">${c.status || '-'}</td>
                <td>${c.lostReason || c.adminComment || '-'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <p style="font-size: 11px; color: #888; text-align: center; margin-top: 50px;">
      สร้างโดย Coldcall Network System (Data Archiving Mechanism)
    </p>
</body>
</html>
  `;

  // สร้าง Blob และจำลองการคลิกเพื่อดาวน์โหลด HTML ย้อนกลับของระบบ
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WeeklyReport_${adminName}_${weekStr.replace(/\//g,'-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
