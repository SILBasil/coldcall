import React, { useState, useEffect } from 'react';
import {
  Repeat,
  AlertTriangle,
  Search,
  PhoneCall,
  Calendar,
  Filter,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Info,
  Edit2,
  Trash2,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import CustomSelect from '../common/CustomSelect';
import EditCustomerModal from '../common/EditCustomerModal';
import { dialog } from '../../utils/dialog';

const STATUS_COLORS = {
  'ปิดเครื่อง / ติดต่อไม่ได้': { bg: 'bg-rose-50 text-rose-700 border-rose-100', bar: 'bg-rose-500' },
  'ไม่สนใจ': { bg: 'bg-red-50 text-red-700 border-red-100', bar: 'bg-red-500' },
  'เลิกขาย/ปิดกิจการ': { bg: 'bg-slate-100 text-slate-700 border-slate-200', bar: 'bg-slate-500' },
  'ยังไม่สะดวกคุยตอนนี้': { bg: 'bg-amber-50 text-amber-700 border-amber-100', bar: 'bg-amber-500' },
  'ติดต่อยาก / รอสายยาว': { bg: 'bg-orange-50 text-orange-700 border-orange-100', bar: 'bg-orange-500' },
  'ลูกค้ามีสินค้าเหลือในสต็อก': { bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', bar: 'bg-indigo-500' },
  'ต้องการของแถม/โปรโมชั่นพิเศษ': { bg: 'bg-purple-50 text-purple-700 border-purple-100', bar: 'bg-purple-500' },
  'โทรไม่รับ': { bg: 'bg-rose-50 text-rose-700 border-rose-100', bar: 'bg-rose-500' },
  'โทรไม่ซื้อ': { bg: 'bg-red-50 text-red-700 border-red-100', bar: 'bg-red-500' },
};

const parseThaiDate = (dateStr) => {
  if (!dateStr) return null;
  if (typeof dateStr !== 'string') {
    const parsedDate = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y > 2400) y = y - 543;
      return new Date(y, m, d);
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatThaiDate = (dateStr) => {
  if (!dateStr) return '-';
  const parsed = parseThaiDate(dateStr);
  if (!parsed) return typeof dateStr === 'string' ? dateStr : '-';
  return `${parsed.getDate()}/${parsed.getMonth() + 1}/${parsed.getFullYear() + 543}`;
};

export default function LostCustomersView({ currentAdminId, currentAdminName, isManager, showToast, onCall }) {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | unassigned | assigned
  const [selectedAdminId, setSelectedAdminId] = useState(isManager ? 'all' : currentAdminId);
  const [lostCustomers, setLostCustomers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selected, setSelected] = useState([]);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterActionDate, setFilterActionDate] = useState('all'); // all | not_today
  const [filterFreqAmt, setFilterFreqAmt] = useState(''); // '' | '1' | '2' | '3'
  const [filterFreqUnit, setFilterFreqUnit] = useState(''); // '' | 'สัปดาห์' | 'เดือน'

  // Fetch Admins if manager
  useEffect(() => {
    const fetchAdminsList = async () => {
      try {
        const users = await leadService.getUsers();
        setAdmins(users.filter(u => u.role === 'admin'));
      } catch (err) {
        console.error("Error fetching admins:", err);
      }
    };
    fetchAdminsList();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const filterId = selectedAdminId === 'all' ? null : selectedAdminId;
      const res = await leadService.getLostCustomers(filterId);
      // Filter out soft deleted
      const nonDeleted = (res.data || []).filter(c => c.stage !== 'trash');
      setLostCustomers(nonDeleted);
    } catch (err) {
      console.error("Error loading Lost Customers:", err);
      if (showToast) showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้าหาย", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setSelected([]);
  }, [selectedAdminId, filterStatus]);

  // Filter lost customers in JS memory
  const filteredCustomers = lostCustomers.filter(c => {
    const matchesSearch = !searchTerm || 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.responsibleName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.status?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    const isAssigned = (c.responsibleId && c.responsibleId !== 'Unassigned');
    if (filterStatus === 'unassigned' && isAssigned) return false;
    if (filterStatus === 'assigned' && !isAssigned) return false;

    // Filter by frequency amount
    if (filterFreqAmt) {
      const amt = parseInt(c.freqAmount) || 1;
      const filterAmt = parseInt(filterFreqAmt);
      if (filterAmt === 3) {
        if (amt < 3) return false;
      } else {
        if (amt !== filterAmt) return false;
      }
    }

    // Filter by frequency unit
    if (filterFreqUnit && (c.freqUnit || 'สัปดาห์') !== filterFreqUnit) return false;

    // Filter by action date for admins
    if (!isManager) {
      const today = new Date();
      const todayYmd = today.toISOString().split('T')[0];
      const todayTh = today.toLocaleDateString('th-TH');
      
      const isDoneToday = 
        (c.lastActionDate && c.lastActionDate === todayYmd) || 
        (c.lastCallDate && c.lastCallDate === todayTh);

      if (filterActionDate === 'today' && !isDoneToday) return false;
      if (filterActionDate === 'not_today' && isDoneToday) return false;
    }

    return true;
  });

  // Frequency label helper
  const freqLabel = (c) => {
    const amt = c.freqAmount || 1;
    const unit = c.freqUnit || 'สัปดาห์';
    return `${amt} ${unit}`;
  };

  const handleSoftDeleteSingle = async (customer) => {
    const confirmDelete = await dialog.confirm({
      title: 'ย้ายรายชื่อไปที่ถังขยะ?',
      text: `คุณต้องการย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะใช่หรือไม่?\n\n*หมายเหตุ: รายชื่อในถังขยะจะถูกเก็บไว้เป็นเวลา 30 วันก่อนจะถูกลบออกถาวรโดยอัตโนมัติ`,
      isDanger: true
    });
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await leadService.deleteCustomerSoft(customer.id || customer.phone, customer.stage || 'customer');
      if (showToast) showToast("ย้ายรายชื่อไปที่ถังขยะเรียบร้อยแล้ว", "success");
      
      await leadService.logActivity({
        adminId: currentAdminId || 'manager',
        adminName: currentAdminName || 'Manager',
        action: `ย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะ`,
        type: 'soft-delete',
        customerId: customer.id || customer.phone,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerStage: 'trash'
      });

      setSelected(prev => prev.filter(id => id !== (customer.id || customer.phone)));
      loadData();
    } catch (err) {
      console.error(err);
      if (showToast) showToast("เกิดข้อผิดพลาดในการลบรายชื่อ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSoftDelete = async () => {
    const confirmDelete = await dialog.confirm({
      title: 'ย้ายรายชื่อที่เลือกไปที่ถังขยะ?',
      text: `คุณต้องการย้ายรายชื่อที่เลือกทั้งหมด ${selected.length} รายการไปที่ถังขยะใช่หรือไม่?\n\n*หมายเหตุ: รายชื่อในถังขยะจะถูกเก็บไว้เป็นเวลา 30 วันก่อนจะถูกลบออกถาวรโดยอัตโนมัติ`,
      isDanger: true
    });
    if (!confirmDelete) return;

    try {
      setLoading(true);
      
      const promises = selected.map(async (id) => {
        const customer = lostCustomers.find(l => l.id === id);
        const originalStage = customer?.stage || 'customer';
        await leadService.deleteCustomerSoft(id, originalStage);
      });
      
      await Promise.all(promises);

      await leadService.logActivity({
        adminId: 'manager',
        adminName: 'Manager',
        action: `ย้ายรายชื่อจำนวน ${selected.length} รายการไปที่ถังขยะ (Bulk)`,
        type: 'soft-delete-bulk',
        details: `IDs: ${selected.join(', ')}`
      });

      if (showToast) showToast(`ย้ายรายชื่อ ${selected.length} รายการไปที่ถังขยะเรียบร้อยแล้ว`, "success");
      setSelected([]);
      loadData();
    } catch (err) {
      console.error(err);
      if (showToast) showToast("เกิดข้อผิดพลาดในการลบหลายรายชื่อ", "error");
    } finally {
      setLoading(false);
    }
  };

  const todayVal = new Date();
  const todayYmdVal = todayVal.toISOString().split('T')[0];
  const todayThVal = todayVal.toLocaleDateString('th-TH');
  
  const doneTodayCount = lostCustomers.filter(c => {
    const isDoneToday = 
      (c.lastActionDate && c.lastActionDate === todayYmdVal) || 
      (c.lastCallDate && c.lastCallDate === todayThVal);
    return isDoneToday;
  }).length;
  
  const notDoneTodayCount = lostCustomers.length - doneTodayCount;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm font-sans">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร หรือแอดมิน..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-300 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
           {isManager ? (
             <>
               <button 
                 onClick={() => setFilterStatus('unassigned')}
                 className={`inline-flex items-center justify-center min-w-[160px] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'unassigned' ? 'bg-white text-indigo-600 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 ยังไม่ได้มอบหมาย ({lostCustomers.filter(c => !c.responsibleId || c.responsibleId === 'Unassigned').length})
               </button>
               <button 
                 onClick={() => setFilterStatus('assigned')}
                 className={`inline-flex items-center justify-center min-w-[160px] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'assigned' ? 'bg-white text-indigo-600 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 มอบหมายแล้ว ({lostCustomers.filter(c => c.responsibleId && c.responsibleId !== 'Unassigned').length})
               </button>
               <button 
                 onClick={() => setFilterStatus('all')}
                 className={`inline-flex items-center justify-center min-w-[130px] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 ทั้งหมด ({lostCustomers.length})
               </button>
               
             </>
           ) : (
             <>
               <button 
                 onClick={() => setFilterActionDate('all')}
                 className={`inline-flex items-center justify-center min-w-[130px] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${filterActionDate === 'all' ? 'bg-white text-slate-800 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 ทั้งหมด ({lostCustomers.length})
               </button>
               <button 
                  onClick={() => setFilterActionDate('not_today')}
                  className={`inline-flex items-center justify-center min-w-[160px] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer border ${filterActionDate === 'not_today' ? 'bg-white text-slate-800 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
                >
                  วันนี้ (ยังไม่ได้ทำ) ({notDoneTodayCount})
                </button>
             </>
           )}
           {isManager && (
               <div className={`relative transition-all duration-200 ml-1 ${filterStatus !== 'assigned' ? 'opacity-40' : ''}`}>
                  <Filter size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 z-10 pointer-events-none" />
                  <CustomSelect
                    value={selectedAdminId}
                    onChange={e => setSelectedAdminId(e.target.value)}
                    disabled={filterStatus !== 'assigned'}
                    className="pl-9 pr-10 py-2 text-[12px]"
                    options={[
                      { value: 'all', label: 'พอร์ตทั้งหมดในระบบ' },
                      ...admins.map(a => ({ value: a.id, label: `พอร์ตของ: ${a.name}` }))
                    ]}
                  />
               </div>
              )}
          </div>
      </div>

      {/* Special Frequency Filters Row */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm font-sans">
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 border-r border-slate-100">
           ตัวกรองพิเศษ :
        </div>

        <CustomSelect 
           value={filterFreqAmt}
           onChange={e => setFilterFreqAmt(e.target.value)}
           className="px-3 py-2 text-xs"
           containerClassName="w-full sm:w-56"
           placeholder="-- กรองระดับความรอบความถี่ --"
           options={[
             { value: '', label: '-- กรองระดับความรอบความถี่ --' },
             { value: '1', label: '1' },
             { value: '2', label: '2' },
             { value: '3', label: '3 ขึ้นไป' }
           ]}
        />

        <CustomSelect 
           value={filterFreqUnit}
           onChange={e => setFilterFreqUnit(e.target.value)}
           className="px-3 py-2 text-xs"
           containerClassName="w-full sm:w-56"
           placeholder="-- กรองหน่วยรอบ --"
           options={[
             { value: '', label: '-- กรองหน่วยรอบ --' },
             { value: 'สัปดาห์', label: 'สัปดาห์' },
             { value: 'เดือน', label: 'เดือน' }
           ]}
        />

        {(filterFreqAmt || filterFreqUnit) && (
          <button
            onClick={() => {
              setFilterFreqAmt('');
              setFilterFreqUnit('');
            }}
            className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 border border-rose-100 cursor-pointer"
          >
            <RotateCcw size={12} />
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table list */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 select-none text-[11px] font-black text-slate-400 uppercase tracking-widest italic font-bold">
                {isManager && (
                  <th className="px-4 py-4 w-12 text-center">
                    <div 
                      onClick={() => {
                        const allIds = filteredCustomers.map(l => l.id);
                        if (allIds.length === 0) return;
                        if (allIds.every(id => selected.includes(id))) {
                          setSelected(prev => prev.filter(id => !allIds.includes(id)));
                        } else {
                          setSelected(prev => Array.from(new Set([...prev, ...allIds])));
                        }
                      }}
                      className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                    >
                      {filteredCustomers.length > 0 && filteredCustomers.every(l => selected.includes(l.id))
                        ? <CheckSquare size={16} className="text-indigo-600" />
                        : <Square size={16} />
                      }
                    </div>
                  </th>
                )}
                <th className={`px-6 py-4 text-left ${isManager ? 'w-[22%]' : 'w-[24%]'}`}>No. / ชื่อลูกค้า</th>
                <th className="px-6 py-4 text-left w-[13%]">เบอร์โทรศัพท์</th>
                <th className="px-6 py-4 text-left w-[15%]">ผู้รับผิดชอบ (Admin)</th>
                <th className="px-6 py-4 text-center w-[10%]">ความถี่</th>
                <th className="px-6 py-4 text-left w-[18%]">สถานะล่าสุด (เหตุผลไม่ซื้อ)</th>
                <th className="px-6 py-4 text-center w-[11%]">วันที่ติดต่อล่าสุด</th>
                <th className="px-6 py-4 text-right w-[9%]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-bold italic text-xs">
                    กำลังดึงข้อมูลรายชื่อลูกค้า...
                  </td>
                </tr>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => {
                  const statusInfo = STATUS_COLORS[customer.status] || {
                    bg: 'bg-slate-50 text-slate-700 border-slate-100',
                    bar: 'bg-slate-400'
                  };
                  
                  return (
                    <tr 
                      key={customer.id} 
                      className={`transition-colors group ${(isManager) ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/50'}`}
                      onClick={() => !isManager && onCall(customer)}
                    >
                      {isManager && (
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div 
                            onClick={() => {
                              setSelected(prev => prev.includes(customer.id) ? prev.filter(id => id !== customer.id) : [...prev, customer.id]);
                            }}
                            className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                          >
                            {selected.includes(customer.id) 
                              ? <CheckSquare size={16} className="text-indigo-600" />
                              : <Square size={16} />
                            }
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
                               <span className="text-[10px] font-black text-slate-400">NO.</span>
                               <span className="text-[11px] font-black text-slate-600 leading-none">{customer.customerNo || '-'}</span>
                           </div>
                           <div>
                              <div className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                                {customer.name || '-'}
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic flex items-center gap-1.5">
                                 {isManager ? '⚠️ ข้อมูลบอทระบบ' : 'คลิกเพื่อดูรายละเอียด / โทรติดต่อ 👈'}
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-black text-indigo-600 tracking-wider">
                           {customer.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="inline-block bg-sky-50 text-primary border border-sky-100 px-2.5 py-1 rounded-full text-[10px] font-black">
                           👤 {customer.responsibleName || 'Unassigned'}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-slate-600">
                        {freqLabel(customer)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block border px-2.5 py-1 rounded-xl text-[10px] font-black ${statusInfo.bg}`}>
                           {customer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-xs text-slate-500 whitespace-nowrap">
                        {formatThaiDate(customer.lastCallDate)}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 text-sm font-bold">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCustomerForEdit(customer);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200 active:scale-95 cursor-pointer flex items-center justify-center"
                            title="แก้ไขข้อมูลลูกค้า"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSoftDeleteSingle(customer);
                            }}
                            className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 active:scale-95 cursor-pointer flex items-center justify-center"
                            title="ย้ายไปถังขยะ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                       <AlertTriangle size={40} className="stroke-[1px]" />
                       <div className="text-sm font-black uppercase tracking-widest italic">ไม่พบข้อมูลลูกค้าสำหรับเงื่อนไขการค้นหานี้</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCustomerForEdit(null);
        }}
        customer={selectedCustomerForEdit}
        onSave={() => {
          loadData();
        }}
        showToast={showToast}
        currentAdminId={currentAdminId}
        currentAdminName={currentAdminName}
      />

      {/* Floating Bulk Actions Bar */}
      {isManager && selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-300">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black">
              {selected.length}
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-slate-300">รายการที่เลือก</span>
          </div>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkSoftDelete()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border-none"
            >
              <Trash2 size={14} />
              ย้ายไปถังขยะ ({selected.length} รายการ)
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
