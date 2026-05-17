import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Phone, Save, History as HistoryIcon, Loader2 } from 'lucide-react';
import { leadService } from '../../services/leadService';

const typeConfig = {
  save: { label: 'บันทึก', icon: Save, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  call: { label: 'โทร', icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  status_change: { label: 'เปลี่ยนสถานะ', icon: HistoryIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
  note: { label: 'บันทึกเพิ่มเติม', icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100' },
};

const ContactHistory = ({ customerId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await leadService.getCustomerLogs(customerId, 15);
        setLogs(data);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [customerId]);

  if (loading) return <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-500" size={24} /></div>;

  if (logs.length === 0) {
    return (
      <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
        <HistoryIcon size={24} className="mx-auto text-slate-400 mb-2" />
        <p className="text-[10px] font-black text-slate-500 uppercase italic">ยังไม่มีประวัติการติดต่อ</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* Timeline Line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />

      {logs.map((log) => {
        const cfg = typeConfig[log.type] || typeConfig.note;
        const LogIcon = cfg.icon;
        
        let displayTime = '';
        if (log.timestamp) {
           try {
             const date = typeof log.timestamp.toDate === 'function' ? log.timestamp.toDate() : new Date(log.timestamp);
             displayTime = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
                           date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
           } catch (e) {
             console.error("Invalid date format in log", log);
             displayTime = 'N/A';
           }
        }

        return (
          <div key={log.id} className="relative pl-10">
            {/* Timeline Dot */}
            <div className={`absolute left-0 top-1 w-8 h-8 rounded-xl flex items-center justify-center border-2 border-white ring-4 ring-slate-50 shadow-sm z-10 ${cfg.bg} ${cfg.color}`}>
              <LogIcon size={14} />
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                   <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{log.adminName}</div>
                   <span className="text-[10px] text-slate-500">|</span>
                   <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                   </div>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 italic">
                  <Clock size={10} />
                  {displayTime}
                </div>
              </div>

              <div className="text-[13px] font-bold text-slate-800 leading-relaxed">
                {log.action}
              </div>

              {log.details && typeof log.details === 'string' && log.status !== log.action && (
                <div className="mt-2 text-xs text-slate-700 font-medium bg-slate-50 p-2.5 rounded-xl border-l-4 border-slate-200">
                  {log.details}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContactHistory;
