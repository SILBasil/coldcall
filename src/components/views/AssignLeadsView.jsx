import React, { useState, useEffect } from 'react';
import { leadService } from '../../services/leadService';
import { UserCog, ChevronDown, Loader2, Search, Filter, CheckSquare, Square } from 'lucide-react';
import { TableSkeleton } from '../common/Skeleton';


const AssignLeadsView = ({ showToast, onSelectCustomer, role }) => {
  const isManager = role === 'manager';
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [activeTab, setActiveTab] = useState('qualified'); 
  const [stats, setStats] = useState({ pool: 0, qualified: 0, customer: 0 });
  const [admins, setAdmins] = useState([]); // State for dynamic admins

  // ── Filters State ────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('unassigned'); // all | unassigned | assigned
  const [adminFilter, setAdminFilter] = useState('all'); // 'all' | adminId


  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [data, currentStats, allUsers] = await Promise.all([
        leadService.getAllCustomersByStage(activeTab, 1, 5000),
        leadService.getStats(),
        leadService.getUsers()
      ]);
      setLeads(data.data);
      setStats(currentStats);
      setAdmins(allUsers.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error(err);
      showToast("โหลดข้อมูลล้มเหลว", "error");
    } finally {
      setLoading(false);
    }
  };


  const toggle = (l) => {
    // Enable pool selection for managers who want to skip bot calling
    if (l.responsibleId) return; // Already assigned
    setSelected(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id]);
  };

  // ── Filtering Logic ──────────────────────────────────────────────────────
  const filteredLeads = leads.filter(l => {
    // 1. Search
    const matchSearch = !searchTerm || 
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.phone?.includes(searchTerm);
    if (!matchSearch) return false;

    // 2. Status
    if (statusFilter === 'unassigned' && l.responsibleId) return false;
    if (statusFilter === 'assigned' && !l.responsibleId) return false;

    // 3. Admin (if status is 'assigned')
    if (statusFilter === 'assigned' && adminFilter !== 'all' && l.responsibleId !== adminFilter) return false;

    return true;
  });

  const toggleAll = () => {
    const assignable = filteredLeads.filter(l => !l.responsibleId).map(l => l.id);
    if (assignable.length === 0) return;
    
    if (selected.length >= assignable.length && assignable.every(id => selected.includes(id))) {
      // Unselect only these items
      setSelected(p => p.filter(id => !assignable.includes(id)));
    } else {
      // Select only these items
      setSelected(p => Array.from(new Set([...p, ...assignable])));
    }
  };


  const handleAssign = async () => {
    if (!assignTo) return showToast('กรุณาเลือกแอดมินก่อน', 'error');
    if (!selected.length) return showToast('กรุณาเลือกรายการก่อน', 'error');
    
    const admin = admins.find(a => a.id === assignTo);
    if (!admin) return;

    try {
      setLoading(true);
      await leadService.assignCustomers(selected, admin.id, admin.name);
      await leadService.logActivity({
        adminId: 'manager',
        adminName: 'Manager',
        action: `มอบหมายงาน ${selected.length} รายการให้ ${admin.name}`,
        type: 'assign',
        details: `IDs: ${selected.join(', ')}`,
        snapshot: {
          assignmentType: activeTab, // 'qualified' | 'customer' | 'pool'
          assignedToId: admin.id,
          assignedToName: admin.name,
          customerIds: selected
        }
      });
      showToast(`มอบหมายงาน ${selected.length} รายการให้ ${admin.name} เรียบร้อย`);
      setSelected([]);
      fetchData();
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการมอบหมายงาน", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => { setActiveTab('qualified'); setSelected([]); }}
          className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'qualified' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          ลูกค้ารอตัดสินใจ ({stats.qualified})
        </button>
        <button 
          onClick={() => { setActiveTab('customer'); setSelected([]); }}
          className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'customer' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          ลูกค้าติดต่อประจำ ({stats.customer})
        </button>
        <button 
          onClick={() => { setActiveTab('pool'); setSelected([]); }}
          className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${activeTab === 'pool' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
        >
          คลังรายชื่อ/บอทกรอง ({stats.pool})
        </button>
      </div>

      {/* Header row */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-4 items-center justify-between border-b-4 border-slate-100">
        <div className="flex items-center gap-3">
          <UserCog size={18} className="text-indigo-600" />
          <div>
            <div className="text-sm font-black text-slate-800 uppercase tracking-tight">มอบหมายรายชื่อ</div>
            <p className="text-[11px] text-slate-600 font-bold mt-0.5">เลือกรายชื่อและแอดมินที่ต้องการมอบหมายงาน</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== 'pool' && (
            <>
              <div className="relative">
                <select
                  value={assignTo}
                  onChange={e => setAssignTo(e.target.value)}
                  className="appearance-none pl-4 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-indigo-400 cursor-pointer shadow-inner pr-10"
                >
                  <option value="">เลือกแอดมินปลายทาง...</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              </div>
              <button
                onClick={handleAssign}
                disabled={loading || !selected.length}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-black shadow-lg text-[13px] uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : `ยืนยันมอบหมาย (${selected.length})`}
              </button>
            </>
          )}
          {activeTab === 'pool' && (
            <div className="text-[10px] font-black text-slate-600 uppercase bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
               ⚠️ รายชื่อส่วนนี้ต้องให้บอทกรองระดับความสนใจเบื้องต้นก่อน
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร หรือธุรกิจ..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-indigo-400 shadow-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
           {[
             { id: 'unassigned', label: 'ยังไม่ได้มอบหมาย' },
             { id: 'assigned', label: 'มอบหมายแล้ว' },
             { id: 'all', label: 'ทั้งหมด' },
           ].map(f => (
             <button
               key={f.id}
               onClick={() => setStatusFilter(f.id)}
               className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${statusFilter === f.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-700'}`}
             >
               {f.label}
             </button>
           ))}
        </div>

        {/* Admin Filter (Cascading) */}
        {statusFilter === 'assigned' && (
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <select
              value={adminFilter}
              onChange={e => setAdminFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold outline-none focus:border-indigo-400 cursor-pointer shadow-sm"
            >
              <option value="all">ผู้รับผิดชอบทั้งหมด (Assignee)</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          </div>
        )}

        <div className="ml-auto text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">
           แสดง {filteredLeads.length} รายการ
        </div>
      </div>


      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left font-sans">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-4 py-2 w-12 text-center">
                <div 
                  onClick={toggleAll}
                  className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  {filteredLeads.filter(l => !l.responsibleId).length > 0 && selected.length >= filteredLeads.filter(l => !l.responsibleId).length && filteredLeads.filter(l => !l.responsibleId).every(id => selected.includes(id)) 
                    ? <CheckSquare size={16} className="text-indigo-600" />
                    : <Square size={16} />
                  }
                </div>
              </th>
              <th className="px-4 py-2">รายชื่อลูกค้า / เบอร์โทร</th>
              <th className="px-4 py-2">ประเภทธุรกิจ / พื้นที่</th>
              <th className="px-4 py-2">สถานะการมอบหมาย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[13px]">
            {loading && leads.length === 0 ? (
               <tr><td colSpan="4"><TableSkeleton /></td></tr>
            ) : filteredLeads.length > 0 ? filteredLeads.map((l) => {
              const isAssigned = !!l.responsibleId;
              const isSelected = selected.includes(l.id);
              const isDisabled = activeTab === 'pool' || (isAssigned && statusFilter !== 'all'); // Only allow assign/unassign flow logic

              return (
                <tr
                  key={l.id}
                  className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => !isDisabled && toggle(l)}
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => {}}
                      className={`w-4 h-4 rounded accent-indigo-600 ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                     <div className="flex items-center gap-2 group/name">
                        <div className={`font-black ${isAssigned ? 'text-slate-400' : 'text-slate-800'}`}>
                          {l.name || <span className="italic font-bold text-slate-500">กำลังกรอกข้อมูลจากบอท...</span>}
                        </div>
                        {onSelectCustomer && !isManager && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onSelectCustomer(l); }}
                            className="p-1 rounded-lg hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover/name:opacity-100"
                            title="เปิดดูรายละเอียด"
                          >
                            <Search size={14} />
                          </button>
                        )}
                     </div>
                     <div className={`text-[10px] font-bold mt-0.5 ${isAssigned ? 'text-slate-400' : 'text-indigo-500'}`}>{l.phone}</div>
                  </td>
                  <td className="px-4 py-2">
                     <div className="text-[11px] font-black text-slate-800">{l.businessType || '- ไม่ระบุประเภทธุรกิจ -'}</div>
                     <div className="text-[10px] font-bold text-slate-500 truncate max-w-[200px] mt-0.5">{l.location}</div>
                     {l.bot_score > 0 && (
                       <div className="flex items-center gap-1 mt-1 text-amber-500 font-black text-[10px]">
                          Bot Score: {l.bot_score}/5
                       </div>
                     )}
                  </td>
                  <td className="px-6 py-4">
                    {isAssigned ? (
                       <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-emerald-500" />
                         <span className="text-[10px] font-black text-slate-700 uppercase">
                           แอดมินผู้รับผิดชอบ: {l.responsibleName || 'แอดมิน'}
                         </span>
                       </div>
                    ) : (
                       <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                         activeTab === 'pool' ? 'bg-slate-50 text-slate-500 border border-slate-100' :
                         activeTab === 'qualified' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                       }`}>
                          {activeTab === 'pool' ? 'BOT POOL' : 'UNASSIGNED'}
                       </span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="4" className="py-20 text-center text-slate-600 font-bold uppercase text-[11px] tracking-widest italic">ไม่พบรายชื่อในระดับนี้</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssignLeadsView;
