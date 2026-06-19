import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  UserPlus,
  Repeat,
  BarChart3,
  UserCog,
  CheckCircle2,
  Activity,
  Settings,
  Database,
  Search,
  Bell,
  Mail,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  User,
  UserX,
  Trash2,
} from 'lucide-react';

// Components
import NavItem from './components/common/NavItem';
import LoginView from './components/views/LoginView';
import AdminDashboardView from './components/views/AdminDashboardView';
import ManagerDashboardView from './components/views/ManagerDashboardView';
import CustomerListView from './components/views/CustomerListView';
import LeadEntryForm from './components/views/LeadEntryForm';
import RetentionTrackingForm from './components/views/RetentionTrackingForm';
import PerformanceView from './components/views/PerformanceView';
import AssignLeadsView from './components/views/AssignLeadsView';
import AdminActivityView from './components/views/AdminActivityView';
import SettingsView from './components/views/SettingsView';
import LostCustomersView from './components/views/LostCustomersView';
import TrashView from './components/views/TrashView';

// Services
import { leadService } from './services/leadService';

// ─── Role-based menu config ───────────────────────────────────────────────────
const ADMIN_MENU = [
  { key: 'dashboard',  label: 'แดชบอร์ด',            icon: LayoutDashboard },
  { key: 'new-leads',  label: 'เบอร์ใหม่',              icon: PhoneCall },
  { key: 'follow-up',  label: 'ลูกค้ารอตัดสินใจ',     icon: UserPlus },
  { key: 'retention',  label: 'ลูกค้าประจำ',           icon: Repeat },
  { key: 'lost-customers', label: 'ลูกค้าหาย',         icon: UserX },
];

const MANAGER_MENU = [
  { key: 'dashboard',  label: 'แดชบอร์ดภาพรวม',      icon: LayoutDashboard },
  { key: 'master-pool',label: 'คลังเบอร์โทร',          icon: Database },
  { key: 'new-leads',  label: 'รายชื่อเบอร์ใหม่',        icon: PhoneCall },
  { key: 'follow-up',  label: 'ลูกค้ารอตัดสินใจ',      icon: UserPlus },
  { key: 'retention',  label: 'งานลูกค้าประจำ',        icon: Repeat },
  { key: 'lost-customers', label: 'ลูกค้าหาย',         icon: UserX },
  { key: 'assign',     label: 'มอบหมายงาน',            icon: UserCog },
  { key: 'activity',   label: 'การทำงานแอดมิน',        icon: Activity },
  { key: 'trash',      label: 'ถังขยะรายชื่อ',         icon: Trash2 },
];

const SETTINGS_SUBMENU = [
  { key: 'admins', label: 'จัดการแอดมิน', icon: '👤' },
  { key: 'topics', label: 'หัวข้อคำถาม',   icon: '📋' },
  { key: 'data',   label: 'จัดการข้อมูล',  icon: '🗄️' },
];

// Page title map
const PAGE_TITLES = {
  dashboard:     'ภาพรวมการทำงาน',
  'master-pool': 'คลังเบอร์โทร',
  'new-leads':   'เบอร์ใหม่',
  'follow-up':   'ลูกค้ารอตัดสินใจ',
  retention:     'ลูกค้าประจำ',
  'lost-customers': 'ลูกค้าหาย',
  performance:   'ประสิทธิผลงาน',
  assign:        'มอบหมายงาน',
  activity:      'ประวัติการทำงาน',
  settings:      'ตั้งค่าระบบ',
  trash:         'ถังขยะรายชื่อ',
};

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      return parsed.role === 'manager' ? 'all' : 'my';
    }
    return 'my';
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [message, setMessage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState(null);
  const sessionStartRef = React.useRef(user ? Date.now() : null);

  // Auto-migrate mock data once (Disabled to prevent auto-seeding after system wipe)
  // useEffect(() => {
  //   leadService.migrateMockData();
  // }, []);

  // Clear retention filters when switching to other menus
  useEffect(() => {
    if (view !== 'retention' && view !== 'call-retention' && view !== 'view-retention') {
      sessionStorage.removeItem('retention_retentionSubTab');
      sessionStorage.removeItem('retention_searchTerm');
      sessionStorage.removeItem('retention_currentPage');
      sessionStorage.removeItem('retention_filterFreqAmt');
      sessionStorage.removeItem('retention_filterFreqUnit');
      sessionStorage.removeItem('retention_filterTrackStatus');
      sessionStorage.removeItem('retention_filterOrderStatus');
    }
  }, [view]);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };



  const handleLogin = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStartRef.current = Date.now();
    setUser(userData);
    setView('dashboard');
    setActiveTab(userData.role === 'manager' ? 'all' : 'my');
    // Log login event
    leadService.logSession({ adminId: userData.id, adminName: userData.name, event: 'login' }).catch(console.error);
  };

  const handleLogout = () => {
    const sessionDuration = sessionStartRef.current ? Math.floor((Date.now() - sessionStartRef.current) / 1000) : null;
    if (user) {
      leadService.logSession({ adminId: user.id, adminName: user.name, event: 'logout', sessionDuration }).catch(console.error);
    }
    sessionStartRef.current = null;
    localStorage.removeItem('user');
    setUser(null);
    setView('dashboard');
  };
  const handleNextLead = async (customer = null) => {
    try {
      let nextLead = customer;
      // Safety check: sometimes events might be passed accidentally instead of null, 
      // but AdminDashboardView passes explicitly `() => onNextLead(c)`.
      if (!nextLead || (!nextLead.id && !nextLead.phone)) {
        nextLead = await leadService.getNextPriorityLead(currentAdminId);
      }

      if (nextLead) {
        setSelectedCustomer(nextLead);
        // Determine whether to go to leads or retention view
        const prefix = nextLead.stage === 'customer' ? 'call-retention' : 'call-leads';
        setView(prefix);
        if (!customer || !customer.id) {
           showToast(`กำลังโหลดลูกค้าถัดไป: ${nextLead.name}`);
        }
      } else {
        showToast("ไม่พบลูกค้ารอการติดต่อในขณะนี้", "info");
      }
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการดึงข้อมูล", "error");
    }
  };

  if (!user) return <LoginView onLogin={handleLogin} />;

  const role = user.role;
  const isManager = role === 'manager';
  const currentAdminId = user.id;
  const menu = isManager ? MANAGER_MENU : ADMIN_MENU;

  // Determine base view (strip call-/view- prefix for title lookup)
  const baseView = view.replace(/^(call|view)-/, '');
  const pageTitle = PAGE_TITLES[baseView] || '';

  // Which views are "detail" views (hide back button logic is in the component)
  const isDetailView = view.startsWith('call-') || view.startsWith('view-');

  const handleNavClick = (key) => {
    setView(key);
    if (key === 'master-pool') {
      setActiveTab('all');
    } else if (key === 'new-leads' || key === 'follow-up' || key === 'retention') {
      setActiveTab(isManager ? 'all' : 'my');
    }
    // Log page navigation
    if (user) {
      leadService.logActivity({
        adminId: user.id,
        adminName: user.name,
        action: `เปิดหน้า: ${PAGE_TITLES[key] || key}`,
        type: 'navigate'
      }).catch(console.error);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-900 overflow-hidden antialiased">
      {/* ─── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          transform transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'}
          bg-white border-r border-slate-100 flex flex-col shadow-sm shrink-0
        `}
      >
        {/* Logo */}
        <div className="h-20 pt-6 flex items-center justify-center px-6 shrink-0 transition-all mb-2">
          <div className="flex items-center gap-4 group cursor-pointer">
             <div className="bg-gradient-to-tr from-primary to-sky-400 p-3 rounded-2xl shadow-xl shadow-primary/20 rotate-[-8deg] group-hover:rotate-0 transition-all duration-500">
                <PhoneCall size={24} className="text-white" />
             </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
              <div className="text-lg font-black text-slate-800 tracking-widest uppercase italic leading-none">
                COLDCALL
              </div>
                <span className="text-[11px] font-black text-primary uppercase tracking-[0.4em] mt-1.5 opacity-80">ศูนย์บริหารการขาย</span>
              </div>
            )}
          </div>
        </div>

        <hr className="mx-4 border-slate-100" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
           <div className={`px-5 mb-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ${!isSidebarOpen && 'hidden'}`}>
             เมนูการทำงานหลัก
           </div>
          {menu.map(({ key, label, icon: Icon }) => {
            const isActive = view === key || (view.startsWith('call-' + key) || view.startsWith('view-' + key));
            return (
              <NavItem
                key={key}
                active={isActive}
                icon={<Icon size={16} />}
                label={label}
                onClick={() => handleNavClick(key)}
                open={isSidebarOpen}
              />
            );
          })}

          {/* Settings expandable menu (Manager only) */}
          {isManager && (
            <div>
              <button
                onClick={() => {
                  setSettingsOpen(o => !o);
                }}
                title={!isSidebarOpen ? 'ตั้งค่าระบบ' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative border-none cursor-pointer
                  ${view === 'settings' ? 'bg-sky-50 text-primary font-black shadow-sm' : 'text-slate-600 hover:text-primary hover:bg-sky-50/50 font-bold'}
                  ${!isSidebarOpen ? 'justify-center px-0' : ''}
                `}
              >
                <div className={`transition-all shrink-0 ${view === 'settings' ? 'text-primary' : 'text-slate-400 group-hover:text-primary'}`}>
                  <Settings size={16} />
                </div>
                {isSidebarOpen && (
                  <>
                    <span className="text-[13px] tracking-normal truncate flex-1 text-left">ตั้งค่าระบบ</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''} text-slate-400 group-hover:text-primary`}
                    />
                  </>
                )}
              </button>

              {/* Submenu */}
              {settingsOpen && isSidebarOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-100 pl-3">
                  {SETTINGS_SUBMENU.map(sub => (
                    <button
                      key={sub.key}
                      onClick={() => {
                        setView('settings');
                        setActiveSettingsSection(sub.key);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[12px] font-bold transition-all duration-150 border-none cursor-pointer
                        ${
                          view === 'settings' && activeSettingsSection === sub.key
                            ? 'bg-sky-100/50 text-primary'
                            : 'text-slate-500 hover:text-primary hover:bg-sky-50/30'
                        }
                      `}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <hr className="my-4 border-slate-100" />
          
          <div className={`px-4 mb-2 text-xs font-extrabold text-slate-400 uppercase tracking-widest ${!isSidebarOpen && 'hidden'}`}>
            Role: {isManager ? 'Manager' : 'Admin'}
          </div>
        </nav>

        {/* Sidebar Footer (Optional) */}
        <div className={`p-4 transition-all opacity-40 hover:opacity-100 ${!isSidebarOpen && 'hidden'}`}>
           <div className="text-[11px] text-slate-400 text-center font-bold tracking-[0.2em] uppercase">
              V1.5.0 BUILD
           </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header (Topbar) */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-3 rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-primary transition-all bg-white border border-slate-100 shadow-sm cursor-pointer"
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={20} />}
            </button>

            {/* Page Title inside Header */}
            <div className="flex flex-col justify-center select-none">
              <div className="text-sm md:text-base text-slate-900 font-black tracking-tight italic uppercase leading-none">
                {isDetailView
                  ? (view.startsWith('call') ? 'บันทึกการทำงาน' : 'ดูข้อมูลทรัพยากร')
                  : pageTitle}
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1.5 leading-none hidden sm:inline-block">
                ColdCall Network Performance Monitoring
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Notifications */}
            <button className="p-2.5 text-slate-600 hover:text-slate-800 relative bg-slate-50/50 rounded-xl transition-colors border-none cursor-pointer">
               <Bell size={18} />
               <span className="absolute top-2 right-2 w-3.5 h-3.5 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white pointer-events-none">3</span>
            </button>
            
            {/* User Info */}
            <div className="flex items-center gap-4 pl-4 border-l border-slate-100 ml-4 group cursor-pointer">
               <div className="text-right hidden md:block">
                  <div className="text-xs font-black text-slate-800 tracking-tight leading-none mb-0.5">{user?.name}</div>
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest opacity-60 italic">{user?.role}</div>
               </div>
               <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-primary/20 transition-all">
                  <User size={20} className="text-slate-500 group-hover:text-primary transition-colors" />
               </div>
            </div>
            
             <button
               onClick={handleLogout}
               className="ml-4 p-2.5 text-slate-600 hover:text-danger hover:bg-danger/5 rounded-xl transition-all border-none cursor-pointer"
               title="Logout"
            >
               <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto px-4 pt-4 pb-3">
          <div className="mx-auto w-full">
            {/* ── Dashboard ── */}
            {view === 'dashboard' && isManager && <ManagerDashboardView />}
            {view === 'dashboard' && !isManager && <AdminDashboardView 
                adminId={currentAdminId} 
                onNextLead={handleNextLead} 
                onSelectCustomer={(c) => {
                    setSelectedCustomer(c);
                    const prefix = c.stage === 'customer' ? 'call-retention' : 'call-follow-up';
                    setView(prefix);
                }} 
            />}

            {/* ── Customer Lists ── */}
            {(view === 'master-pool' || view === 'new-leads' || view === 'follow-up' || view === 'retention') && (
              <CustomerListView
                key={view}
                type={view}
                setView={setView}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                currentAdminId={currentAdminId}
                currentAdminName={user?.name}
                role={role}
                showToast={showToast}
                onCall={(c, readonly, phone) => {
                  setSelectedCustomer(phone ? { ...c, activePhone: phone } : c);
                  // Pool leads are ALWAYS view-only — never editable from the pool list
                  const forceReadonly = view === 'master-pool' ? true : readonly;
                  setView(forceReadonly ? `view-${view}` : `call-${view}`);
                }}
              />
            )}

            {/* ── Lead Detail (Follow-up & New Leads) ── */}
            {(view === 'call-new-leads' || view === 'call-follow-up' || view === 'call-master-pool') && <LeadEntryForm customer={selectedCustomer} onBack={() => setView(view.replace('call-', ''))} showToast={showToast} currentAdminId={currentAdminId} currentAdminName={user?.name} />}
            {(view === 'view-new-leads' || view === 'view-follow-up' || view === 'view-master-pool') && <LeadEntryForm customer={selectedCustomer} onBack={() => setView(view.replace('view-', ''))} showToast={showToast} readonly currentAdminId={currentAdminId} currentAdminName={user?.name} />}

            {/* ── Retention Detail ── */}
            {view === 'call-retention' && <RetentionTrackingForm customer={selectedCustomer} onBack={() => setView('retention')} showToast={showToast} currentAdminId={currentAdminId} currentAdminName={user?.name} />}
            {view === 'view-retention' && <RetentionTrackingForm customer={selectedCustomer} onBack={() => setView('retention')} showToast={showToast} readonly />}

            {/* ── Lost Customers ── */}
            {view === 'lost-customers' && (
              <LostCustomersView
                currentAdminId={currentAdminId}
                currentAdminName={user?.name}
                isManager={isManager}
                showToast={showToast}
                onCall={(c) => {
                  setSelectedCustomer(c);
                  setView(isManager ? 'view-lost-customers' : 'call-lost-customers');
                }}
              />
            )}
            {view === 'call-lost-customers' && <RetentionTrackingForm customer={selectedCustomer} onBack={() => setView('lost-customers')} showToast={showToast} currentAdminId={currentAdminId} currentAdminName={user?.name} />}
            {view === 'view-lost-customers' && <RetentionTrackingForm customer={selectedCustomer} onBack={() => setView('lost-customers')} showToast={showToast} readonly />}

            {/* ── Performance (Admin only) ── */}
            {view === 'performance' && !isManager && <PerformanceView />}

            {/* ── Assign (Manager only) ── */}
            {view === 'assign' && isManager && (
              <AssignLeadsView showToast={showToast} role={role} />
            )}

            {/* ── Activity Log (Manager only) ── */}
            {view === 'activity' && isManager && (
              <AdminActivityView role={role} />
            )}

            {/* ── Trash (Manager only) ── */}
            {view === 'trash' && isManager && (
              <TrashView showToast={showToast} />
            )}

            {/* ── Settings (Manager only) ── */}
            {view === 'settings' && isManager && <SettingsView activeSection={activeSettingsSection} />}
          </div>
        </main>

        {/* Toast Notification */}
        {message && (
          <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-black text-white transition-all animate-in slide-in-from-bottom-4 duration-300
            ${message.type === 'error' ? 'bg-red-600' : message.type === 'info' ? 'bg-slate-700' : 'bg-emerald-600'}
          `}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
