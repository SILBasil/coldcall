import React, { useState, useEffect } from 'react';
import { leadService } from '../../services/leadService';
import {
  UserCog, Loader2, Search, Filter, CheckSquare, Square,
  ArrowRightLeft, AlertTriangle, X, Users, ChevronDown, ChevronUp
} from 'lucide-react';
import { TableSkeleton } from '../common/Skeleton';
import CustomSelect from '../common/CustomSelect';

/* ── Badge ───────────────────────────────────────────────────── */
const Badge = ({ count, color = 'indigo' }) => {
  const map = {
    indigo:  'bg-indigo-100 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-md border text-[10px] font-black ${map[color] || map.indigo}`}>
      {count}
    </span>
  );
};

/* ── Progress ─────────────────────────────────────────────────── */
const ProgressBar = ({ current, total }) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-black text-amber-700">
        <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" />กำลังโอนย้าย...</span>
        <span>{current.toLocaleString()} / {total.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-center text-amber-500 font-bold uppercase tracking-widest">อย่าปิดหน้าต่างนี้</p>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════ */
const AssignLeadsView = ({ showToast, onSelectCustomer, role, currentUser }) => {
  const isManager = role === 'manager';

  /* ── Data ─────────────────────────────────────────────────── */
  const [leads,    setLeads]    = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [stats,    setStats]    = useState({ qualified: 0, customer: 0, newLeads: 0, masterPool: 0 });

  /* ── Assign state ─────────────────────────────────────────── */
  const [selected,     setSelected]     = useState([]);
  const [assignTo,     setAssignTo]     = useState('');
  const [quickCount,   setQuickCount]   = useState('');
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adminFilter,  setAdminFilter]  = useState('all');
  
  /* ── Pagination state ─────────────────────────────────────── */
  const [lastDoc,      setLastDoc]      = useState(null);
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);

  /* ── Transfer state ───────────────────────────────────────── */
  const [showTxPanel,  setShowTxPanel]  = useState(false);
  const [txFrom,       setTxFrom]       = useState('');
  const [txFromCount,  setTxFromCount]  = useState(null);
  const [txFromLoad,   setTxFromLoad]   = useState(false);
  const [txMode,       setTxMode]       = useState('all');
  const [txPartialN,   setTxPartialN]   = useState('');
  const [txTo,         setTxTo]         = useState('');
  const [txConfirm,    setTxConfirm]    = useState(false);
  const [txRunning,    setTxRunning]    = useState(false);
  const [txProgress,   setTxProgress]   = useState({ current: 0, total: 0 });

  /* ── Fetch ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!searchTerm) {
      fetchData(false);
    }
  }, [activeTab, statusFilter, adminFilter, searchTerm]);

  const fetchData = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLastDoc(null);
      setHasMore(true);
    }

    try {
      const currentLastDoc = isLoadMore ? lastDoc : null;
      const [leadsRes, countsRes, allUsers] = await Promise.all([
        leadService.getLeadsForAssignmentPaginated(activeTab, statusFilter, adminFilter, currentLastDoc, 100),
        leadService.getAssignTabCounts(statusFilter, adminFilter),
        leadService.getUsers()
      ]);
      
      const newLeads = leadsRes.data || [];
      if (isLoadMore) {
        setLeads(prev => [...prev, ...newLeads]);
      } else {
        setLeads(newLeads);
      }
      
      setLastDoc(leadsRes.lastDoc);
      setHasMore(leadsRes.hasMore);
      setStats(countsRes);
      setAdmins(allUsers.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error(err);
      showToast('โหลดข้อมูลล้มเหลว', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const results = await leadService.searchCustomers(searchTerm);
      let filtered = results;
      if (activeTab !== 'all') {
        const stage = (activeTab === 'new-leads' || activeTab === 'master-pool') ? 'pool' : activeTab;
        filtered = results.filter(l => l.stage === stage && l.stage !== 'trash');
      } else {
        filtered = results.filter(l => l.stage !== 'trash');
      }
      
      if (activeTab === 'new-leads') {
        filtered = filtered.filter(l => l.status === '🆕 รอดำเนินการ');
      } else if (activeTab === 'master-pool') {
        filtered = filtered.filter(l => l.status !== '🆕 รอดำเนินการ');
      }
      
      if (statusFilter === 'unassigned') {
        filtered = filtered.filter(l => !l.responsibleId);
      } else if (statusFilter === 'assigned') {
        if (adminFilter && adminFilter !== 'all') {
          filtered = filtered.filter(l => l.responsibleId === adminFilter);
        } else {
          filtered = filtered.filter(l => !!l.responsibleId);
        }
      }
      
      setLeads(filtered);
      setHasMore(false);
      setLastDoc(null);
    } catch {
      showToast('ค้นหาล้มเหลว', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset helpers ────────────────────────────────────────── */
  const resetAssign = () => {
    setSelected([]); setAssignTo(''); setQuickCount('');
    setSearchTerm(''); setStatusFilter('all'); setAdminFilter('all');
  };

  const resetTransfer = () => {
    setTxFrom(''); setTxFromCount(null); setTxMode('all');
    setTxPartialN(''); setTxTo(''); setTxConfirm(false);
    setTxProgress({ current: 0, total: 0 });
  };

  const handleTabChange = (id) => {
    setActiveTab(id);
    resetAssign();
    resetTransfer();
    setShowTxPanel(false);
  };

  /* ── Assign helpers ───────────────────────────────────────── */
  const filteredLeads = leads.filter(l => {
    if (searchTerm && !l.name?.toLowerCase().includes(searchTerm.toLowerCase()) && !l.phone?.includes(searchTerm)) return false;
    return true;
  });

  const toggle = (l) => {
    const isSelectable = !(l.stage === 'pool' && l.status !== '🆕 รอดำเนินการ');
    if (l.responsibleId || !isSelectable) return;
    setSelected(p => p.includes(l.id) ? p.filter(x => x !== l.id) : [...p, l.id]);
  };

  const toggleAll = () => {
    const ids = filteredLeads.filter(l => !l.responsibleId).map(l => l.id);
    if (!ids.length) return;
    const all = ids.every(id => selected.includes(id));
    setSelected(p => all ? p.filter(id => !ids.includes(id)) : Array.from(new Set([...p, ...ids])));
  };

  const handleQuickSelect = () => {
    const n = parseInt(quickCount, 10);
    if (isNaN(n) || n <= 0) return showToast('กรุณาระบุจำนวน', 'error');
    const pool = filteredLeads.filter(l => !l.responsibleId);
    if (!pool.length) return showToast('ไม่มีรายการที่เลือกได้', 'warning');
    setSelected(pool.slice(0, n).map(l => l.id));
    showToast(`เลือกด่วน ${Math.min(n, pool.length)} รายการแล้ว`);
  };

  const handleAssign = async () => {
    if (!assignTo)        return showToast('กรุณาเลือกแอดมิน', 'error');
    if (!selected.length) return showToast('กรุณาเลือกรายการ', 'error');
    const admin = admins.find(a => a.id === assignTo);
    if (!admin) return;
    try {
      setLoading(true);
      await leadService.assignCustomers(selected, admin.id, admin.name);
      await leadService.logActivity({
        adminId: 'manager', adminName: 'Manager',
        action: `มอบหมายงาน ${selected.length} รายการให้ ${admin.name}`,
        type: 'assign',
        snapshot: { assignmentType: activeTab, assignedToId: admin.id, assignedToName: admin.name, customerIds: selected }
      });
      showToast(`มอบหมาย ${selected.length} รายการให้ ${admin.name} เรียบร้อย`);
      setSelected([]);
      fetchData();
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
    finally  { setLoading(false); }
  };

  /* ── Transfer helpers ─────────────────────────────────────── */
  const handleTxFromChange = async (id) => {
    setTxFrom(id); setTxFromCount(null); setTxMode('all'); setTxPartialN(''); setTxTo(''); setTxConfirm(false);
    if (!id) return;
    setTxFromLoad(true);
    try {
      const cnt = await leadService.getAdminLeadCount(id);
      setTxFromCount(cnt);
    } catch { showToast('โหลดข้อมูลล้มเหลว', 'error'); }
    finally  { setTxFromLoad(false); }
  };

  const txCount = () => {
    if (!txFromCount) return 0;
    if (txMode === 'all') return txFromCount.total;
    const n = parseInt(txPartialN, 10);
    return isNaN(n) ? 0 : Math.min(n, txFromCount.total);
  };

  const handleTxGo = () => {
    if (!txFrom) return showToast('กรุณาเลือกต้นทาง', 'error');
    if (!txTo)   return showToast('กรุณาเลือกปลายทาง', 'error');
    if (txMode === 'partial') {
      const n = parseInt(txPartialN, 10);
      if (isNaN(n) || n <= 0) return showToast('กรุณาระบุจำนวน', 'error');
      if (n > (txFromCount?.total || 0)) return showToast(`สูงสุด ${txFromCount?.total} รายการ`, 'error');
    }
    setTxConfirm(true);
  };

  const handleTxExecute = async () => {
    const fromA = admins.find(a => a.id === txFrom);
    const toA   = admins.find(a => a.id === txTo);
    if (!fromA || !toA) return;
    const lim = txMode === 'all' ? 0 : parseInt(txPartialN, 10);
    setTxRunning(true);
    setTxProgress({ current: 0, total: txCount() });
    try {
      const res = await leadService.transferNCustomers(
        fromA.id, fromA.name, toA.id, toA.name,
        currentUser?.name || 'Manager', lim,
        (done, tot) => setTxProgress({ current: done, total: tot })
      );
      showToast(`โอนย้ายสำเร็จ! ${res.transferred} รายการ จาก ${fromA.name} → ${toA.name}`, 'success');
      resetTransfer();
      setShowTxPanel(false);
      fetchData();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + (err.message || ''), 'error');
    } finally { setTxRunning(false); }
  };

  /* ── Tabs ─────────────────────────────────────────────────── */
  const TABS = [
    { id: 'qualified',   label: 'ลูกค้ารอตัดสินใจ', count: stats.qualified,  color: 'indigo' },
    { id: 'customer',    label: 'ลูกค้าติดต่อประจำ', count: stats.customer,   color: 'emerald' },
    { id: 'new-leads',   label: 'รายชื่อเบอร์ใหม่',  count: stats.newLeads,   color: 'indigo' },
    { id: 'master-pool', label: 'คลังรายชื่อ/บอท',   count: stats.masterPool, color: 'slate' },
  ];

  /* ── Tabs Dropdown ────────────────────────────────────────── */
  const totalAll = stats.qualified + stats.customer + stats.newLeads + stats.masterPool;

  const CATEGORY_OPTIONS = [
    { value: 'all',         label: `ลูกค้าทั้งหมด (${totalAll.toLocaleString()})` },
    { value: 'qualified',   label: `ลูกค้ารอตัดสินใจ (${stats.qualified.toLocaleString()})` },
    { value: 'customer',    label: `ลูกค้าติดต่อประจำ (${stats.customer.toLocaleString()})` },
    { value: 'new-leads',   label: `รายชื่อเบอร์ใหม่ (${stats.newLeads.toLocaleString()})` },
    { value: 'master-pool', label: `คลังรายชื่อ/บอท (${stats.masterPool.toLocaleString()})` },
  ];

  const currentTotal = activeTab === 'all'
    ? totalAll
    : activeTab === 'qualified' 
      ? stats.qualified 
      : activeTab === 'customer' 
        ? stats.customer 
        : activeTab === 'new-leads' 
          ? stats.newLeads 
          : stats.masterPool;

  const hasAssignDirty = selected.length > 0 || assignTo || quickCount || searchTerm;

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-3 animate-in fade-in duration-500">

      {/* ── Tabs Dropdown ────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl w-fit shadow-sm relative z-50">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5">หมวดหมู่รายชื่อ:</span>
        <CustomSelect
          value={activeTab}
          onChange={e => handleTabChange(e.target.value)}
          containerClassName="w-64"
          className="bg-white border-slate-200"
          dropdownZIndex={200}
          options={CATEGORY_OPTIONS}
        />
      </div>

      {/* ── Control Panel ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible relative z-40">

        {/* Main Row */}
        <div className="p-3.5 flex flex-wrap items-center gap-3">

          {/* Icon + Title */}
          <div className="flex items-center gap-2 mr-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
              <UserCog size={15} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-[12px] font-black text-slate-800">มอบหมาย</div>
              <div className="text-[10px] font-bold text-slate-400">เลือกด่วนหรือ tick รายการ</div>
            </div>
          </div>

          {/* Quick-select */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 shrink-0">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">เลือกด่วน</span>
            <input
              type="number" min="1" value={quickCount}
              onChange={e => setQuickCount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickSelect()}
              placeholder="จำนวน..."
              className="w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-400"
            />
            <button onClick={handleQuickSelect}
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-lg text-xs font-black transition-all active:scale-95">
              เลือก
            </button>
            {quickCount && (
              <button onClick={() => { setQuickCount(''); setSelected([]); }}
                className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all">
                <X size={11} />
              </button>
            )}
          </div>

          {/* Assign-to */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
            <div className="flex-1">
              <CustomSelect
                value={assignTo}
                onChange={e => setAssignTo(e.target.value)}
                className="py-2 text-[12px]"
                containerClassName="w-full"
                placeholder="เลือกแอดมิน..."
                options={admins.map(a => ({ value: a.id, label: a.name }))}
              />
            </div>
            {assignTo && (
              <button onClick={() => setAssignTo('')}
                className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all shrink-0">
                <X size={12} />
              </button>
            )}
            <button
              onClick={handleAssign}
              disabled={loading || !selected.length || !assignTo}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[12px] transition-all active:scale-95 shrink-0 whitespace-nowrap
                ${selected.length && assignTo ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <><UserCog size={13} />มอบหมาย{selected.length > 0 ? ` (${selected.length})` : ''}</>}
            </button>
          </div>

          {/* Spacer + Clear + Transfer button */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {hasAssignDirty && (
              <button onClick={resetAssign}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-100 text-[10px] font-black transition-all">
                <X size={10} />ล้าง
              </button>
            )}
            <div className="w-px h-6 bg-slate-200" />
            <button
              onClick={() => { setShowTxPanel(p => !p); if (showTxPanel) { resetTransfer(); } }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-black border transition-all
                ${showTxPanel
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
                  : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'}`}
            >
              <ArrowRightLeft size={13} />
              โอนย้าย
              {showTxPanel ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        </div>

        {/* ── Transfer Panel (collapsible) ─────────────────── */}
        {showTxPanel && (
          <div className="border-t border-amber-100 bg-amber-50/40 px-4 py-4 space-y-3.5">

            {/* Panel header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={13} className="text-amber-600" />
                <span className="text-[11px] font-black text-amber-800 uppercase tracking-wide">โอนย้ายเบอร์ทั้งหมดของแอดมิน</span>
              </div>
              {(txFrom || txTo || txPartialN) && !txRunning && (
                <button onClick={resetTransfer}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-100 text-[10px] font-black transition-all">
                  <X size={10} />ล้าง
                </button>
              )}
            </div>

            {!txConfirm ? (
              <>
                {/* From → To row */}
                <div className="grid grid-cols-[1fr_32px_1fr] gap-2 items-start">

                  {/* Source */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">จากแอดมิน (ต้นทาง)</label>
                      {txFrom && (
                        <button onClick={() => handleTxFromChange('')}
                          className="p-0.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all">
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    <CustomSelect
                      value={txFrom}
                      onChange={e => handleTxFromChange(e.target.value)}
                      containerClassName="w-full"
                      className="py-2 text-[12px] bg-white"
                      placeholder="เลือกแอดมิน..."
                      dropdownZIndex={200}
                      options={admins.map(a => ({ value: a.id, label: a.name }))}
                    />
                    {/* Count info */}
                    {txFromLoad && <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold"><Loader2 size={10} className="animate-spin" />โหลด...</div>}
                    {txFromCount && !txFromLoad && (
                      <div className="flex gap-1 flex-wrap">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700">รอตัดสินใจ {txFromCount.qualified}</span>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700">ติดต่อประจำ {txFromCount.customer}</span>
                        {txFromCount.pool > 0 && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700">เบอร์ใหม่/คลัง {txFromCount.pool}</span>
                        )}
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">รวม {txFromCount.total}</span>
                      </div>
                    )}
                  </div>

                  {/* Arrow center */}
                  <div className="flex items-start pt-6 justify-center">
                    <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                      <ArrowRightLeft size={11} className="text-amber-600" />
                    </div>
                  </div>

                  {/* Dest */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ไปยังแอดมิน (ปลายทาง)</label>
                      {txTo && (
                        <button onClick={() => setTxTo('')}
                          className="p-0.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all">
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    <CustomSelect
                      value={txTo}
                      onChange={e => setTxTo(e.target.value)}
                      containerClassName="w-full"
                      className="py-2 text-[12px] bg-white"
                      placeholder="เลือกแอดมิน..."
                      dropdownZIndex={200}
                      disabled={!txFrom}
                      options={admins.filter(a => a.id !== txFrom).map(a => ({ value: a.id, label: a.name }))}
                    />
                  </div>
                </div>

                {/* Count mode — show after source picked */}
                {txFromCount && !txFromLoad && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">จำนวนที่ย้าย:</span>
                    <button
                      onClick={() => { setTxMode('all'); setTxPartialN(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${txMode === 'all' ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                      <Users size={11} />ทั้งหมด ({txFromCount.total})
                    </button>
                    <button
                      onClick={() => setTxMode('partial')}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${txMode === 'partial' ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                      ระบุจำนวน
                    </button>
                    {txMode === 'partial' && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min="1" max={txFromCount.total}
                          value={txPartialN}
                          onChange={e => setTxPartialN(e.target.value)}
                          placeholder={`1–${txFromCount.total}`}
                          className="w-24 px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl text-[12px] font-bold outline-none focus:ring-2 focus:ring-amber-200"
                        />
                        <span className="text-[10px] font-bold text-slate-500">รายการ</span>
                        {txPartialN && (
                          <button onClick={() => setTxPartialN('')}
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all">
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Warning + Confirm button in one row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-start gap-1.5 flex-1 bg-amber-100/60 border border-amber-200 rounded-xl px-2.5 py-2">
                    <AlertTriangle size={11} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold text-amber-700">การโอนย้ายจะเปลี่ยน<span className="font-black">ผู้รับผิดชอบ</span>เท่านั้น Log ย้อนหลังของแอดมินคนเก่าจะไม่เปลี่ยน</p>
                  </div>
                  <button
                    onClick={handleTxGo}
                    disabled={!txFrom || !txTo || txFromLoad || (txMode === 'partial' && !txPartialN)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-xl text-[12px] font-black shadow-lg shadow-amber-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0 whitespace-nowrap"
                  >
                    <ArrowRightLeft size={13} />
                    ตรวจสอบ &amp; ยืนยัน
                  </button>
                </div>
              </>
            ) : (
              /* Confirm step */
              <div className="space-y-3">
                {/* Summary */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">สรุปการโอนย้าย</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center">
                      <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-0.5">จากแอดมิน</div>
                      <div className="text-[14px] font-black text-rose-700">{admins.find(a => a.id === txFrom)?.name}</div>
                    </div>
                    <div className="shrink-0">
                      <div className="w-8 h-8 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center">
                        <ArrowRightLeft size={13} className="text-amber-500" />
                      </div>
                    </div>
                    <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                      <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">ไปยังแอดมิน</div>
                      <div className="text-[14px] font-black text-emerald-700">{admins.find(a => a.id === txTo)?.name}</div>
                    </div>
                    <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                      <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-0.5">จำนวน</div>
                      <div className="text-[22px] font-black text-amber-700 leading-none">{txCount().toLocaleString()}</div>
                      <div className="text-[9px] font-bold text-amber-500">รายการ</div>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {txRunning && <ProgressBar current={txProgress.current} total={txProgress.total} />}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxConfirm(false)}
                    disabled={txRunning}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-black text-[12px] hover:bg-slate-50 transition-all disabled:opacity-50">
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={handleTxExecute}
                    disabled={txRunning}
                    className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-black text-[12px] shadow-lg shadow-amber-200 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                    {txRunning
                      ? <><Loader2 size={13} className="animate-spin" />กำลังโอนย้าย...</>
                      : <><ArrowRightLeft size={13} />ยืนยัน โอนย้าย {txCount().toLocaleString()} รายการ</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Filter Bar ───────────────────────────────────────── */}
      <div className="bg-slate-50/50 p-2.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 relative z-50">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="ค้นหาชื่อ, เบอร์โทร (กด Enter เพื่อค้นหาบนเซิร์ฟเวอร์)..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold outline-none focus:border-indigo-400 shadow-sm"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:text-rose-400 text-slate-300 transition-all">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 bg-slate-200/40 border border-slate-200 rounded-xl px-2 py-1 shrink-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-0.5">สถานะมอบหมาย:</span>
          <CustomSelect
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            containerClassName="w-44"
            className="bg-white border-slate-200 py-2 text-[11px]"
            dropdownZIndex={200}
            options={[
              { value: 'all',        label: 'ลูกค้าทั้งหมด (รวมสถานะ)' },
              { value: 'unassigned', label: 'ยังไม่มอบหมาย' },
              { value: 'assigned',   label: 'มอบหมายแล้ว' }
            ]}
          />
        </div>

        <div className={`relative transition-opacity ${statusFilter !== 'assigned' ? 'opacity-30 pointer-events-none' : ''}`}>
          <Filter size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10 pointer-events-none" />
          <CustomSelect
            value={adminFilter}
            onChange={e => setAdminFilter(e.target.value)}
            disabled={statusFilter !== 'assigned'}
            className="pl-8 py-2 text-[11px]"
            containerClassName="w-52"
            options={[{ value: 'all', label: 'ผู้รับผิดชอบทั้งหมด' }, ...admins.map(a => ({ value: a.id, label: a.name }))]}
          />
        </div>

        {adminFilter !== 'all' && statusFilter === 'assigned' && (
          <button onClick={() => setAdminFilter('all')}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-400 transition-all">
            <X size={12} />
          </button>
        )}

        <div className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
          กำลังแสดง {filteredLeads.length.toLocaleString()} จากทั้งหมด {currentTotal.toLocaleString()} รายการ
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative z-10">
        <table className="w-full text-left font-sans table-fixed border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5 w-12 text-center">
                <div onClick={toggleAll} className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors">
                  {filteredLeads.filter(l => !l.responsibleId).length > 0
                    && filteredLeads.filter(l => !l.responsibleId).every(l => selected.includes(l.id))
                    ? <CheckSquare size={15} className="text-indigo-600" />
                    : <Square size={15} />}
                </div>
              </th>
              <th className="px-4 py-2.5 w-[44%]">รายชื่อลูกค้า / เบอร์โทร</th>
              <th className="px-4 py-2.5 w-[30%]">ประเภทธุรกิจ / พื้นที่</th>
              <th className="px-4 py-2.5 w-[26%]">สถานะการมอบหมาย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[13px]">
            {loading && leads.length === 0 ? (
              <tr><td colSpan="4"><TableSkeleton /></td></tr>
            ) : filteredLeads.length > 0 ? filteredLeads.map(l => {
              const isAssigned = !!l.responsibleId;
              const isSelected = selected.includes(l.id);
              const isDisabled = (l.stage === 'pool' && l.status !== '🆕 รอดำเนินการ') || (isAssigned && statusFilter !== 'all');
              return (
                <tr key={l.id}
                  className={`transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'} ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => !isDisabled && toggle(l)}>
                  <td className="px-6 py-3">
                    <input type="checkbox" checked={isSelected} disabled={isDisabled} onChange={() => {}}
                      className={`w-4 h-4 rounded accent-indigo-600 ${isDisabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 group/n">
                      <div className={`font-black ${isAssigned ? 'text-slate-400' : 'text-slate-800'}`}>
                        {l.name || <span className="italic font-bold text-slate-400">กำลังกรอกข้อมูลจากบอท...</span>}
                      </div>
                      {onSelectCustomer && !isManager && (
                        <button onClick={e => { e.stopPropagation(); onSelectCustomer(l); }}
                          className="p-1 rounded-lg hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 transition-all opacity-0 group-hover/n:opacity-100">
                          <Search size={12} />
                        </button>
                      )}
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${isAssigned ? 'text-slate-400' : 'text-indigo-500'}`}>{l.phone}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-[11px] font-black text-slate-700">{l.businessType || '- ไม่ระบุ -'}</div>
                    <div className="text-[10px] font-bold text-slate-400 truncate max-w-[200px] mt-0.5">{l.location}</div>
                    {l.bot_score > 0 && <div className="text-[10px] font-black text-amber-500 mt-0.5">Bot Score: {l.bot_score}/5</div>}
                  </td>
                  <td className="px-4 py-3">
                    {isAssigned ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-[10px] font-black text-slate-600">{l.responsibleName || 'แอดมิน'}</span>
                      </div>
                    ) : (
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black ${
                        l.stage === 'pool'
                          ? 'bg-slate-50 text-slate-500 border border-slate-100'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        {l.stage === 'pool' ? 'BOT POOL' : 'UNASSIGNED'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan="4" className="py-20 text-center text-slate-400 font-bold text-[11px] tracking-widest italic">ไม่พบรายชื่อในระดับนี้</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            onClick={() => fetchData(true)}
            disabled={loadingMore}
            className="bg-white border border-slate-200 text-indigo-600 font-black text-xs uppercase tracking-widest px-8 py-3 rounded-2xl shadow-sm hover:shadow hover:border-indigo-200 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            {loadingMore ? (
              <><Loader2 size={16} className="animate-spin" /> กำลังโหลด...</>
            ) : (
              <><ChevronDown size={16} /> โหลดเพิ่มอีก 100 รายการ</>
            )}
          </button>
        </div>
      )}

    </div>
  );
};

export default AssignLeadsView;
