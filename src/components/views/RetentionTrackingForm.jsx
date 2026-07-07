import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, UserCheck, ChevronLeft, Calendar, Check, 
  ShoppingBag, Save, Info, MessageSquare, AlertCircle, QrCode,
  Loader2, History as HistoryIcon, Clock, Phone as PhoneIcon, RotateCcw, Facebook, X, Plus
} from 'lucide-react';


import { MONTHS_TRACKING, WEEKS } from '../../constants';
import CustomSelect from '../common/CustomSelect';
import QRCodeModal from '../common/QRCodeModal';
import { leadService } from '../../services/leadService';
import ContactHistory from '../common/ContactHistory';
import HistoryCalendar from '../common/HistoryCalendar';

const parseThaiDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y > 2400) y = y - 543;
      return new Date(y, m, d);
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatThaiDate = (dateStr) => {
  if (!dateStr) return '-';
  const parsed = parseThaiDate(dateStr);
  if (!parsed) return dateStr;
  return parsed.getDate() + '/' + (parsed.getMonth() + 1) + '/' + (parsed.getFullYear() + 543);
};

const STATUS_OPTIONS = [
  { label: 'ปิดเครื่อง / ติดต่อไม่ได้', color: 'bg-rose-100 text-rose-600 border-rose-200' },
  { label: 'ไม่สนใจ', color: 'bg-rose-500 text-white border-rose-600' },
  { label: 'สั่งซื้อผ่านตัวแทนจำหน่าย', color: 'bg-orange-100 text-orange-600 border-orange-200' },
  { label: 'สั่งซื้อตรงกับโรงงาน/CLM', color: 'bg-purple-100 text-purple-600 border-purple-200' },
  { label: 'เลิกขาย/ปิดกิจการ', color: 'bg-slate-500 text-white border-slate-600' },
  { label: 'ยังไม่สะดวกคุยตอนนี้', color: 'bg-amber-100 text-amber-600 border-amber-200' },
  { label: 'เสนอขอตัวอย่างสินค้า', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  { label: 'ลูกค้ามีสินค้าเหลือในสต็อก', color: 'bg-emerald-600 text-white border-emerald-700' },
  { label: 'สั่งซื้อผ่านช่องทาง Shopee/Zort/Online', color: 'bg-orange-500 text-white border-orange-600' },
  { label: 'ส่งเสนอราคาเรียบร้อย', color: 'bg-primary text-white border-primary-dark' },
  { label: 'สั่งซื้อซ้ำสำเร็จ', color: 'bg-[#1E293B] text-white border-slate-900' },
  { label: 'ยังไม่ถึงรอบสั่งซื้อซ้ำ', color: 'bg-amber-500 text-white border-amber-600' },
  { label: 'ติดต่อยาก / รอสายยาว', color: 'bg-yellow-300 text-slate-800 border-yellow-400' },
  { label: 'ต้องการของแถม/โปรโมชั่นพิเศษ', color: 'bg-pink-500 text-white border-pink-600' },
];

const getTodayDate = () => {
  const mock = localStorage.getItem('mockTodayStr');
  if (mock) {
    return new Date(mock);
  }
  return new Date();
};

const getYearOptions = () => {
  const currentYear = getTodayDate().getFullYear();
  const currentThaiYear = currentYear + 543;
  const yearOptions = [];
  for (let y = currentThaiYear - 5; y <= currentThaiYear + 5; y++) {
    yearOptions.push({ value: y, label: 'พ.ศ. ' + y + ' (' + (y - 543) + ')' });
  }
  return yearOptions;
};

const formatDateKey = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const d = dateObj.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const RetentionTrackingForm = ({ customer, onBack, showToast, readonly = false, currentAdminId, currentAdminName }) => {
  const [selectedDateStr, setSelectedDateStr] = useState(() => formatDateKey(getTodayDate()));
  const [gridData, setGridData] = useState(customer.gridData || {});
  const [status, setStatus] = useState(customer.status || 'เสนอขอตัวอย่างสินค้า');
  const [type, setType] = useState(customer.type || 'ยังไม่เคยเปิดบิล');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [activeDialPhone, setActiveDialPhone] = useState(customer.activePhone || customer.phone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSocialEdit, setIsSocialEdit] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ 
    lineId: customer.lineId || '', 
    facebookUrl: customer.facebookUrl || '' 
  });
  const [remark, setRemark] = useState(customer.remark || '');
  const [channel, setChannel] = useState('Call');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [restoredHistoryLog, setRestoredHistoryLog] = useState(null);
  const [nextFollowUp, setNextFollowUp] = useState(null);
  const [freq, setFreq] = useState({ 
    amount: customer.freqAmount || 1, 
    unit: customer.freqUnit || 'สัปดาห์' 
  });
  const [selectedYear, setSelectedYear] = useState(() => getTodayDate().getFullYear() + 543);
  const [calYear, setCalYear] = useState(() => getTodayDate().getFullYear() + 543);
  const [calMonth, setCalMonth] = useState(() => getTodayDate().getMonth());
  const openedAtRef = React.useRef(Date.now());

  useEffect(() => {
    if (selectedDateStr) {
      const dailyRemark = gridData[`${selectedDateStr}-remark`];
      const dailyStatus = gridData[`${selectedDateStr}-status`];
      const dailyType = gridData[`${selectedDateStr}-type`];
      
      setRemark(dailyRemark !== undefined ? dailyRemark : (selectedDateStr === formatDateKey(getTodayDate()) ? (customer.remark || '') : ''));
      setStatus(dailyStatus !== undefined ? dailyStatus : (customer.status || 'เสนอขอตัวอย่างสินค้า'));
      setType(dailyType !== undefined ? dailyType : (customer.type || 'ยังไม่เคยเปิดบิล'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]);

  // Calculate next follow-up week based on latest activity in grid
  useEffect(() => {
    let latestOrderWeeks = -1;
    let latestActivityWeeks = -1;

    MONTHS_TRACKING.forEach((m, mIdx) => {
      WEEKS.forEach(w => {
        const total = mIdx * 4 + (w - 1);
        if (gridData[`${m}-${w}-order`] || gridData[`${m}-${w}-followup`]) {
          if (total > latestActivityWeeks) latestActivityWeeks = total;
        }
        if (gridData[`${m}-${w}-order`]) {
          if (total > latestOrderWeeks) latestOrderWeeks = total;
        }
      });
    });

    // Baseline: Latest Order if exists, otherwise Latest Activity, otherwise Current Week
    let baseline = latestOrderWeeks !== -1 ? latestOrderWeeks : latestActivityWeeks;
    
    if (baseline === -1) {
      const now = getTodayDate();
      const day = now.getDate();
      const curWeekIdx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
      baseline = now.getMonth() * 4 + curWeekIdx;
    }

    if (baseline !== -1) {
      const increment = freq.unit === 'เดือน' ? freq.amount * 4 : freq.amount;
      
      // Calculate next follow-up that is AFTER the latest activity (Auto-advance)
      let nextTotalWeeks = baseline + increment;
      while (nextTotalWeeks <= latestActivityWeeks) {
        nextTotalWeeks += increment;
      }

      const nextMonthIdx = Math.floor(nextTotalWeeks / 4) % 12;
      const nWeek = (nextTotalWeeks % 4) + 1;
      setNextFollowUp({ month: MONTHS_TRACKING[nextMonthIdx], week: nWeek });
    } else {
      setNextFollowUp(null);
    }
  }, [gridData, freq]);

  // Removed automatic pre-ticking on mount as requested.


  // Log 'open customer (Retention)' on mount and fetch history
  useEffect(() => {
    const init = async () => {
      try {
        await leadService.logActivity({
          adminId: currentAdminId,
          adminName: currentAdminName,
          customerId: customer.id || customer.phone,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerStage: 'customer',
          action: `เปิดข้อมูลการติดตามลูกค้าเก่า (Retention): ${customer.name}`,
          type: 'open'
        });
        const logs = await leadService.getSaveSnapshots(customer.id);
        setHistoryLogs(logs);
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [customer.id]);


  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const duration = Math.floor((Date.now() - openedAtRef.current) / 1000);
      
      let updatedGrid = { ...gridData };
      let updatedLastOrderDate = customer.lastOrderDate || null;

      // Save daily remark, status, type for the selected date inside the gridData map
      updatedGrid[`${selectedDateStr}-remark`] = remark;
      updatedGrid[`${selectedDateStr}-status`] = status;
      updatedGrid[`${selectedDateStr}-type`] = type;

      // Mark the selected week and day as "Followed up" (Checked) when saving
      const targetDate = parseThaiDate(selectedDateStr) || getTodayDate();
      const targetMonthIndex = targetDate.getMonth();
      const targetMonthName = MONTHS_TRACKING[targetMonthIndex];
      const targetDay = targetDate.getDate();
      const targetWeek = targetDay <= 7 ? 1 : targetDay <= 14 ? 2 : targetDay <= 21 ? 3 : 4;
      const targetYear = targetDate.getFullYear();
      const targetMonthStr = (targetMonthIndex + 1).toString().padStart(2, '0');
      const targetDayStr = targetDay.toString().padStart(2, '0');
      const targetDateKey = `${targetYear}-${targetMonthStr}-${targetDayStr}`;

      updatedGrid[`${targetMonthName}-${targetWeek}-followup`] = true;
      updatedGrid[`${targetDateKey}-followup`] = true;

      // Additionally mark as "Ordered" if status includes 'สั่งซื้อซ้ำ'
      if (status && status.includes('สั่งซื้อซ้ำ')) {
        updatedGrid[`${targetMonthName}-${targetWeek}-order`] = true;
        updatedGrid[`${targetDateKey}-order`] = true;
      }

      // Append to followupLogs
      let newFollowupLogs = customer.followupLogs || [];
      newFollowupLogs.push({
        id: `log-${Date.now()}`,
        date: targetDateKey,
        timestamp: new Date().toISOString(),
        admin: currentAdminName,
        action: status && status.includes('สั่งซื้อซ้ำ') ? 'order' : 'followup',
        reason: remark,
        channel: channel
      });

      // If the target week is marked as ordered in the grid, update lastOrderDate
      if (updatedGrid[`${targetMonthName}-${targetWeek}-order`]) {
        updatedLastOrderDate = targetDate.toLocaleDateString('th-TH');
      }

      await leadService.updateCustomer(customer.id || customer.phone, {
        gridData: updatedGrid,
        status,
        type,
        remark,
        followupLogs: newFollowupLogs,
        freqAmount: freq.amount,
        freqUnit: freq.unit,
        lineId: socialLinks.lineId,
        facebookUrl: socialLinks.facebookUrl,
        lastCallDate: targetDate.toLocaleDateString('th-TH'),
        lastOrderDate: updatedLastOrderDate
      });


      await leadService.logActivity({
        adminId: currentAdminId,
        adminName: currentAdminName,
        customerId: customer.id || customer.phone,
        customerName: customer.name,
        customerPhone: customer.phone,
        previousStage: 'customer',
        customerStage: 'customer',
        action: `บันทึกการติดตามลูกค้าเก่า (Retention) ประจำวันที่ ${formatThaiDate(selectedDateStr)} - สถานะ: ${status}`,
        type: 'save',
        details: remark,
        duration,
        snapshot: { gridData: updatedGrid, status, type, remark, freqAmount: freq.amount, freqUnit: freq.unit }
      });
      
      setGridData(updatedGrid);
      
      const updatedLogs = await leadService.getSaveSnapshots(customer.id || customer.phone);
      setHistoryLogs(updatedLogs);

      openedAtRef.current = Date.now(); // reset timer after save

      showToast("บันทึกการติดตามลูกค้าเก่าสำเร็จ ระบบกำลังพากลับหน้าหลัก...");
      
      setTimeout(() => {
        if (onBack) onBack();
      }, 1500);
    } catch (error) {
      console.error('Error saving retention:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลการติดตาม', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const logCall = async () => {
    if (readonly) return;
    try {
      setIsSubmitting(true);

      await leadService.logActivity({
        adminId: currentAdminId,
        adminName: currentAdminName,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        previousStage: 'customer',
        customerStage: 'customer',
        action: `โทรหาลูกค้าเก่า (Retention): ${status}`,
        type: 'call',
        details: remark
      });
      showToast("บันทึกประวัติการโทรสำเร็จ");
    } catch (error) {
       showToast("เกิดข้อผิดพลาดในการบันทึกประวัติการโทร", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGrid = (month, week, type) => {
    if (readonly) return;
    const key = `${month}-${week}-${type}`;
    const newState = !gridData[key];
    const updatedGrid = { ...gridData, [key]: newState };
    setGridData(updatedGrid);

    const orderKey = `${month}-${week}-order`;
    const followupKey = `${month}-${week}-followup`;
    const hasFollowup = updatedGrid[followupKey];
    const hasOrder = updatedGrid[orderKey];

    let delta = 0;
    if (type === 'followup') {
      if (newState && !hasOrder) delta = 1;
      if (!newState && !hasOrder) delta = -1;
    } else if (type === 'order') {
      if (newState && hasFollowup) delta = -1;
      if (!newState && hasFollowup) delta = 1;
    }

    if (delta !== 0) {
      setFreq(prev => {
        let newAmount = prev.amount + delta;
        let newUnit = prev.unit;
        if (delta > 0) {
          if (newUnit === 'สัปดาห์' && newAmount > 4) { newAmount = 1; newUnit = 'เดือน'; }
        } else {
          if (newAmount < 1) { if (newUnit === 'เดือน') { newAmount = 4; newUnit = 'สัปดาห์'; } else { newAmount = 1; } }
        }
        return { amount: newAmount, unit: newUnit };
      });
    }
  };

  const currentStatusStyle = STATUS_OPTIONS.find(s => s.label === status)?.color || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-5">
      {/* Profile Header - Premium Style */}
      <div className="bg-white rounded-3xl shadow-sm p-4 flex flex-wrap items-center justify-between border-l-[6px] border-emerald-500 gap-4 group">
        <div className="flex items-center gap-2">
          {/* Back Button on the far left */}
          <button
              onClick={onBack}
              className="group/back flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-white text-slate-600 hover:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-transparent hover:border-slate-100 shadow-sm active:scale-95 cursor-pointer"
            >
              <div className="p-1.5 bg-white group-hover/back:bg-emerald-50 rounded-xl transition-colors">
                <ChevronLeft size={16} className="group-hover/back:-translate-x-0.5 transition-transform" /> 
              </div>
              <span className="hidden md:inline">Back</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center text-xl font-black text-slate-800 shrink-0 shadow-inner border border-slate-100 group-hover:scale-105 transition-transform duration-500">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 leading-none mb-1.5 tracking-tighter italic">{customer.name}</div>
              <div className="flex flex-wrap gap-4 text-[11px] font-black text-slate-600 uppercase tracking-widest italic">
                <div className="flex flex-wrap gap-2 mt-1">
                   <div 
                     className={`flex items-center gap-2 group/phone cursor-pointer px-2 py-1 rounded-lg border transition-all ${activeDialPhone === customer.phone ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white'}`}
                     onClick={() => {
                        setActiveDialPhone(customer.phone);
                        setIsQrOpen(true);
                     }}
                   >
                      <PhoneCall size={10} className={activeDialPhone === customer.phone ? 'text-emerald-600' : 'text-slate-400'} /> 
                      <span className="font-black tracking-tight">{customer.phone}</span>
                      <QrCode size={10} className="opacity-40" />
                   </div>

                   {customer.allPhones?.filter(p => p !== customer.phone).map((p, i) => (
                     <div 
                       key={i}
                       className={`flex items-center gap-2 group/phone cursor-pointer px-2 py-1 rounded-lg border transition-all ${activeDialPhone === p ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-white'}`}
                       onClick={() => {
                          setActiveDialPhone(p);
                          setIsQrOpen(true);
                       }}
                     >
                        <PhoneCall size={10} className={activeDialPhone === p ? 'text-emerald-600' : 'text-slate-400'} /> 
                        <span className="font-black tracking-tight">{p}</span>
                        <QrCode size={10} className="opacity-40" />
                     </div>
                   ))}
                </div>
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-emerald-50 rounded-lg">
                      <UserCheck size={12} className="text-emerald-600" /> 
                   </div>
                   {customer.responsibleName || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 relative">
             {/* Edit Social Input Popover */}
             {isSocialEdit && (
               <div className="absolute top-full right-0 mt-3 p-4 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 w-72 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 italic text-left">Social Connect (Retention)</div>
                  <div className="space-y-3">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#06C755] uppercase tracking-widest pl-1 italic block text-left">LINE ID / OA ID</label>
                        <input 
                           type="text" 
                           value={socialLinks.lineId}
                           onChange={(e) => setSocialLinks({...socialLinks, lineId: e.target.value})}
                           placeholder="Ex. @shop_name"
                           className="w-full bg-slate-50 px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-100 outline-none focus:border-[#06C755]/30 shadow-inner"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#1877F2] uppercase tracking-widest pl-1 italic block text-left">Facebook Profile / Page</label>
                        <input 
                           type="text" 
                           value={socialLinks.facebookUrl}
                           onChange={(e) => setSocialLinks({...socialLinks, facebookUrl: e.target.value})}
                           placeholder="Ex. https://fb.com/..."
                           className="w-full bg-slate-50 px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-100 outline-none focus:border-[#1877F2]/30 shadow-inner"
                        />
                     </div>
                     <button 
                       onClick={() => setIsSocialEdit(false)}
                       className="w-full py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-all mt-1 cursor-pointer border-none"
                     >
                       ปิดหน้าต่างนี้
                     </button>
                  </div>
               </div>
             )}

            <button 
               onClick={() => {
                 const s = !isHistoryOpen;
                 setIsHistoryOpen(s);
                 if (s) setIsSocialEdit(false);
               }}
               className={`px-4 py-2 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 border-none cursor-pointer ${isHistoryOpen ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'}`}
             >
               <HistoryIcon size={14} />
               ดูประวัติย้อนหลัง
             </button>

            <div className="w-px h-8 bg-slate-100 mx-1 self-center" />

            <button 
               onClick={async () => {
                 try {
                   if (socialLinks.lineId) {
                      const id = socialLinks.lineId.startsWith('@') ? socialLinks.lineId.slice(1) : socialLinks.lineId;
                      const url = socialLinks.lineId.startsWith('@') 
                        ? `https://line.me/R/ti/p/${id}`
                        : `https://line.me/ti/p/~${id}`;
                      window.open(url, '_blank');
                   }
                   await navigator.clipboard.writeText(`สวัสดีครับคุณ ${customer.name}... (ติดตามการสั่งซื้อ)`);

                   showToast(socialLinks.lineId ? "คัดลอกข้อความและเปิด LINE เรียบร้อย" : "คัดลอกข้อความทักทายของกลุ่ม Retention เรียบร้อย (ไม่มี LINE ID)");
                 } catch (err) {
                   console.error(err);
                 }
               }}
               className={`px-4 py-2 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 rounded-2xl group/line border-none cursor-pointer ${socialLinks.lineId ? 'bg-[#06C755] text-white' : 'bg-white text-[#06C755] border border-[#06C755]/20 hover:bg-[#06C755] hover:text-white'}`}
             >
               <div className={`p-1 rounded-lg transition-colors ${socialLinks.lineId ? 'bg-white/20' : 'bg-[#06C755]/10 group-hover/line:bg-white/20'}`}>
                  <MessageSquare size={14} />
               </div>
               LINE
             </button>
             <button 
               onClick={async () => {
                 try {
                   if (socialLinks.facebookUrl) {
                      window.open(socialLinks.facebookUrl, '_blank');
                   } else {
                      const searchUrl = `https://www.facebook.com/search/top/?q=${encodeURIComponent(customer.name)}`;
                      window.open(searchUrl, '_blank');
                   }
                   await navigator.clipboard.writeText(`สวัสดีครับคุณ ${customer.name}... (ติดตามการสั่งซื้อ)`);

                   showToast("คัดลอกข้อความและเปิดหน้าค้นหา Facebook เรียบร้อย");
                 } catch (err) {
                   console.error(err);
                 }
               }}
               className={`px-4 py-2 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 rounded-2xl group/fb border-none cursor-pointer ${socialLinks.facebookUrl ? 'bg-[#1877F2] text-white' : 'bg-white text-[#1877F2] border border-[#1877F2]/20 hover:bg-[#1877F2] hover:text-white'}`}
             >
               <div className={`p-1 rounded-lg transition-colors ${socialLinks.facebookUrl ? 'bg-white/20' : 'bg-[#1877F2]/10 group-hover/fb:bg-white/20'}`}>
                  <Facebook size={14} /> 
               </div>
               FB
             </button>

             <button 
               onClick={() => {
                 const s = !isSocialEdit;
                 setIsSocialEdit(s);
                 if (s) setIsHistoryOpen(false);
               }}
               className={`p-2 rounded-xl transition-all border cursor-pointer ${isSocialEdit ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:text-emerald-500 hover:border-emerald-500/20'}`}
               title="Update Social Links"
             >
                <Plus size={16} />
             </button>




             {isHistoryOpen && (
               <HistoryCalendar 
                 logs={historyLogs}
                 onClose={() => setIsHistoryOpen(false)}
                 onRestore={(snapshot, log) => {
                    if (snapshot.gridData) setGridData(snapshot.gridData);
                    if (snapshot.status) setStatus(snapshot.status);
                    if (snapshot.type) setType(snapshot.type);
                    if (snapshot.remark) setRemark(snapshot.remark);
                    if (snapshot.freqAmount) setFreq(prev => ({ ...prev, amount: snapshot.freqAmount }));
                    if (snapshot.freqUnit) setFreq(prev => ({ ...prev, unit: snapshot.freqUnit }));
                    if (log) setRestoredHistoryLog(log);
                    showToast("ดึงข้อมูลย้อนหลังจากประวัติสำเร็จ");
                    setIsHistoryOpen(false);
                 }}
               />
             )}
          </div>
       </div>

       <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 items-start ${readonly && 'opacity-80 pointer-events-none'}`}>
         <div className="lg:col-span-8 space-y-4">
           {/* Warnings for Lost Count */}
           {(customer.lostCount >= 3) && (
             <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl shadow-sm animate-pulse mb-4">
               <div className="flex items-center gap-3">
                 <AlertCircle className="text-rose-600 h-5 w-5" />
                 <div>
                   <h3 className="text-rose-800 font-black text-sm">ต้องให้ความสำคัญและเข้มงวดในการติดตามเป็นพิเศษ!</h3>
                   <p className="text-rose-600 text-xs font-bold mt-0.5">ลูกค้ารายนี้เคยเป็นลูกค้าหายสะสมมาแล้ว {customer.lostCount} ครั้ง</p>
                 </div>
               </div>
             </div>
           )}
           {(customer.lostCount > 0 && customer.lostCount < 3) && (
             <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm mb-4">
               <div className="flex items-center gap-3">
                 <AlertCircle className="text-amber-600 h-5 w-5" />
                 <div>
                   <h3 className="text-amber-800 font-black text-sm">ลูกค้าคนนี้เคยเป็นลูกค้าหายสะสมมาแล้ว {customer.lostCount} ครั้ง</h3>
                 </div>
               </div>
             </div>
           )}

             {/* Interactive Calendar Tracker */}
             {(() => {
                const thaiMonths = [
                  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
                ];
                
                const adYear = calYear - 543;
                const firstDate = new Date(adYear, calMonth, 1);
                const standardDay = firstDate.getDay(); 
                const firstDayIndex = standardDay === 0 ? 6 : standardDay - 1; 

                const startDate = new Date(firstDate);
                startDate.setDate(startDate.getDate() - firstDayIndex);

                const calendarWeeks = [];
                for (let week = 0; week < 6; week++) {
                  const weekRow = [];
                  for (let day = 0; day < 7; day++) {
                    weekRow.push(new Date(startDate));
                    startDate.setDate(startDate.getDate() + 1);
                  }
                  calendarWeeks.push(weekRow);
                }

                const getFormattedDateKey = (dateStr) => {
                  const parsed = parseThaiDate(dateStr);
                  if (!parsed) return null;
                  const y = parsed.getFullYear();
                  const m = (parsed.getMonth() + 1).toString().padStart(2, '0');
                  const d = parsed.getDate().toString().padStart(2, '0');
                  return `${y}-${m}-${d}`;
                };

                const lastCallKey = getFormattedDateKey(customer.lastCallDate);
                const lastOrderKey = getFormattedDateKey(customer.lastOrderDate);

                const getDayFollowupState = (d) => {
                  const y = d.getFullYear();
                  const m = (d.getMonth() + 1).toString().padStart(2, '0');
                  const dayStr = d.getDate().toString().padStart(2, '0');
                  const kDate = `${y}-${m}-${dayStr}`;
                  const dailyVal = gridData[`${kDate}-followup`];
                  if (dailyVal !== undefined) return dailyVal;
                  return lastCallKey && kDate === lastCallKey;
                };
                
                const getDayOrderState = (d) => {
                  const y = d.getFullYear();
                  const m = (d.getMonth() + 1).toString().padStart(2, '0');
                  const dayStr = d.getDate().toString().padStart(2, '0');
                  const kDate = `${y}-${m}-${dayStr}`;
                  const dailyVal = gridData[`${kDate}-order`];
                  if (dailyVal !== undefined) return dailyVal;
                  return lastOrderKey && kDate === lastOrderKey;
                };

                const getWeekNumAndMonth = (d) => {
                  const dMonth = d.getMonth();
                  const dDay = d.getDate();
                  const weekNum = dDay <= 7 ? 1 : dDay <= 14 ? 2 : dDay <= 21 ? 3 : 4;
                  return { monthName: thaiMonths[dMonth], weekNum };
                };

                const handleToggleFollowup = (d, isFollowed) => {
                  if (readonly) return;
                  const { monthName, weekNum } = getWeekNumAndMonth(d);
                  const y = d.getFullYear();
                  const m = (d.getMonth() + 1).toString().padStart(2, '0');
                  const dayStr = d.getDate().toString().padStart(2, '0');
                  const keyDate = `${y}-${m}-${dayStr}`;
                  
                  const todayKey = formatDateKey(getTodayDate());
                  if (keyDate !== todayKey) {
                    showToast("ไม่สามารถบันทึกข้อมูลย้อนหลังหรือล่วงหน้าได้ (ต้องเป็นวันนี้เท่านั้น)", "error");
                    return;
                  }
                  
                  const fKey = `${keyDate}-followup`;
                  const fWeekKey = `${monthName}-${weekNum}-followup`;
                  
                  setSelectedDateStr(keyDate);
                  const newValue = !isFollowed;
                  
                  setGridData(prev => {
                    const updated = { ...prev };
                    updated[fKey] = newValue;
                    updated[fWeekKey] = newValue;
                    return updated;
                  });
                };

                const handleToggleOrder = (d, isOrdered) => {
                  if (readonly) return;
                  const { monthName, weekNum } = getWeekNumAndMonth(d);
                  const y = d.getFullYear();
                  const m = (d.getMonth() + 1).toString().padStart(2, '0');
                  const dayStr = d.getDate().toString().padStart(2, '0');
                  const keyDate = `${y}-${m}-${dayStr}`;
                  
                  const todayKey = formatDateKey(getTodayDate());
                  if (keyDate !== todayKey) {
                    showToast("ไม่สามารถบันทึกข้อมูลย้อนหลังหรือล่วงหน้าได้ (ต้องเป็นวันนี้เท่านั้น)", "error");
                    return;
                  }
                  
                  const oKey = `${keyDate}-order`;
                  const oWeekKey = `${monthName}-${weekNum}-order`;
                  
                  setSelectedDateStr(keyDate);
                  const newValue = !isOrdered;
                  
                  setGridData(prev => {
                    const updated = { ...prev };
                    updated[oKey] = newValue;
                    updated[oWeekKey] = newValue;
                    return updated;
                  });
                };
                
                const handlePrevMonth = () => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear(prev => prev - 1);
                  } else {
                    setCalMonth(prev => prev - 1);
                  }
                };
                
                const handleNextMonth = () => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear(prev => prev + 1);
                  } else {
                    setCalMonth(prev => prev + 1);
                  }
                };

                const today = new Date();
                const todayDateObj = new Date();
                const isCurrentMonthYear = today.getFullYear() === adYear && today.getMonth() === calMonth;
                const todayDate = today.getDate();

                return (
                  <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300 font-sans text-left">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-primary animate-pulse" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">ไอเดียที่ 2: ปฏิทินบันทึกรายวัน (Calendar Tracker)</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 transition-colors border-none cursor-pointer"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <div className="px-3 text-[11px] font-black text-slate-800 min-w-[110px] text-center italic">
                            {thaiMonths[calMonth]} {calYear}
                          </div>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 transition-colors border-none cursor-pointer"
                          >
                            <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <CustomSelect
                            value={calMonth}
                            onChange={(e) => setCalMonth(parseInt(e.target.value))}
                            className="py-1 px-2 text-[10px] bg-white border border-slate-100 rounded-lg min-w-[90px]"
                            options={thaiMonths.map((m, idx) => ({ value: idx, label: m }))}
                          />
                          <CustomSelect
                            value={calYear}
                            onChange={(e) => setCalYear(parseInt(e.target.value))}
                            containerClassName="min-w-[130px] w-[130px]"
                            className="py-1 px-2 text-[10px] bg-white border border-slate-100 rounded-lg"
                            options={getYearOptions()}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-8 gap-1.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 py-1.5 rounded-xl border border-slate-100">
                      <div className="text-slate-500 border-r border-slate-200">สัปดาห์</div>
                      <div>จ.</div>
                      <div>อ.</div>
                      <div>พ.</div>
                      <div>พฤ.</div>
                      <div>ศ.</div>
                      <div className="text-rose-500">ส.</div>
                      <div className="text-rose-500">อา.</div>
                    </div>

                    <div className="grid grid-cols-8 gap-1.5">
                      {calendarWeeks.map((week, weekIdx) => {
                        const startW = week[0];
                        const endW = week[6];
                        const wLabel = `${startW.getDate()}-${endW.getDate()}`;
                        return (
                          <React.Fragment key={weekIdx}>
                            {/* Week Row Indicator Label */}
                            <div className="flex flex-col items-center justify-center bg-slate-50/50 border border-slate-100 rounded-xl font-black text-[9px] text-slate-500 py-2 shadow-inner min-h-[80px]">
                              <span className="opacity-80 text-[10px] uppercase tracking-wider leading-none">สัปดาห์</span>
                              <span className="text-slate-800 text-[16px] font-black mt-1">{weekIdx + 1}</span>
                            </div>

                            {/* 7 Days of this week */}
                            {week.map((dObj, idx) => {
                              const y = dObj.getFullYear();
                              const m = (dObj.getMonth() + 1).toString().padStart(2, '0');
                              const d = dObj.getDate().toString().padStart(2, '0');
                              const keyDate = `${y}-${m}-${d}`;
                              
                              const isFollowed = getDayFollowupState(dObj);
                              const isOrdered = getDayOrderState(dObj);
                              const isToday = dObj.getFullYear() === todayDateObj.getFullYear() && dObj.getMonth() === todayDateObj.getMonth() && dObj.getDate() === todayDateObj.getDate();
                              const isOtherMonth = dObj.getMonth() !== calMonth;

                              return (
                                <div 
                                  key={"day-" + keyDate}
                                  className={"rounded-xl border p-2 flex flex-col justify-between transition-all duration-300 relative group min-h-[80px] " + (isToday ? 'bg-amber-50/60 border-amber-300 shadow-sm ring-2 ring-amber-200' : (isOtherMonth ? 'bg-slate-50/50 border-transparent opacity-60' : 'bg-white border-slate-100 hover:border-slate-300'))}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className={"text-[13px] font-black leading-none pl-0.5 " + (isToday ? 'text-amber-800' : 'text-slate-800')}
                                    >
                                      {dObj.getDate()}
                                      {isOtherMonth && <span className="text-[8px] text-slate-400 ml-1">({thaiMonths[dObj.getMonth()].slice(0,3)})</span>}
                                    </span>
                                    {isToday && (
                                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping absolute top-1 right-1" />
                                    )}
                                  </div>

                                  <div className="flex gap-1.5 justify-center mt-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFollowup(dObj, isFollowed)}
                                      className={"w-8 h-8 rounded-lg flex items-center justify-center transition-all border border-solid cursor-pointer active:scale-90 " + (isFollowed ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' : 'bg-slate-50 border-slate-100 text-slate-300 hover:bg-slate-100 hover:text-slate-500')}
                                      title="📞 โทรติดตามวันนี้"
                                    >
                                      <Check size={14} strokeWidth={3} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOrder(dObj, isOrdered)}
                                      className={"w-8 h-8 rounded-lg flex items-center justify-center transition-all border border-solid cursor-pointer active:scale-90 " + (isOrdered ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-50 border-slate-100 text-slate-300 hover:bg-slate-100 hover:text-slate-500')}
                                      title="🛍️ ลูกค้าสั่งซื้อซ้ำวันนี้"
                                    >
                                      <ShoppingBag size={12} strokeWidth={2.5} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-[10px] font-black text-slate-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>💡 ใช้งานง่าย: สามารถกดเปลี่ยนเดือนด้านบน แล้วเลือกติ๊กบันทึกการติดตาม (📞) หรือสั่งซื้อ (🛍️) ที่ตรงกับวันที่ติดต่อลูกค้าจริงได้ทันที</span>
                    </div>
                  </div>
                );
             })()}

          </div>
<div className="lg:col-span-4 space-y-4">
           {restoredHistoryLog && (
             <div className="bg-sky-50 border border-sky-300 p-3 rounded-xl shadow-sm flex items-start gap-3">
               <HistoryIcon className="text-sky-500 mt-0.5 shrink-0" size={16} />
               <div>
                 <div className="text-[10px] font-black text-sky-800 uppercase tracking-widest italic mb-1">กำลังดูประวัติย้อนหลัง</div>
                 <div className="text-xs font-bold text-sky-700 leading-snug">
                   {(() => {
                     const ts = restoredHistoryLog.timestamp;
                     if (!ts) return 'ไม่ทราบวันที่';
                     const d = typeof ts.toDate === 'function' ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
                     return `บันทึกเมื่อ: ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
                   })()}
                 </div>
               </div>
             </div>
           )}
           <div className="bg-white rounded-3xl shadow-sm p-4 border-t-[6px] border-primary space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-2">
                 <div className="flex items-center gap-2">
                    <HistoryIcon size={14} className="text-primary" />
                    <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Tracking History</div>
                 </div>
                 {selectedDateStr && (
                   <div className="px-2 py-0.5 bg-sky-100 border border-sky-200 text-sky-700 rounded-lg text-[9px] font-black uppercase tracking-wider animate-pulse">
                     วันที่: {formatThaiDate(selectedDateStr)}
                   </div>
                 )}
              </div>

             <div className="grid grid-cols-1 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1 pl-1 italic">กลุ่มลูกค้า</label>
                   <CustomSelect
                     value={type}
                     onChange={(e) => setType(e.target.value)}
                     className="w-full px-3 py-2 text-[11px]"
                     options={['ยังไม่เคยเปิดบิล', 'เคยสั่งซื้อซ้ำ']}
                   />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1 pl-1 italic">สถานะการติดตาม</label>
                   <CustomSelect
                     value={status}
                     onChange={(e) => setStatus(e.target.value)}
                     className="w-full px-3 py-2 text-[11px]"
                     options={STATUS_OPTIONS.map(opt => ({ value: opt.label, label: opt.label, color: opt.color }))}
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
               <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100 shadow-inner">
                 <label className="block text-[9px] font-black text-slate-600 uppercase mb-1 italic">Last Call</label>
                 <div className="text-[11px] font-black text-slate-800 tracking-tight">{formatThaiDate(customer.lastCallDate)}</div>
               </div>
               <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100 shadow-inner">
                 <label className="block text-[9px] font-black text-slate-600 uppercase mb-1 italic">Last Order</label>
                 <div className="text-[11px] font-black text-slate-800 tracking-tight">{formatThaiDate(customer.lastOrderDate)}</div>
               </div>
             </div>

             
             {(() => {
                let isFreqLocked = false;
                let unlockDateStr = '';
                let orderCount = Object.keys(gridData || {}).filter(k => k.endsWith('-order') && gridData[k] === true).length;
                
                if (customer.customerSince) {
                  const customerSinceDate = new Date(customer.customerSince);
                  const threeMonthsLater = new Date(customerSinceDate);
                  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
                  if (getTodayDate() < threeMonthsLater) {
                    isFreqLocked = true;
                    unlockDateStr = threeMonthsLater.toLocaleDateString('th-TH');
                  }
                }

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-xl p-2.5 border shadow-inner transition-all duration-300 ${isFreqLocked ? 'bg-slate-100/50 border-slate-200 opacity-80' : 'bg-slate-50/50 border-slate-100'}`}>
                        <label className="block text-[9px] font-black text-slate-600 uppercase mb-1 italic">FREQ (Amt)</label>
                        <input 
                          type="number" 
                          value={freq.amount}
                          disabled={isFreqLocked}
                          onChange={(e) => setFreq({ ...freq, amount: parseInt(e.target.value) || 0 })}
                          className={`w-full bg-transparent text-[11px] font-black outline-none border-b focus:border-primary text-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed ${isFreqLocked ? 'border-transparent' : 'border-primary/20'}`}
                        />
                      </div>
                      <div className={`rounded-xl p-2.5 border shadow-inner transition-all duration-300 ${isFreqLocked ? 'bg-slate-100/50 border-slate-200 opacity-80' : 'bg-slate-50/50 border-slate-100'}`}>
                        <label className="block text-[9px] font-black text-slate-600 uppercase mb-1 italic">Unit</label>
                        <CustomSelect 
                          className="!bg-transparent !border-none !shadow-none !pl-0 !py-0 text-[11px]"
                          value={freq.unit}
                          disabled={isFreqLocked}
                          onChange={(e) => setFreq({ ...freq, unit: e.target.value })}
                          options={['สัปดาห์', 'เดือน']}
                        />
                      </div>
                    </div>
                    <div className="text-[9px] font-bold mt-1 pl-1 text-left">
                      {isFreqLocked ? (
                        <span className="text-amber-500 flex items-center gap-1">
                          🔒 ล็อคความถี่ 3 เดือน (ปลดล็อควันที่ {unlockDateStr})
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1 font-extrabold">
                          🔓 ปลดล็อกการตั้งรอบการติดตามแล้ว
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}


             <div className="space-y-1.5">
               <div className="flex items-center justify-between pl-1 pr-1">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
                   {selectedDateStr === formatDateKey(getTodayDate()) 
                     ? "บันทึกรายละเอียด (วันนี้)" 
                     : `บันทึกรายละเอียดวันที่ ${formatThaiDate(selectedDateStr)}`}
                 </label>
                 <select 
                   value={channel} 
                   onChange={(e) => setChannel(e.target.value)} 
                   className="text-[10px] bg-sky-50 border border-sky-100 text-sky-700 font-bold px-2 py-0.5 rounded-lg outline-none"
                 >
                   <option value="Call">📞 โทรศัพท์</option>
                   <option value="LINE">💬 LINE</option>
                   <option value="Facebook">📘 Facebook</option>
                 </select>
               </div>
               <textarea 
                 placeholder="..." 
                 value={remark}
                 onChange={(e) => setRemark(e.target.value)}
                 className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black outline-none focus:border-primary h-24 resize-none leading-relaxed shadow-inner" 
               />
             </div>

             {!readonly && (
               <div className="flex gap-2 pt-2">
                 <button
                   type="button"
                   onClick={() => {
                     setGridData(customer.gridData || {});
                     setStatus(customer.status || 'เสนอขอตัวอย่างสินค้า');
                     setType(customer.type || 'ยังไม่เคยเปิดบิล');
                     setRemark(customer.remark || '');
                     setFreq({ amount: customer.freqAmount || 1, unit: customer.freqUnit || 'สัปดาห์' });
                     setSelectedDateStr(formatDateKey(getTodayDate()));
                     showToast("ล้างข้อมูลฟอร์มเรียบร้อย");
                   }}
                   className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[12px] shadow-sm transition-all active:scale-95 uppercase flex items-center justify-center gap-2 cursor-pointer border-none"
                 >
                   <RotateCcw size={16} />
                   <span>ล้างข้อมูล</span>
                 </button>
                 <button
                   onClick={handleSave}
                   disabled={isSubmitting}
                   className="flex-[2] py-3 bg-primary hover:bg-slate-900 text-white rounded-xl font-black text-[12px] shadow transition-all active:scale-95 uppercase flex items-center justify-center gap-2 shadow-primary/20 cursor-pointer border-none"
                 >
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                   <span>{isSubmitting ? 'SAVING...' : 'บันทึกการติดตาม'}</span>
                 </button>
               </div>
             )}
          </div>
        </div>
      </div>


       <QRCodeModal 
        isOpen={isQrOpen} 
        onClose={() => setIsQrOpen(false)} 
        phone={activeDialPhone} 
        name={customer.name} 
      />
    </div>
  );
};

export default RetentionTrackingForm;

