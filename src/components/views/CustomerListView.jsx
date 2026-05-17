import React, { useState, useEffect } from 'react';
import { Search, Users, AlertCircle, Loader2, PhoneCall, QrCode, X, MessageSquare, Star, Info, ChevronLeft, ChevronRight, Plus, Calendar, Clock, Edit2 } from 'lucide-react';
import { ADMINS, MONTHS_TRACKING } from '../../constants';
import { leadService } from '../../services/leadService';
import RetentionTableView from './RetentionTableView';
import QRCodeModal from '../common/QRCodeModal';
import { TableSkeleton } from '../common/Skeleton';

const CustomerListView = ({ type, activeTab, setActiveTab, currentAdminId, role, showToast, onCall }) => {
  const isManager = role === 'manager';
  const [qrModal, setQrModal] = useState({ open: false, phone: '', name: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, count: 0, hasMore: false });
  const [cursorHistory, setCursorHistory] = useState([null]); // [0, Page1LastDoc, Page2LastDoc, ...]
  const [currentPage, setCurrentPage] = useState(1);
  const [admins, setAdmins] = useState([]);
  const [assignedThisWeekIds, setAssignedThisWeekIds] = useState(new Set());
  const [completedThisWeekIds, setCompletedThisWeekIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(type === 'master-pool' ? 'all' : (type === 'retention' ? 'all' : 'todo'));
  
  // Retention Manual Dropdowns
  const [filterFreqAmt, setFilterFreqAmt] = useState(''); // '', '1', '2', '3'
  const [filterFreqUnit, setFilterFreqUnit] = useState(''); // '', 'สัปดาห์', 'เดือน'
  const [filterTrackStatus, setFilterTrackStatus] = useState(''); // '', 'tracked', 'not_tracked'
  const [filterOrderStatus, setFilterOrderStatus] = useState(''); // '', 'bought', 'not_bought'

  // Time Machine for Retention testing
  const [mockTodayStr, setMockTodayStr] = useState(new Date().toISOString().split('T')[0]);
  const mockToday = new Date(mockTodayStr);

  useEffect(() => {
    setFilterStatus(type === 'master-pool' ? 'all' : (type === 'retention' ? 'all' : 'todo'));
    setCurrentPage(1); 
    setCursorHistory([null]); 
    setSearchTerm('');
    setDebouncedSearch('');
    setLeads([]);          // Clear stale data immediately
    setLoading(true);      // Show loading state right away
  }, [type, currentAdminId, activeTab]);

  useEffect(() => {
    if (type === 'retention') {
      loadSummaries();
    }
  }, [mockTodayStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchLeads();
  }, [currentAdminId, role, activeTab, type, currentPage, debouncedSearch]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const stage = type === 'follow-up' ? 'qualified' : ((type === 'master-pool' || type === 'new-leads') ? 'pool' : 'customer');
      const currentCursor = cursorHistory[currentPage - 1];

      let res;
      if (debouncedSearch.length >= 2) {
         const searchData = await leadService.searchCustomers(debouncedSearch);
         const adminFiltered = activeTab === 'my' && currentAdminId 
            ? searchData.filter(d => d.responsibleId === currentAdminId) 
            : searchData;
         let finalData = adminFiltered.filter(d => d.stage === stage);
         if (type === 'new-leads') {
            finalData = finalData.filter(d => d.status === '🆕 รอดำเนินการ');
         }
         res = {
            data: finalData,
            lastDoc: null,
            pagination: { total: finalData.length, count: finalData.length, hasMore: false }
         };
      } else {
         const options = {};
         if (type === 'new-leads') options.status = '🆕 รอดำเนินการ';
         res = await leadService.getCustomersByStagePaginated(stage, activeTab === 'my' ? currentAdminId : null, currentCursor, 50, options);
      }

      if (res && res.data) {
        setLeads(res.data);
        setPagination(res.pagination);
        if (res.lastDoc && cursorHistory.length === currentPage && debouncedSearch.length < 2) {
          setCursorHistory([...cursorHistory, res.lastDoc]);
        }
      } else {
        setLeads([]);
      }

      // --- Lazy Load Summaries (Non-blocking for the list) ---
      loadSummaries();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMockupLead = async () => {
    setIsAdding(true);
    try {
      const randomPhone = '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const randomNo = Math.floor(Math.random() * 10000);
      const mockupData = {
        phone: randomPhone,
        name: `ลูกค้าทดสอบ (Mockup ${randomNo})`,
        businessType: 'ร้านค้าปลีก/ส่ง',
        customerNo: `M-${randomNo}`,
        status: '🆕 รอดำเนินการ'
      };
      
      await leadService.addManualLead(mockupData);
      if (showToast) showToast(`เพิ่มลูกค้าทดสอบ ${randomPhone} สำเร็จแล้ว`);
      fetchLeads(); // refresh the list
    } catch (err) {
      if (showToast) showToast(err.message || 'เกิดข้อผิดพลาดในการเพิ่มลูกค้าทดสอบ', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddMockRetentionLead = async () => {
    setIsAdding(true);
    try {
      const getMockDate = (pastDays) => {
         const d = new Date(mockToday.getTime() - (pastDays * 24 * 60 * 60 * 1000));
         return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
      };

      const mocks = [
        {
          phone: '090' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านกาแฟริมน้ำ`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(3),
          freqAmount: 1,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ลูกค้าสั่งชานม แฟรนไชส์ร้านกาแฟริมน้ำประจำ'
        },
        {
          phone: '091' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านขนมหวานปังปิ้ง (รอบ 2 สัปดาห์)`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(14),
          freqAmount: 2,
          freqUnit: 'สัปดาห์',
          responsibleId: null,
          remark: 'ลูกค้าสั่งวัตถุดิบและเบเกอรี่ทุก 2 สัปดาห์สม่ำเสมอ'
        },
        {
          phone: '092' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: โชห่วยมินิมาร์ท (รอบ 1 เดือน)`,
          stage: 'customer',
          status: '❌ ปิดดีลไม่ได้',
          lastOrderDate: getMockDate(40),
          freqAmount: 1,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ไม่ได้ซื้อนานแล้ว โทรไปไม่มีคนรับสายหรือแจ้งว่ายังไม่สะดวกสั่ง'
        },
        {
          phone: '093' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านเบเกอรี่โฮมเมด`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(90),
          freqAmount: 3,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ซื้อซ้ำต่อเนื่อง สั่งซื้อล่าสุดเมื่อ 3 เดือนที่แล้ว'
        },
        {
          phone: '094' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: มินิมาร์ท ปตท. (รอบ 1 สัปดาห์)`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(5),
          freqAmount: 1,
          freqUnit: 'สัปดาห์',
          responsibleId: null,
          remark: 'จัดส่งวัตถุดิบทุกวันจันทร์ ร้านค้าเปิดใหม่ประจำสัปดาห์'
        }
      ];
      
      for (const m of mocks) {
         await leadService.addManualLead(m);
      }

      if (showToast) showToast(`สร้างข้อมูลจำลอง Retention สำเร็จ 5 รายการ`);
      fetchLeads();
    } catch (err) {
      if (showToast) showToast(err.message || 'เกิดข้อผิดพลาดในการสร้างข้อมูลจำลอง', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const now = type === 'retention' ? mockToday : new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const start = new Date(now);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const [allUsers] = await Promise.all([leadService.getUsers()]);
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      setAdmins(adminUsers);

      const adminIdsToFetch = (isManager || !currentAdminId)
        ? adminUsers.map(u => u.id)
        : [currentAdminId];

      const allSummaries = await Promise.all(
        adminIdsToFetch.map(aid => leadService.getWeeklyAdminSummary({
          adminId: aid,
          startDate: start,
          endDate: end
        }))
      );

      const mergedCompleted = new Set();
      const mergedAssigned = new Set();
      allSummaries.forEach(logs => {
        if (logs) {
          (logs.completedFullList || []).forEach(id => mergedCompleted.add(id));
          (logs.assignedFullList || []).forEach(id => mergedAssigned.add(id));
        }
      });

      setCompletedThisWeekIds(mergedCompleted);
      setAssignedThisWeekIds(mergedAssigned);
    } catch (e) {
      console.error("Summary load error", e);
    }
  };
  // Helper for Retention Date Math
  const parseThaiDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10) - 543;
    return new Date(y, m, d);
  };

  const getNextDueDate = (lastOrderDateStr, amount, unit) => {
    const d = parseThaiDate(lastOrderDateStr);
    if (!d) return null;
    const amt = parseInt(amount) || 0;
    if (unit === 'เดือน') {
       d.setMonth(d.getMonth() + amt);
    } else {
       d.setDate(d.getDate() + (amt * 7));
    }
    return d;
  };

  const filteredData = leads.filter(l => {
    const matchesSearch = 
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone?.includes(searchTerm);
    
    if (filterStatus === 'all' && type !== 'retention') return matchesSearch;

    if (type === 'retention') {
       if (filterFreqAmt) {
          const amt = parseInt(l.freqAmount) || 1;
          const filterAmt = parseInt(filterFreqAmt);
          if (filterAmt === 3) {
              if (amt < 3) return false;
          } else {
              if (amt !== filterAmt) return false;
          }
       }
       if (filterFreqUnit && l.freqUnit !== filterFreqUnit) return false;

       const isCompleted = completedThisWeekIds.has(l.id) || completedThisWeekIds.has(l.phone);
       
       const dueDate = getNextDueDate(l.lastOrderDate, l.freqAmount, l.freqUnit);
       const endOfMockToday = new Date(mockToday);
       endOfMockToday.setHours(23, 59, 59, 999);
       const isDue = dueDate ? (dueDate <= endOfMockToday) : false;

       if (filterTrackStatus === 'tracked') {
          if (!isCompleted) return false;
       } else if (filterTrackStatus === 'not_tracked') {
          if (isCompleted) return false;
       }
       
       if (filterOrderStatus === 'bought') {
          if (l.status !== '✅ สั่งซื้อแล้ว') return false;
       } else if (filterOrderStatus === 'not_bought') {
          if (l.status === '✅ สั่งซื้อแล้ว') return false;
       }

       return matchesSearch;
    }
    
    const isCompleted = completedThisWeekIds.has(l.id) || completedThisWeekIds.has(l.phone);
    const isAssigned = (l.responsibleId && l.responsibleId !== 'Unassigned');
    const matchesWeeklyAssigned = assignedThisWeekIds.size === 0 
      ? true 
      : assignedThisWeekIds.has(l.id) || assignedThisWeekIds.has(l.phone);
    
    if (filterStatus === 'todo') {
      return matchesSearch && matchesWeeklyAssigned && !isCompleted;
    }
    
    if (filterStatus === 'due') {
      return matchesSearch && matchesWeeklyAssigned && isCompleted;
    }

    if (filterStatus === 'unassigned') {
      return matchesSearch && !isAssigned;
    }
    
    return matchesSearch;
  });

  if (loading && leads.length === 0) {
     return <TableSkeleton />;
  }

  if (activeTab === 'rentention-grid') {
     return (
       <RetentionTableView 
         data={leads} 
         pagination={pagination}
         onPageChange={setCurrentPage}
         onManage={(l) => onCall(l, type === 'master-pool')} 
       />
     );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm font-sans">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ลูกค้า..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-300 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (currentPage !== 1) setCurrentPage(1); // Reset to page 1 on search
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100 shadow-inner overflow-x-auto custom-scrollbar">
           {type !== 'master-pool' && type !== 'retention' && (
             <>
               <button 
                 onClick={() => setFilterStatus('todo')}
                 className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterStatus === 'todo' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-600 hover:text-slate-800'}`}
               >
                 {isManager ? 'งานที่ค้างมอบหมาย' : 'งานที่ได้รับมอบหมาย'}
               </button>
               {isManager && (
                 <button 
                   onClick={() => setFilterStatus('unassigned')}
                   className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterStatus === 'unassigned' ? 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200' : 'text-slate-600 hover:text-slate-800'}`}
                 >
                   ยังไม่ได้มอบหมาย
                 </button>
               )}
               <button 
                 onClick={() => setFilterStatus('due')}
                 className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterStatus === 'due' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'}`}
               >
                 งานที่ติดตามแล้ว
               </button>
             </>
           )}
           <button 
             onClick={() => setFilterStatus('all')}
             className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'text-slate-600 hover:text-slate-800'}`}
           >
             รายชื่อทั้งหมด ({pagination.total})
           </button>

           {type === 'master-pool' && (
             <button
               onClick={handleAddMockupLead}
               disabled={isAdding}
               className="ml-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
             >
               {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 
               เพิ่มข้อมูลลูกค้าจำลอง (Mockup)
             </button>
           )}
            {type === 'retention' && (
              <button
                onClick={handleAddMockRetentionLead}
                disabled={isAdding}
                className="ml-2 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 
                เพิ่มข้อมูลลูกค้าประจำ (Retention)
              </button>
            )}
        </div>
      </div>

      {type === 'retention' && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm font-sans">
          
          <div className="flex items-center gap-2 px-2 border-r border-slate-200">
             <Clock size={14} className="text-slate-400" />
             <input 
               type="date" 
               value={mockTodayStr}
               onChange={(e) => {
                 setMockTodayStr(e.target.value);
               }}
               className="text-xs font-black bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-indigo-600 focus:border-indigo-400 shadow-sm cursor-pointer"
               title="Time Machine: กำหนดวันที่จำลอง"
             />
          </div>

          <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 border-r border-slate-100">
             ตัวกรองพิเศษ :
          </div>
          
          <select 
             value={filterFreqAmt}
             onChange={e => setFilterFreqAmt(e.target.value)}
             className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
          >
             <option value="">-- กรองระดับความรอบความถี่ --</option>
             <option value="1">1</option>
             <option value="2">2</option>
             <option value="3">3 เดือนขึ้นไป</option>
          </select>

          <select 
             value={filterFreqUnit}
             onChange={e => setFilterFreqUnit(e.target.value)}
             className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
          >
             <option value="">-- กรองหน่วยรอบ --</option>
             <option value="สัปดาห์">สัปดาห์</option>
             <option value="เดือน">เดือน</option>
          </select>

          <select 
             value={filterTrackStatus}
             onChange={e => setFilterTrackStatus(e.target.value)}
             className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
          >
             <option value="">-- สถานะการติดตามสัปดาห์นี้ --</option>
             <option value="tracked">ติดตามแล้ว</option>
             <option value="not_tracked">ยังไม่ได้ติดตาม</option>
          </select>

          <select 
             value={filterOrderStatus}
             onChange={e => setFilterOrderStatus(e.target.value)}
             className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
          >
             <option value="">-- สถานะการสั่งซื้อจริง --</option>
             <option value="bought">สั่งซื้อแล้ว</option>
             <option value="not_bought">ยังไม่ได้สั่งซื้อ</option>
          </select>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">No. / เลขที่ลูกค้า</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">เบอร์โทรศัพท์ / QR Code</th>
                {type === 'retention' ? (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">ผู้รับผิดชอบ</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic">ติดตามสัปดาห์นี้</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic">สั่งซื้อสำเร็จ</th>
                  </>
                ) : (
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">สถานะ / ผู้รับผิดชอบ</th>
                )}
                {type === 'retention' && isManager && (
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">ความรอบความถี่ (รอบออเดอร์)</th>
                )}
                {type !== 'master-pool' && type !== 'retention' && (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic">Coldcall Rating</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic">คะแนนบอท</th>
                  </>
                )}
                {type !== 'master-pool' && <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-widest italic">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map(l => {
                  const isCompleted = completedThisWeekIds.has(l.id);
                  const isAssigned = assignedThisWeekIds.has(l.id);
                  // Pool stage is ALWAYS view-only - no editing allowed
                  const isPoolView = type === 'master-pool';
                  const readonly = isPoolView;

                  return (
                    <tr 
                      key={l.id} 
                      className={`transition-colors group ${(isPoolView || isManager) ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/50'}`}
                      onClick={() => !isPoolView && !isManager && onCall(l, readonly)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
                              <span className="text-[10px] font-black text-slate-400">NO.</span>
                              <span className="text-[11px] font-black text-slate-600 leading-none">{l.customerNo || '-'}</span>
                           </div>
                           <div>
                              <div className={`text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 ${isCompleted ? 'line-through opacity-40' : ''}`}>
                                {l.name || 'ไม่ระบุชื่อลูกค้า'}
                                {isAssigned && !isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic flex items-center gap-1.5">
                                 {isPoolView
                                   ? <span className="text-amber-500">⚠️ ข้อมูลบอทระบบ (Read-only)</span>
                                   : (isManager ? '' : 'คลิกเพื่อดูรายละเอียด / โทรติดตาม')}
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                           <div className="text-sm font-black text-indigo-600 tracking-wider flex items-center gap-2">
                              {l.phone}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQrModal({ open: true, phone: l.phone, name: l.name });
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <QrCode size={12} />
                              </button>
                           </div>
                           {l.allPhones?.length > 1 && (
                             <div className="flex flex-wrap gap-1">
                                {l.allPhones.slice(1).map((p, i) => (
                                  <div key={i} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {p}
                                  </div>
                                ))}
                             </div>
                           )}
                        </div>
                      </td>
                      {type === 'retention' ? (
                        <>
                          {/* 1. ผู้รับผิดชอบ (Responsible Admin) */}
                          <td className="px-6 py-4">
                            {l.responsibleName && l.responsibleName !== 'Unassigned' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner">
                                  <span className="text-[10px] font-black text-indigo-600">
                                    {l.responsibleName.substring(0, 2)}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-slate-700">{l.responsibleName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shadow-inner">
                                  <span className="text-[10px] font-black text-slate-400">-</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 italic">Unassigned</span>
                              </div>
                            )}
                          </td>

                          {/* 2. ติดตามสัปดาห์นี้ (Follow-up) */}
                          <td className="px-6 py-4 text-center">
                            {isCompleted ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-black shadow-sm transform hover:scale-110 transition-transform duration-300">
                                ✅
                              </span>
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>

                          {/* 3. สั่งซื้อสำเร็จ (Order) */}
                          <td className="px-6 py-4 text-center">
                            {l.status === '✅ สั่งซื้อแล้ว' ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-black shadow-sm transform hover:scale-110 transition-transform duration-300">
                                ✅
                              </span>
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                             <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest italic ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'} shadow-sm border`}>
                                {l.status || 'รอดำเนินการ'}
                             </span>
                             {l.responsibleName && l.responsibleName !== 'Unassigned' ? (
                               <div className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-50" />
                                  <span className="text-[10px] font-black text-slate-600 uppercase italic">{l.responsibleName}</span>
                               </div>
                             ) : (
                               <div className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                  <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                               </div>
                             )}
                          </div>
                        </td>
                      )}
                      {type === 'retention' && (
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                           <div className="flex flex-col gap-1.5 w-36 bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-inner">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic flex items-center justify-between">
                                 <span>กำหนดรอบรอบความถี่</span>
                              </div>
                              <div className="flex items-center gap-1">
                                 <input 
                                   type="number" 
                                   defaultValue={l.freqAmount || 1}
                                   min={1}
                                   max={12}
                                   onBlur={(e) => leadService.updateCustomer(l.id || l.phone, { freqAmount: parseInt(e.target.value) || 1 })}
                                   className="w-12 bg-white border border-slate-200 rounded text-xs font-black px-1.5 py-1 outline-none focus:border-indigo-500 transition-all"
                                 />
                                 <select 
                                   defaultValue={l.freqUnit || 'สัปดาห์'}
                                   onChange={(e) => leadService.updateCustomer(l.id || l.phone, { freqUnit: e.target.value })}
                                   className="bg-white border border-slate-200 rounded text-[10px] font-black px-1 py-1.5 outline-none focus:border-indigo-500 flex-1 cursor-pointer transition-all"
                                 >
                                    <option value="สัปดาห์">สัปดาห์</option>
                                    <option value="เดือน">เดือน</option>
                                 </select>
                              </div>
                              <div className="text-[9px] font-bold text-slate-500 mt-0.5">
                                สั่งซื้อล่าสุด: <span className="text-slate-800 font-black">{l.lastOrderDate || '-'}</span>
                              </div>
                           </div>
                        </td>
                      )}
                      {type !== 'master-pool' && type !== 'retention' && (
                        <>
                          <td className="px-6 py-4">
                            <div className="text-xs font-black text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 italic line-clamp-2 max-w-[150px]">
                               {l.bot_ratingText || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div
                              onClick={(e) => { e.stopPropagation(); setDrawerData(l); }}
                              className="inline-flex items-center justify-center min-w-[32px] h-8 bg-amber-50 rounded-xl border border-amber-100 text-amber-600 font-black text-sm cursor-pointer hover:bg-amber-100 hover:border-amber-200 transition-all active:scale-95"
                              title="แบบประเมินความสนใจของบอท (Q&A)"
                            >
                               {l.bot_score}/5
                            </div>
                          </td>
                        </>
                      )}
                      {type !== 'master-pool' && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-sm font-bold">
                            {!isManager && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCall(l, readonly);
                                }}
                                className={`p-2.5 rounded-xl transition-all shadow-sm ${readonly ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-slate-100' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95 border border-primary/5'}`}
                                disabled={readonly}
                                title={readonly ? 'ระบบอ่านอย่างเดียว' : 'โทรติดต่อ / บันทึกประวัติ'}
                              >
                                <PhoneCall size={18} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrModal({ open: true, phone: l.phone, name: l.name });
                              }}
                              className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100/50 active:scale-95"
                              title="แสดง QR Code เพื่อใช้สแกนโทร"
                            >
                              <QrCode size={18} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                       <AlertCircle size={40} className="stroke-[1px]" />
                       <div className="text-sm font-black uppercase tracking-widest italic">ไม่พบข้อมูลรายชื่อลูกค้าในเงื่อนไขนี้</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {(currentPage > 1 || pagination.hasMore) && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs font-black text-slate-500 uppercase tracking-widest italic">
              แสดงผลหน้าที่ {currentPage} (รายการที่ {(currentPage - 1) * 50 + 1} - {(currentPage - 1) * 50 + pagination.count} จากทั้งหมด {pagination.total})
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${currentPage === 1 ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 active:scale-95 shadow-sm'}`}
              >
                <ChevronLeft size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">หน้าก่อนหน้า</span>
              </button>
              
              <div className="w-12 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-xs font-black text-indigo-600 shadow-inner">
                {currentPage}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!pagination.hasMore}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${!pagination.hasMore ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">หน้าถัดไป</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay */}
      {drawerData && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm transition-all"
          onClick={() => setDrawerData(null)}
        />
      )}

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full md:w-[450px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${drawerData ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {drawerData && (
          <>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-200 shadow-sm text-indigo-600">
                   <Info size={20} />
                 </div>
                 <div>
                   <h2 className="text-lg font-black text-slate-800 uppercase italic leading-tight">รายละเอียดและประวัติบอท</h2>
                   <p className="text-xs text-slate-500 font-bold mt-0.5">{drawerData.name || 'ไม่ระบุชื่อลูกค้า'}</p>
                 </div>
               </div>
               <button 
                 onClick={() => setDrawerData(null)}
                 className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-danger hover:bg-danger/10 transition-all border border-slate-200"
               >
                 <X size={18} />
               </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto font-sans space-y-6">
              
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">เลขที่ลูกค้า</div>
                  <div className="text-xl font-black text-slate-800">{drawerData.customerNo || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">คะแนนความสนใจ</div>
                  <div className="flex items-center gap-1 text-2xl font-black text-amber-500">
                     {drawerData.bot_score} <Star size={18} fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                 <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <PhoneCall size={12} /> เบอร์โทรศัพท์ติดต่อของลูกค้า
                 </div>
                 <div className="space-y-2">
                   <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-indigo-100 shadow-sm group">
                       <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">เบอร์โทรศัพท์หลัก</span>
                         <span className="text-sm font-black text-indigo-600">{drawerData.phone}</span>
                       </div>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (type === 'master-pool') {
                             setQrModal({ open: true, phone: drawerData.phone, name: drawerData.name });
                           } else {
                             onCall(drawerData, false, drawerData.phone);
                           }
                         }}
                         className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                         title={type === 'master-pool' ? 'แสดง QR Code' : 'โทรติดต่อ'}
                       >
                         {type === 'master-pool' ? <QrCode size={14} /> : <PhoneCall size={14} />}
                       </button>
                   </div>
                   {drawerData.allPhones?.length > 1 && drawerData.allPhones.slice(1).map((p, i) => (
                     <div key={i} className="flex items-center justify-between bg-white/50 px-3 py-2 rounded-xl border border-indigo-50 group">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">เบอร์โทรศัพท์สำรอง {i+1}</span>
                           <span className="text-sm font-black text-slate-600">{p}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (type === 'master-pool') {
                              setQrModal({ open: true, phone: p, name: drawerData.name });
                            } else {
                              onCall(drawerData, false, p);
                            }
                          }}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                          title={type === 'master-pool' ? 'แสดง QR Code' : 'โทรติดต่อ'}
                        >
                          {type === 'master-pool' ? <QrCode size={14} /> : <PhoneCall size={14} />}
                        </button>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Q&A Section */}
              <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <MessageSquare size={12} /> แบบประเมินความสนใจของบอท (Q&A)
                 </div>
                 
                 <div className="space-y-3">
                   {[
                     { q: "1. ทำไมลูกค้าถึงสนใจแบรนด์เรา?", a: drawerData.q1_business },
                     { q: "2. ลูกค้าเคยใช้บริการบรรจุภัณฑ์ประเภทใดบ้าง?", a: drawerData.q2_usage },
                     { q: "3. ต้องการรับตัวอย่างกล่องสินค้าหรือไม่?", a: drawerData.q3_sample },
                     { q: "4. ความต้องการนำไปจัดจำหน่ายในเขตใด?", a: drawerData.q4_visit },
                     { q: "5. ช่วงเวลาสะดวกในการให้เซลล์ติดต่อกลับ?", a: drawerData.q5_prefTime },
                     { q: "6. ยินดีแอดไลน์ทางการ @LineOA หรือไม่?", a: drawerData.q6_addLine }
                   ].map((item, idx) => (
                     <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-[11px] font-black text-slate-500 mb-1">{item.q}</div>
                        <div className="text-sm text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">
                          {item.a ? item.a : <span className="text-slate-300 italic">ยังไม่มีข้อมูลคำตอบบอท</span>}
                        </div>
                     </div>
                   ))}
                 </div>
                 
                 <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="text-[11px] font-black text-slate-500 mb-1">ประเมินระดับความพึงพอใจโดยรวม (AI Score)</div>
                    <div className="text-sm font-black text-slate-800">{drawerData.bot_ratingText || '-'}</div>
                 </div>
              </div>

            </div>
            
            {/* Drawer Footer */}
            {type !== 'master-pool' && (
               <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                 <button 
                   onClick={() => {
                     onCall(drawerData, false);
                     setDrawerData(null);
                   }}
                   className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wide shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                 >
                   <PhoneCall size={16} /> โทรติดต่อ / จัดการบันทึกประวัติการโทร
                 </button>
               </div>
            )}
          </>
        )}
      </div>

      <QRCodeModal 
        isOpen={qrModal.open} 
        onClose={() => setQrModal({ open: false, phone: '', name: '' })}
        phone={qrModal.phone}
        name={qrModal.name}
      />
    </div>
  );
};

export default CustomerListView;
