import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Users, PhoneCall, CheckCircle2, Award,
  ChevronRight, ChevronLeft, Loader2, Database, RotateCw, AlertCircle,
  Target, Flame, Zap, Medal, Calendar, ShieldCheck, BarChart3, Activity,
  UserX, ArrowUpRight, ArrowDownRight, Minus, Bell, AlertTriangle,
  Clock, Eye, Star, Crosshair, Radio, Wifi, WifiOff, Circle,
  TrendingUp as TrendUp, BarChart2, PieChart, Map, Navigation,
  ChevronUp, ChevronDown, Layers, GitBranch, Filter, RefreshCw,
  UserCheck, UserMinus, Package, Boxes, ArrowRight, Info
} from 'lucide-react';
import { leadService } from '../../services/leadService';

// ─────────────────────────────────────────────
// UTILITY COMPONENTS
// ─────────────────────────────────────────────
const Pulse = ({ color = 'bg-emerald-400' }) => (
  <span className="relative flex h-2 w-2">
    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
    <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
  </span>
);

const MiniSpark = ({ data = [], color = '#6366f1', height = 32 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100 / (data.length - 1);
  const points = data.map((v, i) => `${i * w},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={data.length > 1 ? (data.length - 1) * w : 0} cy={height - ((data[data.length - 1] - min) / range) * height} r="2.5" fill={color} />
    </svg>
  );
};

const RiskBadge = ({ level }) => {
  const cfg = {
    high: { bg: 'bg-red-500/20 border-red-500/40 text-red-400', label: 'HIGH RISK' },
    medium: { bg: 'bg-amber-500/20 border-amber-500/40 text-amber-400', label: 'WATCH' },
    low: { bg: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', label: 'HEALTHY' },
  };
  const c = cfg[level] || cfg.low;
  return <span className={`px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest ${c.bg}`}>{c.label}</span>;
};

const StatusDot = ({ active }) => (
  <span className={`inline-flex h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const ManagerDashboardV3 = () => {
  const [stats, setStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [churnStats, setChurnStats] = useState({ lostCount: 0, activeRatio: 100, totalCustomersCount: 0, activeCount: 0, loading: true, reasonsBreakdown: {} });
  const [historyData, setHistoryData] = useState([]);
  const [adminWeeklyRates, setAdminWeeklyRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [baseDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertsOpen, setAlertsOpen] = useState(true);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [data, allUsers] = await Promise.all([
        leadService.getStats(baseDate, 'week'),
        leadService.getUsers()
      ]);
      setStats(data);
      setAdmins(allUsers.filter(u => u.role === 'admin'));

      // History for sparklines
      const day = baseDate.getDay();
      const diff = baseDate.getDate() - (day === 0 ? 6 : day - 1);
      const refMonday = new Date(baseDate);
      refMonday.setDate(diff);
      refMonday.setHours(0, 0, 0, 0);
      const periodStarts = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(refMonday);
        d.setDate(refMonday.getDate() - (5 - i) * 7);
        return d;
      });
      const history = await Promise.all(periodStarts.map(s => leadService.getStats(s, 'week')));
      setHistoryData(history);

      const ratesMap = {};
      allUsers.filter(u => u.role === 'admin').forEach(a => { ratesMap[a.id] = Array(6).fill(0); });
      history.forEach((pd, pi) => {
        Object.entries(pd.weeklyStats?.adminDetails || {}).forEach(([aid, entry]) => {
          if (ratesMap[aid]) ratesMap[aid][pi] = parseFloat(entry.rate) || 0;
        });
      });
      setAdminWeeklyRates(ratesMap);

      // Churn
      try {
        const [lostRes, custRes] = await Promise.all([
          leadService.getLostCustomers(null),
          leadService.getCustomersByStage('customer', null, 1, 1000)
        ]);
        const portfolioCount = custRes.pagination?.total || 0;
        const lostCount = lostRes.total;
        const activeCount = Math.max(0, portfolioCount - lostCount);
        const activeRatio = portfolioCount > 0 ? Math.round((activeCount / portfolioCount) * 100) : 100;
        setChurnStats({ lostCount, activeRatio, totalCustomersCount: portfolioCount, activeCount, loading: false, reasonsBreakdown: lostRes.reasonsBreakdown || {} });
      } catch (e) { setChurnStats(s => ({ ...s, loading: false })); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 animate-ping absolute" />
          <div className="w-16 h-16 rounded-full border-2 border-cyan-500 animate-spin border-t-transparent" />
        </div>
        <div className="text-cyan-400 text-xs font-black uppercase tracking-widest animate-pulse">Initializing Command Center...</div>
      </div>
    </div>
  );

  // ── Derived data ──
  const eff = parseFloat(stats?.weeklyStats?.efficiency) || 0;
  const followsDone = stats?.weeklyStats?.followUps || 0;
  const followsTotal = stats?.weeklyStats?.followUpsTotal || 0;
  const newCust = stats?.weeklyStats?.newCustomers || 0;
  const actTrend = stats?.activityTrend?.counts || [];
  const totalActivity = actTrend.reduce((a, b) => a + b, 0);
  const todayActivity = actTrend[actTrend.length - 1] || 0;
  const yesterday = actTrend[actTrend.length - 2] || 0;
  const activityDelta = todayActivity - yesterday;

  // Pipeline health score (0-100)
  const total = (stats?.pool || 0) + (stats?.qualified || 0) + (stats?.customer || 0);
  const convRate = total > 0 ? Math.round(((stats?.customer || 0) / total) * 100) : 0;
  const churnRate = 100 - churnStats.activeRatio;
  const pipelineScore = Math.max(0, Math.min(100, Math.round((convRate * 0.4) + (eff * 0.4) + (churnStats.activeRatio * 0.2))));
  const scoreColor = pipelineScore >= 70 ? '#10b981' : pipelineScore >= 40 ? '#f59e0b' : '#ef4444';
  const scoreLabel = pipelineScore >= 70 ? 'EXCELLENT' : pipelineScore >= 40 ? 'MODERATE' : 'AT RISK';

  // Admin health assessment
  const adminHealth = admins.map(admin => {
    const detail = stats?.weeklyStats?.adminDetails?.[admin.id] || { grade: 'C', followed: 0, converted: 0, rate: '0%' };
    const rates = adminWeeklyRates[admin.id] || Array(6).fill(0);
    const recent3Avg = rates.slice(3).reduce((a, b) => a + b, 0) / 3;
    const prev3Avg = rates.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const trend = recent3Avg - prev3Avg;
    const risk = detail.followed === 0 ? 'high' : detail.grade === 'C' ? 'medium' : 'low';
    return { admin, detail, rates, trend, risk, recent3Avg, hasActivity: detail.followed > 0 };
  });

  // Alerts
  const alerts = [];
  if (churnRate > 20) alerts.push({ type: 'danger', icon: UserMinus, msg: `Churn rate สูงถึง ${churnRate}% — ลูกค้าประจำหาย ${churnStats.lostCount} ราย ต้องจัดการด่วน` });
  if (eff < 10) alerts.push({ type: 'warning', icon: Target, msg: `ประสิทธิภาพปิดดีลต่ำมาก (${eff}%) — ทีมอาจต้องการ coaching` });
  if ((stats?.unassigned || 0) > 0) alerts.push({ type: 'info', icon: Bell, msg: `มีลูกค้า ${stats?.unassigned} ราย ใน qualified ยังไม่มีแอดมินรับผิดชอบ` });
  const inactiveAdmins = adminHealth.filter(ah => !ah.hasActivity);
  if (inactiveAdmins.length > 0) alerts.push({ type: 'warning', icon: WifiOff, msg: `${inactiveAdmins.map(ah => ah.admin.name).join(', ')} — ไม่มีกิจกรรมในช่วงนี้` });
  const topLostReason = Object.entries(churnStats.reasonsBreakdown || {}).sort((a, b) => b[1] - a[1])[0];
  if (topLostReason) alerts.push({ type: 'info', icon: AlertTriangle, msg: `สาเหตุหลักที่ลูกค้าหาย: "${topLostReason[0]}" — ${topLostReason[1]} ราย` });

  // Gauge SVG for pipeline score
  const gaugeAngle = (pipelineScore / 100) * 180;
  const polarToCartesian = (cx, cy, r, deg) => {
    const rad = (deg - 180) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const gStart = polarToCartesian(60, 60, 48, 0);
  const gEnd = polarToCartesian(60, 60, 48, gaugeAngle);
  const largeArc = gaugeAngle > 90 ? 1 : 0;

  // Conversion funnel percentages
  const pool = stats?.pool || 0;
  const qualified = stats?.qualified || 0;
  const customer = stats?.customer || 0;
  const poolToQual = pool > 0 ? Math.round((qualified / (pool + qualified + customer)) * 100) : 0;
  const qualToCust = (pool + qualified) > 0 ? Math.round((customer / (pool + qualified + customer)) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans pb-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════════
          TOP COMMAND BAR
      ══════════════════════════════════════════ */}
      <div className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Pulse color="bg-cyan-400" />
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em]">Live</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-sm font-black text-white tracking-tight">COMMAND CENTER <span className="text-cyan-400">V3</span></span>
            <span className="text-[10px] text-zinc-500 font-bold hidden md:block">ระบบบริหารทีม & ลูกค้า</span>
          </div>

          <div className="flex items-center gap-6">
            {/* Live clock */}
            <div className="hidden md:flex items-center gap-1.5 text-zinc-400">
              <Clock size={11} />
              <span className="text-[11px] font-black tabular-nums">{currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="text-[9px] text-zinc-600">·</span>
              <span className="text-[10px]">{currentTime.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>

            {/* Quick metrics */}
            <div className="flex items-center gap-4">
              {[
                { label: 'Pipeline', val: total, color: 'text-white' },
                { label: 'Active %', val: `${churnStats.activeRatio}%`, color: churnStats.activeRatio >= 80 ? 'text-emerald-400' : 'text-amber-400' },
                { label: "Today's Logs", val: todayActivity, color: todayActivity > 0 ? 'text-cyan-400' : 'text-zinc-600' },
              ].map((m, i) => (
                <div key={i} className="hidden lg:flex flex-col items-end">
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">{m.label}</span>
                  <span className={`text-sm font-black ${m.color}`}>{m.val}</span>
                </div>
              ))}
            </div>

            <button onClick={() => fetchAll(true)} className={`p-1.5 rounded-lg border border-white/10 ${refreshing ? 'text-cyan-400 animate-spin' : 'text-zinc-500 hover:text-white hover:border-white/20'} transition-all`}>
              <RotateCw size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 pt-5 space-y-4">

        {/* ══════════════════════════════════════════
            ALERT STRIP
        ══════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <button
              className="w-full px-4 py-2.5 flex items-center justify-between"
              onClick={() => setAlertsOpen(!alertsOpen)}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Action Required — {alerts.length} รายการที่ต้องดำเนินการ</span>
              </div>
              {alertsOpen ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
            </button>
            {alertsOpen && (
              <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {alerts.map((a, i) => {
                  const alertColors = {
                    danger: 'border-red-500/30 bg-red-500/10 text-red-300',
                    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                    info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
                  };
                  return (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${alertColors[a.type]}`}>
                      <a.icon size={11} className="mt-0.5 shrink-0" />
                      <span className="text-[10px] font-bold leading-relaxed">{a.msg}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            ROW 1: SCORE GAUGE + PIPELINE + KPIs
        ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Pipeline Health Score Gauge */}
          <div className="lg:col-span-3 bg-zinc-900 rounded-2xl border border-white/5 p-5 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 to-transparent pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">PIPELINE HEALTH SCORE</div>
              {/* Gauge */}
              <div className="relative w-32 h-20 overflow-hidden">
                <svg viewBox="0 0 120 70" className="w-full">
                  {/* Track */}
                  <path d={`M 12 60 A 48 48 0 0 1 108 60`} fill="none" stroke="#27272a" strokeWidth="10" strokeLinecap="round" />
                  {/* Fill */}
                  <path
                    d={`M 12 60 A 48 48 0 ${largeArc} 1 ${gEnd.x} ${gEnd.y}`}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 6px ${scoreColor}60)` }}
                  />
                  {/* Score text */}
                  <text x="60" y="58" textAnchor="middle" fill="white" fontSize="18" fontWeight="900" fontFamily="Inter, sans-serif">{pipelineScore}</text>
                </svg>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: scoreColor }}>{scoreLabel}</div>

              <div className="mt-4 w-full space-y-2">
                {[
                  { label: 'Conversion', val: convRate + '%', color: 'bg-cyan-500' },
                  { label: 'Efficiency', val: eff + '%', color: 'bg-indigo-500' },
                  { label: 'Retention', val: churnStats.activeRatio + '%', color: 'bg-emerald-500' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-14 text-[9px] text-zinc-500 font-bold uppercase shrink-0">{s.label}</div>
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full transition-all duration-1000`} style={{ width: s.val }} />
                    </div>
                    <div className="text-[9px] font-black text-zinc-300 w-8 text-right shrink-0">{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Pipeline Flow */}
          <div className="lg:col-span-5 bg-zinc-900 rounded-2xl border border-white/5 p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-900/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">CUSTOMER PIPELINE</div>
                  <div className="text-xs font-black text-white mt-0.5">ภาพรวมลูกค้าทั้งระบบ <span className="text-zinc-500 font-bold text-[10px]">({total} รายทั้งหมด)</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-zinc-600 uppercase font-bold">Net Growth</div>
                  <div className="text-sm font-black text-emerald-400">+{newCust} <span className="text-[9px] text-zinc-500">สัปดาห์นี้</span></div>
                </div>
              </div>

              {/* Pipeline stages - horizontal flow */}
              <div className="flex items-stretch gap-2">
                {[
                  { label: 'Pool\n(สกรีน)', val: pool, pct: total > 0 ? Math.round((pool / total) * 100) : 0, color: 'from-slate-700 to-slate-600', accent: '#64748b', icon: Boxes },
                  { label: 'Qualified\n(รอตัดสินใจ)', val: qualified, pct: total > 0 ? Math.round((qualified / total) * 100) : 0, color: 'from-indigo-900 to-indigo-800', accent: '#818cf8', icon: Target },
                  { label: 'Customer\n(ลูกค้าประจำ)', val: customer, pct: total > 0 ? Math.round((customer / total) * 100) : 0, color: 'from-emerald-900 to-emerald-800', accent: '#34d399', icon: UserCheck },
                  { label: 'Lost\n(หาย)', val: churnStats.lostCount, pct: total > 0 ? Math.round((churnStats.lostCount / total) * 100) : 0, color: 'from-rose-950 to-rose-900', accent: '#f87171', icon: UserMinus },
                ].map((stage, i) => (
                  <React.Fragment key={i}>
                    <div className={`flex-1 bg-gradient-to-b ${stage.color} rounded-xl p-3 border border-white/5 flex flex-col gap-2 hover:border-white/10 transition-all group`}>
                      <div className="flex items-center justify-between">
                        <stage.icon size={12} style={{ color: stage.accent }} />
                        <span className="text-[8px] font-black text-white/30">{stage.pct}%</span>
                      </div>
                      <div className="text-2xl font-black tracking-tighter" style={{ color: stage.accent }}>{stage.val}</div>
                      <div className="text-[8px] font-bold text-white/50 leading-tight whitespace-pre-line">{stage.label}</div>
                      <div className="h-0.5 w-full bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${stage.pct}%`, backgroundColor: stage.accent }} />
                      </div>
                    </div>
                    {i < 3 && <div className="flex items-center text-zinc-700 shrink-0"><ChevronRight size={12} /></div>}
                  </React.Fragment>
                ))}
              </div>

              {/* Conversion arrows */}
              <div className="flex items-center gap-1 mt-3 text-[8px] font-black text-zinc-600 uppercase tracking-wider">
                <span>Pool→Qual</span>
                <span className={`px-1.5 py-0.5 rounded ${poolToQual > 30 ? 'text-emerald-400 bg-emerald-950' : 'text-amber-400 bg-amber-950'}`}>{poolToQual}%</span>
                <span className="mx-2 text-zinc-800">·</span>
                <span>Qual→Cust</span>
                <span className={`px-1.5 py-0.5 rounded ${qualToCust > 30 ? 'text-emerald-400 bg-emerald-950' : 'text-amber-400 bg-amber-950'}`}>{qualToCust}%</span>
                <span className="mx-2 text-zinc-800">·</span>
                <span>Churn</span>
                <span className={`px-1.5 py-0.5 rounded ${churnRate < 20 ? 'text-emerald-400 bg-emerald-950' : 'text-rose-400 bg-rose-950'}`}>{churnRate}%</span>
              </div>
            </div>
          </div>

          {/* 4 KPI tiles */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            {[
              {
                label: 'Efficiency', sublabel: 'อัตราปิดดีล', val: eff + '%',
                trend: historyData.map(h => parseFloat(h.weeklyStats?.efficiency) || 0),
                icon: Target, color: '#6366f1', bg: 'bg-indigo-950',
                status: eff >= 50 ? 'healthy' : eff >= 20 ? 'watch' : 'risk',
              },
              {
                label: 'Follow-ups Done', sublabel: 'งานติดตามลูกค้า', val: `${followsDone}/${followsTotal}`,
                trend: historyData.map(h => h.weeklyStats?.followUps || 0),
                icon: CheckCircle2, color: '#10b981', bg: 'bg-emerald-950',
                status: followsDone >= followsTotal * 0.8 ? 'healthy' : 'watch',
              },
              {
                label: 'New Customers', sublabel: 'ปิดยอดสำเร็จ', val: newCust,
                trend: historyData.map(h => h.weeklyStats?.newCustomers || 0),
                icon: Star, color: '#f59e0b', bg: 'bg-amber-950',
                status: newCust > 0 ? 'healthy' : 'risk',
              },
              {
                label: "Today's Activity", sublabel: 'กิจกรรมวันนี้', val: todayActivity,
                trend: actTrend,
                icon: Radio, color: '#22d3ee', bg: 'bg-cyan-950',
                status: todayActivity > 5 ? 'healthy' : todayActivity > 0 ? 'watch' : 'risk',
              },
            ].map((kpi, i) => {
              const statusDot = kpi.status === 'healthy' ? 'bg-emerald-400' : kpi.status === 'watch' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={i} className={`${kpi.bg} rounded-xl border border-white/5 p-3.5 flex flex-col gap-2 hover:border-white/10 transition-all relative overflow-hidden`}>
                  <div className="flex items-center justify-between">
                    <kpi.icon size={13} style={{ color: kpi.color }} />
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                  </div>
                  <div className="text-2xl font-black tracking-tighter" style={{ color: kpi.color }}>{kpi.val}</div>
                  <div>
                    <div className="text-[9px] font-black text-white/80 uppercase tracking-wider">{kpi.label}</div>
                    <div className="text-[8px] text-zinc-600 font-bold">{kpi.sublabel}</div>
                  </div>
                  <div className="h-6 opacity-60">
                    <MiniSpark data={kpi.trend} color={kpi.color} height={24} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            ROW 2: TEAM STATUS + ACTIVITY HEATMAP
        ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Team Status Grid */}
          <div className="lg:col-span-8 bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-indigo-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Team Performance Radar</span>
              </div>
              <span className="text-[8px] text-zinc-500 font-bold uppercase">6 สัปดาห์ย้อนหลัง</span>
            </div>

            <div className="divide-y divide-white/[0.03]">
              {adminHealth.length === 0 && (
                <div className="p-8 text-center text-zinc-600 text-xs">ไม่พบข้อมูลแอดมิน</div>
              )}
              {adminHealth.map(({ admin, detail, rates, trend, risk, recent3Avg }, idx) => {
                const trendIcon = trend > 2 ? <ArrowUpRight size={10} className="text-emerald-400" /> : trend < -2 ? <ArrowDownRight size={10} className="text-rose-400" /> : <Minus size={10} className="text-zinc-500" />;
                const gradeColors = { A: '#10b981', B: '#6366f1', C: '#f59e0b', D: '#ef4444' };
                const gradeColor = gradeColors[detail.grade] || '#71717a';

                return (
                  <div key={admin.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-all group">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg"
                        style={{ backgroundColor: admin?.color || '#6366f1', boxShadow: `0 0 20px ${admin?.color || '#6366f1'}40` }}
                      >
                        {admin?.name?.charAt(0) || 'A'}
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-md flex items-center justify-center text-white text-[8px] font-black border border-zinc-900"
                        style={{ backgroundColor: gradeColor }}
                      >
                        {detail.grade}
                      </div>
                    </div>

                    {/* Name + status */}
                    <div className="w-28 shrink-0">
                      <div className="text-xs font-black text-white truncate">{admin.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <RiskBadge level={risk} />
                      </div>
                    </div>

                    {/* 6-week sparkline + rate pills */}
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto min-w-0">
                      {rates.map((rate, ri) => {
                        const isLast = ri === 5;
                        const rateStr = rate > 0 ? rate + '%' : '-';
                        const barH = rate > 0 ? Math.max((rate / 100) * 100, 10) : 0;
                        return (
                          <div key={ri} className={`shrink-0 flex flex-col items-center gap-0.5 w-10`}>
                            {/* Mini bar */}
                            <div className="w-full h-8 flex items-end">
                              <div
                                className={`w-full rounded-sm transition-all duration-700 ${isLast ? 'bg-cyan-500' : rate > 50 ? 'bg-emerald-700' : rate > 20 ? 'bg-indigo-800' : rate > 0 ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                                style={{ height: `${barH}%`, minHeight: barH > 0 ? 2 : 0 }}
                              />
                            </div>
                            <div className={`text-[8px] font-black tabular-nums ${isLast ? 'text-cyan-400' : rate > 0 ? 'text-zinc-400' : 'text-zinc-700'}`}>{rateStr}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center hidden md:block">
                        <div className="text-[8px] text-zinc-600 uppercase font-bold">Logs</div>
                        <div className="text-xs font-black text-white">{detail.followed}</div>
                      </div>
                      <div className="text-center hidden md:block">
                        <div className="text-[8px] text-zinc-600 uppercase font-bold">Won</div>
                        <div className="text-xs font-black text-emerald-400">{detail.converted}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-zinc-600 uppercase font-bold">Conv.</div>
                        <div className="text-sm font-black text-white">{detail.rate}</div>
                      </div>
                      <div className="flex items-center gap-0.5 text-[9px] font-black">
                        {trendIcon}
                        <span className={trend > 2 ? 'text-emerald-400' : trend < -2 ? 'text-rose-400' : 'text-zinc-600'}>
                          {trend > 0 ? '+' : ''}{Math.round(trend)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Activity Heatmap + Leaderboard */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Leaderboard */}
            <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Medal size={12} className="text-amber-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Top Performers</span>
                <span className="ml-auto text-[8px] text-zinc-600 font-bold uppercase">สัปดาห์นี้</span>
              </div>
              <div className="space-y-2.5">
                {stats?.weeklyStats?.leaderboard?.filter(adm => admins.some(a => a.id === adm.id)).slice(0, 5).map((adm, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={i} className="flex items-center gap-2.5 group">
                      <span className="text-sm w-5 text-center">{medals[i] || `${i + 1}`}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-white truncate">{adm.name}</div>
                        <div className="h-0.5 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-zinc-400' : 'bg-orange-600'}`}
                            style={{ width: adm.rate }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-white">{adm.rate}</div>
                        <div className="text-[8px] text-zinc-600">{adm.converted} won</div>
                      </div>
                    </div>
                  );
                })}
                {(!stats?.weeklyStats?.leaderboard?.length) && (
                  <div className="text-center py-4 text-zinc-600 text-[10px] font-bold uppercase">ไม่มีข้อมูลในช่วงนี้</div>
                )}
              </div>
            </div>

            {/* Activity heatmap (hours) */}
            <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={11} className="text-cyan-400" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Peak Hours Today</span>
              </div>
              <div className="flex items-end gap-0.5 h-12">
                {(stats?.activityHeatmap || Array(24).fill(0)).map((count, hour) => {
                  if (hour < 7 || hour > 20) return null;
                  const max = Math.max(...(stats?.activityHeatmap || [1]), 1);
                  const h = count > 0 ? Math.max((count / max) * 100, 8) : 0;
                  const isHot = count > max * 0.7;
                  const isWarm = count > max * 0.3;
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group relative" title={`${hour}:00 — ${count} ครั้ง`}>
                      <div
                        className={`w-full rounded-sm transition-all ${isHot ? 'bg-cyan-400' : isWarm ? 'bg-cyan-700' : count > 0 ? 'bg-zinc-700' : 'bg-zinc-800/50'}`}
                        style={{ height: h > 0 ? `${h}%` : '2px' }}
                      />
                      <span className="text-[7px] text-zinc-700 font-bold">{hour}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-zinc-700 font-bold">
                <span>08:00</span><span>Peak: {stats?.activityHeatmap ? `${stats.activityHeatmap.indexOf(Math.max(...stats.activityHeatmap))}:00` : '--'}</span><span>20:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            ROW 3: DEAL FLOW + CHURN + INSIGHTS
        ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* This week's deal flow */}
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Deal Flow — สัปดาห์นี้</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'คัดจากคลัง (Pool → Active)', val: stats?.weeklyFunnelFlow?.toQualified ?? 0, icon: Boxes, color: 'text-slate-400', bgBar: 'bg-slate-600' },
                { label: 'ระหว่างเจรจา (Pitching)', val: stats?.weeklyFunnelFlow?.toDecision ?? 0, icon: Target, color: 'text-indigo-400', bgBar: 'bg-indigo-600' },
                { label: 'ปิดยอดสำเร็จ (Closed Won)', val: stats?.weeklyFunnelFlow?.toCustomer ?? 0, icon: CheckCircle2, color: 'text-emerald-400', bgBar: 'bg-emerald-600' },
                { label: 'กิจกรรมรวม (Total Logs)', val: totalActivity, icon: Activity, color: 'text-cyan-400', bgBar: 'bg-cyan-600' },
              ].map((row, i) => {
                const maxVal = Math.max(stats?.weeklyFunnelFlow?.toDecision ?? 0, totalActivity, 1);
                const pct = maxVal > 0 ? Math.min((row.val / maxVal) * 100, 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <row.icon size={10} className={row.color} />
                        <span className="text-[10px] text-zinc-400 font-bold">{row.label}</span>
                      </div>
                      <span className={`text-xs font-black ${row.color}`}>{row.val}</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${row.bgBar} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Call outcomes donut-style */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[8px] text-zinc-600 uppercase font-bold mb-2">ผลเจรจา (Call Outcomes)</div>
              {(() => {
                const outcomes = stats?.teamCallOutcomes || [];
                const total = outcomes.reduce((a, c) => a + c.count, 0);
                if (!total) return <div className="text-[9px] text-zinc-600 font-bold">ไม่มีข้อมูล</div>;
                const colorMap = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' };
                return (
                  <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
                    {outcomes.map((o, i) => (
                      <div
                        key={i}
                        className={`${colorMap[o.color] || 'bg-zinc-500'} h-full first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${(o.count / total) * 100}%` }}
                        title={`${o.label}: ${o.count}`}
                      />
                    ))}
                  </div>
                );
              })()}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {(stats?.teamCallOutcomes || []).map((o, i) => {
                  const dotColors = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' };
                  const total = (stats?.teamCallOutcomes || []).reduce((a, c) => a + c.count, 0);
                  return (
                    <div key={i} className="flex items-center gap-1 text-[8px] text-zinc-500 font-bold">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[o.color] || 'bg-zinc-500'}`} />
                      {Math.round((o.count / Math.max(total, 1)) * 100)}% {o.color === 'emerald' ? 'Won' : o.color === 'amber' ? 'Pending' : 'Lost'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Churn & Retention Analysis */}
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserX size={12} className="text-rose-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Churn & Retention</span>
            </div>

            {/* Retention ring visual */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#27272a" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="#10b981" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32 * churnStats.activeRatio / 100} ${2 * Math.PI * 32 * (1 - churnStats.activeRatio / 100)}`}
                    style={{ filter: 'drop-shadow(0 0 6px #10b98160)' }}
                  />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="#ef4444" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDashoffset={`${-2 * Math.PI * 32 * churnStats.activeRatio / 100}`}
                    strokeDasharray={`${2 * Math.PI * 32 * churnRate / 100} ${2 * Math.PI * 32}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-lg font-black text-white leading-none">{churnStats.activeRatio}%</div>
                  <div className="text-[7px] text-zinc-500 font-bold uppercase">Active</div>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: 'Active Customers', val: churnStats.activeCount, color: 'text-emerald-400', dot: 'bg-emerald-500' },
                  { label: 'Lost Customers', val: churnStats.lostCount, color: 'text-rose-400', dot: 'bg-rose-500' },
                  { label: 'Total Portfolio', val: churnStats.totalCustomersCount, color: 'text-white', dot: 'bg-zinc-500' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      <span className="text-[9px] text-zinc-500 font-bold">{s.label}</span>
                    </div>
                    <span className={`text-xs font-black ${s.color}`}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top churn reasons */}
            <div>
              <div className="text-[8px] text-zinc-600 uppercase font-bold mb-2">สาเหตุหลักที่ลูกค้าหาย</div>
              <div className="space-y-2">
                {Object.entries(churnStats.reasonsBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count], i) => {
                  const maxCount = Math.max(...Object.values(churnStats.reasonsBreakdown || {}), 1);
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="text-zinc-400 font-bold truncate pr-2">{reason}</span>
                        <span className="text-zinc-500 shrink-0">{count}</span>
                      </div>
                      <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-700 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(churnStats.reasonsBreakdown || {}).length === 0 && (
                  <div className="text-[9px] text-zinc-600 font-bold">ไม่มีข้อมูลในช่วงนี้</div>
                )}
              </div>
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="bg-zinc-900 rounded-2xl border border-white/5 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-yellow-400" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Strategic Insights</span>
            </div>

            {/* Weekly frequency breakdown - compact */}
            <div>
              <div className="text-[8px] text-zinc-600 uppercase font-bold mb-2">ความถี่ติดตามลูกค้าประจำ</div>
              <div className="space-y-1.5">
                {Object.entries(stats?.frequencyStats || {}).filter(([, g]) => g.total > 0).map(([key, g]) => {
                  const boughtPct = g.total > 0 ? (g.bought / g.total) * 100 : 0;
                  const followPct = g.total > 0 ? (g.followup / g.total) * 100 : 0;
                  const lostPct = g.total > 0 ? (g.lost / g.total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-12 text-[8px] text-zinc-500 font-bold shrink-0">{g.label}</div>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                        {boughtPct > 0 && <div className="bg-emerald-600 h-full" style={{ width: `${boughtPct}%` }} />}
                        {followPct > 0 && <div className="bg-amber-600 h-full" style={{ width: `${followPct}%` }} />}
                        {lostPct > 0 && <div className="bg-rose-700 h-full" style={{ width: `${lostPct}%` }} />}
                      </div>
                      <div className="text-[8px] text-zinc-500 font-bold w-6 text-right shrink-0">{g.total}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {[{ color: 'bg-emerald-600', label: 'ซื้อ' }, { color: 'bg-amber-600', label: 'ติดตาม' }, { color: 'bg-rose-700', label: 'หาย' }].map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-[7px] text-zinc-600 font-bold"><span className={`w-1.5 h-1.5 rounded-sm ${s.color}`} />{s.label}</span>
                ))}
              </div>
            </div>

            {/* Action recommendations */}
            <div className="flex-1">
              <div className="text-[8px] text-zinc-600 uppercase font-bold mb-2">คำแนะนำสำหรับสัปดาห์ถัดไป</div>
              <div className="space-y-2">
                {[
                  churnRate > 15 && {
                    priority: 'HIGH', icon: '🔴',
                    msg: `เร่งแก้ปัญหา Churn — ลูกค้า ${churnStats.lostCount} รายต้องได้รับการติดตาม`
                  },
                  (stats?.unassigned || 0) > 0 && {
                    priority: 'HIGH', icon: '🟠',
                    msg: `มอบหมายลูกค้า ${stats?.unassigned} รายที่ยังไม่มีเจ้าของให้ทีมโดยด่วน`
                  },
                  eff < 15 && {
                    priority: 'MEDIUM', icon: '🟡',
                    msg: `Efficiency ต่ำ (${eff}%) — ควร coaching และ review script การขาย`
                  },
                  followsDone < followsTotal * 0.6 && {
                    priority: 'MEDIUM', icon: '🟡',
                    msg: `ทีมทำได้แค่ ${followsDone}/${followsTotal} follow-ups — เพิ่มแรงกดดัน`
                  },
                  {
                    priority: 'LOW', icon: '🟢',
                    msg: `เน้น ${stats?.qualified || 0} รายที่ "รอตัดสินใจ" ให้ปิดยอดให้ได้สัปดาห์นี้`
                  },
                ].filter(Boolean).slice(0, 4).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-sm leading-none mt-0.5">{rec.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${rec.priority === 'HIGH' ? 'text-rose-400' : rec.priority === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>{rec.priority}</div>
                      <div className="text-[9px] text-zinc-400 font-bold leading-relaxed">{rec.msg}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer timestamp ── */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest flex items-center gap-2">
            <Pulse color="bg-zinc-600" />
            Last updated: {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[9px] text-zinc-700 font-bold uppercase tracking-widest">ColdCall Command Center V3 · Executive Edition</div>
        </div>

      </div>
    </div>
  );
};

export default ManagerDashboardV3;
