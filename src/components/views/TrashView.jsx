import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertCircle, 
  Loader2, 
  Search, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  Info,
  Calendar
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { TableSkeleton } from '../common/Skeleton';
import { dialog } from '../../utils/dialog';

export default function TrashView({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    runCleanupAndLoad();
  }, []);

  const runCleanupAndLoad = async () => {
    setLoading(true);
    try {
      // 1. Purge expired trash items (> 30 days) automatically
      const cleanupRes = await leadService.cleanupExpiredTrash();
      if (cleanupRes.success && cleanupRes.deletedCount > 0) {
        console.log(`Automatically purged ${cleanupRes.deletedCount} expired trash items.`);
      }
      
      // 2. Fetch active trash items
      await fetchTrashLeads();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrashLeads = async () => {
    try {
      const res = await leadService.getCustomersByStage('trash', null, 1, 5000);
      setLeads(res.data || []);
    } catch (err) {
      console.error("Fetch Trash Leads Error:", err);
      showToast("ไม่สามารถดึงข้อมูลถังขยะได้", "error");
    }
  };

  const getRemainingDays = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedTime = deletedAt.toDate ? deletedAt.toDate().getTime() : new Date(deletedAt).getTime();
    const expiryTime = deletedTime + (30 * 24 * 60 * 60 * 1000);
    const diffMs = expiryTime - Date.now();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return Math.max(0, diffDays);
  };

  const formatDeletedDate = (deletedAt) => {
    if (!deletedAt) return '-';
    const date = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear() + 543} ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleRestoreSingle = async (customer) => {
    const confirmRestore = await dialog.confirm({
      title: 'กู้คืนรายชื่อ?',
      text: `คุณต้องการกู้คืนรายชื่อ "${customer.name || customer.phone}" กลับไปที่หมวดเดิมใช่หรือไม่?`,
      icon: 'question'
    });
    if (!confirmRestore) return;

    setLoading(true);
    try {
      const origStage = customer.trashOriginalStage || 'pool';
      await leadService.restoreCustomer(customer.id);
      showToast("กู้คืนรายชื่อเรียบร้อยแล้ว", "success");

      await leadService.logActivity({
        adminId: 'manager',
        adminName: 'Manager',
        action: `กู้คืนรายชื่อ "${customer.name || customer.phone}" กลับไปที่ stage "${origStage}"`,
        type: 'restore-lead',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerStage: origStage
      });

      setSelected(prev => prev.filter(id => id !== customer.id));
      await fetchTrashLeads();
    } catch (err) {
      console.error(err);
      showToast("กู้คืนรายชื่อล้มเหลว", "error");
    } finally {
      setLoading(false);
    }
  };



  const filteredLeads = leads.filter(l => {
    return !searchTerm || 
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.phone?.includes(searchTerm) || 
      (l.customerNo && l.customerNo.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  if (loading && leads.length === 0) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 font-sans">
      
      {/* Upper bar with Stats and search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        
        {/* Header Title & Count */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase italic leading-tight">ถังขยะรายชื่อลูกค้า</h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              แสดงรายชื่อที่ถูกลบชั่วคราว มีเวลาเหลือ 30 วันก่อนจะลบออกระบบถาวรโดยอัตโนมัติ (ปัจจุบัน: {leads.length} รายการ)
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">

          <button
            onClick={runCleanupAndLoad}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 active:scale-95 transition-all cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ลูกค้าในถังขยะ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-300 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
          พบในผลลัพธ์: {filteredLeads.length} รายการ
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-4 w-12 text-center">
                  <div 
                    onClick={() => {
                      const allIds = filteredLeads.map(l => l.id);
                      if (allIds.length === 0) return;
                      if (allIds.every(id => selected.includes(id))) {
                        setSelected(prev => prev.filter(id => !allIds.includes(id)));
                      } else {
                        setSelected(prev => Array.from(new Set([...prev, ...allIds])));
                      }
                    }}
                    className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                  >
                    {filteredLeads.length > 0 && filteredLeads.every(l => selected.includes(l.id))
                      ? <CheckSquare size={16} className="text-indigo-600" />
                      : <Square size={16} />
                    }
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[30%]">No. / ชื่อลูกค้า</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[18%]">เบอร์โทรศัพท์</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[15%]">หมวดหมู่เดิมก่อนลบ</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[18%]">วันที่ย้ายไปถังขยะ</th>
                <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic w-[12%]">ระยะเวลาที่เหลือ</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-widest italic w-[12%]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLeads.length > 0 ? (
                filteredLeads.map(l => {
                  const remDays = getRemainingDays(l.deletedAt);
                  const isUrgent = remDays <= 7;
                  
                  return (
                    <tr 
                      key={l.id} 
                      className="transition-colors group hover:bg-slate-50/30"
                    >
                      {/* Checkbox cell */}
                      <td className="px-4 py-4 text-center">
                        <div 
                          onClick={() => {
                            setSelected(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]);
                          }}
                          className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                        >
                          {selected.includes(l.id) 
                            ? <CheckSquare size={16} className="text-indigo-600" />
                            : <Square size={16} />
                          }
                        </div>
                      </td>
                      
                      {/* Name/No */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-inner">
                              <span className="text-[10px] font-black text-slate-400">NO.</span>
                              <span className="text-[11px] font-black text-slate-600 leading-none">{l.customerNo || '-'}</span>
                           </div>
                           <div>
                              <div className="text-sm font-black text-slate-900 tracking-tight">
                                {l.name || 'ไม่ระบุชื่อลูกค้า'}
                              </div>
                           </div>
                        </div>
                      </td>
                      
                      {/* Phone */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-black text-indigo-600 tracking-wider">
                           {l.phone}
                        </div>
                      </td>
                      
                      {/* Original Stage */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 tracking-wider uppercase">
                          {l.trashOriginalStage === 'pool' ? 'คลังรายชื่อ/เบอร์ใหม่' : (l.trashOriginalStage === 'qualified' ? 'ลูกค้ารอตัดสินใจ' : 'ลูกค้าประจำ')}
                        </span>
                      </td>

                      {/* Deleted Date */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                        {formatDeletedDate(l.deletedAt)}
                      </td>
                      
                      {/* Countdown */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                          isUrgent 
                            ? 'bg-rose-50 text-rose-600 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {isUrgent ? '⏳' : '✅'} เหลืออีก {remDays} วัน
                        </span>
                      </td>

                      {/* Individual Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestoreSingle(l)}
                            className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100/50 active:scale-95 cursor-pointer flex items-center justify-center"
                            title="กู้คืนรายชื่อกลับหมวดหมู่เดิม"
                          >
                            <RotateCcw size={15} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center text-slate-600">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <Trash2 size={48} className="stroke-[1px]" />
                      <div className="text-sm font-black uppercase tracking-widest italic">ถังขยะว่างเปล่า</div>
                      <p className="text-[11px] text-slate-400 font-bold max-w-xs leading-relaxed">
                        ไม่มีรายชื่อลูกค้าที่ถูกลบอยู่ในถังขยะขณะนี้ เมื่อคุณลบรายชื่อจากหน้าอื่นๆ รายชื่อจะมาปรากฏในหน้านี้
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-300">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black">
              {selected.length}
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-slate-300">รายการที่เลือก</span>
          </div>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex gap-2.5">
            <button
              onClick={handleBulkRestore}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border-none"
            >
              <RotateCcw size={14} />
              กู้คืนทั้งหมด ({selected.length})
            </button>

            <button
              onClick={() => setSelected([])}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer border-none"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
