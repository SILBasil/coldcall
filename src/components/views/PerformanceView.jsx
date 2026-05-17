import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { leadService } from '../../services/leadService';

const PerformanceView = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uAll, sAll] = await Promise.all([
        leadService.getUsers(),
        leadService.getStats()
      ]);
      setAdmins(uAll.filter(u => u.role === 'admin'));
      setStats(sAll);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in zoom-in-95 duration-500">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-primary" />
        <div className="text-base font-black text-slate-800 uppercase tracking-tight italic">ผลงานของทีม - Team Performance</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {admins.map(a => {
          const detail = stats?.weeklyStats?.adminDetails?.[a.id] || { grade: 'C', followed: 0, converted: 0, rate: '0%' };
          const rateNum = parseInt(detail.rate);

          return (
            <div
              key={a.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center gap-3 hover:shadow-md transition-shadow group"
            >
              <div
                className="h-12 w-12 rounded-2xl text-white flex items-center justify-center font-black text-lg shadow-sm relative"
                style={{ backgroundColor: a.color || '#6366f1' }}
              >
                {a.name?.charAt(0) || 'A'}
                <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-[10px] shadow-md border-2 border-white ${
                   detail.grade === 'A' ? 'bg-emerald-500' : detail.grade === 'B' ? 'bg-indigo-500' : 'bg-slate-400'
                }`}>
                   {detail.grade}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[13px] font-black text-slate-800 leading-tight">{a.name}</div>
                <p className="text-primary font-black text-[10px] uppercase tracking-widest mt-1 italic">
                  {detail.rate} Performance
                </p>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden border border-slate-100">
                <div
                  className="h-full transition-all shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                  style={{ width: `${rateNum}%`, backgroundColor: a.color || '#6366f1' }}
                />
              </div>
              {/* Stats */}
              <div className="grid grid-cols-2 w-full gap-3 pt-3 border-t border-slate-50 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-lg font-black text-slate-800 leading-none mb-1">
                    {detail.followed}
                  </p>
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Touched</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2">
                  <p className="text-lg font-black text-emerald-600 leading-none mb-1">
                    {detail.converted}
                  </p>
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Ordered</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceView;
