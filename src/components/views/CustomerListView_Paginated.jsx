import React, { useState, useEffect } from 'react';
import { Search, Users, AlertCircle, Loader2, PhoneCall, QrCode, X, MessageSquare, Star, Info, ChevronDown, Edit2, Trash2, CheckSquare, Square } from 'lucide-react';
import { leadServicePaginated } from '../../services/leadService_Paginated';
import { leadService } from '../../services/leadService';
import RetentionTableView from './RetentionTableView';
import QRCodeModal from '../common/QRCodeModal';
import EditCustomerModal from '../common/EditCustomerModal';
import { dialog } from '../../utils/dialog';

const CustomerListView_Paginated = ({ type, activeTab, setActiveTab, currentAdminId, role, showToast, onCall }) => {
  const isManager = role === 'manager';
  const [qrModal, setQrModal] = useState({ open: false, phone: '', name: '' });
  const [drawerData, setDrawerData] = useState(null);
  
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [assignedThisWeekIds, setAssignedThisWeekIds] = useState(new Set());
  const [completedThisWeekIds, setCompletedThisWeekIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingDB, setIsSearchingDB] = useState(false);
  const [filterStatus, setFilterStatus] = useState(type === 'bot-pool' ? 'all' : 'todo'); // 'all', 'todo', 'due'

  // Pagination state
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setFilterStatus(type === 'bot-pool' ? 'all' : 'todo');
    setSelected([]);
  }, [type, currentAdminId, activeTab]);

  useEffect(() => {
    fetchLeads(false);
  }, [currentAdminId, role, activeTab, type]);

  const fetchLeads = async (isLoadMore = false) => {
    if (isLoadMore) {
        setLoadingMore(true);
    } else {
        setLoading(true);
        setLastDoc(null);
        setHasMore(true);
    }
    
    try {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const start = new Date(now);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const stage = type === 'leads' ? 'qualified' : (type === 'bot-pool' ? 'pool' : 'customer');
      
      const adminIdQuery = activeTab === 'my' ? currentAdminId : null;
      let data = [];
      let newLastDoc = null;
      let newHasMore = false;

      // If Bot pool, use pagination
      if (stage === 'pool') {
         const result = await leadServicePaginated.getCustomersByStagePaginated(
            stage, 
            adminIdQuery, 
            isLoadMore ? lastDoc : null, 
            100 // Load 100 per click
         );
         data = result.docs;
         newLastDoc = result.lastDoc;
         newHasMore = result.hasMore;
      } else {
         // Standard load for My Leads and Customers
         data = await leadServicePaginated.getCustomersByStage(stage, adminIdQuery);
      }

      // Fetch weekly summary for status
      const logs = await leadServicePaginated.getWeeklyAdminSummary({
         adminId: currentAdminId,
         startDate: start,
         endDate: end
      });

      if (logs) {
         setAssignedThisWeekIds(new Set(logs.assignedFullList || []));
         setCompletedThisWeekIds(new Set(logs.completedFullList || []));
      }

      // Filter out soft deleted items
      const nonDeleted = data.filter(l => l.stage !== 'trash');

      if (isLoadMore) {
         setLeads(prev => [...prev, ...nonDeleted]);
      } else {
         setLeads(nonDeleted);
      }

      setLastDoc(newLastDoc);
      setHasMore(newHasMore);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearchDB = async () => {
    if (!searchTerm || searchTerm.length < 8) return;
    setIsSearchingDB(true);
    try {
        const results = await leadServicePaginated.searchCustomerByPhone(searchTerm);
        const nonDeleted = results.filter(l => l.stage !== 'trash');
        if (nonDeleted.length > 0) {
            setLeads(nonDeleted);
            setHasMore(false);
        } else {
            await dialog.alert({ title: 'ไม่พบข้อมูล', text: 'ไม่พบข้อมูลลูกค้ารายนี้ในระบบ', icon: 'info' });
        }
    } catch (error) {
        console.error(error);
    } finally {
        setIsSearchingDB(false);
    }
  };

  const clearSearch = () => {
      setSearchTerm('');
      fetchLeads(false);
  }

  const handleSoftDeleteSingle = async (customer) => {
    const confirmDelete = await dialog.confirm({
      title: 'ย้ายรายชื่อไปที่ถังขยะ?',
      text: `คุณต้องการย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะใช่หรือไม่?\n\n*หมายเหตุ: รายชื่อในถังขยะจะถูกเก็บไว้เป็นเวลา 30 วันก่อนจะถูกลบออกถาวรโดยอัตโนมัติ`,
      isDanger: true
    });
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await leadService.deleteCustomerSoft(customer.id || customer.phone, customer.stage || 'pool');
      if (showToast) showToast("ย้ายรายชื่อไปที่ถังขยะเรียบร้อยแล้ว", "success");
      
      await leadService.logActivity({
        adminId: 'manager',
        adminName: 'Manager',
        action: `ย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะ`,
        type: 'soft-delete',
        customerId: customer.id || customer.phone,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerStage: 'trash'
      });

      setSelected(prev => prev.filter(id => id !== (customer.id || customer.phone)));
      fetchLeads(false);
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
        const customer = leads.find(l => l.id === id);
        const originalStage = customer?.stage || 'pool';
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
      fetchLeads(false);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("เกิดข้อผิดพลาดในการลบหลายรายชื่อ", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = leads.filter(l => {
    if (!searchTerm) {
        if (filterStatus === 'all') return true;
        const isCompleted = completedThisWeekIds.has(l.id);
        const isAssigned = assignedThisWeekIds.has(l.id);
        if (filterStatus === 'todo') return isAssigned && !isCompleted;
        if (filterStatus === 'due') return isAssigned && isCompleted;
        return true;
    }

    const matchesSearch = 
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone?.includes(searchTerm);
    
    if (filterStatus === 'all') return matchesSearch;
    
    const isCompleted = completedThisWeekIds.has(l.id);
    const isAssigned = assignedThisWeekIds.has(l.id);
    
    if (filterStatus === 'todo') return matchesSearch && isAssigned && !isCompleted;
    if (filterStatus === 'due') return matchesSearch && isAssigned && isCompleted;
    
    return matchesSearch;
  });

  if (loading) {
     return (
        <div className="h-64 flex items-center justify-center">
           <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
     );
  }

  if (activeTab === 'rentention-grid') {
     return <RetentionTableView data={leads} onManage={(l) => onCall(l, type === 'bot-pool')} />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm font-sans">
        <div className="relative flex-1 max-w-md flex items-center gap-2">
          <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
             <input
               type="text"
               placeholder="พิมพ์ 10 หลักเพื่อค้นหาจากเซิร์ฟเวอร์ หรือค้นหารายชื่อในหน้านี้..."
               className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-300 outline-none transition-all shadow-inner"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
          {searchTerm && type === 'bot-pool' && (
             <button 
               onClick={handleSearchDB}
               disabled={isSearchingDB}
               className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2 border-none cursor-pointer active:scale-95"
             >
               {isSearchingDB ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
               ค้นหาจาก Server
             </button>
          )}
          {searchTerm && (
             <button onClick={clearSearch} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 border-none cursor-pointer">
               ล้าง
             </button>
          )}
        </div>

        <div className="flex items-center gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100 shadow-inner">
           {type !== 'bot-pool' && (
             <>
               <button 
                 onClick={() => setFilterStatus('todo')}
                 className={`inline-flex items-center justify-center min-w-[175px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'todo' ? 'bg-white text-indigo-600 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 งานที่ต้องทำ ({leads.filter(l => assignedThisWeekIds.has(l.id) && !completedThisWeekIds.has(l.id)).length})
               </button>
               <button 
                 onClick={() => setFilterStatus('due')}
                 className={`inline-flex items-center justify-center min-w-[200px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'due' ? 'bg-emerald-500 text-white shadow-md border-emerald-500' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
               >
                 งานที่ติดตามแล้ว ({leads.filter(l => assignedThisWeekIds.has(l.id) && completedThisWeekIds.has(l.id)).length})
               </button>
             </>
           )}
           <button 
             onClick={() => setFilterStatus('all')}
             className={`inline-flex items-center justify-center min-w-[130px] px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer border ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm border-slate-100' : 'text-slate-600 hover:text-slate-800 border-transparent'}`}
           >
             ทั้งหมด ({leads.length})
           </button>
         </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {isManager && (
                  <th className="px-4 py-4 w-12 text-center">
                    <div 
                      onClick={() => {
                        const allIds = filteredData.map(l => l.id);
                        if (allIds.length === 0) return;
                        if (allIds.every(id => selected.includes(id))) {
                          setSelected(prev => prev.filter(id => !allIds.includes(id)));
                        } else {
                          setSelected(prev => Array.from(new Set([...prev, ...allIds])));
                        }
                      }}
                      className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                    >
                      {filteredData.length > 0 && filteredData.every(l => selected.includes(l.id))
                        ? <CheckSquare size={16} className="text-indigo-600" />
                        : <Square size={16} />
                      }
                    </div>
                  </th>
                )}
                <th className={`px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-widest ${type === 'bot-pool' ? 'w-[35%]' : 'w-[30%]'}`}>No. / ชื่อลูกค้า</th>
                <th className={`px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-widest ${type === 'bot-pool' ? 'w-[23%]' : 'w-[20%]'}`}>เบอร์โทรศัพท์</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-widest w-[20%]">สถานะ / ผู้รับผิดชอบ</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-widest w-[15%]">Coldcall Rating</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-600 uppercase tracking-widest w-[7%]">คะแนนบอท</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-widest w-[10%]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map(l => {
                  const isCompleted = completedThisWeekIds.has(l.id);
                  const isAssigned = assignedThisWeekIds.has(l.id);
                  const readonly = type === 'bot-pool';

                  return (
                    <tr 
                      key={l.id} 
                      className={`transition-colors group ${(!readonly && !isManager) ? 'cursor-pointer hover:bg-slate-50/50' : 'cursor-default'}`}
                      onClick={() => !readonly && !isManager && onCall(l, readonly)}
                    >
                      {isManager && (
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
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
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
                              <span className="text-[10px] font-black text-slate-400">NO.</span>
                              <span className="text-[11px] font-black text-slate-600 leading-none">{l.customerNo || '-'}</span>
                           </div>
                           <div>
                              <div className={`text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 ${isCompleted ? 'line-through opacity-40' : ''}`}>
                                {l.name || 'ไม่ระบุชื่อ'}
                                {isAssigned && !isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                              </div>
                              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                                 {readonly ? 'ข้อมูล Read-only' : 'คลิกเพื่อดูรายละเอียด / โทรติดต่อ'}
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-black text-indigo-600 tracking-wider">
                           {l.phone}
                        </div>
                        {l.additionalPhones && l.additionalPhones.length > 0 && (
                          <div className="text-[10px] text-slate-400 mt-1">+{l.additionalPhones.length} เบอร์เพิ่มเติม</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                           <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'} shadow-sm border`}>
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
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 italic line-clamp-2 max-w-[150px]">
                           {l.bot_ratingText || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="inline-flex items-center justify-center min-w-[32px] h-8 bg-amber-50 rounded-xl border border-amber-100 text-amber-600 font-bold text-sm">
                            {l.bot_score != null ? `${l.bot_score}/5` : '-'}
                         </div>
                       </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 text-sm font-bold">
                          {isManager ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomerForEdit(l);
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
                                  handleSoftDeleteSingle(l);
                                }}
                                className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 active:scale-95 cursor-pointer flex items-center justify-center"
                                title="ย้ายไปถังขยะ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCall(l, readonly);
                              }}
                              className={`p-2.5 rounded-xl transition-all shadow-sm ${readonly ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-slate-100' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95 border border-primary/5'}`}
                              disabled={readonly}
                              title={readonly ? 'ดูอย่างเดียว' : 'โทรติดต่อ / บันทึกประวัติ'}
                            >
                              <PhoneCall size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isManager ? 7 : 6} className="px-6 py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                       <AlertCircle size={40} className="stroke-[1px]" />
                       <div className="text-sm font-bold uppercase tracking-widest">ไม่พบข้อมูลรายชื่อลูกค้า</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Load More Button */}
      {type === 'bot-pool' && hasMore && (
         <div className="flex justify-center pt-2 pb-6">
            <button
               onClick={() => fetchLeads(true)}
               disabled={loadingMore}
               className="bg-white border border-slate-200 text-indigo-600 font-black text-sm uppercase tracking-widest px-8 py-3 rounded-2xl shadow-sm hover:shadow hover:border-indigo-200 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
               {loadingMore ? (
                  <><Loader2 size={18} className="animate-spin" /> กำลังโหลด...</>
               ) : (
                  <><ChevronDown size={18} /> โหลดเพิ่มอีก 100 รายการ</>
               )}
            </button>
         </div>
      )}

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
                   <h2 className="text-lg font-black text-slate-800 uppercase italic leading-tight">รายละเอียดการโทรของบอท</h2>
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
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">คะแนนบอท</div>
                  <div className="flex items-center gap-1 text-2xl font-black text-amber-500">
                     {drawerData.bot_score} <Star size={18} fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                 <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <PhoneCall size={12} /> เบอร์โทรศัพท์สำหรับโทร
                 </div>
                 <div className="space-y-2">
                   <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-indigo-100 shadow-sm">
                      <span className="text-xs font-black text-slate-500">เบอร์หลัก</span>
                      <span className="text-sm font-black text-indigo-600">{drawerData.phone}</span>
                   </div>
                   {drawerData.additionalPhones?.length > 0 && drawerData.additionalPhones.map((p, i) => (
                     <div key={i} className="flex items-center justify-between bg-white/50 px-3 py-2 rounded-xl border border-indigo-50">
                        <span className="text-[10px] font-bold text-slate-400">เบอร์สำรองที่ {i+1}</span>
                        <span className="text-xs font-black text-indigo-400">{p}</span>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Q&A Section */}
              <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <MessageSquare size={12} /> สรุปบทสนทนาจากบอท (Q&A)
                 </div>
                 
                 <div className="space-y-3">
                   {[
                     { q: "1. ลูกค้าทำธุรกิจอะไร", a: drawerData.q1_business },
                     { q: "2. ลูกค้าเคยใช้บรรจุภัณฑ์ประเภทใด", a: drawerData.q2_usage },
                     { q: "3. สนใจรับสินค้าตัวอย่างหรือไม่", a: drawerData.q3_sample },
                     { q: "4. พื้นที่การจัดจำหน่าย", a: drawerData.q4_visit },
                     { q: "5. สะดวกติดต่อกลับช่วงเวลาใด", a: drawerData.q5_prefTime },
                     { q: "6. แอดไลน์ทางการ @LineOA หรือไม่", a: drawerData.q6_addLine }
                   ].map((item, idx) => (
                     <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-[11px] font-black text-slate-500 mb-1">{item.q}</div>
                        <div className="text-sm text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">
                          {item.a ? item.a : <span className="text-slate-300 italic">ไม่มีข้อมูลคำตอบบอท</span>}
                        </div>
                     </div>
                   ))}
                 </div>
                 
                 <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="text-[11px] font-black text-slate-500 mb-1">Coldcall Rating (จากบอท)</div>
                    <div className="text-sm font-black text-slate-800">{drawerData.bot_ratingText || '-'}</div>
                 </div>
              </div>

            </div>
            
            {/* Drawer Footer */}
            {type !== 'bot-pool' && !isManager && (
               <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                 <button 
                   onClick={() => {
                     onCall(drawerData, type === 'bot-pool');
                     setDrawerData(null);
                   }}
                   className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wide shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                 >
                   <PhoneCall size={16} /> โทร / บันทึกประวัติการโทร
                 </button>
               </div>
            )}
          </>
        )}
      </div>

      <QRCodeModal 
        isOpen={qrModal.open}
        onClose={() => setQrModal({ ...qrModal, open: false })}
        phone={qrModal.phone}
        name={qrModal.name}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCustomerForEdit(null);
        }}
        customer={selectedCustomerForEdit}
        onSave={() => {
          fetchLeads(false);
        }}
        showToast={showToast}
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
};

export default CustomerListView_Paginated;
