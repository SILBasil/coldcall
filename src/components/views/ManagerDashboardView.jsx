import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp as ActivityIcon, AlertCircle as AlertIcon, Clock as HistoryIcon, 
  Phone as PhoneIcon, Target, TrendingUp, Users, PhoneCall, CheckCircle2, 
  Award, ChevronRight, ChevronLeft, Loader2, Database, TrendingDown, X, Calendar,
  RotateCw, ShieldCheck, Zap, Medal, Flame, Timer, Repeat
} from 'lucide-react';

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
import { leadService } from '../../services/leadService';
import { downloadWeeklyHTML } from '../../utils/htmlExporter';
import { ManagerSkeleton } from '../common/Skeleton';
import { dialog } from '../../utils/dialog';

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

  // New History States
  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Churn & Lost Customer Portfolio States
  const [churnStats, setChurnStats] = useState({
    lostCount: 0,
    activeRatio: 100,
    totalCustomersCount: 0,
    activeCount: 0,
    reasonsBreakdown: {},
    weeklyReports: [],
    weeklyVarianceText: 'สถิติคงที่เทียบกับสัปดาห์ก่อน',
    weeklyVarianceClass: 'bg-slate-50 text-slate-600',
    loading: true
  });

  const fetchChurnStats = async () => {
    try {
      const res = await leadService.getLostCustomers(null);
      const rawRes = await leadService.getCustomersByStage('customer', null, 1, 1000);
      const portfolioCount = rawRes.pagination?.total || 0;
      const reports = await leadService.getWeeklyLostReports();

      const lostCount = res.total;
      const activeCount = Math.max(0, portfolioCount - lostCount);
      const activeRatio = portfolioCount > 0 ? Math.round((activeCount / portfolioCount) * 100) : 100;

      let weeklyVarianceText = 'สถิติคงที่เทียบกับสัปดาห์ก่อน';
      let weeklyVarianceClass = 'bg-slate-50 text-slate-600';
      
      if (reports.length >= 2) {
        const currentWeekCount = reports[0].lostCount || 0;
        const prevWeekCount = reports[1].lostCount || 0;
        const diff = currentWeekCount - prevWeekCount;
        
        if (diff > 0) {
          weeklyVarianceText = `เพิ่มขึ้น +${diff} รายจากสัปดาห์ก่อน`;
          weeklyVarianceClass = 'bg-rose-50 text-rose-600 border border-rose-100';
        } else if (diff < 0) {
          weeklyVarianceText = `ลดลง ${diff} รายจากสัปดาห์ก่อน`;
          weeklyVarianceClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
        }
      }

      setChurnStats({
        lostCount,
        activeRatio,
        totalCustomersCount: portfolioCount,
        activeCount,
        reasonsBreakdown: res.reasonsBreakdown,
        weeklyReports: reports,
        weeklyVarianceText,
        weeklyVarianceClass,
        loading: false
      });
    } catch (err) {
      console.error("Error fetching churn stats:", err);
    }
  };

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

      // 2. Fetch history for week/month mode
      await fetchHistoryData(baseDate, mode);
      
      // 3. Fetch Churn & Lost Customer Portfolio Stats
      await fetchChurnStats();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistoryData = async (refDate, currentMode) => {
    setIsWeeklyLoading(true);
    setIsHistoryLoading(true);
    try {
      const numPeriods = 6;
      const periodStarts = [];
      
      if (currentMode === 'month') {
        // Last 6 months starting from refDate
        for (let i = 0; i < numPeriods; i++) {
          const d = new Date(refDate.getFullYear(), refDate.getMonth() - ((numPeriods - 1) - i), 1, 0, 0, 0, 0);
          periodStarts.push(d);
        }
      } else {
        // Last 6 weeks starting from refDate
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

      // Fetch stats for each period
      let historyResults = [];
      if (currentMode === 'week') {
        // const snapshots = await leadService.getHistoricalDashboardStats(refDate, numPeriods);
        // if (snapshots && snapshots.length === numPeriods) {
        //   historyResults = snapshots;
        // } else {
          // Fallback to dynamic generation if snapshots are missing/incomplete
          historyResults = await Promise.all(
            periodStarts.map(start => leadService.getStats(start, currentMode))
          );
        // }
      } else {
        historyResults = await Promise.all(
          periodStarts.map(start => leadService.getStats(start, currentMode))
        );
      }

      setHistoryData(historyResults);

      const ratesMap = {};
      // Initialize map for all admins
      const allUsers = await leadService.getUsers();
      const adminList = allUsers.filter(u => u.role === 'admin');
      adminList.forEach(a => { ratesMap[a.id] = Array(numPeriods).fill('-'); });

      // Fill rates from adminDetails data
      historyResults.forEach((periodData, periodIdx) => {
        const adminDetails = periodData.weeklyStats?.adminDetails || {};
        Object.entries(adminDetails).forEach(([adminId, entry]) => {
          if (ratesMap[adminId]) {
            ratesMap[adminId][periodIdx] = entry.rate || '0%';
          }
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

  useEffect(() => {
    fetchStats();
  }, [baseDate, mode]);


  const getPeriodLabels = (referenceDate, currentMode, numPeriods = 6) => {
    if (currentMode === 'month') {
      const months = [];
      for (let i = 0; i < numPeriods; i++) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - ((numPeriods - 1) - i), 1);
        months.push({
          start: d,
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0),
          label: d.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })
        });
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
         weeks.push({ 
           start, 
           end, 
           label: `${start.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}`
         });
      }
      return weeks.reverse();
    }
  };

  const currentPeriods = getPeriodLabels(baseDate, mode, 6);

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

  const renderCategoryBar = (label, dataKey, colors) => {
    const stageData = stats.categoryBreakdown?.[dataKey] || { total: 0, done: 0, remaining: 0, lost: 0 };
    const total = stageData.total || 0;
    
    const donePct = total > 0 ? Math.round((stageData.done / total) * 100) : 0;
    const remainingPct = total > 0 ? Math.round((stageData.remaining / total) * 100) : 0;
    const lostPct = total > 0 ? Math.round((stageData.lost / total) * 100) : 0;

    return (
      <div className="space-y-2 relative group font-sans">
        <div className="flex justify-between items-center text-xs font-black text-slate-700">
          <span className="flex items-center gap-1.5 font-bold tracking-tight">
            <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            {label}
          </span>
          <span className="font-extrabold text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">ทั้งหมด {total} ราย</span>
        </div>

        {/* Stacked Bar Container */}
        <div className="h-6 w-full bg-slate-100 rounded-full flex overflow-hidden shadow-inner border border-slate-200/50">
          {total === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              ไม่มีข้อมูลในระบบ
            </div>
          ) : (
            <>
              {stageData.done > 0 && (
                <div 
                  style={{ width: `${(stageData.done / total) * 100}%` }}
                  className="bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-105 transition-all duration-300 h-full cursor-help shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                />
              )}
              {stageData.remaining > 0 && (
                <div 
                  style={{ width: `${(stageData.remaining / total) * 100}%` }}
                  className="bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 transition-all duration-300 h-full cursor-help shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                />
              )}
              {stageData.lost > 0 && (
                <div 
                  style={{ width: `${(stageData.lost / total) * 100}%` }}
                  className="bg-gradient-to-r from-rose-400 to-rose-500 hover:brightness-105 transition-all duration-300 h-full cursor-help shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                />
              )}
            </>
          )}
        </div>

        {/* Interactive Hover Tooltip card */}
        {total > 0 && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-40 bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-3xl shadow-2xl w-72 border border-slate-800 text-xs font-sans transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="font-black border-b border-white/10 pb-2 mb-3 text-sm tracking-tight flex items-center justify-between">
              <span>📊 รายละเอียด: {label}</span>
              <span className="text-slate-400 font-extrabold text-[11px]">{total} ราย</span>
            </div>
            <div className="space-y-2.5 font-bold">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ทำเสร็จแล้ว (Done):
                </span>
                <span className="text-emerald-400 font-extrabold">{stageData.done} ราย ({donePct}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  คงเหลือ (Remaining):
                </span>
                <span className="text-amber-400 font-extrabold">{stageData.remaining} ราย ({remainingPct}%)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  ลูกค้าหาย (Lost):
                </span>
                <span className="text-rose-400 font-extrabold">{stageData.lost} ราย ({lostPct}%)</span>
              </div>
              
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-wider">
                <span>อัตราความสำเร็จ:</span>
                <span className="text-sky-400 font-black text-xs">{total > 0 ? Math.round((stageData.done / total) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGrowthChart = () => {
    if (isHistoryLoading || historyData.length === 0) {
      return (
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-xs font-bold text-slate-400">กำลังประมวลผลข้อมูลแนวโน้มเติบโต...</p>
        </div>
      );
    }

    const numPoints = historyData.length;
    const maxVal = Math.max(
      ...historyData.map(h => h.growthStats?.newCustomersCount || 0),
      ...historyData.map(h => h.growthStats?.pendingDecisionCount || 0),
      ...historyData.map(h => h.growthStats?.regularFollowUps || 0),
      ...historyData.map(h => h.growthStats?.regularLostCount || 0),
      4
    );
    
    const getX = (index) => 45 + (index / (numPoints - 1)) * 410;
    const getY = (val) => 20 + (1 - val / maxVal) * 130;

    // Paths
    let newCustLine = "";
    let pendingDecLine = "";
    let regFollowLine = "";
    let regLostLine = "";

    let newCustArea = "";
    let pendingDecArea = "";
    let regFollowArea = "";
    let regLostArea = "";

    historyData.forEach((h, idx) => {
      const x = getX(idx);
      const valNewCust = h.growthStats?.newCustomersCount || 0;
      const valPendingDec = h.growthStats?.pendingDecisionCount || 0;
      const valRegFollow = h.growthStats?.regularFollowUps || 0;
      const valRegLost = h.growthStats?.regularLostCount || 0;

      const yNewCust = getY(valNewCust);
      const yPendingDec = getY(valPendingDec);
      const yRegFollow = getY(valRegFollow);
      const yRegLost = getY(valRegLost);

      if (idx === 0) {
        newCustLine = `M ${x} ${yNewCust}`;
        pendingDecLine = `M ${x} ${yPendingDec}`;
        regFollowLine = `M ${x} ${yRegFollow}`;
        regLostLine = `M ${x} ${yRegLost}`;

        newCustArea = `M ${x} 150 L ${x} ${yNewCust}`;
        pendingDecArea = `M ${x} 150 L ${x} ${yPendingDec}`;
        regFollowArea = `M ${x} 150 L ${x} ${yRegFollow}`;
        regLostArea = `M ${x} 150 L ${x} ${yRegLost}`;
      } else {
        newCustLine += ` L ${x} ${yNewCust}`;
        pendingDecLine += ` L ${x} ${yPendingDec}`;
        regFollowLine += ` L ${x} ${yRegFollow}`;
        regLostLine += ` L ${x} ${yRegLost}`;

        newCustArea += ` L ${x} ${yNewCust}`;
        pendingDecArea += ` L ${x} ${yPendingDec}`;
        regFollowArea += ` L ${x} ${yRegFollow}`;
        regLostArea += ` L ${x} ${yRegLost}`;
      }

      if (idx === numPoints - 1) {
        newCustArea += ` L ${x} 150 Z`;
        pendingDecArea += ` L ${x} 150 Z`;
        regFollowArea += ` L ${x} 150 Z`;
        regLostArea += ` L ${x} 150 Z`;
      }
    });

    return (
      <div className="w-full font-sans">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-sky-500 rounded-full" />
              <span className="text-slate-600">ลูกค้าใหม่ (ราย)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-amber-500 rounded-full" />
              <span className="text-slate-600">รอตัดสินใจ (ราย)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-slate-600">ตามลูกค้าประจำ (ครั้ง)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-1.5 bg-rose-500 rounded-full" />
              <span className="text-slate-600">ลูกค้าประจำที่หาย (ราย)</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <svg viewBox="0 0 500 180" className="w-full overflow-visible select-none">
            <defs>
              <linearGradient id="newCustGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="pendingDecGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="regFollowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="regLostGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
              const y = 20 + r * 130;
              return (
                <line 
                  key={idx} 
                  x1="45" 
                  y1={y} 
                  x2="455" 
                  y2={y} 
                  stroke="#f1f5f9" 
                  strokeWidth="1" 
                />
              );
            })}

            {/* Paths and Area Fills */}
            {newCustArea && <path d={newCustArea} fill="url(#newCustGrad)" />}
            {pendingDecArea && <path d={pendingDecArea} fill="url(#pendingDecGrad)" />}
            {regFollowArea && <path d={regFollowArea} fill="url(#regFollowGrad)" />}
            {regLostArea && <path d={regLostArea} fill="url(#regLostGrad)" />}

            {newCustLine && <path d={newCustLine} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {pendingDecLine && <path d={pendingDecLine} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {regFollowLine && <path d={regFollowLine} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {regLostLine && <path d={regLostLine} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Y-Axis Left (Customers Count) */}
            <text x="35" y={getY(0)} textAnchor="end" className="text-[9px] font-black fill-slate-400">0</text>
            <text x="35" y={getY(maxVal / 2)} textAnchor="end" className="text-[9px] font-black fill-slate-400">{Math.round(maxVal / 2)}</text>
            <text x="35" y={getY(maxVal)} textAnchor="end" className="text-[9px] font-black fill-slate-400">{Math.round(maxVal)}</text>

            {/* Y-Axis Right (Customers Count) */}
            <text x="465" y={getY(0)} textAnchor="start" className="text-[9px] font-black fill-slate-400">0</text>
            <text x="465" y={getY(maxVal / 2)} textAnchor="start" className="text-[9px] font-black fill-slate-400">{Math.round(maxVal / 2)}</text>
            <text x="465" y={getY(maxVal)} textAnchor="start" className="text-[9px] font-black fill-slate-400">{Math.round(maxVal)}</text>

            {/* Dots on Curves */}
            {historyData.map((h, idx) => {
              const x = getX(idx);
              const valNewCust = h.growthStats?.newCustomersCount || 0;
              const valPendingDec = h.growthStats?.pendingDecisionCount || 0;
              const valRegFollow = h.growthStats?.regularFollowUps || 0;
              const valRegLost = h.growthStats?.regularLostCount || 0;

              const yNewCust = getY(valNewCust);
              const yPendingDec = getY(valPendingDec);
              const yRegFollow = getY(valRegFollow);
              const yRegLost = getY(valRegLost);

              let label = "";
              if (mode === 'month') {
                label = h.periodLabel ? h.periodLabel.split(" ")[0].substring(0, 3) : "";
              } else {
                label = `W${idx + 1}`;
              }

              const tooltipText = `ช่วงเวลา: ${h.periodLabel}\n• ลูกค้าใหม่ (ปิดดีลได้): ${valNewCust} ราย\n• ลูกค้ารอตัดสินใจ: ${valPendingDec} ราย\n• ติดตามลูกค้าประจำ: ${valRegFollow} ครั้ง\n• ลูกค้าประจำที่หาย: ${valRegLost} ราย`;

              return (
                <g key={idx} className="group/node">
                  {/* X-Axis Labels */}
                  <text 
                    x={x} 
                    y="168" 
                    textAnchor="middle" 
                    className="text-[9px] font-extrabold fill-slate-400"
                  >
                    {label}
                  </text>

                  {/* Vertical hover guide line */}
                  <line 
                    x1={x} 
                    y1="20" 
                    x2={x} 
                    y2="150" 
                    stroke="#e2e8f0" 
                    strokeWidth="1" 
                    strokeDasharray="3" 
                    className="opacity-0 group-hover/node:opacity-100 transition-opacity" 
                  />

                  {/* New Customer dot */}
                  <circle cx={x} cy={yNewCust} r="3.5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2" />
                  <circle cx={x} cy={yNewCust} r="8" fill="#0ea5e9" opacity="0" className="cursor-pointer hover:opacity-10 transition-all duration-200">
                    <title>{tooltipText}</title>
                  </circle>

                  {/* Pending Decision dot */}
                  <circle cx={x} cy={yPendingDec} r="3.5" fill="#ffffff" stroke="#f59e0b" strokeWidth="2" />
                  <circle cx={x} cy={yPendingDec} r="8" fill="#f59e0b" opacity="0" className="cursor-pointer hover:opacity-10 transition-all duration-200">
                    <title>{tooltipText}</title>
                  </circle>

                  {/* Regular Follow-up dot */}
                  <circle cx={x} cy={yRegFollow} r="3.5" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                  <circle cx={x} cy={yRegFollow} r="8" fill="#10b981" opacity="0" className="cursor-pointer hover:opacity-10 transition-all duration-200">
                    <title>{tooltipText}</title>
                  </circle>

                  {/* Regular Lost dot */}
                  <circle cx={x} cy={yRegLost} r="3.5" fill="#ffffff" stroke="#f43f5e" strokeWidth="2" />
                  <circle cx={x} cy={yRegLost} r="8" fill="#f43f5e" opacity="0" className="cursor-pointer hover:opacity-10 transition-all duration-200">
                    <title>{tooltipText}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

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
    <div className={`space-y-4 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-6 relative ${refreshing ? 'opacity-50 pointer-events-none' : ''}`}>
      
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {topStats.map((s, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all duration-300 relative overflow-hidden flex items-center gap-3">
            {refreshing && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10 animate-pulse" />}
            <div className={`p-2.5 rounded-xl ${s.bg} shrink-0`}><s.Icon size={18} className={s.color} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{s.label}</div>
              <div className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-0.5">{s.value}</div>
              <div className="text-[10px] font-bold text-slate-400 italic truncate">{s.sub}</div>
            </div>
            {s.trend !== null && (
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${parseFloat(s.trend) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{s.trend}%</span>
            )}
          </div>
        ))}
      </div>


      {/* Bot Funnel Flow (Compact) */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-4 shadow-md text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-bl-full -mr-12 -mt-12 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-tight flex items-center gap-1.5 italic text-amber-400">
              <Flame size={14} /> ความเคลื่อนไหวของดีล
            </div>
            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-0.5">Bot → สนใจจริง → รอตัดสินใจ → ลูกค้าประจำ</p>
          </div>
          <div className="grid grid-cols-4 gap-2 flex-1 max-w-2xl w-full">
            {[
              { label: 'บอทคัดกรอง', val: stats.weeklyFunnelFlow?.botProcessed ?? 0 },
              { label: 'สนใจจริง', val: stats.weeklyFunnelFlow?.toQualified ?? 0 },
              { label: 'รอตัดสินใจ', val: stats.weeklyFunnelFlow?.toDecision ?? 0 },
              { label: 'ลูกค้าประจำ', val: stats.weeklyFunnelFlow?.toCustomer ?? 0 },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                <div className="text-[8px] font-black text-white/50 uppercase tracking-wide">{item.label}</div>
                <div className="text-lg font-black text-white">{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── NEW CHARTS SECTION (STAGE BREAKDOWN & GROWTH) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Stage Status Breakdown (lg:col-span-7) */}
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
            
            {/* Legend indicators */}
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
                {/* Horizontal grid lines */}
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
                        {/* Total badge */}
                        {g.total > 0 && (
                          <span className="text-[10px] font-black text-slate-700 mb-1.5 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md shadow-sm opacity-90 transition-all group-hover:scale-110">
                            {g.total}
                          </span>
                        )}

                        {/* Vertical Stacked Bar */}
                        <div 
                          style={{ height: g.total > 0 ? `${barHeightPct}%` : '8px' }}
                          className={`w-10 rounded-xl overflow-hidden flex flex-col justify-end shadow-md transition-all duration-500 border border-slate-200/50 hover:shadow-lg hover:scale-105 cursor-pointer ${g.total === 0 ? 'bg-slate-50 border-dashed border-slate-300' : ''}`}
                        >
                          {g.total > 0 ? (
                            <>
                              {g.remaining > 0 && (
                                <div 
                                  style={{ height: `${(g.remaining / g.total) * 100}%` }}
                                  className="w-full bg-gradient-to-t from-slate-300 to-slate-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]"
                                  title={`คงเหลือ: ${g.remaining}`}
                                />
                              )}
                              {g.lost > 0 && (
                                <div 
                                  style={{ height: `${(g.lost / g.total) * 100}%` }}
                                  className="w-full bg-gradient-to-t from-rose-500 to-rose-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]"
                                  title={`หาย: ${g.lost}`}
                                />
                              )}
                              {g.followup > 0 && (
                                <div 
                                  style={{ height: `${(g.followup / g.total) * 100}%` }}
                                  className="w-full bg-gradient-to-t from-amber-500 to-amber-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]"
                                  title={`ติดตาม: ${g.followup}`}
                                />
                              )}
                              {g.bought > 0 && (
                                <div 
                                  style={{ height: `${(g.bought / g.total) * 100}%` }}
                                  className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]"
                                  title={`ซื้อ: ${g.bought}`}
                                />
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full bg-transparent" />
                          )}
                        </div>

                        {/* X Axis Label */}
                        <span className="text-[10px] font-black text-slate-600 mt-2.5 truncate max-w-full text-center">
                          {g.label}
                        </span>

                        {/* Premium Tooltip Card */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 hidden group-hover:block z-50 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl w-60 border border-slate-800 text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
                          <div className="font-extrabold border-b border-white/10 pb-1.5 mb-2.5 text-sm tracking-tight flex items-center justify-between">
                            <span>📊 ความถี่: {g.label}</span>
                            <span className="text-slate-400 font-extrabold">{g.total} ราย</span>
                          </div>
                          <div className="space-y-2 font-bold">
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> สั่งซื้อสำเร็จ (ซื้อ)
                              </span>
                              <span className="text-emerald-400 font-black">{g.bought} ({g.total > 0 ? Math.round((g.bought / g.total) * 100) : 0}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-amber-400" /> รอติดตาม (ติดตาม)
                              </span>
                              <span className="text-amber-400 font-black">{g.followup} ({g.total > 0 ? Math.round((g.followup / g.total) * 100) : 0}%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-rose-400" /> หาย (ไม่รับ/ไม่ซื้อ)
                              </span>
                              <span className="text-rose-400 font-black">{g.lost} ({g.total > 0 ? Math.round((g.lost / g.total) * 100) : 0}%)</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/5 pt-1.5 mt-1.5">
                              <span className="flex items-center gap-1.5 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-slate-400" /> คงเหลือ (ยังไม่ทำ)
                              </span>
                              <span className="text-slate-300 font-black">{g.remaining} ({g.total > 0 ? Math.round((g.remaining / g.total) * 100) : 0}%)</span>
                            </div>
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

        {/* Growth Trend (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between group/growth">
          <div className="border-b border-slate-50 pb-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
                <TrendingUp className="text-emerald-500 animate-pulse" size={18} /> กราฟแนวโน้มความเติบโต (Growth Trend Chart)
              </div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">
                รายงานความเติบโตลูกค้าใหม่, รอตัดสินใจ และกลุ่มลูกค้าประจำ 6 {mode === 'month' ? 'เดือน' : 'สัปดาห์'} ล่าสุด
              </p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            {renderGrowthChart()}
          </div>

          {/* Active Period Totals Summary Card */}
          <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-4 mt-4 text-center">
            <div className="bg-sky-50/50 p-2.5 rounded-2xl border border-sky-100">
              <div className="text-[9px] font-black text-sky-600 uppercase tracking-tight">ลูกค้าใหม่</div>
              <div className="text-base font-black text-sky-700 mt-0.5">{stats.growthStats?.newCustomersCount || 0}</div>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-100">
              <div className="text-[9px] font-black text-amber-600 uppercase tracking-tight">รอตัดสินใจ</div>
              <div className="text-base font-black text-amber-700 mt-0.5">{stats.growthStats?.pendingDecisionCount || 0}</div>
            </div>
            <div className="bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-100">
              <div className="text-[9px] font-black text-emerald-600 uppercase tracking-tight flex items-center justify-center gap-0.5 flex-wrap"><span>ตามลูกค้า</span><span>ประจำ</span></div>
              <div className="text-base font-black text-emerald-700 mt-0.5">{stats.growthStats?.regularFollowUps || 0}</div>
            </div>
            <div className="bg-rose-50/50 p-2.5 rounded-2xl border border-rose-100">
              <div className="text-[9px] font-black text-rose-600 uppercase tracking-tight flex items-center justify-center gap-0.5 flex-wrap"><span>ลูกค้าประจำ</span><span>ที่หาย</span></div>
              <div className="text-base font-black text-rose-700 mt-0.5">{stats.growthStats?.regularLostCount || 0}</div>
            </div>
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
                        {/* Funnel Level 5: Lost Customers */}
                        <div className="flex items-center justify-center group">
                           <div className="w-[30%] h-8 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center justify-between px-4 transition-all hover:bg-rose-500/40">
                             <span className="text-[10px] font-black uppercase text-rose-300">ลูกค้าหาย (Lost)</span>
                             <span className="text-sm font-black text-rose-300">{stats.lost}</span>
                           </div>
                        </div>
                     </div>
                    <div className="grid grid-cols-2 gap-3 pt-4 text-slate-100">
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
                       <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 hover:bg-white/10 transition-all group/card shadow-sm cursor-pointer active:scale-95">
                          <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.1em] mb-2 group-hover/card:text-rose-400 transition-colors">ลูกค้าหาย (Lost)</div>
                          <div className="text-2xl font-black text-rose-400 tracking-tighter">{stats.lost}</div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

       </div>
       </div>

       {/* ─── CHURN & LOST CUSTOMER ANALYSIS SECTION ─── */}
      <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 mt-6">
         <div className="border-b border-slate-100 pb-4">
            <div className="text-xl font-black text-slate-900 tracking-tighter italic uppercase flex items-center gap-3">
               <Users className="text-rose-500" size={20} /> วิเคราะห์และรายงานลูกค้าที่หยุดเคลื่อนไหว (Churn & Lost Customers Portfolio)
            </div>
            <p className="text-xs font-black text-slate-600 mt-1 opacity-70 italic">
               สรุปข้อมูลลูกค้าประจำที่มีสถานะหยุดเคลื่อนไหว (เช่น ปิดเครื่อง, ไม่สนใจ, เลิกขาย) เพื่อวิเคราะห์อัตราการสูญเสียลูกค้า (Churn Rate)
            </p>
         </div>

         {/* Metric row */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Total Lost */}
            <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 shadow-inner relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    ลูกค้าหยุดเคลื่อนไหว (Total Lost)
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 italic mt-1.5 leading-none">
                    {churnStats.loading ? '...' : `${churnStats.lostCount} ราย`}
                  </h3>
                </div>
                <div className="bg-rose-50 text-rose-500 p-2.5 rounded-xl">
                  <Users size={18} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${churnStats.weeklyVarianceClass}`}>
                  {churnStats.weeklyVarianceText}
                </span>
              </div>
            </div>

            {/* Metric 2: Active Retention Rate */}
            <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 shadow-inner relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Active Retention Rate
                  </span>
                  <h3 className="text-2xl font-black text-emerald-600 italic mt-1.5 leading-none">
                    {churnStats.loading ? '...' : `${churnStats.activeRatio}%`}
                  </h3>
                </div>
                <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-xl">
                  <Award size={18} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-slate-500 text-[10px] font-bold">
                <span>สั่งซื้อสำเร็จต่อเนื่องในระบบ</span>
                <span className="text-emerald-600 font-extrabold">{churnStats.activeCount} / {churnStats.totalCustomersCount} ราย</span>
              </div>
            </div>

            {/* Metric 3: Total Portfolio */}
            <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 shadow-inner relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    ลูกค้าประจำทั้งหมด (Retention Portfolio)
                  </span>
                  <h3 className="text-2xl font-black text-slate-700 italic mt-1.5 leading-none">
                    {churnStats.loading ? '...' : `${churnStats.totalCustomersCount} ราย`}
                  </h3>
                </div>
                <div className="bg-sky-50 text-primary p-2.5 rounded-xl">
                  <Repeat size={18} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                <AlertIcon size={12} className="text-amber-500" />
                <span>อัตราการหยุดเคลื่อนไหวสะสม</span>
                <span className="text-rose-600 font-extrabold">{(churnStats.totalCustomersCount > 0 ? Math.round((churnStats.lostCount / churnStats.totalCustomersCount) * 100) : 0)}%</span>
              </div>
            </div>
         </div>

         {/* Graphs row */}
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Reasons Breakdown */}
            <div className="lg:col-span-7 bg-slate-50/40 p-5 rounded-3xl border border-slate-100 shadow-inner flex flex-col min-w-0">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider italic flex items-center gap-2 mb-4">
                 <AlertIcon size={14} className="text-rose-500" />
                 สรุปสาเหตุการไม่ซื้อสินค้า (Churn Reasons Breakdown)
              </h4>
              <div className="space-y-3.5 flex-1">
                 {churnStats.loading ? (
                   <div className="py-12 flex items-center justify-center text-slate-400 font-bold italic text-xs">กำลังวิเคราะห์ข้อมูล...</div>
                 ) : Object.keys(churnStats.reasonsBreakdown).length > 0 ? (
                   Object.entries(churnStats.reasonsBreakdown)
                     .map(([reason, count]) => ({
                       reason,
                       count,
                       percent: churnStats.lostCount > 0 ? Math.round((count / churnStats.lostCount) * 100) : 0,
                       style: STATUS_COLORS[reason] || { bg: 'bg-slate-100 text-slate-800 border-slate-200', bar: 'bg-slate-400' }
                     }))
                     .sort((a, b) => b.count - a.count)
                     .map(({ reason, count, percent, style }) => (
                       <div key={reason} className="space-y-1">
                         <div className="flex justify-between items-center text-[11px] font-black text-slate-700">
                           <span className="truncate pr-4 flex items-center gap-1.5">
                             <span className={`w-2 h-2 rounded-full ${style.bar}`}></span>
                             {reason}
                           </span>
                           <span className="shrink-0 text-slate-500">{count} ราย ({percent}%)</span>
                         </div>
                         <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden border border-slate-100">
                           <div className={`h-full ${style.bar} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
                         </div>
                       </div>
                     ))
                 ) : (
                   <div className="py-12 text-center text-slate-400 font-black italic text-xs uppercase tracking-widest">ไม่มีข้อมูลสาเหตุหยุดเคลื่อนไหวในระบบขณะนี้</div>
                 )}
              </div>
            </div>

            {/* Right Column: Weekly Report history timeline */}
            <div className="lg:col-span-5 bg-slate-50/40 p-5 rounded-3xl border border-slate-100 shadow-inner flex flex-col min-w-0">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider italic flex items-center gap-2 mb-4">
                 <Calendar size={14} className="text-primary" />
                 ประวัติจำนวนสะสมรายสัปดาห์ (Weekly Report History)
              </h4>
              <div className="overflow-y-auto max-h-[200px] pr-1 custom-scrollbar flex-1">
                 {churnStats.loading ? (
                   <div className="py-12 flex items-center justify-center text-slate-400 font-bold italic text-xs">กำลังดึงประวัติ...</div>
                 ) : churnStats.weeklyReports.length > 0 ? (
                   <div className="relative border-l border-slate-200 ml-2 pl-4 space-y-4">
                     {churnStats.weeklyReports.map((report) => (
                       <div key={report.id} className="relative group text-xs">
                         <div className="absolute -left-[21px] top-0.5 w-2 h-2 bg-white rounded-full border-2 border-primary group-hover:bg-primary transition-all"></div>
                         <div className="flex justify-between items-center gap-2">
                           <div>
                             <div className="font-black text-slate-800">สัปดาห์: <span className="text-primary font-black italic">{report.weekId}</span></div>
                             <div className="text-[10px] text-slate-400 mt-0.5">{report.startDate} - {report.endDate}</div>
                           </div>
                           <span className="bg-rose-50 text-rose-700 border border-rose-100 rounded-lg px-2 py-0.5 font-black text-[10px] italic">
                             {report.lostCount || 0} ราย
                           </span>
                         </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="py-12 text-center text-slate-400 font-black italic text-xs uppercase tracking-widest">ยังไม่มีรายงานรายสัปดาห์บันทึกไว้</div>
                 )}
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
               <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] mt-1 opacity-70 italic">อิงข้อมูลย้อนหลัง 6 {mode === 'month' ? 'เดือน' : 'สัปดาห์'}ล่าสุด และสถิติ Real-time</p>
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
                             {currentPeriods.map((w, idx) => {
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
         await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถดึงรายงานได้', icon: 'error' });
      }
    } catch (err) {
      console.error(err);
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการดาวน์โหลดรายงาน', icon: 'error' });
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
