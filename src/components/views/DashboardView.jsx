import React, { useState, useEffect } from 'react';
import { TrendingUp, UserPlus, CheckCircle2, PhoneCall, Target } from 'lucide-react';
import StatCard from '../common/StatCard';
import TeamLineChart from '../common/TeamLineChart';
import { leadService } from '../../services/leadService';

const DashboardView = () => {
  const [admins, setAdmins] = useState([]);
  
  const fetchAdmins = async () => {
    try {
      const all = await leadService.getUsers();
      setAdmins(all.filter(u => u.role === 'admin'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Leads รอจัดการ" value="48" Icon={UserPlus} color="bg-indigo-600" iconColor="text-indigo-600" />
        <StatCard label="ปิดดีลวันนี้" value="12" Icon={CheckCircle2} color="bg-emerald-600" iconColor="text-emerald-600" />
        <StatCard label="จำนวนโทรทั้งหมด" value="342" Icon={PhoneCall} color="bg-blue-600" iconColor="text-blue-600" />
        <StatCard label="Retention Rate" value="94%" Icon={Target} color="bg-amber-600" iconColor="text-amber-600" />
      </div>
      
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-6">
           <div className="text-base font-bold text-slate-800 flex items-center gap-2 tracking-tight uppercase"><TrendingUp size={18} className="text-indigo-600" /> Team Performance</div>
           <div className="flex gap-3">
              {admins.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-400">
                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: a.color}}></div> {a.name}
                </div>
              ))}
           </div>
        </div>
        <div className="h-64 w-full"><TeamLineChart admins={admins} /></div>
      </div>
    </div>
  );
};

export default DashboardView;
