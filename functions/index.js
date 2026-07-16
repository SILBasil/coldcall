const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();

/**
 * Helper: ดึงข้อมูลจาก Google Sheets (คืนค่าเป็นข้อมูลดิบ)
 */
async function fetchTabData(sheets, { tab, phoneIdx, nameIdx }) {
  const SPREADSHEET_ID = '1_DgA1c9C1Ll9Y-fZQBjJi1juGIDpeuG7YN1iXdn-xGs';
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tab}!A2:E20000`, 
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  // กรองข้อมูลเบื้องต้น (เอาเฉพาะแถวที่มีเบอร์)
  return rows
    .filter(row => row[phoneIdx])
    .map(row => ({
      name: row[nameIdx] || 'ไม่ระบุชื่อ',
      phone: row[phoneIdx].toString().replace(/[^0-9]/g, ''),
    }))
    .filter(item => item.phone.length >= 9);
}

/**
 * [V1 HTTPS ONCALL] ดึงข้อมูลจาก Google Sheets ส่งไปให้ Frontend ประมวลผล
 */
exports.fetchGoogleSheetData = functions.region('us-central1').runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'creds.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      const phases = [
        { tab: '1.ข้อมูลVlookup', stage: 'pool', phoneIdx: 2, nameIdx: 1 },
        { tab: '2.ลูกค้าใหม่ที่ยังไม่เคยเปิด', stage: 'qualified', phoneIdx: 2, nameIdx: 1 },
        { tab: '3.ติดตามลูกค้าที่เคยสั่งซื้อแล้ว', stage: 'customer', phoneIdx: 2, nameIdx: 1 }
      ];

      const results = {};
      for (const phase of phases) {
        results[phase.stage] = await fetchTabData(sheets, phase);
      }

      return { success: true, data: results };
      
    } catch (error) {
      console.error('Fetch Sheets Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * [V1 SCHEDULE] รันวันละครั้ง (Keep simplified legacy or keep as is)
 */
exports.dailyInventorySync = functions.region('us-central1').pubsub.schedule('every 24 hours').onRun(async (context) => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'creds.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  const data = await fetchTabData(sheets, { tab: '1.ข้อมูลVlookup', stage: 'pool', phoneIdx: 2, nameIdx: 1 });
  
  // Minimal server-side batching for scheduled task
  const CUSTOMERS_COL = 'coldcall_customers';
  let currentBatch = db.batch();
  let count = 0;

  for (const item of data) {
    const docRef = db.collection(CUSTOMERS_COL).doc(item.phone);
    currentBatch.set(docRef, {
      name: item.name,
      phone: item.phone,
      stage: 'pool',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    count++;
    if (count >= 450) {
      await currentBatch.commit();
      currentBatch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await currentBatch.commit();
  console.log(`[DailySync] สำเร็จ! นำเข้า ${data.length} รายการ`);
});

