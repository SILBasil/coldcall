import React from 'react';

const StatCard = ({ label, value, color, iconColor, ...props }) => (
  <div className="p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm bg-white hover:shadow-md transition-all duration-300 group relative overflow-hidden">
    <div
      className={`p-3 rounded-xl ${color} bg-opacity-10 text-slate-800 mb-4 md:mb-6 group-hover:scale-110 transition-all inline-block border border-white shadow-sm`}
    >
      {React.createElement(props.Icon, { size: 20, className: `${iconColor} stroke-[2.5]` })}
    </div>
    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-1 md:mb-2 relative z-10 leading-none">{label}</p>
    <p className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter relative z-10">{value}</p>
  </div>
);

export default StatCard;
