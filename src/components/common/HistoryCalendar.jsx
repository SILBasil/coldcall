import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Clock, Calendar as CalendarIcon, X } from 'lucide-react';

const HistoryCalendar = ({ logs, onRestore, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Find the latest log date to auto-select on open
  const getInitialDayKey = () => {
    if (!logs || logs.length === 0) return null;
    const sorted = [...logs].sort((a, b) => {
      const da = typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate() : new Date(a.timestamp);
      const db = typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate() : new Date(b.timestamp);
      return db - da;
    });
    const latest = sorted[0];
    const ts = latest.timestamp;
    const date = typeof ts.toDate === 'function' ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const [selectedDayKey, setSelectedDayKey] = useState(getInitialDayKey());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getLogDate = (log) => {
    if (!log || !log.timestamp) return null;
    const ts = log.timestamp;
    return typeof ts.toDate === 'function' ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  };

  const getDayKeyFromDate = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  // Map logs to dates safely using local day precision
  const logMap = {};
  logs.forEach(log => {
    const date = getLogDate(log);
    if (!date) return;
    const key = getDayKeyFromDate(date);
    if (!logMap[key]) logMap[key] = [];
    logMap[key].push(log);
  });

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Fill empty days for starting alignment
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-10" />);
  }

  // Fill actual days
  for (let d = 1; d <= totalDays; d++) {
    const key = `${year}-${month}-${d}`;
    const dayLogs = logMap[key] || [];
    const hasLogs = dayLogs.length > 0;
    
    const isSelected = selectedDayKey === key;

    days.push(
      <div 
        key={d} 
        onClick={() => hasLogs && setSelectedDayKey(key)}
        className={`h-10 flex flex-col items-center justify-center rounded-xl transition-all relative group
          ${hasLogs ? 'cursor-pointer hover:bg-primary/10 border border-transparent active:scale-95 text-slate-900 font-bold' : 'text-slate-400 cursor-default'}
          ${isSelected ? 'bg-primary text-white shadow-lg border-primary' : hasLogs ? 'bg-white border-slate-100 hover:border-primary/20' : ''}
        `}
      >
        <span className="text-[11px] font-black">{d}</span>
        {hasLogs && (
          <div className={`h-1.5 w-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-primary'} ${!isSelected && 'animate-pulse'}`} />
        )}
      </div>
    );
  }

  const selectedLogs = selectedDayKey ? (logMap[selectedDayKey] || []) : [];
  const selectedSnapshots = selectedLogs.filter(l => !!l.snapshot);

  return (
    <div className="absolute top-full right-0 mt-3 z-[200] w-[340px] animate-in slide-in-from-top-4 fade-in duration-300" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden ring-1 ring-slate-200">
        <div className="bg-slate-50/80 p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <CalendarIcon size={14} className="text-primary" />
             <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-900">ประวัติการบันทึกข้อมูล</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-500 rounded-lg transition-all cursor-pointer border-none bg-transparent">
             <X size={14} />
          </button>
        </div>

      <div className="p-2 border-b border-slate-50 flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border-none bg-transparent"><ChevronLeft size={16} /></button>
          <span className="text-[11px] font-black text-slate-700 tracking-tight">{monthNames[month]} {year + 543}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer border-none bg-transparent"><ChevronRight size={16} /></button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[9px] font-black text-slate-600 uppercase italic">
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>

      {selectedDayKey ? (
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2 mb-1 px-1">
            <Clock size={12} className="text-primary" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">รอบการบันทึก: {selectedSnapshots.length} ครั้งในวันนี้</span>
          </div>
          
          {selectedLogs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic text-center">ไม่พบประวัติในวันนี้</p>
            </div>
          ) : selectedSnapshots.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic text-center">ไม่มีข้อมูลบันทึกในวันนี้</p>
            </div>
          ) : selectedLogs.map((log, i) => (
            <button 
              key={i} 
              onClick={() => log.snapshot && onRestore(log.snapshot)}
              disabled={!log.snapshot}
              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between mb-2 last:mb-0 cursor-pointer
                ${log.snapshot ? 'bg-white border-slate-100 hover:border-primary/40 hover:shadow-lg hover:bg-primary/[0.02] group/item active:scale-[0.98]' : 'bg-slate-50/50 border-slate-50 opacity-60 cursor-default'}
              `}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-slate-50 rounded-xl flex flex-col items-center justify-center border border-slate-100 group-hover/item:border-primary/20 group-hover/item:bg-white transition-colors">
                  <div className="text-[11px] font-black text-slate-800">{new Date(getLogDate(log)).toLocaleTimeString('th-TH').split(':')[0]}</div>
                  <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter -mt-1 leading-none">{new Date(getLogDate(log)).toLocaleTimeString('th-TH').split(':')[1]}</div>
                </div>
                <div>
                   <div className="text-[11px] font-black text-slate-900 leading-none mb-1.5">{log.adminName}</div>
                   <div className="text-[9px] font-black text-primary uppercase tracking-widest line-clamp-1 italic">
                     บันทึกข้อมูลการกรอก [Data Snapshot]
                   </div>
                </div>
              </div>
              <div className="h-8 w-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-500 group-hover/item:bg-primary group-hover/item:text-white transition-all">
                <RotateCcw size={14} className="group-hover:rotate-[-120deg] transition-transform duration-500" />
              </div>
            </button>
          ))}
          
          <div className="text-center pt-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] italic">คลิกที่รายการเพื่อย้อนข้อมูลกลับ</p>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50/30 border-t border-slate-100">
           <div className="h-12 w-12 bg-white rounded-2xl shadow-inner border border-slate-100 flex items-center justify-center mx-auto mb-3">
              <CalendarIcon size={20} className="text-slate-400" />
           </div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic text-center">เลือกวันที่ที่มีจุดเพื่อดูประวัติ</p>
        </div>
      )}
      </div>
    </div>
  );
};

export default HistoryCalendar;
