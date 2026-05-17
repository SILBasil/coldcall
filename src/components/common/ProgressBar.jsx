import React from 'react';

const ProgressBar = ({ name, val, color }) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center text-sm font-bold text-slate-600 uppercase tracking-widest">
        <span>{name}</span>
        <span className="text-slate-400">{val}%</span>
     </div>
     <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full ${color} transition-all duration-1000 shadow-sm`} style={{ width: `${val}%` }}></div>
     </div>
  </div>
);

export default ProgressBar;
