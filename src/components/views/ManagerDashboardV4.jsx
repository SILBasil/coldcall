import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Users, PhoneCall, CheckCircle2, Award,
  ChevronRight, ChevronLeft, Loader2, Database, RotateCw, AlertCircle,
  Target, Flame, Zap, Medal, Calendar, ShieldCheck, BarChart3, Activity,
  UserX, ArrowUpRight, ArrowDownRight, Minus, Bell, Clock,
  UserCheck, Package, ArrowRight, PieChart, Repeat
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { ManagerSkeleton } from '../common/Skeleton';
import { downloadWeeklyHTML } from '../../utils/htmlExporter';

// ─── Status color map (from V1) ──────────────────────────────────────────────
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

// ─── Utility ─────────────────────────────────────────────────────────────────
const GrowthBadge = ({ val }) => {
  if (val === null || val === undefined) return null;
  const v = parseFloat(val);
  if (v > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-black"><ArrowUpRight size={10} />{v}%</span>;
  if (v < 0) return <span className="flex items-center gap-0.5 text-rose-500 text-[10px] font-black"><ArrowDownRight size={10} />{v}%</span>;
  return <span className="flex items-center gap-0.5 text-slate-400 text-[10px] font-black"><Minus size={10} />0%</span>;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ManagerDashboardV4 = () => {
  const [stats, setStats] = useState({
    pool: 0, qualified: 0, customer: 0, total: 0, newLeadsToday: 0, lost: 0,
    recentLogs: [],
    weeklyStats: {
      efficiency: '0%', efficiencyGrowth: '0',
      followUps: 0, followUpsTotal: 0, followUpsGrowth: '0',
      newCustomers: 0, newCustomersGrowth: '0',
      leaderboard: [],
      adminDetails: {}
    },
    activityTrend: { labels: [], counts: [] },
    frequencyStats: {},
    teamCallOutcomes: [],
    growthStats: {},
    weeklyFunnelFlow: {},
    categoryBreakdown: {}
  });
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminWeeklyRates, setAdminWeeklyRates] = useState({});
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState('week');
  const [churnStats, setChurnStats] = useState({
    lostCount: 0, activeRatio: 100, totalCustomersCount: 0, activeCount: 0,
    reasonsBreakdown: {}, weeklyReports: [],
    weeklyVarianceText: 'สถิติคงที่เทียบกับสัปดาห์ก่อน',
    weeklyVarianceClass: 'bg-slate-50 text-slate-600',
    loading: true
  });
  const dateInputRef = useRef(null);

  // ─── Period Helpers ────────────────────────────────────────────────────────
  const getPeriodLabels = (referenceDate, currentMode, numPeriods = 6) => {
    if (currentMode === 'month') {
      const months = [];
      for (let i = 0; i < numPeriods; i++) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - ((numPeriods - 1) - i), 1);
        months.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0), label: d.toLocaleDateString('th-TH', { month: 'short' }) });
      }
      return months;
    } else {
      const day = referenceDate.getDay();
      const diff = referenceDate.getDate() - (day === 0 ? 6 : day - 1);
      const referenceMonday = new Date(referenceDate);
      referenceMonday.setDate(diff);
      referenceMonday.setHours(0, 0, 0, 0);
      const weeks = [];
      for (let i = 0; i < numPeriods; i++) {
        const start = new Date(referenceMonday);
        start.setDate(referenceMonday.getDate() - (i * 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        weeks.push({ start, end, label: start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }) });
      }
      return weeks.reverse();
    }
  };

  const currentPeriods = getPeriodLabels(baseDate, mode, 6);

  const dateRangeStr = stats.periodLabel || (
    mode === 'month'
      ? baseDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
      : (() => {
          const day = baseDate.getDay();
          const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
          const start = new Date(baseDate); start.setDate(diff); start.setHours(0, 0, 0, 0);
          const end = new Date(start); end.setDate(start.getDate() + 6);
          return `${start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
        })()
  );

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const fetchHistoryData = async (refDate, currentMode) => {
    setIsWeeklyLoading(true);
    setIsHistoryLoading(true);
    try {
      const numPeriods = 6;
      const periodStarts = [];
      if (currentMode === 'month') {
        for (let i = 0; i < numPeriods; i++) {
          const d = new Date(refDate.getFullYear(), refDate.getMonth() - ((numPeriods - 1) - i), 1, 0, 0, 0, 0);
          periodStarts.push(d);
        }
      } else {
        const day = refDate.getDay();
        const diff = refDate.getDate() - (day === 0 ? 6 : day - 1);
        const refMonday = new Date(refDate);
        refMonday.setDate(diff);
        refMonday.setHours(0, 0, 0, 0);
        for (let i = 0; i < numPeriods; i++) {
          const d = new Date(refMonday);
          d.setDate(refMonday.getDate() - ((numPeriods - 1) - i) * 7);
          periodStarts.push(d);
        }
      }
      const historyResults = await Promise.all(periodStarts.map(start => leadService.getStats(start, currentMode)));
      setHistoryData(historyResults);

      const ratesMap = {};
      const allUsers = await leadService.getUsers();
      const adminList = allUsers.filter(u => u.role === 'admin');
      adminList.forEach(a => { ratesMap[a.id] = Array(numPeriods).fill('-'); });
      historyResults.forEach((periodData, periodIdx) => {
        const adminDetails = periodData.weeklyStats?.adminDetails || {};
        Object.entries(adminDetails).forEach(([adminId, entry]) => {
          if (ratesMap[adminId]) ratesMap[adminId][periodIdx] = entry.rate || '0%';
        });
      });
      setAdminWeeklyRates(ratesMap);
    } catch (err) {
      console.error('fetchHistoryData error:', err);
    } finally {
      setIsWeeklyLoading(false);
      setIsHistoryLoading(false);
    }
  };

  const fetchChurnStats = async () => {
    try {
      const res = await leadService.getLostCustomers(null);
      const rawRes = await leadService.getCustomersByStage('customer', null, 1, 1000);
      const portfolioCount = rawRes.pagination?.total || 0;
      const reports = await leadService.getWeeklyLostReports?.() || [];
      const lostCount = res.total;
      const activeCount = Math.max(0, portfolioCount - lostCount);
      const activeRatio = portfolioCount > 0 ? Math.round((activeCount / portfolioCount) * 100) : 100;

      let weeklyVarianceText = 'สถิติคงที่เทียบกับสัปดาห์ก่อน';
      let weeklyVarianceClass = 'bg-slate-50 text-slate-600';
      if (reports.length >= 2) {
        const diff = (reports[0].lostCount || 0) - (reports[1].lostCount || 0);
        if (diff > 0) { weeklyVarianceText = `เพิ่มขึ้น +${diff} รายจากสัปดาห์ก่อน`; weeklyVarianceClass = 'bg-rose-50 text-rose-600 border border-rose-100'; }
        else if (diff < 0) { weeklyVarianceText = `ลดลง ${diff} รายจากสัปดาห์ก่อน`; weeklyVarianceClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100'; }
      }

      setChurnStats({ lostCount, activeRatio, totalCustomersCount: portfolioCount, activeCount, reasonsBreakdown: res.reasonsBreakdown || {}, weeklyReports: reports, weeklyVarianceText, weeklyVarianceClass, loading: false });
    } catch (err) {
      console.error('fetchChurnStats error:', err);
      setChurnStats(s => ({ ...s, loading: false }));
    }
  };

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await leadService.getStats(baseDate, mode);
      setStats(data);
      await fetchHistoryData(baseDate, mode);
      await fetchChurnStats();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    leadService.getUsers().then(all => setAdmins(all.filter(u => u.role === 'admin'))).catch(() => {});
  }, []);

  useEffect(() => { fetchStats(); }, [baseDate, mode]);

  const navigatePeriod = (dir) => {
    const nextDate = new Date(baseDate);
    if (mode === 'month') nextDate.setMonth(baseDate.getMonth() + dir);
    else nextDate.setDate(baseDate.getDate() + dir * 7);
    setBaseDate(nextDate);
  };

  // ─── Growth Chart (from V1) ────────────────────────────────────────────────
  const renderGrowthChart = () => {
    if (isHistoryLoading || historyData.length === 0) {
      return <div className="h-48 flex flex-col items-center justify-center gap-3"><Loader2 className="w-8 h-8 text-sky-500 animate-spin" /><p className="text-xs font-bold text-slate-400">กำลังประมวลผลข้อมูล...</p></div>;
    }
    const numPoints = historyData.length;
    const maxVal = Math.max(
      ...historyData.map(h => h.growthStats?.newCustomersCount || 0),
      ...historyData.map(h => h.growthStats?.pendingDecisionCount || 0),
      ...historyData.map(h => h.growthStats?.regularFollowUps || 0),
      ...historyData.map(h => h.growthStats?.regularLostCount || 0),
      4
    );
    const getX = (i) => 45 + (i / (numPoints - 1)) * 410;
    const getY = (v) => 20 + (1 - v / maxVal) * 130;
    let nL = '', pL = '', rL = '', lL = '', nA = '', pA = '', rA = '', lA = '';
    historyData.forEach((h, i) => {
      const x = getX(i);
      const vN = h.growthStats?.newCustomersCount || 0;
      const vP = h.growthStats?.pendingDecisionCount || 0;
      const vR = h.growthStats?.regularFollowUps || 0;
      const vL = h.growthStats?.regularLostCount || 0;
      if (i === 0) {
        nL = `M ${x} ${getY(vN)}`; pL = `M ${x} ${getY(vP)}`; rL = `M ${x} ${getY(vR)}`; lL = `M ${x} ${getY(vL)}`;
        nA = `M ${x} 150 L ${x} ${getY(vN)}`; pA = `M ${x} 150 L ${x} ${getY(vP)}`; rA = `M ${x} 150 L ${x} ${getY(vR)}`; lA = `M ${x} 150 L ${x} ${getY(vL)}`;
      } else {
        nL += ` L ${x} ${getY(vN)}`; pL += ` L ${x} ${getY(vP)}`; rL += ` L ${x} ${getY(vR)}`; lL += ` L ${x} ${getY(vL)}`;
        nA += ` L ${x} ${getY(vN)}`; pA += ` L ${x} ${getY(vP)}`; rA += ` L ${x} ${getY(vR)}`; lA += ` L ${x} ${getY(vL)}`;
      }
      if (i === numPoints - 1) {
        nA += ` L ${x} 150 Z`; pA += ` L ${x} 150 Z`; rA += ` L ${x} 150 Z`; lA += ` L ${x} 150 Z`;
      }
    });
    return (
      <div className="w-full font-sans">
        <div className="flex items-center gap-4 mb-3 text-[10px] font-black uppercase tracking-wider flex-wrap">
          {[['#0ea5e9','ลูกค้าใหม่'],['#f59e0b','รอตัดสินใจ'],['#10b981','ตามลูกค้าประจำ'],['#f43f5e','ประจำที่หาย']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-full" style={{background:c}} /><span className="text-slate-600">{l}</span></div>
          ))}
        </div>
        <svg viewBox="0 0 500 180" className="w-full overflow-visible select-none">
          <defs>
            {[['newCustGrad','#0ea5e9'],['pendDecGrad','#f59e0b'],['regFollGrad','#10b981'],['regLostGrad','#f43f5e']].map(([id,c]) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.15" />
                <stop offset="100%" stopColor={c} stopOpacity="0.0" />
              </linearGradient>
            ))}
          </defs>
          {[0,0.25,0.5,0.75,1].map((r,i) => <line key={i} x1="45" y1={20+r*130} x2="455" y2={20+r*130} stroke="#f1f5f9" strokeWidth="1" />)}
          {nA && <path d={nA} fill="url(#newCustGrad)" />}
          {pA && <path d={pA} fill="url(#pendDecGrad)" />}
          {rA && <path d={rA} fill="url(#regFollGrad)" />}
          {lA && <path d={lA} fill="url(#regLostGrad)" />}
          {nL && <path d={nL} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {pL && <path d={pL} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {rL && <path d={rL} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {lL && <path d={lL} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          <text x="35" y={getY(0)} textAnchor="end" fontSize="9" fill="#94a3b8">0</text>
          <text x="35" y={getY(maxVal/2)} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxVal/2)}</text>
          <text x="35" y={getY(maxVal)} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxVal)}</text>
          {historyData.map((h, i) => {
            const x = getX(i);
            const vN = h.growthStats?.newCustomersCount || 0;
            const vP = h.growthStats?.pendingDecisionCount || 0;
            const vR = h.growthStats?.regularFollowUps || 0;
            const vL = h.growthStats?.regularLostCount || 0;
            const label = mode === 'month' ? (h.periodLabel?.split(' ')[0]?.substring(0,3) || '') : `W${i+1}`;
            return (
              <g key={i}>
                <text x={x} y="168" textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>
                {[{y:getY(vN),s:'#0ea5e9'},{y:getY(vP),s:'#f59e0b'},{y:getY(vR),s:'#10b981'},{y:getY(vL),s:'#f43f5e'}].map(({y,s},di) => (
                  <circle key={di} cx={x} cy={y} r="3.5" fill="#fff" stroke={s} strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  if (loading && !refreshing) return <ManagerSkeleton />;

  const eff = stats.weeklyStats?.efficiency || '0%';
  const effGrowth = parseFloat(stats.weeklyStats?.efficiencyGrowth || '0');
  const followsDone = stats.weeklyStats?.followUps || 0;
  const followsTotal = stats.weeklyStats?.followUpsTotal || 0;
  const newCust = stats.weeklyStats?.newCustomers || 0;
  const newCustGrowth = parseFloat(stats.weeklyStats?.newCustomersGrowth || '0');
  const trendCounts = historyData.map(h => h.weeklyStats?.followUps || 0);
  const trendMax = Math.max(...trendCounts, 1);

  return (
    <div className={`space-y-6 max-w-[1600px] mx-auto pb-8 ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>

      {/* ══════════════════════════════════════════════════════
          HEADER — Combined V1+V2 style
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
          <span className="text-base font-black text-indigo-600 uppercase tracking-widest italic">
            แดชบอร์ด <span className="text-slate-800">V4</span> · Unified Monitoring Center
          </span>
          {refreshing && <Loader2 size={14} className="text-indigo-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period nav */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-xs">
            <button onClick={() => navigatePeriod(-1)} className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-500 border-r border-slate-100"><ChevronLeft size={14} /></button>
            <button onClick={() => dateInputRef.current?.showPicker()} className="px-3 py-1.5 font-black text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
              <Calendar size={11} className="text-indigo-500" />{dateRangeStr}
            </button>
            <input ref={dateInputRef} type="date" className="absolute opacity-0 pointer-events-none w-0" onChange={e => e.target.value && setBaseDate(new Date(e.target.value))} />
            <button onClick={() => navigatePeriod(1)} className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-500 border-l border-slate-100"><ChevronRight size={14} /></button>
          </div>
          {/* Mode toggle */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-[11px] font-black">
            <button onClick={() => { setMode('week'); setBaseDate(new Date()); }} className={`px-3 py-1.5 transition-all ${mode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>สัปดาห์</button>
            <button onClick={() => { setMode('month'); setBaseDate(new Date()); }} className={`px-3 py-1.5 transition-all ${mode === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>เดือน</button>
          </div>
          <button onClick={() => setBaseDate(new Date())} className="px-2.5 py-1.5 text-[11px] font-black bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all shadow-sm">วันนี้</button>
          <button onClick={() => fetchStats(true)} className={`p-1.5 rounded-xl border border-slate-200 bg-white shadow-sm ${refreshing ? 'animate-spin text-indigo-500' : 'text-slate-400 hover:text-indigo-600'} transition-all`}><RotateCw size={13} /></button>
          <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm text-xs font-black">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-slate-500">{admins.length} แอดมิน</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 1: KPI STRIP (from V1 Hero Cards style)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: `ลูกค้าใหม่วันนี้ (Bot)`, value: stats.newLeadsToday || 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'รายชื่อใหม่เข้าระบบวันนี้', trend: null },
          { label: `ประสิทธิภาพปิดดีล`, value: eff, icon: Target, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'เทียบกับช่วงเวลาก่อนหน้า', trend: effGrowth },
          { label: `งานติดตาม (Done)`, value: `${followsDone}/${followsTotal}`, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'สัดส่วนงานที่เรียบร้อย', trend: null },
          { label: `ลูกค้าหาย (Lost)`, value: churnStats.lostCount, icon: UserX, color: 'text-rose-600', bg: 'bg-rose-50', sub: `Churn ${100 - churnStats.activeRatio}%`, trend: null },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-3 rounded-2xl ${s.bg} shadow-inner`}><s.icon size={20} className={s.color} /></div>
              {s.trend !== null && <GrowthBadge val={s.trend} />}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</div>
            <div className="text-2xl font-black text-slate-900 tracking-tighter mb-1">{s.value}</div>
            <div className="text-[10px] font-bold italic text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 2: DEAL FLOW FUNNEL (from V1)
      ══════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[2.5rem] p-7 shadow-2xl shadow-indigo-900/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-bl-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 italic">
                <Flame className="text-amber-400" size={18} /> สรุปความเคลื่อนไหวของดีล ประจำ{mode === 'week' ? 'สัปดาห์' : 'เดือน'}นี้
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">
                Bot Processed → ลูกค้าสนใจจริง → รอตัดสินใจ → ลูกค้าประจำ
              </p>
            </div>
            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/20 px-3 py-1.5 rounded-full border border-indigo-500/30">{mode === 'week' ? 'สัปดาห์' : 'เดือน'}นี้</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'บอทช่วยสกรีน', val: stats.weeklyFunnelFlow?.botProcessed ?? stats.pool ?? 0, sub: 'นำเข้าจากคลังคัดกรอง', icon: Database, color: 'text-slate-300', bg: 'bg-slate-500/30', border: 'border-white/10 bg-white/5' },
              { label: 'ลูกค้าสนใจจริง', val: stats.weeklyFunnelFlow?.toQualified ?? 0, sub: 'pool → รับเรื่อง/ติดต่อกลับ', icon: Users, color: 'text-indigo-300', bg: 'bg-indigo-500/30', border: 'border-indigo-500/20 bg-indigo-500/10' },
              { label: 'รอตัดสินใจ', val: stats.weeklyFunnelFlow?.toDecision ?? 0, sub: 'อยู่ระหว่างยื่นข้อเสนอ', icon: Clock, color: 'text-amber-300', bg: 'bg-amber-500/30', border: 'border-amber-500/20 bg-amber-500/10' },
              { label: 'ลูกค้าประจำ', val: stats.weeklyFunnelFlow?.toCustomer ?? 0, sub: 'ปิดยอดสำเร็จ', icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/30', border: 'border-emerald-500/20 bg-emerald-500/10' },
            ].map((item, i) => (
              <div key={i} className={`${item.border} border rounded-2xl p-5 hover:brightness-110 transition-all`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`}><item.icon size={16} className={item.color} /></div>
                  <span className={`text-[9px] font-black ${item.color} opacity-70 uppercase tracking-widest`}>{item.label}</span>
                </div>
                <div className={`text-3xl font-black ${item.color} tracking-tighter`}>{item.val}</div>
                <div className={`text-[10px] font-black ${item.color} opacity-60 mt-1`}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div className="hidden md:flex items-center justify-center gap-2 mt-4 text-white/20">
            {['คลังคัดกรอง','ลูกค้าสนใจจริง','รอตัดสินใจ','ลูกค้าประจำ'].map((l,i,a) => (
              <React.Fragment key={l}>
                <span className="text-[10px] font-black uppercase tracking-widest">{l}</span>
                {i < a.length - 1 && <ChevronRight size={14} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 3: TUBE CHART (V1 EXACT) + GROWTH CHART (V1 EXACT)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── รายงานสถานะงานลูกค้าประจำ (TUBE CHART — V1 EXACT, ห้ามเปลี่ยน) ── */}
        <div className="lg:col-span-7 bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group/cat">
          <div className="border-b border-slate-50 pb-4 mb-5 flex items-center justify-between">
            <div>
              <div className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
                <Database className="text-primary animate-pulse" size={18} /> รายงานสถานะงานลูกค้าประจำ (Regular Customer Status by Call Frequency)
              </div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">
                รายงานความถี่การติดตาม: ซื้อแล้ว, รอติดตาม, หาย (ไม่รับสาย/ไม่ซื้อ) และคงเหลือ
              </p>
            </div>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-wider flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ซื้อ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> ติดตาม</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> หาย</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> เหลือ</span>
            </div>
          </div>

          {(() => {
            const freqData = stats.frequencyStats || {
              '1w': { label: '1 สัปดาห์', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              '2w': { label: '2 สัปดาห์', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              '3w': { label: '3 สัปดาห์', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              '1m': { label: '1 เดือน', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              '2m': { label: '2 เดือน', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              '3m': { label: '3 เดือน', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 },
              'other': { label: 'อื่น ๆ', total: 0, bought: 0, lost: 0, followup: 0, remaining: 0 }
            };
            const maxTotal = Math.max(...Object.values(freqData).map(g => g.total), 1);
            return (
              <div className="flex-1 flex flex-col justify-end min-h-[260px] relative mt-4">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.05] mb-8">
                  <div className="border-t border-slate-900 w-full" />
                  <div className="border-t border-slate-900 w-full" />
                  <div className="border-t border-slate-900 w-full" />
                  <div className="border-t border-slate-900 w-full" />
                </div>
                <div className="flex items-end justify-between gap-2 h-52 px-2 relative z-10">
                  {Object.entries(freqData).map(([key, g]) => {
                    const barHeightPct = g.total > 0 ? Math.max(10, (g.total / maxTotal) * 100) : 0;
                    return (
                      <div key={key} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {g.total > 0 && (
                          <span className="text-[10px] font-black text-slate-700 mb-1.5 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md shadow-sm opacity-90 transition-all group-hover:scale-110">
                            {g.total}
                          </span>
                        )}
                        <div
                          style={{ height: g.total > 0 ? `${barHeightPct}%` : '8px' }}
                          className={`w-10 rounded-xl overflow-hidden flex flex-col justify-end shadow-md transition-all duration-500 border border-slate-200/50 hover:shadow-lg hover:scale-105 cursor-pointer ${g.total === 0 ? 'bg-slate-50 border-dashed border-slate-300' : ''}`}
                        >
                          {g.total > 0 ? (
                            <>
                              {g.remaining > 0 && <div style={{ height: `${(g.remaining / g.total) * 100}%` }} className="w-full bg-gradient-to-t from-slate-300 to-slate-200" title={`คงเหลือ: ${g.remaining}`} />}
                              {g.lost > 0 && <div style={{ height: `${(g.lost / g.total) * 100}%` }} className="w-full bg-gradient-to-t from-rose-500 to-rose-400" title={`หาย: ${g.lost}`} />}
                              {g.followup > 0 && <div style={{ height: `${(g.followup / g.total) * 100}%` }} className="w-full bg-gradient-to-t from-amber-500 to-amber-400" title={`ติดตาม: ${g.followup}`} />}
                              {g.bought > 0 && <div style={{ height: `${(g.bought / g.total) * 100}%` }} className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400" title={`ซื้อ: ${g.bought}`} />}
                            </>
                          ) : <div className="w-full h-full bg-transparent" />}
                        </div>
                        <span className="text-[10px] font-black text-slate-600 mt-2.5 truncate max-w-full text-center">{g.label}</span>
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl w-60 border border-slate-800 text-xs font-sans">
                          <div className="font-extrabold border-b border-white/10 pb-1.5 mb-2.5 text-sm tracking-tight flex items-center justify-between">
                            <span>📊 ความถี่: {g.label}</span>
                            <span className="text-slate-400 font-extrabold">{g.total} ราย</span>
                          </div>
                          <div className="space-y-2 font-bold">
                            {[['emerald-400','สั่งซื้อสำเร็จ (ซื้อ)',g.bought],['amber-400','รอติดตาม (ติดตาม)',g.followup],['rose-400','หาย (ไม่รับ/ไม่ซื้อ)',g.lost],['slate-400','คงเหลือ (ยังไม่ทำ)',g.remaining]].map(([c,l,v]) => (
                              <div key={l} className="flex justify-between items-center">
                                <span className="flex items-center gap-1.5 text-slate-300"><span className={`w-2 h-2 rounded-full bg-${c}`} />{l}</span>
                                <span className={`text-${c} font-black`}>{v} ({g.total > 0 ? Math.round((v / g.total) * 100) : 0}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Growth Trend Chart (from V1) */}
        <div className="lg:col-span-5 bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="border-b border-slate-50 pb-4 mb-4">
            <div className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
              <TrendingUp className="text-emerald-500 animate-pulse" size={18} /> กราฟแนวโน้มความเติบโต (Growth Trend)
            </div>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">
              รายงานเติบโต 6 {mode === 'month' ? 'เดือน' : 'สัปดาห์'} ล่าสุด
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center">{renderGrowthChart()}</div>
          <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 mt-4 text-center">
            {[
              ['sky','ลูกค้าใหม่',stats.growthStats?.newCustomersCount||0],
              ['amber','รอตัดสินใจ',stats.growthStats?.pendingDecisionCount||0],
              ['emerald','ตามประจำ',stats.growthStats?.regularFollowUps||0],
              ['rose','ประจำหาย',stats.growthStats?.regularLostCount||0],
            ].map(([c,l,v]) => (
              <div key={l} className={`bg-${c}-50/50 p-2.5 rounded-2xl border border-${c}-100`}>
                <div className={`text-[9px] font-black text-${c}-600 uppercase tracking-tight`}>{l}</div>
                <div className={`text-base font-black text-${c}-700 mt-0.5`}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 4: COMPACT V2 SECTION — Mini Trend + Call Outcomes
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deal Flow (V2) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <Flame size={12} className="text-amber-500" /> ความเคลื่อนไหวดีล{mode === 'week' ? 'สัปดาห์' : 'เดือน'}นี้
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'สกรีนคลัง', val: stats.weeklyFunnelFlow?.botProcessed ?? stats.pool ?? 0, color: 'text-slate-600', bg: 'bg-slate-100' },
              { label: 'ลูกค้าสนใจ', val: stats.weeklyFunnelFlow?.toQualified ?? 0, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'รอตัดสินใจ', val: stats.weeklyFunnelFlow?.toDecision ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'ปิดดีลได้', val: stats.weeklyFunnelFlow?.toCustomer ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((item, i) => (
              <div key={i} className={`${item.bg} rounded-xl p-3`}>
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{item.label}</div>
                <div className={`text-2xl font-black ${item.color} tracking-tighter`}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini Trend (V2) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <BarChart3 size={12} className="text-indigo-500" /> แนวโน้มงานติดตาม (6 {mode === 'week' ? 'สัปดาห์' : 'เดือน'})
          </div>
          {isWeeklyLoading ? (
            <div className="h-20 flex items-center justify-center"><Loader2 size={16} className="text-indigo-400 animate-spin" /></div>
          ) : (
            <div className="flex items-end gap-1.5 h-20">
              {trendCounts.map((c, i) => {
                const h = Math.max((c / trendMax) * 100, c > 0 ? 8 : 3);
                const isLast = i === trendCounts.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <div className={`w-full rounded-md transition-all duration-500 ${isLast ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-300'}`} style={{ height: `${h}%` }} title={`${currentPeriods[i]?.label}: ${c}`} />
                    <span className={`text-[8px] font-black ${isLast ? 'text-indigo-600' : 'text-slate-400'} truncate w-full text-center`}>{currentPeriods[i]?.label?.split(' ')[0] || `W${i+1}`}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center">
            {[['ลูกค้าใหม่','sky',stats.growthStats?.newCustomersCount||0],['ตามประจำ','emerald',stats.growthStats?.regularFollowUps||0],['ประจำหาย','rose',stats.growthStats?.regularLostCount||0]].map(([l,c,v]) => (
              <div key={l}><div className="text-[8px] font-black text-slate-400 uppercase">{l}</div><div className={`text-sm font-black text-${c}-600`}>{v}</div></div>
            ))}
          </div>
        </div>

        {/* Call Outcomes (V1-style) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
            <PhoneCall size={12} className="text-amber-500" /> ผลลัพธ์การเจรจา (Call Outcomes)
          </div>
          <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner mb-4">
            {(() => {
              const outcomes = stats.teamCallOutcomes || [];
              const total = outcomes.reduce((acc, curr) => acc + curr.count, 0);
              if (total === 0) return <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-slate-400">ไม่มีข้อมูล</div>;
              const colorMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
              return outcomes.map((o, idx) => (
                <div key={idx} className={`${colorMap[o.color] || 'bg-slate-500'} h-full flex items-center justify-center text-[8px] font-black text-white/90`} style={{ width: `${(o.count / total) * 100}%` }}>
                  {Math.round((o.count / total) * 100)}%
                </div>
              ));
            })()}
          </div>
          <div className="space-y-1.5">
            {(stats.teamCallOutcomes || []).map((o, idx) => {
              const bgMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
              return (
                <div key={idx} className="flex items-center justify-between text-[10px] font-black">
                  <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${bgMap[o.color] || 'bg-slate-500'}`} /><span className="text-slate-600">{o.label}</span></div>
                  <span className="text-slate-400">{o.count} ครั้ง</span>
                </div>
              );
            })}
            {(!stats.teamCallOutcomes || stats.teamCallOutcomes.length === 0) && (
              <div className="text-center text-slate-400 text-[10px] font-bold italic py-4">ไม่มีข้อมูลในช่วงเวลานี้</div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 5: ADMIN PERFORMANCE TABLE (V2 style) + INVENTORY PYRAMID (V1 EXACT)
      ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Admin Performance Table */}
        <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <span className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Medal size={14} className="text-amber-500" /> ประสิทธิภาพรายบุคคล (6 {mode === 'week' ? 'สัปดาห์' : 'เดือน'})
            </span>
            {isWeeklyLoading && <Loader2 size={14} className="animate-spin text-indigo-400" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-black">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-left text-[9px] text-slate-400 uppercase tracking-widest">แอดมิน</th>
                  {currentPeriods.map((p, i) => (
                    <th key={i} className="px-3 py-3 text-center text-[9px] text-slate-400 uppercase tracking-widest">{p.label}</th>
                  ))}
                  <th className="px-3 py-3 text-center text-[9px] text-slate-400 uppercase tracking-widest">สัปดาห์นี้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {admins.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400 italic">ไม่มีข้อมูลแอดมิน</td></tr>
                ) : admins.map((admin, i) => {
                  const rates = adminWeeklyRates[admin.id] || Array(6).fill('-');
                  const currentRate = stats.weeklyStats?.adminDetails?.[admin.id]?.rate || '-';
                  return (
                    <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-sm" style={{ background: admin.color || '#6366f1' }}>
                            {admin.name?.charAt(0)}
                          </div>
                          <span className="text-slate-800 font-black">{admin.name}</span>
                        </div>
                      </td>
                      {rates.map((rate, ri) => (
                        <td key={ri} className="px-3 py-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${rate === '-' ? 'text-slate-300' : parseFloat(rate) >= 50 ? 'bg-emerald-50 text-emerald-700' : parseFloat(rate) >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{rate}</span>
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${currentRate === '-' ? 'text-slate-300' : parseFloat(currentRate) >= 50 ? 'bg-emerald-100 text-emerald-700' : parseFloat(currentRate) >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{currentRate}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* คลังรายชื่อ Inventory — INVERTED PYRAMID (V1 EXACT, ห้ามเปลี่ยน) */}
        <div className="lg:col-span-4 self-start sticky top-0">
          <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl shadow-indigo-500/20 text-white relative overflow-hidden group/lead flex flex-col justify-between">
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
                  {/* Funnel Level 5: Lost Customers */}
                  <div className="flex items-center justify-center group">
                    <div className="w-[30%] h-8 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-rose-500/40">
                      <span className="text-[10px] font-black uppercase text-rose-300">หาย (Lost)</span>
                      <span className="text-sm font-black text-rose-300">{stats.lost || churnStats.lostCount}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 text-slate-100">
                  {[
                    { label: 'สกรีนลูกค้า (Pool)', val: stats.pool, color: 'group-hover/card:text-indigo-400' },
                    { label: 'รอการตรวจสอบ', val: stats.unassigned || 0, color: 'text-amber-400' },
                    { label: 'ลูกค้าประจำ', val: stats.customer, color: 'group-hover/card:text-emerald-400', valColor: 'text-emerald-400' },
                    { label: 'ลูกค้าหาย (Lost)', val: stats.lost || churnStats.lostCount, color: 'group-hover/card:text-rose-400', valColor: 'text-rose-400' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all group/card shadow-sm cursor-pointer active:scale-95">
                      <div className={`text-[10px] font-black text-white/40 uppercase tracking-[0.1em] mb-2 ${item.color} transition-colors`}>{item.label}</div>
                      <div className={`text-2xl font-black tracking-tighter ${item.valColor || ''}`}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 6: CHURN & LOST ANALYSIS (from V1)
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="text-xl font-black text-slate-900 tracking-tighter italic uppercase flex items-center gap-3">
            <UserX className="text-rose-500" size={20} /> วิเคราะห์และรายงานลูกค้าที่หยุดเคลื่อนไหว (Churn &amp; Lost Customers Portfolio)
          </div>
          <p className="text-xs font-black text-slate-600 mt-1 opacity-70 italic">
            สรุปข้อมูลลูกค้าประจำที่มีสถานะหยุดเคลื่อนไหว เพื่อวิเคราะห์อัตราการสูญเสียลูกค้า (Churn Rate)
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: 'ลูกค้าหยุดเคลื่อนไหว (Total Lost)', val: `${churnStats.lostCount} ราย`, color: 'text-slate-800', icon: UserX, iconBg: 'bg-rose-50 text-rose-500', sub: <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${churnStats.weeklyVarianceClass}`}>{churnStats.weeklyVarianceText}</span> },
            { label: 'Active Retention Rate', val: `${churnStats.activeRatio}%`, color: 'text-emerald-600', icon: Award, iconBg: 'bg-emerald-50 text-emerald-500', sub: <span className="text-[10px] font-bold text-slate-500">สั่งซื้อต่อเนื่อง <strong className="text-emerald-600">{churnStats.activeCount}/{churnStats.totalCustomersCount}</strong> ราย</span> },
            { label: 'ลูกค้าประจำทั้งหมด (Retention Portfolio)', val: `${churnStats.totalCustomersCount} ราย`, color: 'text-slate-700', icon: Repeat, iconBg: 'bg-sky-50 text-primary', sub: <span className="text-[10px] font-bold text-slate-500">อัตราหยุดเคลื่อนไหวสะสม <strong className="text-rose-600">{churnStats.totalCustomersCount > 0 ? Math.round((churnStats.lostCount/churnStats.totalCustomersCount)*100) : 0}%</strong></span> },
          ].map((s,i) => (
            <div key={i} className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 shadow-inner hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                  <h3 className={`text-2xl font-black ${s.color} italic mt-1 leading-none`}>{churnStats.loading ? '...' : s.val}</h3>
                </div>
                <div className={`${s.iconBg} p-2.5 rounded-xl`}><s.icon size={18} /></div>
              </div>
              <div className="mt-2">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-50/40 p-5 rounded-3xl border border-slate-100 shadow-inner flex flex-col min-w-0">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider italic flex items-center gap-2 mb-4">
              <AlertCircle size={14} className="text-rose-500" /> สรุปสาเหตุการไม่ซื้อสินค้า (Churn Reasons Breakdown)
            </h4>
            <div className="space-y-3.5 flex-1">
              {churnStats.loading ? (
                <div className="py-12 flex items-center justify-center text-slate-400 font-bold italic text-xs">กำลังวิเคราะห์ข้อมูล...</div>
              ) : Object.keys(churnStats.reasonsBreakdown).length > 0 ? (
                Object.entries(churnStats.reasonsBreakdown)
                  .map(([reason, count]) => ({ reason, count, percent: churnStats.lostCount > 0 ? Math.round((count / churnStats.lostCount) * 100) : 0, style: STATUS_COLORS[reason] || { bar: 'bg-slate-400' } }))
                  .sort((a, b) => b.count - a.count)
                  .map(({ reason, count, percent, style }) => (
                    <div key={reason} className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-black text-slate-700">
                        <span className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${style.bar}`} />{reason}</span>
                        <span className="shrink-0 text-slate-500">{count} ราย ({percent}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden border border-slate-100">
                        <div className={`h-full ${style.bar} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-slate-400 font-black italic text-xs uppercase tracking-widest">ไม่มีข้อมูลสาเหตุหยุดเคลื่อนไหวในระบบขณะนี้</div>
              )}
            </div>
          </div>
          <div className="lg:col-span-5 bg-slate-50/40 p-5 rounded-3xl border border-slate-100 shadow-inner flex flex-col min-w-0">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider italic flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-primary" /> ประวัติจำนวนสะสมรายสัปดาห์ (Weekly History)
            </h4>
            <div className="overflow-y-auto max-h-[200px] pr-1 custom-scrollbar flex-1">
              {churnStats.loading ? (
                <div className="py-12 flex items-center justify-center text-slate-400 font-bold italic text-xs">กำลังดึงประวัติ...</div>
              ) : churnStats.weeklyReports?.length > 0 ? (
                <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
                  {churnStats.weeklyReports.map((report) => (
                    <div key={report.id} className="relative group text-xs">
                      <div className="absolute -left-[21px] top-0.5 w-2 h-2 bg-white rounded-full border-2 border-primary group-hover:bg-primary transition-all" />
                      <div className="font-black text-slate-800">สัปดาห์: <span className="text-primary font-black italic">{report.weekId}</span></div>
                      <div className="text-slate-500 font-bold mt-0.5">หยุดเคลื่อนไหว: <span className="text-rose-600">{report.lostCount || 0} ราย</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 font-black italic text-xs">ยังไม่มีประวัติรายงาน</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ROW 7: CATEGORY BREAKDOWN BARS (from V1)
      ══════════════════════════════════════════════════════ */}
      <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="border-b border-slate-50 pb-4 mb-5">
          <div className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
            <Activity className="text-indigo-500" size={18} /> สรุปการทำงานตามประเภทลูกค้า (Category Breakdown)
          </div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">แยกตามกลุ่ม Pool / Qualified / Customer</p>
        </div>
        <div className="space-y-5">
          {[
            { label: 'เบอร์สกรีน (Pool)', key: 'pool', colors: { dot: 'bg-indigo-500' } },
            { label: 'รอตัดสินใจ (Qualified)', key: 'qualified', colors: { dot: 'bg-amber-500' } },
            { label: 'ลูกค้าประจำ (Customer)', key: 'customer', colors: { dot: 'bg-emerald-500' } },
          ].map(({ label, key, colors }) => {
            const stageData = stats.categoryBreakdown?.[key] || { total: 0, done: 0, remaining: 0, lost: 0 };
            const total = stageData.total || 0;
            return (
              <div key={key} className="space-y-2 relative group font-sans">
                <div className="flex justify-between items-center text-xs font-black text-slate-700">
                  <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />{label}</span>
                  <span className="font-extrabold text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">ทั้งหมด {total} ราย</span>
                </div>
                <div className="h-6 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner border border-slate-200/50">
                  {total === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400">ไม่มีข้อมูลในระบบ</div>
                  ) : (
                    <>
                      {stageData.done > 0 && <div style={{ width: `${(stageData.done / total) * 100}%` }} className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full transition-all duration-300" />}
                      {stageData.remaining > 0 && <div style={{ width: `${(stageData.remaining / total) * 100}%` }} className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-300" />}
                      {stageData.lost > 0 && <div style={{ width: `${(stageData.lost / total) * 100}%` }} className="bg-gradient-to-r from-rose-400 to-rose-500 h-full transition-all duration-300" />}
                    </>
                  )}
                </div>
                {total > 0 && (
                  <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                    <span className="text-emerald-600">✅ ทำแล้ว: {stageData.done}</span>
                    <span className="text-amber-600">⏳ คงเหลือ: {stageData.remaining}</span>
                    <span className="text-rose-600">❌ หาย: {stageData.lost}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default ManagerDashboardV4;
