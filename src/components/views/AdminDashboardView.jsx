import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, PhoneCall, CheckCircle2, Target, Clock, Award, Users, 
  ChevronRight, ChevronLeft, Calendar, RotateCw, Loader2, Database, TrendingDown 
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { downloadWeeklyHTML } from '../../utils/htmlExporter';
import { DashboardSkeleton } from '../common/Skeleton';

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
          alert('ส่งรายงานสัปดาห์นี้เรียบร้อยแล้ว!');
      } else {
          alert('เกิดข้อผิดพลาดในการส่งรายงาน');
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
         alert('เกิดข้อผิดพลาด ไม่สามารถดึงข้อมูลรายงานได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดข้อมูล');
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
    <div className={`space-y-6 animate-in fade-in duration-700 max-w-[1400px] mx-auto pb-8 relative ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
         <div className="flex items-center gap-3 mb-1">
            <div className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
            <span className="text-base font-black text-indigo-600 uppercase tracking-widest italic">แดชบอร์ดระบบแอดมิน (Action Center)</span>
         </div>
         
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 group relative">
               <button onClick={() => navigatePeriod(-1)} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600 hover:text-indigo-600" title="ช่วงเวลาก่อนหน้า">
                 <ChevronLeft size={22} />
               </button>
               
               <div onClick={() => dateInputRef.current?.showPicker()} className="px-6 flex flex-col items-center cursor-pointer hover:bg-slate-50 rounded-xl transition-all py-2 border-x border-transparent hover:border-slate-100">
                  <div className="text-[12px] font-black text-indigo-600 uppercase tracking-widest italic flex items-center gap-2 group-hover:scale-105 transition-transform">
                    <Calendar size={14} /> {mode === 'month' ? 'เลือกเดือน' : 'เลือกช่วงสัปดาห์'}
                  </div>
                  <div className="text-sm font-black text-slate-900 uppercase tracking-tight text-center">{dateRangeStr}</div>
                  <input ref={dateInputRef} type="date" className="absolute opacity-0 pointer-events-none" onChange={(e) => e.target.value && setBaseDate(new Date(e.target.value))} />
               </div>

               <button onClick={() => navigatePeriod(1)} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600 hover:text-indigo-600" title="ช่วงถัดไป">
                 <ChevronRight size={22} />
               </button>
               
               <div className="w-[1.5px] h-10 bg-slate-100 mx-2" />
               {/* Week / Month Toggle Pill */}
               <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                 <button
                   onClick={() => { setMode('week'); setBaseDate(new Date()); }}
                   className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${
                     mode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   รายสัปดาห์
                 </button>
                 <button
                   onClick={() => { setMode('month'); setBaseDate(new Date()); }}
                   className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${
                     mode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   รายเดือน
                 </button>
               </div>
               <div className="w-[1.5px] h-10 bg-slate-100 mx-2" />
               <button onClick={() => setBaseDate(new Date())} className="px-5 py-2.5 text-xs font-black uppercase text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">Today</button>
               <div className="w-[1.5px] h-10 bg-slate-100 mx-2" />
               <button onClick={() => fetchStats(true)} className={`p-2.5 rounded-xl transition-all ${refreshing ? 'text-indigo-600 bg-indigo-50 animate-spin' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`} title="รีเฟรชข้อมูล">
                 <RotateCw size={22} />
               </button>
            </div>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {todayStats.map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-2xl ${s.bg} ${s.color} transition-transform group-hover:scale-110`}>
                <s.Icon size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest truncate">{s.label}</div>
                <div className={`text-2xl font-black ${s.color} tracking-tighter truncate`}>{s.value}</div>
              </div>
            </div>
            <div className="text-[12px] font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/50 italic truncate">
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Section */}
      <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100/50 shrink-0 shadow-inner">
          <Award size={36} className="text-indigo-600" />
        </div>
        <div className="flex-1 w-full relative">
          <div className="flex justify-between items-end mb-3">
            <div>
              <div className="text-lg font-black text-slate-900 uppercase tracking-tighter">ความคืบหน้าภาพรวมประจำสัปดาห์ <span className="text-[12px] text-slate-600 font-bold ml-2">({dateRangeStr})</span></div>
              <div className="text-sm font-black text-slate-600 uppercase tracking-widest italic mt-1">สัดส่วนงานที่ต้องทำทั้งหมด (ลูกค้ารายใหม่ และ ติดตามลูกค้ารายเดิม)</div>
            </div>
            <div className="text-3xl font-black text-indigo-600 tracking-tighter">
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
          <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
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
                     <div className="bg-indigo-500 h-full transition-all duration-1000 origin-left" style={{ width: `${procNew}%` }} />
                     <div className="bg-sky-400 h-full transition-all duration-1000 origin-left" style={{ width: `${procRet}%` }} />
                   </>
                 );
            })()}
          </div>
        </div>
      </div>

      {/* Call Outcome Breakdown */}
      <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
         <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-50 border border-amber-100/50 shrink-0 shadow-inner group">
            <PhoneCall size={36} className="text-amber-600 group-hover:scale-110 transition-transform" />
         </div>
         <div className="flex-1 w-full relative">
            <div className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4">สัดส่วนผลลัพธ์การโทร (Call Outcome)</div>
            <div className="w-full h-8 bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-4 relative">
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
            <div className="flex flex-wrap items-center gap-6">
              {summary?.outcomes?.callOutcomes?.map((o, idx) => {
                 const bgMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
                 return (
                   <div key={idx} className="flex items-center gap-2">
                     <div className={`w-3.5 h-3.5 rounded-full ${bgMap[o.color] || 'bg-slate-500'} shadow-sm`} />
                     <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{o.label} <span className="text-slate-400 ml-1">({o.count})</span></span>
                   </div>
                 );
              })}
            </div>
         </div>
      </div>

      {/* Main Workload Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: New Leads */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[650px] group/col">
          <div className="p-7 bg-indigo-50/40 border-b border-indigo-100/50 relative shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/col:opacity-10 transition-opacity">
              <Users size={100} className="text-indigo-600" />
            </div>
            <div className="relative z-10 flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600 shadow-sm"><Users size={28}/></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">รายชื่อเบอร์ใหม่ / ลูกค้ารอตัดสินใจ</h3>
                <p className="text-sm font-black text-indigo-600 uppercase tracking-widest italic">ช่วงงานประจำสัปดาห์ {dateRangeStr}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3 mt-6 relative z-10">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-800">{workloadOverview?.newLeads?.assignedThisWeek || 0}</span>
                <span className="text-[11px] font-bold text-slate-600 uppercase text-center leading-tight">งานมอบหมาย<br/>สัปดาห์นี้</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                 <span className="text-2xl font-black text-slate-800">{workloadOverview?.newLeads?.backlogCount || 0}</span>
                <span className="text-[11px] font-bold text-rose-400 uppercase text-center leading-tight">งานค้างจาก<br/>สัปดาห์ก่อน</span>
              </div>
              <div className="bg-emerald-500 p-4 rounded-2xl shadow-sm border border-emerald-400 flex flex-col items-center justify-center text-white">
                <span className="text-2xl font-black">{workloadOverview?.newLeads?.completed || 0}</span>
                <span className="text-[11px] font-bold text-emerald-100 uppercase text-center leading-tight">ทำเสร็จแล้ว<br/>สัปดาห์นี้</span>
              </div>
              <div className="bg-indigo-600 p-4 rounded-2xl shadow-sm border border-indigo-500 flex flex-col items-center justify-center text-white">
                <span className="text-2xl font-black">{workloadOverview?.newLeads?.totalInHand || 0}</span>
                <span className="text-[11px] font-bold text-indigo-200 uppercase text-center leading-tight">งานคงเหลือ<br/>ทั้งหมด</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-indigo-600/5 p-4 rounded-2xl border border-indigo-100 mt-4 relative z-10">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-indigo-600 uppercase">เปลี่ยนเป็นลูกค้าประจำ</span>
                <span className="text-xl font-black text-indigo-700">{summary?.outcomes?.conversions?.newToRetention || 0} ราย</span>
              </div>
              <div className="w-[1px] h-8 bg-indigo-200/50" />
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-slate-500 uppercase">เปลี่ยนเป็นลูกค้ารอตัดสินใจ</span>
                <span className="text-xl font-black text-slate-700">{summary?.outcomes?.conversions?.newToFollowUp || 0} ราย</span>
              </div>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
            {!workloadOverview?.newLeads?.list?.length ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-300 font-black text-sm uppercase italic opacity-70">ไม่มีรายชื่อลูกค้าที่ต้องจัดการ</div>
            ) : (
              workloadOverview.newLeads.list.map((c, i) => (
                <button key={c.id ? `${c.id}-${i}` : i} onClick={() => onSelectCustomer ? onSelectCustomer(c) : onNextLead(c)} className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${c.isDone ? 'bg-white/50 border-transparent opacity-60' : 'bg-white border-slate-100 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 shadow-sm'}`}>
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black shrink-0 ${c.isDone ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm'}`}>
                       {i + 1}
                     </div>
                     <div className="overflow-hidden min-w-0">
                       <div className={`text-base font-bold truncate ${c.isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{c?.name || 'ลูกค้าไม่มีชื่อ'}</div>
                       <div className="flex gap-3 items-center mt-1">
                          <span className="text-xs font-bold text-slate-600 tracking-wide">{c.phone}</span>
                          {!c.isDone && c.isNewThisWeek && <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 font-black rounded uppercase">ใหม่</span>}
                          {!c.isDone && !c.isNewThisWeek && <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-600 font-black rounded uppercase">ค้าง</span>}
                          {c.isDone && <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 font-black rounded uppercase italic">Done</span>}
                       </div>
                     </div>
                   </div>
                   <div className={`p-2.5 rounded-xl transition-all ${c.isDone ? 'text-slate-300' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                     <ChevronRight size={22} />
                   </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Retention */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[650px] group/col-ret">
          <div className="p-7 bg-sky-50/40 border-b border-sky-100/50 relative shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/col-ret:opacity-10 transition-opacity">
              <Clock size={100} className="text-sky-600" />
            </div>
            <div className="relative z-10 flex items-center gap-4 mb-4">
              <div className="p-3 bg-sky-100 rounded-2xl text-sky-600 shadow-sm"><Clock size={28}/></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">งานลูกค้าประจำ (Retention)</h3>
                <p className="text-sm font-black text-sky-600 uppercase tracking-widest italic">รอบติดต่อประจำสัปดาห์ {dateRangeStr}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3 mt-6 relative z-10">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-800">{workloadOverview?.retention?.assignedThisWeek || 0}</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase text-center leading-tight">รอบใหม่<br/>สัปดาห์นี้</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                 <span className="text-2xl font-black text-slate-800">{workloadOverview?.retention?.backlogCount || 0}</span>
                <span className="text-[11px] font-bold text-rose-400 uppercase text-center leading-tight">งานค้างจาก<br/>สัปดาห์ก่อน</span>
              </div>
              <div className="bg-emerald-500 p-4 rounded-2xl shadow-sm border border-emerald-400 flex flex-col items-center justify-center text-white">
                <span className="text-2xl font-black">{workloadOverview?.retention?.completed || 0}</span>
                <span className="text-[11px] font-bold text-emerald-100 uppercase text-center leading-tight">ทำเสร็จแล้ว<br/>สัปดาห์นี้</span>
              </div>
              <div className="bg-sky-600 p-4 rounded-2xl shadow-sm border border-sky-500 flex flex-col items-center justify-center text-white">
                <span className="text-2xl font-black">{workloadOverview?.retention?.totalInHand || 0}</span>
                <span className="text-[11px] font-bold text-sky-100 uppercase text-center leading-tight">งานคงเหลือ<br/>ทั้งหมด</span>
              </div>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
            {!workloadOverview?.retention?.list?.length ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-300 font-black text-sm uppercase italic opacity-70">ไม่มีรายชื่อลูกค้าถึงรอบติดต่อ</div>
            ) : (
              workloadOverview.retention.list.map((c, i) => (
                <button key={c.id ? `${c.id}-${i}` : i} onClick={() => onSelectCustomer ? onSelectCustomer(c) : onNextLead(c)} className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${c.isDone ? 'bg-white/50 border-transparent opacity-60' : 'bg-white border-slate-100 hover:border-sky-400 hover:shadow-lg hover:-translate-y-0.5 shadow-sm'}`}>
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-black shrink-0 ${c.isDone ? 'bg-slate-100 text-slate-400' : 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-sm'}`}>
                       {i + 1}
                     </div>
                     <div className="overflow-hidden min-w-0">
                       <div className={`text-base font-bold truncate ${c.isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{c.name || 'ลูกค้าไม่มีชื่อ'}</div>
                       <div className="flex gap-3 items-center mt-1">
                          <span className="text-xs font-bold text-slate-600 tracking-wide">{c.phone}</span>
                          {c.followUpFrequencyDays && (
                              <span className={`text-[10px] px-2 py-0.5 font-extrabold rounded uppercase flex items-center gap-1 ${c.followUpFrequencyDays === 7 ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>
                                 <RotateCw size={10} /> รอบทุก {c.followUpFrequencyDays} วัน
                              </span>
                          )}
                          {c.nextDueDate && (
                              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 font-black rounded uppercase shadow-sm border border-slate-200">
                                 รอบ: {new Date(c.nextDueDate).toLocaleDateString('th-TH', {day: 'numeric', month: 'short'})}
                              </span>
                          )}
                          {!c.isDone && c.isNewThisWeek && <span className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-600 font-black rounded uppercase shadow-sm">สัปดาห์นี้</span>}
                          {!c.isDone && !c.isNewThisWeek && <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-600 font-black rounded uppercase shadow-sm">ค้าง</span>}
                          {c.isDone && <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-600 font-black rounded uppercase italic shadow-sm">เรียบร้อย</span>}
                       </div>
                     </div>
                   </div>
                   <div className={`p-2.5 rounded-xl transition-all ${c.isDone ? 'text-slate-300' : 'bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white'}`}>
                     <ChevronRight size={22} />
                   </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer / Summary Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Activity Breakdown Chart */}
        <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[450px]">
          <div className="px-7 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div className="flex items-center gap-4">
               <div className="p-2.5 bg-indigo-50 rounded-2xl">
                  <TrendingUp size={22} className="text-indigo-500" />
               </div>
               <div>
                  <div className="text-base font-black text-slate-900 uppercase tracking-tighter italic">ประสิทธิภาพรายวัน (Daily Tracking)</div>
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-1 italic">สัปดาห์ปัจจุบัน: {dateRangeStr}</p>
               </div>
            </div>
            <div className="flex gap-5 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded bg-sky-400 shadow-sm shadow-sky-100" /><span className="text-xs font-black text-slate-500 uppercase">งานลูกค้าประจำ</span></div>
               <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded bg-indigo-500 shadow-sm shadow-indigo-100" /><span className="text-xs font-black text-slate-500 uppercase">เบอร์ใหม่/รอตัดสินใจ</span></div>
            </div>
          </div>
          
          <div className="p-8 flex-1 flex flex-col justify-end">
            <div className="relative h-64 w-full">
              {/* Horizontal Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-12 pointer-events-none">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="border-b border-dashed border-slate-100 w-full" />
                ))}
              </div>
              
              <div className="flex items-end justify-between h-full w-full px-4 lg:px-12 relative z-10 pb-10">
                {summary?.daily?.map((d, i) => {
                  const maxVal = Math.max(...(summary?.daily||[]).map(x => Math.max(x.followUps, x.newLeads)), 10);
                  const hFollow = Math.round((d.followUps / maxVal) * 100);
                  const hNew = Math.round((d.newLeads / maxVal) * 100);
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-5 group h-full justify-end">
                      <div className="w-full flex justify-center gap-2 md:gap-3 items-end h-[90%] relative">
                          {/* Tooltip */}
                          <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-4 py-2.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-none whitespace-nowrap shadow-2xl border border-slate-700">
                             ติดต่อกลับ: {d.followUps} | เบอร์ใหม่: {d.newLeads} ราย
                             <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
                          </div>
                          
                          <div className="relative w-5 md:w-7 lg:w-10 group/bar flex flex-col justify-end h-full">
                            <div className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t-lg rounded-b-[2px] transition-all duration-1000 ease-out origin-bottom shadow-lg shadow-sky-100 group-hover/bar:brightness-110" style={{ height: `${hFollow}%` }} />
                          </div>
                          
                          <div className="relative w-5 md:w-7 lg:w-10 group/bar flex flex-col justify-end h-full">
                            <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg rounded-b-[2px] transition-all duration-1000 ease-out origin-bottom shadow-lg shadow-indigo-100 group-hover/bar:brightness-110" style={{ height: `${hNew}%` }} />
                          </div>
                      </div>
                  <div className="text-[12px] font-black text-slate-700 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/50 flex-shrink-0 shadow-sm">
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
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
              <div className="px-7 py-5 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                 <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-500"><Database size={22} /></div>
                 <h4 className="text-base font-black text-slate-900 uppercase tracking-tighter italic">สรุปผลการปิดการขาย (สัปดาห์นี้)</h4>
              </div>
              <div className="p-6 space-y-6 flex-1">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100/50 shadow-sm">
                       <div className="text-[10px] font-black text-emerald-600 uppercase mb-1 tracking-widest">ORDERED / WON</div>
                       <div className="text-2xl font-black text-emerald-900 leading-tight">{(summary?.outcomes?.lead?.won || 0) + (summary?.outcomes?.retention?.ordered || 0)} ราย</div>
                    </div>
                    <div className="p-4 bg-rose-50 rounded-3xl border border-rose-100/50 shadow-sm">
                       <div className="text-[10px] font-black text-rose-600 uppercase mb-1 tracking-widest">DENIED / LOST</div>
                       <div className="text-2xl font-black text-rose-900 leading-tight">{(summary?.outcomes?.lead?.lost || 0) + (summary?.outcomes?.retention?.notInterested || 0)} ราย</div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2 mb-2">
                       <Database size={14} /> ปัญหาและปฏิเสธจากลูกค้า (Top 3 Reasons)
                    </div>
                    {summary?.reasons?.leadClosedLost?.slice(0, 3).map((r, idx) => (
                       <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100/50 hover:border-indigo-200 transition-colors">
                          <span className="text-sm font-bold text-slate-700 truncate mr-3">{r.reason}</span>
                          <span className="text-xs font-black text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{r.count} ราย</span>
                       </div>
                    ))}
                    {(!summary?.reasons?.leadClosedLost || summary.reasons.leadClosedLost.length === 0) && (
                       <div className="text-sm font-bold text-slate-300 italic text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">ไม่มีข้อมูลเหตุผลปิดการขาย</div>
                    )}
                 </div>

                   <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-3">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                         <Users size={14} /> เขียนรายงานและสะท้อนปัญหาประจำสัปดาห์
                      </h4>
                      <textarea 
                         value={reportNote}
                         onChange={e => setReportNote(e.target.value)}
                         placeholder="อธิบายอุปสรรค เหตุผลที่ลูกค้าปฏิเสธส่วนใหญ่ หรือสิ่งที่ต้องการให้ผู้จัดการช่วยเหลือ..."
                         className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none bg-slate-50/50"
                         rows={3}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                         <button 
                            onClick={submitReport}
                            disabled={isSubmitting}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-200 active:scale-95 flex items-center justify-center gap-2"
                         >
                            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันส่งรายงานสัปดาห์นี้'}
                         </button>
                         
                         <button 
                            onClick={handleExportLiveHTML}
                            disabled={isExporting}
                            className="w-full py-3 bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:opacity-50 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                         >
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                            {isExporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลดรายงาน (HTML)'}
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
