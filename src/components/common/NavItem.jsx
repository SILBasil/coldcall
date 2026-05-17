import React from 'react';

const NavItem = ({ icon, label, active, onClick, open, badge }) => (
  <button
    onClick={onClick}
    title={!open ? label : undefined}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative
      ${active
        ? 'text-white font-bold opacity-100'
        : 'text-white/60 hover:text-white hover:bg-white/5 opacity-80 hover:opacity-100'}
      ${!open ? 'justify-center px-0' : ''}
    `}
  >
    <div className={`transition-all shrink-0 ${active ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
      {icon}
    </div>
    {open && <span className="text-[13px] tracking-normal truncate">{label}</span>}
    {badge && (
      <div className={`absolute right-3 px-1.5 py-0.5 rounded-md text-[9px] font-black ${active ? 'bg-white text-primary' : 'bg-danger text-white'}`}>
        {badge}
      </div>
    )}
  </button>
);

export default NavItem;
