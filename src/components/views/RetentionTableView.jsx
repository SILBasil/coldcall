import React, { useState, useEffect } from 'react';
import { MONTHS_TRACKING, WEEKS } from '../../constants';
import { leadService } from '../../services/leadService';
import { Check, ShoppingBag, Edit2, ChevronRight, ChevronLeft } from 'lucide-react';

const STATUS_OPTIONS = [
  { label: 'ติดต่อไม่ได้', color: 'bg-rose-100 text-rose-600 border-rose-200' },
  { label: 'ไม่สนใจ', color: 'bg-rose-500 text-white border-rose-600' },
  { label: 'โทรกลับทีหลัง', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { label: 'โทรกลับร้านงาน/CLM', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { label: 'ยกเลิก/ติดธุรกิจ', color: 'bg-slate-500 text-white border-slate-600' },
  { label: 'ยังไม่สนใจตอนนี้', color: 'bg-amber-100 text-amber-600 border-amber-200' },
  { label: 'เสนอขายสินค้า', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  { label: 'ลูกค้าคาดหวังสต็อก', color: 'bg-emerald-600 text-white border-emerald-700' },
  { label: 'เปลี่ยนช่อง shopee/zort/online', color: 'bg-orange-500 text-white border-orange-600' },
  { label: 'สนใจดูสินค้า', color: 'bg-indigo-600 text-white border-indigo-700' },
  { label: 'สั่งซื้อแล้ว', color: 'bg-[#1E293B] text-white border-slate-900' },
  { label: 'ยังรอถึงรอบสั่งซื้อ', color: 'bg-amber-500 text-white border-amber-600' },
  { label: 'ติดต่อแล้วเช็คราคา', color: 'bg-yellow-300 text-slate-800 border-yellow-400' },
  { label: 'ต้องการตัวอย่างสินค้า', color: 'bg-pink-500 text-white border-pink-600' },
];

const RetentionTableView = ({ data, onManage, pagination, onPageChange }) => {
  const [gridState, setGridState] = useState({});
  const [admins, setAdmins] = useState([]);

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = async () => {
    try {
      const all = await leadService.getUsers();
      setAdmins(all.filter(u => u.role === 'admin'));
    } catch (err) { console.error(err); }
  };

  const toggle = (customerId, month, week, type) => {
    const key = `${customerId}-${month}-${week}-${type}`;
    setGridState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-500">
      <div className="flex-1 overflow-auto relative">
        <table className="border-separate border-spacing-0 w-full">
          <thead>
            <tr className="bg-slate-50 text-xs font-black uppercase tracking-widest sticky top-0 z-30 italic">
              <th colSpan={8} className="border-b border-r border-slate-200 p-2.5 bg-slate-100 text-slate-600 sticky left-0 z-40">ข้อมูลพื้นฐานลูกค้า</th>
              {MONTHS_TRACKING.map(month => (
                <th key={month} colSpan={8} className="border-b border-r border-slate-200 p-2.5 text-center bg-indigo-50/50 text-indigo-600">{month}</th>
              ))}
            </tr>
            <tr className="bg-white text-[11px] font-black uppercase tracking-widest sticky top-[33px] z-30 shadow-sm italic">
              <th className="border-b border-r border-slate-200 p-2.5 text-left sticky left-0 bg-white z-40 w-48">ชื่อลูกค้า</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-left sticky left-48 bg-white z-40 w-32">เบอร์โทรศัพท์</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-left w-36">ที่อยู่</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-left w-32">แอดมิน</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-left w-56">สถานะการติดต่อ</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-left w-64">บันทึกล่าสุด</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-center w-28">วันที่ติดต่อ</th>
              <th className="border-b border-r border-slate-200 p-2.5 text-center w-28">วันที่สั่งซื้อ</th>
              {MONTHS_TRACKING.map(month => (
                WEEKS.map(week => (
                  <th key={`${month}-${week}`} colSpan={2} className="border-b border-r border-slate-100 p-2 text-center bg-slate-50/30">W{week}</th>
                ))
              ))}
            </tr>
            <tr className="bg-slate-50/50 text-[8px] font-black uppercase sticky top-[66px] z-30 border-b border-slate-200">
              <th colSpan={8} className="sticky left-0 bg-white z-40 border-r border-slate-200"></th>
              {MONTHS_TRACKING.map(month => (
                WEEKS.map(week => (
                  <React.Fragment key={`${month}-${week}-labels`}>
                    <th className="border-r border-slate-100 p-1 text-indigo-600">ติด</th>
                    <th className="border-r border-slate-200 p-1 text-emerald-500">ซื้อ</th>
                  </React.Fragment>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? data.map(l => (
              <tr key={l.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onManage(l)}>
                <td className="border-b border-r border-slate-100 p-2 sticky left-0 bg-white group-hover:bg-slate-50 z-20 shadow-sm">
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onManage(l); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-primary transition-all"><Edit2 size={12} /></button>
                    <span className="font-black text-slate-800 text-sm truncate whitespace-nowrap italic">{l.name}</span>
                  </div>
                </td>
                <td className="border-b border-r border-slate-100 p-2 sticky left-48 bg-white group-hover:bg-slate-50 z-20 shadow-sm font-black text-sm text-primary whitespace-nowrap">{l.phone}</td>
                <td className="border-b border-r border-slate-50 p-2 text-xs font-black text-slate-800 italic truncate max-w-[200px]">{l.location || '-'}</td>
                <td className="border-b border-r border-slate-50 p-2">
                  <select value={l.responsibleId || ''} onChange={(e) => leadService.updateCustomer(l.id || l.phone, { responsibleId: e.target.value, responsibleName: admins.find(a => a.id === e.target.value)?.name || 'Unassigned' })} onClick={(e) => e.stopPropagation()} className="w-full bg-slate-50/50 border-none text-[11px] font-black p-1 rounded-lg cursor-pointer">
                    <option value="">เลือกแอดมิน</option>
                    {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td className="border-b border-r border-slate-50 p-2">
                  <select value={l.stage || 'customer'} onChange={(e) => leadService.updateCustomer(l.id || l.phone, { stage: e.target.value })} onClick={(e) => e.stopPropagation()} className="w-full bg-slate-50/50 border-none text-[11px] font-black p-1 rounded-lg cursor-pointer">
                    <option value="pool">Lead Pool</option>
                    <option value="qualified">Qualified</option>
                    <option value="customer">Customer</option>
                  </select>
                </td>
                <td className="border-b border-r border-slate-50 p-2 min-w-[200px]">
                  <select value={l.status || ''} onChange={(e) => leadService.updateCustomer(l.id || l.phone, { status: e.target.value })} onClick={(e) => e.stopPropagation()} className={`w-full text-xs font-black p-1.5 rounded-lg border outline-none transition-all cursor-pointer ${STATUS_OPTIONS.find(s => s.label === l.status)?.color || 'bg-white text-slate-600 border-slate-200'}`}>
                    <option value="">เลือกสถานะ</option>
                    {STATUS_OPTIONS.map(opt => <option key={opt.label} value={opt.label} className="bg-white text-slate-900">{opt.label}</option>)}
                  </select>
                </td>
                <td className="border-b border-r border-slate-50 p-2 text-xs font-bold text-slate-600 italic truncate max-w-[200px]">{l.remark || '...'}</td>
                <td className="border-b border-r border-slate-50 p-2 text-center text-xs font-black text-slate-500 whitespace-nowrap uppercase">{l.lastCallDate || '-'}</td>
                <td className="border-b border-r border-slate-100 p-2 text-center text-xs font-black text-slate-500 whitespace-nowrap uppercase">{l.lastOrderDate || '-'}</td>
                {MONTHS_TRACKING.map(month => (
                  WEEKS.map(week => (
                    <React.Fragment key={`${l.id}-${month}-${week}`}>
                      <td onClick={(e) => { e.stopPropagation(); toggle(l.id, month, week, 'track'); }} className={`border-b border-r border-slate-100 p-0 hover:bg-indigo-50 cursor-pointer transition-all ${gridState[`${l.id}-${month}-${week}-track`] ? 'bg-indigo-100' : ''}`}>
                        <div className="flex justify-center">{gridState[`${l.id}-${month}-${week}-track`] ? <Check size={10} className="text-indigo-600" /> : <div className="w-1 h-1 bg-slate-200 rounded-full" />}</div>
                      </td>
                      <td onClick={(e) => { e.stopPropagation(); toggle(l.id, month, week, 'order'); }} className={`border-b border-r border-slate-200 p-0 hover:bg-emerald-50 cursor-pointer transition-all ${gridState[`${l.id}-${month}-${week}-order`] ? 'bg-emerald-100' : ''}`}>
                        <div className="flex justify-center">{gridState[`${l.id}-${month}-${week}-order`] ? <ShoppingBag size={10} className="text-emerald-600" /> : <div className="w-1 h-1 bg-slate-200 rounded-full" />}</div>
                      </td>
                    </React.Fragment>
                  ))
                ))}
              </tr>
            )) : (
              <tr><td colSpan={50} className="p-20 text-center text-slate-400 font-black uppercase tracking-widest italic bg-slate-50/50">ไม่พบข้อมูลสำหรับลูกค้าหน้านี้</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-900 px-6 py-4 text-xs font-black text-white flex justify-between items-center shrink-0">
        <div className="flex gap-8 uppercase tracking-widest pl-2">
          <span className="flex items-center gap-2.5"><div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div> ติดต่อลูกค้า</span>
          <span className="flex items-center gap-2.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div> สั่งซื้อ/ซื้อสินค้า</span>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner">
            <button onClick={(e) => { e.stopPropagation(); onPageChange(prev => Math.max(1, prev - 1)); }} disabled={pagination.page === 1} className={`p-1.5 rounded-lg transition-all ${pagination.page === 1 ? 'text-white/20 cursor-not-allowed' : 'hover:bg-white/10 text-white active:scale-95'}`}><ChevronLeft size={16} /></button>
            <div className="px-3 flex items-center gap-2 font-black"><span className="text-indigo-400">หน้า {pagination.page}</span><span className="text-white/20">/</span><span>{pagination.totalPages}</span></div>
            <button onClick={(e) => { e.stopPropagation(); onPageChange(prev => Math.min(pagination.totalPages, prev + 1)); }} disabled={pagination.page === pagination.totalPages} className={`p-1.5 rounded-lg transition-all ${pagination.page === pagination.totalPages ? 'text-white/20 cursor-not-allowed' : 'hover:bg-white/10 text-white active:scale-95'}`}><ChevronRight size={16} /></button>
          </div>
        )}
        <div className="flex gap-6 text-slate-400 italic">
          <span className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5 text-[10px]">เลื่อนตารางได้ <ChevronRight size={10} /></span>
          <span>จำนวนทั้งหมด: {pagination?.total || (data ? data.length : 0)} รายการ</span>
        </div>
      </div>
    </div>
  );
};

export default RetentionTableView;
