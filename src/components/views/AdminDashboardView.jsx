import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, PhoneCall, CheckCircle2, Target, Clock, Award, Users, 
  ChevronRight, ChevronLeft, Calendar, RotateCw, Loader2, Database, TrendingDown,
  UserPlus, Hourglass, Star
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { downloadWeeklyHTML } from '../../utils/htmlExporter';
import { DashboardSkeleton } from '../common/Skeleton';
import { dialog } from '../../utils/dialog';

// แดชบอร์ดสำหรับแอดมิน - แสดงผลงานรายสัปดาห์/เดือนและส่งรายงาน
const AdminDashboardView = ({ adminId, onNextLead, onSelectCustomer }) => {
  const [globalStats, setGlobalStats] = React.useState({ newLeadsToday: 0 });
  const [baseDate, setBaseDate] = React.useState(new Date());
  const [mode, setMode] = React.useState('week'); // 'week' | 'month'
  const [summary, setSummary] = React.useState(null);
  const [workloadOverview, setWorkloadOverview] = React.useState(null);
  const [dailyTasks, setDailyTasks] = React.useState({ newLeads: 0, retention: 0 });
  const [nextLead, setNextLead] = React.useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const dateInputRef = React.useRef(null);
  const [reportNote, setReportNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchAdmin();
  }, [adminId]);

  const submitReport = async () => {
      if (!admin) return;
      setIsSubmitting(true);
      // คำนวณช่วงสัปดาห์ปัจจุบัน
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
      const start = new Date(baseDate);
      start.setDate(diff);
      const weekStr = `W${Math.ceil(start.getDate() / 7)}_${start.toLocaleString('en-us', {month:'short'})}_${start.getFullYear()}`;

      const res = await leadService.submitWeeklyReport(admin.id, admin.name, weekStr, reportNote);
      if (res) {
          setReportNote('');
          await dialog.alert({ title: 'ส่งรายงานสำเร็จ', text: 'ส่งรายงานสัปดาห์นี้เรียบร้อยแล้ว!', icon: 'success' });
      } else {
          await dialog.alert({ title: 'ส่งรายงานล้มเหลว', text: 'เกิดข้อผิดพลาดในการส่งรายงาน', icon: 'error' });
      }
      setIsSubmitting(false);
  };

  const handleExportLiveHTML = async () => {
    if (!admin) return;
    setIsExporting(true);
    try {
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
      const start = new Date(baseDate);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      
      const weekStr = `W${Math.ceil(start.getDate() / 7)}_${start.toLocaleString('en-us', {month:'short'})}_${start.getFullYear()}`;

      const reportData = await leadService.getWeeklyReportDataForExport(
         admin.id, admin.name, start, end, weekStr, reportNote
      );
      if (reportData) {
         downloadWeeklyHTML(reportData);
      } else {
         await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถดึงข้อมูลรายงานได้', icon: 'error' });
      }
    } catch (err) {
      console.error(err);
      await dialog.alert({ title: 'ดาวน์โหลดข้อมูลล้มเหลว', text: 'เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล', icon: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const fetchAdmin = async () => {
    try {
      const all = await leadService.getUsers();
      const found = all.find(u => u.id === adminId) || all.find(u => u.role === 'admin');
      setAdmin(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = React.useCallback(async (isManual = false) => {
    if (!admin) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      const [globalStats, tasks, next] = await Promise.all([
        leadService.getGlobalDashboardStats(baseDate),
        leadService.getAdminTaskSummary(adminId),
        leadService.getNextPriorityLead(adminId)
      ]);
      setGlobalStats(globalStats);
      setDailyTasks(tasks);
      setNextLead(next);

      // คำนวณช่วงเวลาตาม mode
      let start, end;
      if (mode === 'month') {
        start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1, 0, 0, 0, 0);
      } else {
        const day = baseDate.getDay();
        const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
        start = new Date(baseDate);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 7);
      }

      const [weekly, workload] = await Promise.all([
        leadService.getWeeklyAdminSummary({
          adminId: adminId,
          adminName: admin?.name,
          startDate: start,
          endDate: end
        }),
        leadService.getAdminWorkloadOverview(adminId, start, end)
      ]);
      setSummary(weekly);
      setWorkloadOverview(workload);
    } catch (err) { 
      console.error(err); 
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminId, admin?.name, baseDate, mode]);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const navigatePeriod = (dir) => {
    const nextDate = new Date(baseDate);
    if (mode === 'month') {
      nextDate.setMonth(baseDate.getMonth() + dir);
      nextDate.setDate(1);
    } else {
      nextDate.setDate(baseDate.getDate() + (dir * 7));
    }
    setBaseDate(nextDate);
  };

  const getWeekRangeStr = () => {
    if (mode === 'month') {
      return baseDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    }
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
    const start = new Date(baseDate);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${end.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  const periodLabel = mode === 'month' ? 'เดือนนี้' : 'สัปดาห์นี้';

  const dateRangeStr = getWeekRangeStr();

  const doneNew = summary?.completed?.new || 0;
  const targetNew = summary?.assigned?.new || 0;
  const doneRetention = summary?.completed?.retention || 0;
  const targetRetention = summary?.assigned?.retention || 0;
  
  const totalDone = doneNew + doneRetention;
  const totalTarget = targetNew + targetRetention;

  const todayStats = [
    { label: 'ลูกค้าใหม่เข้าระบบวันนี้', value: globalStats?.newLeadsToday || 0, Icon: Users, color: 'text-primary', bg: 'bg-primary/5', sub: 'ลูกค้าใหม่ที่เข้าระบบวันนี้' },
    { label: `ผลสำเร็จงาน (${periodLabel})`, value: `${totalDone}`, Icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `จากเป้าหมายทั้งหมด ${totalTarget} เคส` },
    { label: 'งานที่ปิดการขายได้', value: (summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0), Icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', sub: `ยอดคำสั่งซื้อที่เกิดขึ้น (${periodLabel})` },
    { label: 'ประสิทธิภาพการทำงาน', value: `${summary?.activity?.saves > 0 ? Math.round((((summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0)) / summary.activity.saves) * 100) : 0}%`, Icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'สัดส่วนยอดซื้อเทียบกับบันทึกการทำงาน' },
  ];

  if (loading && !refreshing) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={`space-y-4 animate-in fade-in duration-700 max-w-[1400px] mx-auto pb-6 relative ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
         <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
            <span className="text-sm font-black text-indigo-600 uppercase tracking-widest italic">แดชบอร์ดแอดมิน (Action Center)</span>
            {refreshing && <Loader2 size={13} className="text-indigo-400 animate-spin" />}
         </div>
         
         <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100 group relative">
               <button onClick={() => navigatePeriod(-1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-500 hover:text-indigo-600">
                 <ChevronLeft size={16} />
               </button>
               <div onClick={() => dateInputRef.current?.showPicker()} className="px-3 flex flex-col items-center cursor-pointer hover:bg-slate-50 rounded-lg transition-all py-1">
                  <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={11} /> {mode === 'month' ? 'เดือน' : 'สัปดาห์'}
                  </div>
                  <div className="text-xs font-black text-slate-900 tracking-tight text-center">{dateRangeStr}</div>
                  <input ref={dateInputRef} type="date" className="absolute opacity-0 pointer-events-none w-0" onChange={(e) => e.target.value && setBaseDate(new Date(e.target.value))} />
               </div>
               <button onClick={() => navigatePeriod(1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-all text-slate-500 hover:text-indigo-600">
                 <ChevronRight size={16} />
               </button>
            </div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-[11px] font-black">
              <button onClick={() => { setMode('week'); setBaseDate(new Date()); }} className={`px-2.5 py-1.5 transition-all ${mode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>สัปดาห์</button>
              <button onClick={() => { setMode('month'); setBaseDate(new Date()); }} className={`px-2.5 py-1.5 transition-all ${mode === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>เดือน</button>
            </div>
            <button onClick={() => setBaseDate(new Date())} className="px-2.5 py-1.5 text-[11px] font-black bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all shadow-sm">วันนี้</button>
            <button onClick={() => fetchStats(true)} className={`p-1.5 rounded-xl border border-slate-200 bg-white shadow-sm ${refreshing ? 'animate-spin text-indigo-500' : 'text-slate-400 hover:text-indigo-600'} transition-all`}><RotateCw size={13} /></button>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {todayStats.map((s, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${s.bg} ${s.color} shrink-0 transition-transform group-hover:scale-105`}>
              <s.Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{s.label}</div>
              <div className={`text-xl font-black ${s.color} tracking-tighter leading-tight`}>{s.value}</div>
              <div className="text-[10px] font-bold text-slate-400 italic truncate">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Section */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100/50 shrink-0 shadow-inner">
          <Award size={22} className="text-indigo-600" />
        </div>
        <div className="flex-1 w-full relative">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-sm font-black text-slate-900 uppercase tracking-tighter">ความคืบหน้าภาพรวม <span className="text-[11px] text-slate-500 font-bold ml-1">({dateRangeStr})</span></div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider italic">สัดส่วนงานที่ต้องทำ (ลูกค้าใหม่ + ติดตามลูกค้าเดิม)</div>
            </div>
            <div className="text-2xl font-black text-indigo-600 tracking-tighter">
               {(() => {
                 if (!workloadOverview) return 0;
                 const tNew = workloadOverview.newLeads.totalInHand || 0;
                 const tRet = workloadOverview.retention.totalInHand || 0;
                 const dNew = workloadOverview.newLeads.completed || 0;
                 const dRet = workloadOverview.retention.completed || 0;
                 const total = tNew + tRet;
                 const done = dNew + dRet;
                 return total > 0 ? Math.round((done / total) * 100) : 0;
               })()}%
            </div>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {(() => {
                 if (!workloadOverview) return null;
                 const tNew = workloadOverview.newLeads.totalInHand || 0;
                 const tRet = workloadOverview.retention.totalInHand || 0;
                 const dNew = workloadOverview.newLeads.completed || 0;
                 const dRet = workloadOverview.retention.completed || 0;
                 const total = tNew + tRet;
                 if (total === 0) return <div className="w-full h-full bg-slate-100" />;
                 const procNew = (dNew / total) * 100;
                 const procRet = (dRet / total) * 100;
                 return (
                   <>
                     <div className="bg-indigo-500 h-full transition-all duration-700 origin-left" style={{ width: `${procNew}%` }} />
                     <div className="bg-sky-400 h-full transition-all duration-700 origin-left" style={{ width: `${procRet}%` }} />
                   </>
                 );
            })()}
          </div>
        </div>
      </div>

      {/* Call Outcome Breakdown */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
         <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 border border-amber-100/50 shrink-0 shadow-inner">
            <PhoneCall size={22} className="text-amber-600" />
         </div>
         <div className="flex-1 w-full relative">
            <div className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-2">สัดส่วนผลลัพธ์การโทร (Call Outcome)</div>
            <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-2 relative">
              {(() => {
                const outcomes = summary?.outcomes?.callOutcomes || [];
                const total = outcomes.reduce((acc, curr) => acc + curr.count, 0);
                if (total === 0) return <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">ไม่มีข้อมูลการโทรประจำสัปดาห์</div>;
                
                const colorMap = {
                   'emerald': 'bg-emerald-500',
                   'amber': 'bg-amber-500',
                   'rose': 'bg-rose-500'
                };

                return outcomes.map((o, idx) => (
                  <div key={idx} className={`${colorMap[o.color] || 'bg-slate-500'} h-full transition-all duration-1000 origin-left border-r border-white/20 relative group/seg cursor-help`} style={{ width: `${(o.count / total) * 100}%` }}>
                     <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-white/90 drop-shadow-md truncate px-1">
                        {Math.round((o.count / total) * 100)}%
                     </div>
                  </div>
                ));
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {summary?.outcomes?.callOutcomes?.map((o, idx) => {
                 const bgMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
                 return (
                   <div key={idx} className="flex items-center gap-1.5">
                     <div className={`w-2.5 h-2.5 rounded-full ${bgMap[o.color] || 'bg-slate-500'}`} />
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{o.label} <span className="text-slate-400">({o.count})</span></span>
                   </div>
                 );
              })}
            </div>
         </div>
      </div>

      {/* Customer Stage Overview — 3 Cards (Compact) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Card 1: ลูกค้าใหม่ (Pool) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 bg-gradient-to-r from-indigo-400 to-indigo-600" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-xl"><UserPlus size={18} className="text-indigo-600" /></div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ลูกค้าใหม่ทั้งหมด</div>
                  <div className="text-3xl font-black text-indigo-600 tracking-tighter leading-none">{workloadOverview?.pool?.totalInHand ?? '—'}</div>
                </div>
              </div>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">POOL</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-50">
              <div className="bg-indigo-50/50 rounded-lg p-2"><div className="text-[8px] font-black text-indigo-500 uppercase">มอบหมายสัปดาห์นี้</div><div className="text-base font-black text-indigo-600">{workloadOverview?.pool?.assignedThisWeek ?? '—'}</div></div>
              <div className="bg-rose-50/50 rounded-lg p-2"><div className="text-[8px] font-black text-rose-400 uppercase">ตกค้าง</div><div className="text-base font-black text-rose-500">{workloadOverview?.pool?.backlogCount ?? '—'}</div></div>
              <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100"><div className="text-[8px] font-black text-emerald-600 uppercase">ปิดยอดแล้ว</div><div className="text-base font-black text-emerald-700">{workloadOverview?.pool?.completedWon ?? '—'}</div></div>
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-100"><div className="text-[8px] font-black text-slate-500 uppercase">รอตัดสินใจ</div><div className="text-base font-black text-slate-700">{workloadOverview?.pool?.completedNotWon ?? '—'}</div></div>
            </div>
          </div>
        </div>

        {/* Card 2: ลูกค้ารอตัดสินใจ (Qualified) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 rounded-xl"><Hourglass size={18} className="text-amber-500" /></div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">รอตัดสินใจทั้งหมด</div>
                  <div className="text-3xl font-black text-amber-500 tracking-tighter leading-none">{workloadOverview?.qualified?.totalInHand ?? '—'}</div>
                </div>
              </div>
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full">QUALIFIED</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-50">
              <div className="bg-amber-50/50 rounded-lg p-2"><div className="text-[8px] font-black text-amber-500 uppercase">มอบหมายสัปดาห์นี้</div><div className="text-base font-black text-amber-600">{workloadOverview?.qualified?.assignedThisWeek ?? '—'}</div></div>
              <div className="bg-rose-50/50 rounded-lg p-2"><div className="text-[8px] font-black text-rose-400 uppercase">ตกค้าง</div><div className="text-base font-black text-rose-500">{workloadOverview?.qualified?.backlogCount ?? '—'}</div></div>
              <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100"><div className="text-[8px] font-black text-emerald-600 uppercase">ปิดยอดแล้ว</div><div className="text-base font-black text-emerald-700">{workloadOverview?.qualified?.completedWon ?? '—'}</div></div>
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-100"><div className="text-[8px] font-black text-slate-500 uppercase">ติดตามต่อ</div><div className="text-base font-black text-slate-700">{workloadOverview?.qualified?.completedNotWon ?? '—'}</div></div>
            </div>
          </div>
        </div>

        {/* Card 3: ลูกค้าประจำ (Retention) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-xl"><Star size={18} className="text-emerald-600" /></div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ลูกค้าประจำของฉัน</div>
                  <div className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">{workloadOverview?.retention?.customerTotal ?? '—'}</div>
                </div>
              </div>
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full">RETENTION</span>
            </div>
            <div className="pt-2 border-t border-slate-50">
              <div className="bg-emerald-50/70 rounded-lg p-3 flex items-center justify-between">
                <div><div className="text-[8px] font-black text-emerald-600 uppercase">ติดตามไปแล้วสัปดาห์นี้</div><div className="text-[10px] text-emerald-500 mt-0.5">ราย (ทั้งซื้อซ้ำและยัง)</div></div>
                <span className="text-2xl font-black text-emerald-700">{workloadOverview?.retention?.completed ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>


      {/* Footer / Summary Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Weekly Activity Breakdown Chart */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-50 rounded-xl">
                  <TrendingUp size={16} className="text-indigo-500" />
               </div>
               <div>
                  <div className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">ประสิทธิภาพรายวัน (Daily Tracking)</div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest italic">สัปดาห์ปัจจุบัน: {dateRangeStr}</p>
               </div>
            </div>
            <div className="flex gap-4 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-sky-400" /><span className="text-[10px] font-black text-slate-500 uppercase">งานลูกค้าประจำ</span></div>
               <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-indigo-500" /><span className="text-[10px] font-black text-slate-500 uppercase">เบอร์ใหม่/รอตัดสินใจ</span></div>
            </div>
          </div>
          
          <div className="p-5 flex-1 flex flex-col justify-end">
            <div className="relative h-44 w-full">
              {/* Horizontal Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-12 pointer-events-none">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="border-b border-dashed border-slate-100 w-full" />
                ))}
              </div>
              
              <div className="flex items-end justify-between h-full w-full px-2 relative z-10 pb-8">
                {summary?.daily?.map((d, i) => {
                  const maxVal = Math.max(...(summary?.daily||[]).map(x => Math.max(x.followUps, x.newLeads)), 10);
                  const hFollow = Math.round((d.followUps / maxVal) * 100);
                  const hNew = Math.round((d.newLeads / maxVal) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="w-full flex justify-center gap-1.5 items-end h-[90%] relative">
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-none whitespace-nowrap shadow-xl">
                             ↩ {d.followUps} | ✦ {d.newLeads}
                          </div>
                          <div className="relative w-4 md:w-6 group/bar flex flex-col justify-end h-full">
                            <div className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t-md transition-all duration-700 origin-bottom" style={{ height: `${hFollow}%` }} />
                          </div>
                          <div className="relative w-4 md:w-6 group/bar flex flex-col justify-end h-full">
                            <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all duration-700 origin-bottom" style={{ height: `${hNew}%` }} />
                          </div>
                      </div>
                      <div className="text-[10px] font-black text-slate-600 uppercase tracking-wide bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50 flex-shrink-0">
                        {d?.day || '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Performance Summary Column */}
        <div className="lg:col-span-4">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-3 bg-slate-50/20">
                 <div className="p-2 bg-amber-50 rounded-xl text-amber-500"><Database size={16} /></div>
                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">สรุปผลการปิดการขาย</h4>
              </div>
              <div className="p-4 space-y-4 flex-1">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                       <div className="text-[9px] font-black text-emerald-600 uppercase mb-1">ORDERED / WON</div>
                       <div className="text-xl font-black text-emerald-900">{(summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0)} ราย</div>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100/50">
                       <div className="text-[9px] font-black text-rose-600 uppercase mb-1">DENIED / LOST</div>
                       <div className="text-xl font-black text-rose-900">{(summary?.outcomes?.lead?.lost || 0) + (summary?.outcomes?.retention?.notInterested || 0)} ราย</div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                       <Database size={12} /> เหตุผลปฏิเสธ (Top 3)
                    </div>
                    {summary?.reasons?.leadClosedLost?.slice(0, 3).map((r, idx) => (
                       <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100/50">
                          <span className="text-xs font-bold text-slate-700 truncate mr-2">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">{r.count} ราย</span>
                       </div>
                    ))}
                    {(!summary?.reasons?.leadClosedLost || summary.reasons.leadClosedLost.length === 0) && (
                       <div className="text-xs font-bold text-slate-300 italic text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">ไม่มีข้อมูลเหตุผลปิดการขาย</div>
                    )}
                 </div>

                 <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                       <Users size={12} /> รายงานประจำสัปดาห์
                    </h4>
                    <textarea 
                       value={reportNote}
                       onChange={e => setReportNote(e.target.value)}
                       placeholder="อธิบายอุปสรรค เหตุผลที่ลูกค้าปฏิเสธ..."
                       className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none bg-slate-50/50"
                       rows={3}
                    />
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={submitReport} disabled={isSubmitting} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5">
                          {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          {isSubmitting ? 'กำลังส่ง...' : 'ส่งรายงาน'}
                       </button>
                       <button onClick={handleExportLiveHTML} disabled={isExporting} className="w-full py-2 bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:opacity-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5">
                          {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                          {isExporting ? 'กำลังโหลด...' : 'Export HTML'}
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardView;
