import React from 'react';

const NavItem = ({ icon, label, active, onClick, open, badge }) => (
  <button
    onClick={onClick}
    title={!open ? label : undefined}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative border-none cursor-pointer
      ${active
        ? 'bg-sky-50 text-primary font-black shadow-sm'
        : 'text-slate-600 hover:text-primary hover:bg-sky-50/50 font-bold'}
      ${!open ? 'justify-center px-0' : ''}
    `}
  >
    <div className={`transition-all shrink-0 ${active ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`}>
      {icon}
    </div>
    {open && <span className="text-[13px] tracking-normal truncate">{label}</span>}
    {badge && (
      <div className={`absolute right-3 px-1.5 py-0.5 rounded-md text-[9px] font-black ${active ? 'bg-primary text-white' : 'bg-danger text-white'}`}>
        {badge}
      </div>
    )}
  </button>
);

export default NavItem;
