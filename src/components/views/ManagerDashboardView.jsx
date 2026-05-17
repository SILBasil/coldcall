import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp as ActivityIcon, AlertCircle as AlertIcon, Clock as HistoryIcon, 
  Phone as PhoneIcon, Target, TrendingUp, Users, PhoneCall, CheckCircle2, 
  Award, ChevronRight, ChevronLeft, Loader2, Database, TrendingDown, X, Calendar,
  RotateCw, ShieldCheck, Zap, Medal, Flame, Timer
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { downloadWeeklyHTML } from '../../utils/htmlExporter';
import { ManagerSkeleton } from '../common/Skeleton';

const ManagerDashboardView = () => {
  const [stats, setStats] = useState({
    pool: 0, qualified: 0, customer: 0, total: 0, newLeadsToday: 0,
    recentLogs: [],
    weeklyStats: { 
      efficiency: '0%', efficiencyGrowth: '0', 
      followUps: 0, followUpsTotal: 0, followUpsGrowth: '0',
      newCustomers: 0, newCustomersGrowth: '0',
      leaderboard: [],
      adminDetails: {}
    },
    activityTrend: { labels: [], counts: [] }
  });
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminWeeklyRates, setAdminWeeklyRates] = useState({});
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState('week'); // 'week' | 'month'
  const dateInputRef = useRef(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const all = await leadService.getUsers();
      setAdmins(all.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    
    try {
      // 1. Fetch current period stats
      const data = await leadService.getStats(baseDate, mode);
      setStats(data);

      // 2. Optimized history fetch (week mode only)
      if (mode === 'week') fetchOptimizedWeeklyHistory(baseDate);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOptimizedWeeklyHistory = async (refDate) => {
    setIsWeeklyLoading(true);
    try {
      const day = refDate.getDay();
      const diff = refDate.getDate() - (day === 0 ? 6 : day - 1);
      const refMonday = new Date(refDate);
      refMonday.setDate(diff);
      refMonday.setHours(0, 0, 0, 0);

      // We need stats for the last 6 weeks
      const weekStarts = [];
      const numWeeks = 6;
      for (let i = 0; i < numWeeks; i++) {
        const d = new Date(refMonday);
        d.setDate(refMonday.getDate() - ((numWeeks - 1) - i) * 7);
        weekStarts.push(d);
      }

      // Fetch stats for each week in parallel
      const weeklyStatsResults = await Promise.all(
        weekStarts.map(start => leadService.getStats(start))
      );

      const ratesMap = {};
      // Initialize map for all admins
      const allUsers = await leadService.getUsers();
      const adminList = allUsers.filter(u => u.role === 'admin');
      adminList.forEach(a => { ratesMap[a.id] = Array(numWeeks).fill('-'); });

      // Fill rates from leaderboard data
      weeklyStatsResults.forEach((weekData, weekIdx) => {
        const leaderboard = weekData.weeklyStats?.leaderboard || [];
        leaderboard.forEach(entry => {
          if (ratesMap[entry.id]) {
            ratesMap[entry.id][weekIdx] = entry.rate || '0%';
          }
        });
      });

      setAdminWeeklyRates(ratesMap);
    } catch (err) {
      console.error('fetchOptimizedWeeklyHistory error:', err);
    } finally {
      setIsWeeklyLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [baseDate, mode]);


  const getLastWeeks = (referenceDate, numWeeks = 6) => {
    const day = referenceDate.getDay();
    const diff = referenceDate.getDate() - (day === 0 ? 6 : day - 1);
    const referenceMonday = new Date(referenceDate);
    referenceMonday.setDate(diff);
    referenceMonday.setHours(0, 0, 0, 0);

    const weeks = [];
    for (let i = 0; i < numWeeks; i++) {
       const start = new Date(referenceMonday);
       start.setDate(referenceMonday.getDate() - (i * 7));
       const end = new Date(start);
       end.setDate(start.getDate() + 6);
       weeks.push({ 
         start, 
         end, 
         label: `${start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}`
       });
    }
    return weeks.reverse();
  };

  const currentWeeks = getLastWeeks(baseDate, 6);

  const periodLabel = mode === 'month' ? 'รายเดือน' : 'รายสัปดาห์';

  const dateRangeStr = stats.periodLabel || (
    mode === 'month'
      ? baseDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
      : (() => {
          const day = baseDate.getDay();
          const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
          const start = new Date(baseDate); start.setDate(diff); start.setHours(0,0,0,0);
          const end = new Date(start); end.setDate(start.getDate() + 6);
          return `${start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${end.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        })()
  );

  const topStats = [
    { label: `ลูกค้าใหม่วันนี้ (Bot)`, value: stats.newLeadsToday || 0, Icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'รายชื่อทั้งหมดในวันนี้', trend: null },
    { label: `ประสิทธิภาพการปิดดีล (${periodLabel})`, value: stats.weeklyStats?.efficiency || '0%', Icon: ActivityIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'เทียบกับช่วงเวลาก่อนหน้า', trend: stats.weeklyStats?.efficiencyGrowth },
    { label: `งานติดตามลูกค้า (DONE)`, value: `${stats.weeklyStats?.followUps || 0} / ${stats.weeklyStats?.followUpsTotal || 0}`, Icon: HistoryIcon, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'สัดส่วนงานที่เรียบร้อย', trend: stats.weeklyStats?.followUpsGrowth },
    { label: `ยอดผู้สั่งซื้อสำเร็จ (${periodLabel})`, value: stats.weeklyStats?.newCustomers || 0, Icon: Award, color: 'text-rose-600', bg: 'bg-rose-50', sub: 'จากทุกช่องทาง', trend: stats.weeklyStats?.newCustomersGrowth },
  ];

  const navigatePeriod = (dir) => {
    const nextDate = new Date(baseDate);
    if (mode === 'month') {
      nextDate.setMonth(baseDate.getMonth() + dir);
      nextDate.setDate(1); // always go to 1st of month
    } else {
      nextDate.setDate(baseDate.getDate() + (dir * 7));
    }
    setBaseDate(nextDate);
  };

  if (loading && !refreshing) {
     return <ManagerSkeleton />;
  }

  return (
    <div className={`space-y-6 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-8 relative ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100 font-sans">
         <div className="flex items-center gap-3 mb-1">
            <div className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
            <span className="text-base font-black text-indigo-600 uppercase tracking-widest italic">Monitoring Control Center (ห้องควบคุมและจัดการระบบ)</span>
            {refreshing && <Loader2 size={14} className="text-indigo-400 animate-spin ml-2" />}
         </div>
         
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 group relative">
               <button onClick={() => navigatePeriod(-1)} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600 hover:text-indigo-600" title="ช่วงเวลาก่อนหน้า"><ChevronLeft size={22} /></button>
               <div onClick={() => dateInputRef.current?.showPicker()} className="px-6 flex flex-col items-center cursor-pointer hover:bg-slate-50 rounded-xl transition-all py-2 border-x border-transparent hover:border-slate-100">
                  <div className="text-[12px] font-black text-indigo-600 uppercase tracking-widest italic flex items-center gap-2 group-hover:scale-105 transition-transform">
                    <Calendar size={14} className="animate-bounce" /> {mode === 'month' ? 'เลือกเดือน' : 'เลือกสัปดาห์'}
                  </div>
                  <div className="text-sm font-black text-slate-900 uppercase tracking-tight text-center">{dateRangeStr}</div>
                  <input ref={dateInputRef} type="date" className="absolute opacity-0 pointer-events-none" onChange={(e) => e.target.value && setBaseDate(new Date(e.target.value))} />
               </div>
               <button onClick={() => navigatePeriod(1)} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600 hover:text-indigo-600" title="ช่วงเวลาถัดไป"><ChevronRight size={22} /></button>
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
               <button onClick={() => fetchStats(true)} className={`p-2.5 rounded-xl transition-all ${refreshing ? 'text-indigo-600 bg-indigo-50 animate-spin' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'}`} title="รีเฟรชข้อมูล"><RotateCw size={22} /></button>
            </div>

            <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
               <div className="px-6 py-1.5 border-r border-slate-100 text-right hidden lg:block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">สถานะการเชื่อมต่อ</div>
                  <div className="text-sm font-black text-emerald-500 uppercase flex items-center gap-2 justify-end">
                     <ShieldCheck size={14} /> ดีเยี่ยม (Optimal)
                  </div>
               </div>
               <div className="px-6 py-1.5 grayscale opacity-30">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">พนักงาน</div>
                    <div className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                      <Users size={14} /> {admins.length} คน
                    </div>
               </div>
            </div>
         </div>
      </div>

      {/* Hero Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topStats.map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
            {refreshing && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10 animate-pulse" />}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3.5 rounded-2xl ${s.bg} shadow-inner`}><s.Icon size={24} className={s.color} /></div>
              {s.trend !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black shadow-sm ${parseFloat(s.trend) >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                  {parseFloat(s.trend) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {s.trend}%
                </div>
              )}
            </div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{s.label}</div>
            <div className="text-3xl font-black text-slate-900 tracking-tighter mb-2">{s.value}</div>
            <div className="flex items-center gap-2 text-xs font-bold italic"><span className={`${s.color} opacity-80 uppercase tracking-widest`}>{s.sub}</span></div>
          </div>
        ))}
      </div>

      {/* Bot Weekly Funnel Flow */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-7 shadow-2xl shadow-indigo-900/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-bl-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 italic">
                <Flame className="text-amber-400" size={18} /> สรุปความเคลื่อนไหวของดีล ประจำสัปดาห์นี้
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
                Bot Processed → ลูกค้าสนใจจริง → รอตัดสินใจ → ลูกค้าประจำ
              </p>
            </div>
            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/20 px-3 py-1.5 rounded-full border border-indigo-500/30">
              สัปดาห์นี้
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Bot Processed */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all group/fc">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-slate-500/30 flex items-center justify-center">
                  <Database size={16} className="text-slate-300" />
                </div>
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">บอทช่วยสกรีน</span>
              </div>
              <div className="text-3xl font-black text-white tracking-tighter">
                {stats.weeklyFunnelFlow?.botProcessed ?? stats.pool ?? 0}
              </div>
              <div className="text-[10px] font-black text-slate-400 mt-1">นำเข้าจากคลังคัดกรอง</div>
            </div>

            {/* Arrow connector */}
            <div className="hidden md:flex items-center justify-start -ml-2 mt-6 pointer-events-none absolute" style={{display:'none'}} />

            {/* To Qualified -> ลูกค้าสนใจจริง */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 hover:bg-indigo-500/20 transition-all group/fc">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center">
                  <Users size={16} className="text-indigo-300" />
                </div>
                <span className="text-[9px] font-black text-indigo-300/70 uppercase tracking-widest">ลูกค้าสนใจจริง</span>
              </div>
              <div className="text-3xl font-black text-indigo-300 tracking-tighter">
                {stats.weeklyFunnelFlow?.toQualified ?? 0}
              </div>
              <div className="text-[10px] font-black text-indigo-400/60 mt-1">pool → รับเรื่อง/ติดต่อกลับ</div>
              {(stats.weeklyFunnelFlow?.botProcessed || stats.pool) > 0 && (
                <div className="text-[9px] font-black text-indigo-300 mt-2 bg-indigo-500/20 px-2 py-0.5 rounded-full inline-block">
                  {Math.round(((stats.weeklyFunnelFlow?.toQualified ?? 0) / Math.max(stats.weeklyFunnelFlow?.botProcessed || stats.pool || 1, 1)) * 100)}% of pool
                </div>
              )}
            </div>

            {/* To Decision -> รอตัดสินใจ */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 hover:bg-amber-500/20 transition-all group/fc">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/30 flex items-center justify-center">
                  <Timer size={16} className="text-amber-300" />
                </div>
                <span className="text-[9px] font-black text-amber-300/70 uppercase tracking-widest">รอตัดสินใจ</span>
              </div>
              <div className="text-3xl font-black text-amber-300 tracking-tighter">
                {stats.weeklyFunnelFlow?.toDecision ?? 0}
              </div>
              <div className="text-[10px] font-black text-amber-400/60 mt-1">อยู่ระหว่างยื่นข้อเสนอสัปดาห์นี้</div>
              {(stats.weeklyFunnelFlow?.toQualified ?? 0) > 0 && (
                <div className="text-[9px] font-black text-amber-300 mt-2 bg-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                  {Math.round(((stats.weeklyFunnelFlow?.toDecision ?? 0) / Math.max(stats.weeklyFunnelFlow?.toQualified ?? 1, 1)) * 100)}% of new
                </div>
              )}
            </div>

            {/* To Customer -> ลูกค้าประจำ */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 hover:bg-emerald-500/20 transition-all group/fc">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-emerald-300" />
                </div>
                <span className="text-[9px] font-black text-emerald-300/70 uppercase tracking-widest">ลูกค้าประจำ</span>
              </div>
              <div className="text-3xl font-black text-emerald-300 tracking-tighter">
                {stats.weeklyFunnelFlow?.toCustomer ?? 0}
              </div>
              <div className="text-[10px] font-black text-emerald-400/60 mt-1">ปิดยอดได้ในสัปดาห์นี้</div>
              {(stats.weeklyFunnelFlow?.toDecision ?? 0) > 0 && (
                <div className="text-[9px] font-black text-emerald-300 mt-2 bg-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                  {Math.round(((stats.weeklyFunnelFlow?.toCustomer ?? 0) / Math.max(stats.weeklyFunnelFlow?.toDecision ?? 1, 1)) * 100)}% closing rate
                </div>
              )}
            </div>
          </div>

          {/* Flow arrows visual (desktop only) */}
          <div className="hidden md:flex items-center justify-center gap-2 mt-4 text-white/20">
            <span className="text-[10px] font-black uppercase tracking-widest">คลังคัดกรอง</span>
            <ChevronRight size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60">ลูกค้าสนใจจริง</span>
            <ChevronRight size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/60">รอตัดสินใจ</span>
            <ChevronRight size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/60">ลูกค้าประจำ</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Analytics Section */}
        <div className="lg:col-span-8">
           
           {/* Team Call Outcome Breakdown */}
           <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8 mb-6">
               <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100/50 shrink-0 shadow-inner group">
                 <PhoneCall size={32} className="text-amber-600 group-hover:scale-110 transition-transform" />
               </div>
               <div className="flex-1 w-full relative">
                  <div className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4">ผลลัพธ์การเจรจา (Team Call Outcomes)</div>
                  <div className="w-full h-6 bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-4 relative">
                    {(() => {
                      const outcomes = stats.teamCallOutcomes || [];
                      const total = outcomes.reduce((acc, curr) => acc + curr.count, 0);
                      if (total === 0) return <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-400 uppercase tracking-widest">ไม่มีผลการเจรจาในสัปดาห์นี้</div>;
                      
                      const colorMap = {
                         'emerald': 'bg-emerald-500',
                         'amber': 'bg-amber-500',
                         'rose': 'bg-rose-500'
                      };

                      return outcomes.map((o, idx) => (
                        <div key={idx} className={`${colorMap[o.color] || 'bg-slate-500'} h-full transition-all duration-1000 origin-left border-r border-white/20 relative group/seg cursor-help`} style={{ width: `${(o.count / total) * 100}%` }}>
                           <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white/90 drop-shadow-md truncate px-1">
                              {Math.round((o.count / total) * 100)}%
                           </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    {stats.teamCallOutcomes?.map((o, idx) => {
                       const bgMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
                       return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${bgMap[o.color] || 'bg-slate-500'} shadow-sm`} />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{o.label} <span className="text-slate-400 ml-1">({o.count})</span></span>
                        </div>
                       );
                    })}
                  </div>
               </div>
            </div>

           {/* Leaderboard & Trend Charts */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
              {/* Leaderboard List */}
              <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group/board h-full flex flex-col">
                 <div className="flex items-center justify-between mb-8">
                    <div>
                       <div className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 italic">
                          <Medal className="text-amber-500" size={18} /> อันดับประสิทธิภาพแอดมิน (Top Performers)
                       </div>
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1 italic">จัดอันดับแอดมินตามอัตราการปิดการขาย</p>
                    </div>
                    <Flame className="text-rose-500 animate-pulse group-hover/board:scale-125 transition-transform" size={24} />
                 </div>
                 <div className="space-y-5 flex-1">
                    {stats.weeklyStats?.leaderboard?.filter(adm => admins.some(a => a.id === adm.id)).map((adm, i) => (
                       <div key={i} className="flex items-center gap-5 group hover:translate-x-2 transition-transform">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shadow-md ${
                             i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 
                             i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : 
                             'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600'
                          }`}>
                             {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="text-base font-black text-slate-800 tracking-tight truncate">{adm.name}</div>
                             <div className="text-xs font-bold text-slate-600 uppercase mt-0.5 tracking-wide">ปิดได้ {adm.converted} รายการ</div>
                          </div>
                          <div className="text-right">
                             <div className={`text-sm font-black ${i === 0 ? 'text-emerald-500' : 'text-slate-600'} tracking-tighter`}>{adm.rate} Conv.</div>
                             <div className="h-1 w-12 bg-slate-100 rounded-full mt-1 overflow-hidden ml-auto">
                                <div className="h-full bg-indigo-500" style={{ width: adm.rate }} />
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Weekly Performance Bar Chart */}
              <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 group/trend flex flex-col h-full">
                 <div className="flex items-center justify-between mb-6">
                    <div className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 italic">
                       <Zap className="text-indigo-600" size={18} /> แนวโน้มการทำงาน (Workload Trend)
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">7 วันล่าสุด</span>
                 </div>
                  <div className="flex items-end justify-between gap-3 px-2 flex-1 min-h-[128px]">
                     {stats.activityTrend?.counts?.map((count, i) => {
                        const max = Math.max(...stats.activityTrend.counts, 1);
                        const h = Math.max((count / max) * 100, count > 0 ? 4 : 0);
                        return (
                           <div key={i} className="flex-1 flex flex-col items-center gap-2 group/bar h-full">
                              <div className="relative w-full flex justify-center flex-1">
                                 <div className="w-2.5 bg-slate-100 rounded-full absolute inset-0 mx-auto" />
                                 <div
                                    className="w-2.5 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-full transition-all duration-700 cursor-pointer absolute bottom-0 mx-auto z-10"
                                    style={{ height: `${h}%` }}
                                 >
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-opacity z-20 whitespace-nowrap shadow-xl">{count}</div>
                                 </div>
                              </div>
                              <span className="text-[11px] font-black text-slate-400 group-hover/bar:text-indigo-600 transition-colors shrink-0">{stats.activityTrend.labels[i]}</span>
                           </div>
                        );
                     })}
                  </div>
              </div>
           </div>

           {/* Detailed Analytics Row: Lost Reasons & Heatmap */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              
              {/* Lost Reasons (Pareto) */}
              <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full">
                 <div className="flex items-center justify-between mb-6">
                    <div className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 italic">
                       <AlertIcon className="text-rose-500" size={18} /> วิเคราะห์สาเหตุปิดดีลล้มเหลว
                    </div>
                 </div>
                 <div className="space-y-4 flex-1">
                    {!stats.teamLostReasons || stats.teamLostReasons.length === 0 ? (
                       <div className="flex items-center justify-center h-full text-[11px] font-black text-slate-400 uppercase">ไม่มีข้อมูลสาเหตุล้มเหลวในสัปดาห์นี้</div>
                    ) : (
                       stats.teamLostReasons.slice(0, 5).map((r, i) => {
                          const maxCount = Math.max(...stats.teamLostReasons.map(x => x.count), 1);
                          const w = Math.max((r.count / maxCount) * 100, 5);
                          return (
                             <div key={i} className="group/reason">
                                <div className="flex justify-between text-[11px] font-black text-slate-600 mb-1">
                                   <span className="truncate pr-4 group-hover/reason:text-rose-600 transition-colors">{r.reason}</span>
                                   <span>{r.count} ราย</span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-gradient-to-r from-rose-400 to-rose-300 rounded-full transition-all duration-1000" style={{ width: `${w}%` }} />
                                </div>
                             </div>
                          );
                       })
                    )}
                 </div>
              </div>

              {/* Activity Heatmap */}
              <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full">
                 <div className="flex items-center justify-between mb-6">
                    <div className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 italic">
                       <Timer className="text-amber-500" size={18} /> ช่วงเวลาทองของแอดมิน (Activity Heatmap)
                    </div>
                 </div>
                 <div className="flex items-end justify-between gap-1 flex-1 min-h-[140px] px-2">
                    {!stats.activityHeatmap ? (
                       <div className="flex items-center justify-center w-full text-[11px] font-black text-slate-400 uppercase">ไม่มีข้อมูล</div>
                    ) : (
                       stats.activityHeatmap.map((count, hour) => {
                          // Only show working hours 8 to 20 to save space, or all 24.
                          if (hour < 8 || hour > 20) return null;
                          const maxCount = Math.max(...stats.activityHeatmap, 1);
                          const h = Math.max((count / maxCount) * 100, count > 0 ? 5 : 0);
                          return (
                             <div key={hour} className="flex-1 flex flex-col items-center gap-2 group/heat h-full justify-end relative">
                                <div className="w-full flex justify-center items-end flex-1">
                                   <div 
                                      className={`w-full max-w-[12px] rounded-sm transition-all duration-700 ${count === 0 ? 'bg-slate-50' : count > maxCount*0.7 ? 'bg-amber-500' : count > maxCount*0.3 ? 'bg-amber-300' : 'bg-amber-100'}`}
                                      style={{ height: `${h}%` }}
                                   />
                                </div>
                                <span className="text-[9px] font-black text-slate-400">{hour}:00</span>
                                {count > 0 && (
                                   <div className="absolute -top-6 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/heat:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                                      {count} ครั้ง
                                   </div>
                                )}
                             </div>
                          );
                       })
                    )}
                 </div>
              </div>

           </div>

        </div>

        {/* Control Panel Section */}
        <div className="lg:col-span-4 self-start sticky top-0">
           
           {/* Lead Pool Management Card */}
           <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl shadow-indigo-500/20 text-white relative overflow-hidden group/lead flex flex-col justify-between">
              {refreshing && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] z-10" />}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-bl-[8rem] -mr-16 -mt-16 blur-3xl group-hover/lead:scale-125 transition-all duration-1000" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                 <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="text-2xl font-black italic tracking-tighter mb-1 uppercase">คลังรายชื่อ <span className="text-indigo-400">Inventory</span></div>
                        <p className="text-xs font-black text-white/40 uppercase tracking-[0.2em] italic">การจัดการสถานะดีลทั้งหมดในระบบ</p>
                    </div>
                    <div className="bg-indigo-500/20 p-4 rounded-2xl backdrop-blur-3xl border border-white/10 shadow-inner text-indigo-400 group-hover/lead:rotate-12 transition-transform"><Database size={32} /></div>
                 </div>
                 <div className="space-y-7">
                     <div className="space-y-3">
                        <div className="flex justify-between text-xs font-black uppercase tracking-[0.2em] mb-2 text-white/50">
                           <span>คัดกรองแบบ Funnel (Conversion Funnel)</span>
                        </div>
                        {/* Funnel Level 1: Master Pool */}
                        <div className="flex items-center justify-center group">
                           <div className="w-full h-8 bg-slate-800 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-slate-700 border border-slate-700">
                             <span className="text-[10px] font-black uppercase text-slate-400">คลังลูกค้า (Master)</span>
                             <span className="text-sm font-black">{stats.total}</span>
                           </div>
                        </div>
                        {/* Funnel Level 2: Pool */}
                        <div className="flex items-center justify-center group">
                           <div className="w-[85%] h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-indigo-500/40">
                             <span className="text-[10px] font-black uppercase text-indigo-300">สกรีนลูกค้า (Pool)</span>
                             <span className="text-sm font-black text-indigo-300">{stats.pool}</span>
                           </div>
                        </div>
                        {/* Funnel Level 3: Qualified */}
                        <div className="flex items-center justify-center group">
                           <div className="w-[65%] h-8 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-amber-500/40">
                             <span className="text-[10px] font-black uppercase text-amber-300">รอตัดสินใจ</span>
                             <span className="text-sm font-black text-amber-300">{stats.qualified}</span>
                           </div>
                        </div>
                        {/* Funnel Level 4: Customers */}
                        <div className="flex items-center justify-center group">
                           <div className="w-[45%] h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-emerald-500/40">
                             <span className="text-[10px] font-black uppercase text-emerald-300">ลูกค้าประจำ</span>
                             <span className="text-sm font-black text-emerald-300">{stats.customer}</span>
                           </div>
                        </div>
                     </div>
                    <div className="grid grid-cols-3 gap-3 pt-4 text-slate-100">
                       <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all group/card shadow-sm cursor-pointer active:scale-95">
                          <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em] mb-2 group-hover/card:text-indigo-400 transition-colors">สกรีนลูกค้า (Pool)</div>
                          <div className="text-2xl font-black tracking-tighter">{stats.pool}</div>
                       </div>
                       <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all group/card shadow-sm cursor-pointer active:scale-95">
                          <div className="text-[10px] font-black text-amber-400 uppercase tracking-[0.1em] mb-2">รอการตรวจสอบ</div>
                          <div className="text-2xl font-black tracking-tighter text-amber-400">{stats.unassigned || 0}</div>
                       </div>
                       <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all group/card shadow-sm cursor-pointer active:scale-95">
                          <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em] mb-2 group-hover/card:text-emerald-400 transition-colors">ลูกค้าประจำ</div>
                          <div className="text-2xl font-black text-emerald-400 tracking-tighter">{stats.customer}</div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

      </div>
      </div>

      {/* Admin Efficiency Audit Table (Full Width) */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative mt-6">
         {refreshing && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10" />}
         <div className="p-7 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
            <div>
               <div className="text-xl font-black text-slate-900 tracking-tighter italic uppercase flex items-center gap-3">
                  <ShieldCheck className="text-indigo-600" size={20} /> ตรวจสอบประสิทธิภาพรายบุคคล (Individual Efficiency Audit)
               </div>
               <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] mt-1 opacity-70 italic">อิงข้อมูลย้อนหลัง 6 สัปดาห์ล่าสุด และสถิติ Real-time</p>
            </div>
         </div>
         
         <div className="p-7">
            <div className="grid grid-cols-1 gap-2">
               {admins.map(admin => {
                  const detail = stats.weeklyStats?.adminDetails?.[admin.id] || { grade: 'C', followed: 0, converted: 0, rate: '0%' };
                  const status = stats.adminStatusMap?.[admin.id] || { status: 'offline', isActive: false, lastAction: 'ไม่มีกิจกรรม' };

                  return (
                     <div key={admin.id} className="group flex items-center gap-8 p-5 rounded-3xl hover:bg-indigo-50/40 transition-all border border-transparent hover:border-indigo-100 hover:shadow-lg hover:-translate-y-0.5">
                           <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg relative shrink-0" style={{ backgroundColor: admin?.color || '#6366f1' }}>
                              {admin?.name?.charAt(0) || 'A'}
                              
                             <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md border-2 border-white ${
                                detail.grade === 'A' ? 'bg-emerald-500' : detail.grade === 'B' ? 'bg-indigo-500' : 'bg-slate-400'
                             }`}>
                                {detail.grade}
                             </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-3">
                                <span className="text-base font-black text-slate-800 uppercase tracking-tight">{admin.name}</span>
                             </div>
                             <div className="text-[11px] font-bold text-slate-600 mt-1 truncate italic flex items-center gap-2">
                                <RotateCw size={10} className="animate-spin-slow" /> ล่าสุด: {status.lastAction}
                             </div>
                          </div>

                          <div className="hidden xl:flex items-center justify-center gap-3 flex-wrap">
                             {currentWeeks.map((w, idx) => {
                               const weekRate = adminWeeklyRates[admin.id]?.[idx];
                               return (
                                 <div
                                   key={idx}
                                   onClick={() => !isWeeklyLoading && setSelectedDetail({ admin, week: w, weekIndex: idx })}
                                   className={`px-4 py-2.5 rounded-2xl border transition-all duration-300 flex flex-col items-center min-w-[100px] ${
                                     idx === 5
                                       ? 'bg-indigo-600 text-white border-indigo-700 ring-4 ring-indigo-500/10 shadow-indigo-200'
                                       : 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100 hover:border-indigo-200'
                                   } ${!isWeeklyLoading ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'}`}
                                 >
                                   <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${idx === 5 ? 'text-white/70' : 'text-slate-400'}`}>{w.label}</span>
                                   {isWeeklyLoading ? (
                                     <div className={`h-4 w-8 rounded-md animate-pulse ${idx === 5 ? 'bg-white/30' : 'bg-slate-200'}`} />
                                   ) : (
                                     <span className={`text-base font-black tracking-tighter ${idx === 5 ? 'text-white' : weekRate && weekRate !== '-' ? 'text-indigo-600' : 'text-slate-400'}`}>
                                       {weekRate ?? '-'}
                                     </span>
                                   )}
                                 </div>
                               );
                             })}
                          </div>

                          <div className="w-40 text-right">
                             <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">{detail.rate}</div>
                             <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.1em] italic">{detail.followed} รายการบันทึก</div>
                          </div>

                          <button className="p-3 rounded-2xl text-slate-300 group-hover:text-indigo-600 hover:bg-white transition-all shrink-0 shadow-sm border border-transparent hover:border-slate-100"><ChevronRight size={20} /></button>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>

      {selectedDetail && <DetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />}
    </div>
  );
};

const DetailModal = ({ data, onClose }) => {
  const { admin, week } = data;
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setSummaryLoading(true);
      try {
        const endExclusive = new Date(week.end);
        endExclusive.setDate(endExclusive.getDate() + 1);
        endExclusive.setHours(0, 0, 0, 0);

        const s = await leadService.getWeeklyAdminSummary({
          adminId: admin.id,
          adminName: admin.name,
          startDate: week.start,
          endDate: endExclusive
        });
        if (!cancelled) setSummary(s);
      } catch (err) {
        console.error(err);
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [admin.id, admin.name, week.start, week.end]);

  const dailyData = summary?.daily || [];
  const totalFollowUps = dailyData.reduce((acc, curr) => acc + (curr.followUps || 0), 0);
  const totalNewLeads = dailyData.reduce((acc, curr) => acc + (curr.newLeads || 0), 0);

  const assignedFollowUps = summary?.assigned?.retention || 0;
  const assignedNew = summary?.assigned?.new || 0;
  const doneFollowUps = summary?.completed?.retention ?? totalFollowUps;
  const doneNew = summary?.completed?.new ?? totalNewLeads;

  const targetFollowUps = assignedFollowUps || doneFollowUps || 0;
  const targetNew = assignedNew || doneNew || 0;
  const completionPercent = targetFollowUps > 0 ? Math.round((doneFollowUps / targetFollowUps) * 100) : 0;

  const leadWon = summary?.outcomes?.lead?.won ?? 0;
  const leadLost = summary?.outcomes?.lead?.lost ?? 0;
  const leadPending = summary?.outcomes?.lead?.pending ?? 0;
  const retentionOrdered = summary?.outcomes?.retention?.ordered ?? 0;
  const retentionNotOrdered = summary?.outcomes?.retention?.not_ordered ?? 0;

  const leadLostReasons = summary?.reasons?.leadClosedLost || [];
  const retentionNotOrderedReasons = summary?.reasons?.retentionNotOrdered || [];

  const summaryText = (!summaryLoading && summary) ? [
    `สรุปผลงานรายสัปดาห์ - ${admin.name} (${week.label})`,
    `ลูกค้าใหม่: ได้รับมอบหมาย ${summary.assigned?.new || 0}, ติดตามแล้ว ${doneNew}, ปิดดีลได้ ${leadWon}, ปิดดีลล้มเหลว ${leadLost}, รอตัดสินใจ ${leadPending}`,
    `ติดตามลูกค้าเดิม: ได้รับมอบหมาย ${summary.assigned?.retention || 0}, ติดตามแล้ว ${doneFollowUps}, สั่งซื้อซ้ำสำเร็จ ${retentionOrdered}, ยังไม่สั่งซื้อซ้ำ ${retentionNotOrdered}`,
    '',
    'สาเหตุหลักที่ปิดดีลลูกค้าใหม่ไม่สำเร็จ:',
    ...(leadLostReasons.slice(0, 6).map(r => `- (${r.count}) ${r.reason}`) || ['- (ไม่มีข้อมูล)']),
    '',
    'สาเหตุหลักที่ลูกค้าเก่ายังไม่สั่งซื้อซ้ำ:',
    ...(retentionNotOrderedReasons.slice(0, 6).map(r => `- (${r.count}) ${r.reason}`) || ['- (ไม่มีข้อมูล)'])
  ].join('\n') : '';

  const handleCopySummary = async () => {
    if (!summaryText) return;
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportLiveHTML = async () => {
    setIsExporting(true);
    try {
      const endExclusive = new Date(week.end);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
      
      const reportData = await leadService.getWeeklyReportDataForExport(
         admin.id, admin.name, week.start, endExclusive, week.label, ''
      );
      if (reportData) {
         downloadWeeklyHTML(reportData);
      } else {
         alert('เกิดข้อผิดพลาด ไม่สามารถดึงรายงานได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรายงาน');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
       <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-300 relative">
          <button onClick={onClose} className="absolute top-8 right-8 p-3 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all z-10 shadow-sm border border-slate-200 cursor-pointer">
             <X size={24} />
          </button>
          
          <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/40">
             <div className="flex items-center gap-6 text-slate-900">
                <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-200" style={{ backgroundColor: admin?.color || '#6366f1' }}>{admin?.name?.charAt(0) || 'A'}</div>
                <div>
                   <div className="text-2xl font-black tracking-tighter uppercase mb-1">{admin.name}</div>
                   <div className="text-sm font-black text-indigo-600 uppercase tracking-widest italic flex items-center gap-2">
                       <Calendar size={14} /> ผลการทำงานในช่วงวันที่ {week.label}
                   </div>
                </div>
             </div>
          </div>

          <div className="p-10 overflow-y-auto max-h-[70vh] custom-scrollbar">
             {summaryLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                   <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                   <p className="text-sm font-bold text-slate-400 animate-pulse">กำลังประมวลผลสถิติรายบุคคล...</p>
                </div>
             ) : (
                <div className="space-y-8">
                   <div className="grid grid-cols-2 gap-6">
                      <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100/50 relative overflow-hidden group">
                         <Users className="absolute -right-4 -bottom-4 text-indigo-200/50 group-hover:scale-125 transition-transform" size={80} />
                         <div className="relative z-10">
                            <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 italic">ลูกค้าสนใจจริง (New Leads)</div>
                            <div className="flex items-end gap-2 mb-1">
                               <div className="text-3xl font-black text-slate-900 tracking-tighter">{doneNew}</div>
                               <div className="text-sm font-bold text-slate-400 pb-1 uppercase">จาก {targetNew} ราย</div>
                            </div>
                            <div className="text-xs font-bold text-indigo-600/60 uppercase tracking-wider">ประสิทธิภาพการติดตาม</div>
                         </div>
                      </div>
                      <div className="bg-emerald-50/50 p-6 rounded-[2.5rem] border border-emerald-100/50 relative overflow-hidden group">
                         <Target className="absolute -right-4 -bottom-4 text-emerald-200/50 group-hover:scale-125 transition-transform" size={80} />
                         <div className="relative z-10">
                            <div className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 italic">ติดตามลูกค้าประจำ (Retention)</div>
                            <div className="flex items-end gap-2 mb-1">
                               <div className="text-3xl font-black text-slate-900 tracking-tighter">{doneFollowUps}</div>
                               <div className="text-sm font-bold text-slate-400 pb-1 uppercase">จาก {targetFollowUps} ราย</div>
                            </div>
                            <div className="text-xs font-bold text-emerald-600/60 uppercase tracking-wider">อัตราการทำรายการสำเร็จ {completionPercent}%</div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-500/20">
                      <div className="flex items-center gap-3 mb-6">
                         <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 backdrop-blur-xl border border-white/5 shadow-inner"><Target size={20} /></div>
                         <div className="text-base font-black uppercase tracking-tighter italic">ผลลัพธ์เชิงกลยุทธ์ (Strategic Outcomes)</div>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">รายการที่สั่งซื้อ / ปิดดีลได้</div>
                            <div className="space-y-3">
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                  <span className="text-sm font-bold text-white/70 italic">ลูกค้าใหม่ (Won)</span>
                                  <span className="text-xl font-black text-indigo-400">{leadWon}</span>
                                </div>
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                  <span className="text-sm font-bold text-white/70 italic">ลูกค้าเดิมสั่งซ้ำ</span>
                                  <span className="text-xl font-black text-emerald-400">{retentionOrdered}</span>
                               </div>
                               <div className="flex justify-between items-center bg-indigo-50/10 p-3 rounded-2xl border border-indigo-400/20 mt-2">
                                  <span className="text-sm font-bold text-indigo-300 italic">ปรับเป็นลูกค้าประจำ</span>
                                  <span className="text-xl font-black text-indigo-400">{summary?.outcomes?.conversions?.newToRetention || 0}</span>
                               </div>
                               <div className="flex justify-between items-center bg-emerald-50/10 p-3 rounded-2xl border border-emerald-400/20">
                                  <span className="text-sm font-bold text-emerald-300 italic">เปลี่ยนเป็นรอตัดสินใจ</span>
                                  <span className="text-xl font-black text-emerald-400">{summary?.outcomes?.conversions?.newToFollowUp || 0}</span>
                               </div>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">รายการที่ยังไม่สำเร็จ</div>
                            <div className="space-y-3">
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                  <span className="text-sm font-bold text-white/70 italic">ใหม่ - ปิดดีลล้มเหลว</span>
                                  <span className="text-xl font-black text-rose-400">{leadLost}</span>
                               </div>
                               <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl border border-white/5">
                                  <span className="text-sm font-bold text-white/70 italic">เดิม - ยังไม่สั่งซ้ำ</span>
                                  <span className="text-xl font-black text-amber-400">{retentionNotOrdered}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="pt-2 space-y-3">
                       <button 
                         onClick={handleCopySummary}
                         className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95 group border-none cursor-pointer"
                       >
                          <Database size={20} className="group-hover:rotate-12 transition-transform" />
                          คัดล็อกข้อความสรุปรายงานผลงาน (Copy Summary Text)
                       </button>

                       <button 
                         onClick={handleExportLiveHTML}
                         disabled={isExporting}
                         className="w-full py-5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-sky-200 flex items-center justify-center gap-3 active:scale-95 group border-none cursor-pointer"
                       >
                          {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} className="group-hover:-translate-y-1 transition-transform" />}
                          {isExporting ? 'กำลังโหลดรายงาน...' : `ดาวน์โหลดรายงาน HTML (สัปดาห์ ${week.label})`}
                       </button>
                    </div>
                 </div>
              )}
           </div>
        </div>
     </div>
  );
};

export default ManagerDashboardView;
