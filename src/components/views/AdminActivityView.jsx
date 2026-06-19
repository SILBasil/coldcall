import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Search, ChevronDown, Clock, Save, Phone, Eye, User, 
  ChevronLeft, ChevronRight, Filter, Target, Activity, Database, 
  CheckCircle2, AlertCircle, Calendar, MousePointer2, UserPlus
} from 'lucide-react';
import { leadService } from '../../services/leadService';
import { TableSkeleton } from '../common/Skeleton';
import CustomSelect from '../common/CustomSelect';

const statusConfig = {
  save: { label: 'บันทึกข้อมูล', category: 'PROD', color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Save },
  call: { label: 'การโทรออก', category: 'PROD', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Phone },
  status_change: { label: 'เปลี่ยนสถานะ', category: 'PROD', color: 'text-blue-600', bg: 'bg-blue-50', icon: Target },
  click: { label: 'การคลิกปุ่ม', category: 'CLICK', color: 'text-amber-600', bg: 'bg-amber-50', icon: MousePointer2 },
  view: { label: 'เปิดดูข้อมูล', category: 'CLICK', color: 'text-slate-600', bg: 'bg-slate-50', icon: Eye },
  no_answer: { label: 'ไม่รับสาย', category: 'PROD', color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertCircle },
};

const AdminActivityView = ({ onSelectCustomer, role }) => {
  const isManager = role === 'manager';
  const [logs, setLogs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAdmin, setFilterAdmin] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['call', 'save', 'status_change', 'view', 'click']);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('feed'); 
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filterAdmin, selectedTypes, date]);

  const fetchAdmins = async () => {
    try {
      const all = await leadService.getUsers();
      setAdmins(all.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const data = await leadService.getAllLogs({
        adminId: filterAdmin,
        startDate: start,
        endDate: end
      });
      
      const typeFiltered = data.filter(l => selectedTypes.includes(l.type));
      setLogs(typeFiltered);

      const trend = await leadService.getActivityTrend(filterAdmin, 1);
      const totalActions = Object.values(trend).reduce((a, b) => a + b, 0);
      setVelocity((totalActions / 24).toFixed(1));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filteredLogs = logs.filter(l => 
    l.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    l.customerPhone?.includes(search) ||
    l.adminName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-6">
      
      {/* Sidebar - Filter Control */}
      <aside className="w-full lg:w-80 flex flex-col gap-4 shrink-0 h-fit lg:sticky lg:top-28">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <div className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 opacity-60 italic">Audit Parameters</div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] pl-1">ค้นหาข้อมูล</label>
              <div className="relative group">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="ลูกค้า หรือ แอดมิน..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black transition-all outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 shadow-inner"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] pl-1">เลือกเจ้าหน้าที่/แอดมิน</label>
            <CustomSelect 
              value={filterAdmin}
              onChange={(e) => setFilterAdmin(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 text-[11px]"
              placeholder="แสดงแอดมินทั้งหมด"
              options={[
                { value: 'all', label: 'แสดงแอดมินทั้งหมด' },
                ...admins.map(a => ({ value: a.id, label: a.name }))
              ]}
            />
          </div>

          {/* Activity Type Groups */}
          <div className="space-y-6">
             <div className="space-y-3">
                <label className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3 italic border-b border-slate-50 pb-2">
                   <Save size={12} /> ผลผลิต (Productivity)
                </label>
                {[
                  { id: 'call', label: 'โทรออกหาลูกค้า' },
                  { id: 'save', label: 'บันทึกข้อมูลลูกค้า' },
                  { id: 'status_change', label: 'การเปลี่ยนสถานะ' }
                ].map(type => (
                  <div key={type.id} className="flex items-center justify-between group cursor-pointer" onClick={() => toggleType(type.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedTypes.includes(type.id) ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-slate-100 bg-slate-50'}`}>
                        {selectedTypes.includes(type.id) && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] font-black tracking-tight ${selectedTypes.includes(type.id) ? 'text-slate-900' : 'text-slate-600'} group-hover:text-primary transition-colors`}>{type.label}</span>
                    </div>
                  </div>
                ))}
             </div>

             <div className="space-y-3">
                <label className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-3 italic border-b border-slate-50 pb-2">
                   <MousePointer2 size={12} /> ปฏิสัมพันธ์ (Interaction)
                </label>
                {[
                  { id: 'view', label: 'เปิดดูรายละเอียด' },
                  { id: 'click', label: 'การคลิกโทร/คัดลอก' }
                ].map(type => (
                  <div key={type.id} className="flex items-center justify-between group cursor-pointer" onClick={() => toggleType(type.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${selectedTypes.includes(type.id) ? 'bg-amber-500 border-amber-500 shadow-lg shadow-amber-500/20' : 'border-slate-100 bg-slate-50'}`}>
                        {selectedTypes.includes(type.id) && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] font-black tracking-tight ${selectedTypes.includes(type.id) ? 'text-slate-900' : 'text-slate-600'} group-hover:text-amber-500 transition-colors`}>{type.label}</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] pl-1">เลือกวันที่</label>
             <div className="relative group">
                <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-primary transition-colors" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-inner"
                />
             </div>
          </div>
        </div>

        {/* Velocity Score Card */}
        <div className="bg-slate-900 p-6 rounded-3xl text-white relative overflow-hidden group shadow-2xl shadow-primary/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-bl-[4rem] blur-2xl group-hover:scale-125 transition-all duration-700" />
          <div className="relative z-10">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mb-1 italic">Velocity</div>
            <div className="flex items-baseline gap-3 mb-6">
               <span className="text-4xl font-black tracking-tighter italic">{velocity}</span>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">act/hr</span>
            </div>
            <div className="space-y-3">
               <div className="flex justify-between items-end text-[11px] font-black uppercase tracking-[0.3em]">
                  <span className="text-white/40">Efficiency</span>
                  <span className="text-emerald-400">High</span>
               </div>
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[1px] shadow-inner">
                  <div className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${Math.min(100, (velocity/15)*100)}%` }} />
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Feed Content */}
      <main className="flex-1 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
           <div>
              <div className="text-xl font-black text-slate-900 tracking-tighter italic">บันทึกกิจกรรมการทำงาน</div>
              <p className="text-[11px] font-black text-slate-600 mt-1 uppercase tracking-[0.3em] opacity-80 pl-1 italic">Real-time Operational Feed</p>
           </div>
           
           <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm self-end">
              <button 
                onClick={() => setViewMode('feed')} 
                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-[0.2em] transition-all ${viewMode === 'feed' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Live Events
              </button>
              <button 
                onClick={() => setViewMode('summary')} 
                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-[0.2em] transition-all ${viewMode === 'summary' ? 'bg-primary text-white shadow-lg' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Summary
              </button>
           </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                 <thead>
                    <tr className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] border-b border-slate-50">
                       <th className="px-6 py-4 bg-slate-50/50">เหตุการณ์ & กิจกรรม</th>
                       <th className="px-6 py-4 bg-slate-50/50">พนักงาน / แอดมิน</th>
                       <th className="px-6 py-4 bg-slate-50/50">ลูกค้า / รายละเอียด</th>
                       <th className="px-6 py-4 text-right bg-slate-50/50">เวลา</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                       <tr><td colSpan={4}><TableSkeleton /></td></tr>
                    ) : filteredLogs.length === 0 ? (
                       <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-600 font-black uppercase text-[11px] tracking-[0.3em] italic">ไม่พบประวัติกิจกรรม</td></tr>
                    ) : (
                       filteredLogs.map((log) => {
                          const config = statusConfig[log.type] || statusConfig.view;
                           const LogIcon = config.icon;
                           const timestamp = new Date(log.timestamp);
                           const isProductivity = config.category === 'PROD';

                           return (
                              <tr key={log.id} className="group hover:bg-slate-50/70 transition-all border-b border-slate-50 last:border-0 cursor-default">
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                       <div className={`p-3 rounded-xl ${config.bg} ${config.color} border border-black/5 group-hover:scale-105 transition-transform duration-500`}>
                                          <LogIcon size={18} />
                                       </div>
                                       <div>
                                          <div className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-[0.05em] w-fit ${isProductivity ? 'bg-primary text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
                                             {isProductivity ? 'Prod' : 'View'}
                                          </div>
                                          <div className="text-[13px] font-black text-slate-900 mt-1 uppercase tracking-tight group-hover:text-primary transition-colors">{config.label}</div>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-black shrink-0 shadow shadow-black/5 border border-black/5 group-hover:rotate-6 transition-transform" style={{ backgroundColor: admins.find(a => a.id === log.adminId)?.color || '#6366f1' }}>
                                          {log.adminName?.charAt(0) || 'A'}
                                       </div>
                                       <div className="flex flex-col">
                                          <div className="text-[13px] font-black text-slate-900 tracking-tight">{log.adminName}</div>
                                          <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic opacity-60">Level 1</div>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 group/cell">
                                    <div 
                                      className={`flex flex-col items-start ${(log.customerId && !isManager) ? 'cursor-pointer' : ''}`}
                                      onClick={async () => {
                                        if (log.customerId && onSelectCustomer && !isManager) {
                                          const c = await leadService.getCustomer(log.customerId);
                                          if (c) onSelectCustomer(c);
                                        }
                                      }}
                                    >
                                       <div className="flex items-center gap-2">
                                          <div className={`text-[13px] font-black text-slate-900 tracking-tighter ${(!isManager && log.customerId) ? 'group-hover/cell:text-primary' : ''} transition-all flex items-center gap-1.5`}>
                                            {log.customerPhone || 'เบอร์ลูกค้า'}
                                            {(log.customerId && !isManager) && <MousePointer2 size={12} className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-primary" />}
                                          </div>
                                          {log.customerStage && (
                                             <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${log.customerStage === 'customer' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm' : 'bg-primary/5 text-primary border border-primary/10 shadow-sm'}`}>
                                                {log.customerStage === 'customer' ? 'RET' : 'NEW'}
                                             </span>
                                          )}
                                       </div>
                                       <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.05em] mt-1 opacity-70 italic truncate max-w-[200px]">{log.action || 'Unknown Action'}</div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="text-[14px] font-black text-slate-900 tracking-tighter italic">{timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                                    <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] italic opacity-60">Audit Stamp</div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                 </tbody>
              </table>
           </div>
        </div>
      </main>
    </div>
  );
};

export default AdminActivityView;
