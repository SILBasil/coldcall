import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Users, PhoneCall, CheckCircle2, Award,
  ChevronRight, ChevronLeft, Loader2, Database, RotateCw, AlertCircle,
  Target, Flame, Zap, Medal, Calendar, ShieldCheck, BarChart3, Activity,
  UserX, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { ManagerSkeleton } from '../common/Skeleton';

const ManagerDashboardV2 = () => {
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
    teamLostReasons: [],
    growthStats: {},
    weeklyFunnelFlow: {}
  });
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminWeeklyRates, setAdminWeeklyRates] = useState({});
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(true);
  const [historyData, setHistoryData] = useState([]);
  const [baseDate, setBaseDate] = useState(new Date());
  const [mode, setMode] = useState('week');
  const [churnStats, setChurnStats] = useState({ lostCount: 0, activeRatio: 100, totalCustomersCount: 0, activeCount: 0, loading: true });
  const dateInputRef = useRef(null);

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

  const fetchHistoryData = async (refDate, currentMode) => {
    setIsWeeklyLoading(true);
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
    }
  };

  const fetchStats = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await leadService.getStats(baseDate, mode);
      setStats(data);
      await fetchHistoryData(baseDate, mode);

      // churn
      try {
        const res = await leadService.getLostCustomers(null);
        const rawRes = await leadService.getCustomersByStage('customer', null, 1, 1000);
        const portfolioCount = rawRes.pagination?.total || 0;
        const lostCount = res.total;
        const activeCount = Math.max(0, portfolioCount - lostCount);
        const activeRatio = portfolioCount > 0 ? Math.round((activeCount / portfolioCount) * 100) : 100;
        setChurnStats({ lostCount, activeRatio, totalCustomersCount: portfolioCount, activeCount, loading: false });
      } catch (e) {
        setChurnStats(s => ({ ...s, loading: false }));
      }
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

  useEffect(() => {
    fetchStats();
  }, [baseDate, mode]);

  const navigatePeriod = (dir) => {
    const nextDate = new Date(baseDate);
    if (mode === 'month') nextDate.setMonth(baseDate.getMonth() + dir);
    else nextDate.setDate(baseDate.getDate() + dir * 7);
    setBaseDate(nextDate);
  };

  if (loading && !refreshing) return <ManagerSkeleton />;

  const eff = stats.weeklyStats?.efficiency || '0%';
  const effGrowth = parseFloat(stats.weeklyStats?.efficiencyGrowth || '0');
  const followsDone = stats.weeklyStats?.followUps || 0;
  const followsTotal = stats.weeklyStats?.followUpsTotal || 0;
  const newCust = stats.weeklyStats?.newCustomers || 0;
  const newCustGrowth = parseFloat(stats.weeklyStats?.newCustomersGrowth || '0');

  // Mini trend bar from historyData
  const trendCounts = historyData.map(h => h.weeklyStats?.followUps || 0);
  const trendMax = Math.max(...trendCounts, 1);

  const GrowthBadge = ({ val }) => {
    if (val === null || val === undefined) return null;
    const v = parseFloat(val);
    if (v > 0) return <span className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-black"><ArrowUpRight size={10} />{v}%</span>;
    if (v < 0) return <span className="flex items-center gap-0.5 text-rose-500 text-[10px] font-black"><ArrowDownRight size={10} />{v}%</span>;
    return <span className="flex items-center gap-0.5 text-slate-400 text-[10px] font-black"><Minus size={10} />0%</span>;
  };

  return (
    <div className={`space-y-4 max-w-[1600px] mx-auto pb-6 ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}>

      {/* ── COMPACT HEADER ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-black text-slate-700 uppercase tracking-widest">แดชบอร์ด <span className="text-indigo-600">V2</span> · Compact View</span>
          {refreshing && <Loader2 size={12} className="text-indigo-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={() => setBaseDate(new Date())} className="px-2.5 py-1.5 text-[11px] font-black bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">วันนี้</button>
          <button onClick={() => fetchStats(true)} className={`p-1.5 rounded-xl border border-slate-200 bg-white shadow-sm ${refreshing ? 'animate-spin text-indigo-500' : 'text-slate-400 hover:text-indigo-600'} transition-all`}><RotateCw size={13} /></button>
        </div>
      </div>

      {/* ── ROW 1: KPI STRIP ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'ประสิทธิภาพปิดดีล', value: eff, sub: `เทียบก่อนหน้า`, growth: effGrowth, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'งานติดตาม (Done)', value: `${followsDone}/${followsTotal}`, sub: `สัดส่วนที่เสร็จ`, growth: null, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'ปิดยอดสำเร็จ', value: newCust, sub: `${mode === 'week' ? 'สัปดาห์' : 'เดือน'}นี้`, growth: newCustGrowth, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'ลูกค้าหาย (Lost)', value: churnStats.lostCount, sub: `Churn ${100 - churnStats.activeRatio}%`, growth: null, icon: UserX, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
            <div className={`p-2 rounded-xl ${s.bg} shrink-0`}><s.icon size={18} className={s.color} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{s.label}</div>
              <div className="text-xl font-black text-slate-900 tracking-tighter leading-tight">{s.value}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-slate-400 font-bold">{s.sub}</span>
                <GrowthBadge val={s.growth} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── ROW 2: FUNNEL + CALL OUTCOMES + MINI TREND ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Funnel */}
        <div className="bg-slate-900 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-white/70 uppercase tracking-widest flex items-center gap-1.5"><Database size={12} className="text-indigo-400" /> คลังรายชื่อ</span>
              <span className="text-[10px] text-indigo-300 font-black bg-indigo-500/20 px-2 py-0.5 rounded-full">{stats.total} ราย</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'สกรีน (Pool)', val: stats.pool, color: 'text-indigo-300', bar: 'bg-indigo-500/50', w: '100%' },
                { label: 'รอตัดสินใจ', val: stats.qualified, color: 'text-amber-300', bar: 'bg-amber-500/50', w: `${stats.total > 0 ? Math.round((stats.qualified / stats.total) * 100) : 50}%` },
                { label: 'ลูกค้าประจำ', val: stats.customer, color: 'text-emerald-300', bar: 'bg-emerald-500/50', w: `${stats.total > 0 ? Math.round((stats.customer / stats.total) * 100) : 40}%` },
                { label: 'ลูกค้าหาย', val: stats.lost || churnStats.lostCount, color: 'text-rose-300', bar: 'bg-rose-500/50', w: `${stats.total > 0 ? Math.round(((stats.lost || churnStats.lostCount) / stats.total) * 100) : 20}%` },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-20 shrink-0">
                    <div className={`text-[10px] font-black ${row.color} truncate`}>{row.label}</div>
                  </div>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${row.bar} rounded-full transition-all duration-700`} style={{ width: row.w }} />
                  </div>
                  <span className={`text-sm font-black ${row.color} w-8 text-right shrink-0`}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal Flow This Period */}
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

        {/* Weekly Activity Trend (mini sparkline) */}
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
                    <div
                      className={`w-full rounded-md transition-all duration-500 ${isLast ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-300'}`}
                      style={{ height: `${h}%` }}
                      title={`${currentPeriods[i]?.label}: ${c}`}
                    />
                    <span className={`text-[8px] font-black ${isLast ? 'text-indigo-600' : 'text-slate-400'} truncate w-full text-center`}>
                      {currentPeriods[i]?.label?.split(' ')[0] || `W${i + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Summary counts */}
          <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[8px] font-black text-slate-400 uppercase">ลูกค้าใหม่</div>
              <div className="text-sm font-black text-sky-600">{stats.growthStats?.newCustomersCount || 0}</div>
            </div>
            <div>
              <div className="text-[8px] font-black text-slate-400 uppercase">ตามประจำ</div>
              <div className="text-sm font-black text-emerald-600">{stats.growthStats?.regularFollowUps || 0}</div>
            </div>
            <div>
              <div className="text-[8px] font-black text-slate-400 uppercase">ประจำหาย</div>
              <div className="text-sm font-black text-rose-600">{stats.growthStats?.regularLostCount || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TEAM PERFORMANCE TABLE + CALL OUTCOMES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Admin Performance Table - compact */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-indigo-600" /> ประสิทธิภาพรายบุคคล
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase">6 {mode === 'week' ? 'สัปดาห์' : 'เดือน'} ย้อนหลัง</span>
          </div>

          {isWeeklyLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-bold">กำลังโหลด...</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {admins.map(admin => {
                const detail = stats.weeklyStats?.adminDetails?.[admin.id] || { grade: 'C', followed: 0, converted: 0, rate: '0%' };
                const rates = adminWeeklyRates[admin.id] || Array(6).fill('-');
                const gradeColor = detail.grade === 'A' ? 'bg-emerald-500' : detail.grade === 'B' ? 'bg-indigo-500' : 'bg-slate-400';

                return (
                  <div key={admin.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-all group">
                    {/* Avatar + grade */}
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm" style={{ backgroundColor: admin?.color || '#6366f1' }}>
                        {admin?.name?.charAt(0) || 'A'}
                      </div>
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-md flex items-center justify-center text-white text-[8px] font-black border border-white ${gradeColor}`}>
                        {detail.grade}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="w-24 shrink-0">
                      <div className="text-xs font-black text-slate-800 truncate">{admin.name}</div>
                      <div className="text-[9px] text-slate-400 font-bold truncate">{detail.followed} logs</div>
                    </div>

                    {/* 6-period rate pills - compact */}
                    <div className="flex-1 flex items-center gap-1 overflow-x-auto">
                      {rates.map((rate, idx) => {
                        const isLast = idx === 5;
                        const hasData = rate && rate !== '-';
                        return (
                          <div key={idx} className={`shrink-0 px-2 py-1 rounded-lg text-center min-w-[44px] text-[9px] font-black transition-all
                            ${isLast
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : hasData
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-slate-50 text-slate-400 border border-slate-100'
                            }`}
                          >
                            <div className={`${isLast ? 'text-white/60' : 'text-slate-400'} text-[7px] uppercase mb-0.5`}>
                              {currentPeriods[idx]?.label?.split(' ')[0] || `P${idx + 1}`}
                            </div>
                            {isWeeklyLoading ? <div className="h-2 w-4 bg-current opacity-30 rounded animate-pulse mx-auto" /> : rate ?? '-'}
                          </div>
                        );
                      })}
                    </div>

                    {/* Current rate */}
                    <div className="text-right shrink-0 w-14">
                      <div className="text-base font-black text-slate-900 tracking-tighter">{detail.rate}</div>
                      <div className="text-[8px] font-black text-indigo-500 uppercase">Conv.</div>
                    </div>
                  </div>
                );
              })}
              {admins.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-bold">ไม่พบข้อมูลแอดมิน</div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Leaderboard + Call Outcomes */}
        <div className="flex flex-col gap-3">

          {/* Mini Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Medal size={12} className="text-amber-500" /> Top Performers
              </span>
            </div>
            <div className="p-3 space-y-2">
              {stats.weeklyStats?.leaderboard?.filter(adm => admins.some(a => a.id === adm.id)).slice(0, 5).map((adm, i) => (
                <div key={i} className="flex items-center gap-2.5 group hover:translate-x-1 transition-transform">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                    i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-slate-800 truncate">{adm.name}</div>
                    <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: adm.rate }} />
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-600 shrink-0">{adm.rate}</span>
                </div>
              ))}
              {(!stats.weeklyStats?.leaderboard || stats.weeklyStats.leaderboard.length === 0) && (
                <div className="text-center text-slate-400 text-[10px] font-bold py-4 uppercase">ไม่มีข้อมูล</div>
              )}
            </div>
          </div>

          {/* Call Outcomes mini */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <PhoneCall size={12} className="text-amber-600" /> ผลการเจรจา
              </span>
            </div>
            <div className="px-4 py-3">
              {(() => {
                const outcomes = stats.teamCallOutcomes || [];
                const total = outcomes.reduce((acc, curr) => acc + curr.count, 0);
                if (total === 0) return <div className="text-[10px] font-bold text-slate-400 text-center py-2 uppercase">ไม่มีข้อมูล</div>;
                const colorMap = { 'emerald': 'bg-emerald-500', 'amber': 'bg-amber-500', 'rose': 'bg-rose-500' };
                return (
                  <>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex mb-2.5">
                      {outcomes.map((o, idx) => (
                        <div key={idx} className={`${colorMap[o.color] || 'bg-slate-400'} h-full`} style={{ width: `${(o.count / total) * 100}%` }} />
                      ))}
                    </div>
                    <div className="space-y-1">
                      {outcomes.map((o, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-black">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${colorMap[o.color] || 'bg-slate-400'}`} />
                            {o.label}
                          </span>
                          <span className="text-slate-800">{o.count} <span className="text-slate-400 font-bold">({Math.round((o.count / total) * 100)}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: FREQUENCY BREAKDOWN + LOST ANALYSIS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Frequency Status Breakdown (compact) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={12} className="text-primary" /> สถานะตามความถี่ติดตาม
            </span>
            <div className="flex items-center gap-3 text-[8px] font-black uppercase">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />ซื้อ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />ติดตาม</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />หาย</span>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {(() => {
              const freqData = stats.frequencyStats || {};
              const entries = Object.entries(freqData);
              if (entries.length === 0) return <div className="text-center text-slate-400 text-[10px] font-bold py-4 uppercase">ไม่มีข้อมูล</div>;
              return entries.map(([key, g]) => {
                const total = g.total || 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-16 shrink-0 text-[10px] font-black text-slate-600 truncate">{g.label}</div>
                    <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
                      {total > 0 ? (
                        <>
                          {g.bought > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(g.bought / total) * 100}%` }} title={`ซื้อ: ${g.bought}`} />}
                          {g.followup > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(g.followup / total) * 100}%` }} title={`ติดตาม: ${g.followup}`} />}
                          {g.lost > 0 && <div className="bg-rose-500 h-full" style={{ width: `${(g.lost / total) * 100}%` }} title={`หาย: ${g.lost}`} />}
                          {g.remaining > 0 && <div className="bg-slate-200 h-full" style={{ width: `${(g.remaining / total) * 100}%` }} title={`เหลือ: ${g.remaining}`} />}
                        </>
                      ) : <div className="w-full h-full bg-slate-50" />}
                    </div>
                    <div className="w-10 text-right shrink-0 text-[10px] font-black text-slate-500">{total}</div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Churn + Lost Reasons combined */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={12} className="text-rose-500" /> วิเคราะห์ Churn & Lost
            </span>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[8px] font-black text-slate-400 uppercase">Retention Rate</div>
                <div className="text-sm font-black text-emerald-600">{churnStats.activeRatio}%</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] font-black text-slate-400 uppercase">Lost</div>
                <div className="text-sm font-black text-rose-600">{churnStats.lostCount}</div>
              </div>
            </div>
          </div>
          {/* Retention visual */}
          <div className="px-5 pt-3 pb-1">
            <div className="h-2 w-full bg-rose-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${churnStats.activeRatio}%` }} />
            </div>
            <div className="flex justify-between text-[8px] font-black text-slate-400 mt-1 uppercase">
              <span>Active {churnStats.activeCount} ราย</span>
              <span>Lost {churnStats.lostCount} ราย</span>
            </div>
          </div>
          {/* Lost reasons */}
          <div className="p-4 pt-2 space-y-2">
            {!stats.teamLostReasons || stats.teamLostReasons.length === 0 ? (
              <div className="text-center text-slate-400 text-[10px] font-bold py-3 uppercase">ไม่มีข้อมูลสาเหตุในช่วงนี้</div>
            ) : stats.teamLostReasons.slice(0, 5).map((r, i) => {
              const maxCount = Math.max(...stats.teamLostReasons.map(x => x.count), 1);
              const w = Math.max((r.count / maxCount) * 100, 5);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[10px] font-black text-slate-600 mb-0.5">
                      <span className="truncate pr-2">{r.reason}</span>
                      <span className="shrink-0 text-slate-400">{r.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full transition-all duration-700" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboardV2;
