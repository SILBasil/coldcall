import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FrequencyChart = ({ data }) => {
  // data ที่ได้จาก API จะถูกแปลงเป็น Array สำหรับ Recharts
  const chartData = [
    { name: '1 สัปดาห์', ...data['1W'] },
    { name: '2 สัปดาห์', ...data['2W'] },
    { name: '3 สัปดาห์', ...data['3W'] },
    { name: '1 เดือน', ...data['1M'] },
    { name: '2 เดือน', ...data['2M'] },
    { name: '3 เดือน', ...data['3M'] },
  ];

  return (
    <div className="h-96 w-full p-4 bg-white rounded-xl shadow">
      <h2 className="text-lg font-bold mb-4">รายงานลูกค้าประจำตามรอบติดตาม</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          {/* สั่งซื้อแล้ว - สีเขียว */}
          <Bar dataKey="ordered" name="สั่งซื้อแล้ว" stackId="a" fill="#10b981" />
          {/* หาย - สีแดง */}
          <Bar dataKey="lost" name="หาย (ไม่รับ/ไม่ซื้อ)" stackId="a" fill="#ef4444" />
          {/* เหลือ - สีเทา */}
          <Bar dataKey="remaining" name="รอติดตาม" stackId="a" fill="#9ca3af" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};