import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, PhoneCall, ShieldCheck, Lock, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { leadService } from '../../services/leadService';

// Statically defined Mock Dashboard Background to prevent data leaks 
// while giving a highly premium, context-rich preview of the workspace.
const DashboardMockup = () => {
  return (
    <div className="absolute inset-0 w-full h-full bg-slate-50 flex overflow-hidden select-none pointer-events-none filter blur-sm opacity-25 z-0">
      {/* Mock Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-6 space-y-6">
        <div className="h-10 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <PhoneCall size={16} className="text-sky-500" />
          </div>
          <div className="w-24 h-4 bg-slate-200 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-sky-50 rounded-xl" />
          <div className="h-10 bg-slate-100/50 rounded-xl" />
          <div className="h-10 bg-slate-100/50 rounded-xl" />
          <div className="h-10 bg-slate-100/50 rounded-xl" />
        </div>
      </div>
      {/* Mock Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Mock Header */}
        <div className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="w-32 h-6 bg-slate-200 rounded" />
          <div className="flex space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-200" />
            <div className="w-8 h-8 rounded-full bg-slate-200" />
          </div>
        </div>
        {/* Mock Stats & Lists */}
        <div className="p-8 space-y-6 flex-1 overflow-hidden">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-6">
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="w-16 h-3 bg-slate-200 rounded" />
              <div className="w-24 h-6 bg-slate-300 rounded" />
            </div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="w-16 h-3 bg-slate-200 rounded" />
              <div className="w-24 h-6 bg-slate-300 rounded" />
            </div>
            <div className="h-28 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="w-16 h-3 bg-slate-200 rounded" />
              <div className="w-24 h-6 bg-slate-300 rounded" />
            </div>
          </div>
          {/* Table Mockup */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="h-6 bg-slate-50 rounded flex items-center px-4 justify-between">
              <div className="w-24 h-3 bg-slate-200 rounded" />
              <div className="w-32 h-3 bg-slate-200 rounded" />
              <div className="w-16 h-3 bg-slate-200 rounded" />
            </div>
            <div className="h-10 bg-white border-b border-slate-100 flex items-center px-4 justify-between">
              <div className="w-28 h-4 bg-slate-100 rounded" />
              <div className="w-36 h-4 bg-slate-100 rounded" />
              <div className="w-12 h-5 bg-emerald-100 rounded-full" />
            </div>
            <div className="h-10 bg-white border-b border-slate-100 flex items-center px-4 justify-between">
              <div className="w-32 h-4 bg-slate-100 rounded" />
              <div className="w-28 h-4 bg-slate-100 rounded" />
              <div className="w-12 h-5 bg-amber-100 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginView = ({ onLogin }) => {
  // Pre-fill email if Remember Me was previously checked
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('rememberedEmail') || '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('rememberedEmail');
  });

  const [screen, setScreen] = useState('login'); // 'login' | 'terms'
  const [tempUser, setTempUser] = useState(null);
  const [acceptChecked, setAcceptChecked] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await leadService.authenticateUser(username, password);
      if (user) {
        // Save or remove Remembered Email
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', username);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        // Check terms acceptance
        if (user.acceptedTerms === true) {
          onLogin(user);
        } else {
          setTempUser(user);
          setScreen('terms');
          setIsSubmitting(false);
        }
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        setIsSubmitting(false);
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      setIsSubmitting(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!tempUser || !acceptChecked) return;
    setIsSubmitting(true);
    try {
      await leadService.acceptTerms(tempUser.id);
      // Update local object status to reflect on login
      const updatedUser = { ...tempUser, acceptedTerms: true };
      onLogin(updatedUser);
    } catch (err) {
      setError("ไม่สามารถบันทึกข้อตกลงได้ กรุณาลองใหม่อีกครั้ง");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center sm:justify-end overflow-hidden bg-slate-50 antialiased font-sans">
      {/* Statically rendered blurred dashboard background */}
      <DashboardMockup />

      {/* Dark tint backdrop overlay to increase overall screen focus */}
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[8px] z-10 pointer-events-none" />

      {/* Side Slide-in Login panel */}
      <div className="relative z-20 w-full sm:w-[480px] h-screen bg-white/95 backdrop-blur-md border-l border-slate-100 shadow-2xl flex flex-col justify-between p-8 md:p-12 animate-slide-in-right">
        {/* Header Block */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-primary to-sky-400 p-2.5 rounded-xl shadow-lg shadow-primary/20 text-white flex items-center justify-center">
              <PhoneCall size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 tracking-wider leading-none">COLDCALL</h1>
              <span className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-1 block">ศูนย์บริหารการขาย</span>
            </div>
          </div>
        </div>

        {/* Dynamic Screen Area */}
        <div className="my-auto py-8">
          {screen === 'login' ? (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">ยินดีต้อนรับกลับมา</h2>
                <p className="text-xs text-slate-500 mt-1">กรุณากรอกข้อมูลบัญชีเพื่อเข้าสู่ระบบบริหารงานการโทร</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-xs p-3.5 rounded-xl flex items-center gap-2.5 animate-shake font-bold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email / Username field */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    อีเมลบัญชีผู้ใช้งาน
                  </label>
                  <input
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-800 placeholder-slate-400"
                    placeholder="name@coldcall.com"
                    autoComplete="username"
                    required
                  />
                </div>

                {/* Password field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      รหัสผ่านความปลอดภัย
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-primary focus:bg-white rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-800 placeholder-slate-400 pr-12"
                      placeholder="กรอกรหัสผ่านผ่านระบบ"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer border-none bg-transparent flex items-center justify-center"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me and Forgot Password bar */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary/20 transition-all"
                    />
                    <span className="text-xs text-slate-600 font-medium">จำผู้ใช้งานไว้</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-primary hover:text-primary-dark font-semibold border-none bg-transparent cursor-pointer hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`
                    w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider
                    transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer mt-4
                    ${isSubmitting
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5 active:scale-95'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
                      <span>ตรวจสอบบัญชี...</span>
                    </div>
                  ) : (
                    "เข้าสู่ระบบใช้งาน"
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-fade-in space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-sky-50 p-2 rounded-xl text-primary">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">ข้อตกลงและนโยบายระบบ</h2>
                  <p className="text-xs text-slate-500 mt-0.5">การล็อกอินครั้งแรก โปรดยอมรับระเบียบปฏิบัติเพื่อเริ่มงาน</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-xs p-3.5 rounded-xl flex items-center gap-2.5 animate-shake font-bold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Policy Scroll Box */}
              <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 text-[11px] leading-relaxed text-slate-600 font-medium overflow-y-auto h-[260px] custom-scrollbar space-y-4">
                <div>
                  <p className="font-bold text-slate-800 text-xs mb-1">1. การรักษาความลับและความปลอดภัยสูงสุด (Confidentiality)</p>
                  <p>ผู้ใช้งานตกลงเก็บรักษาข้อมูลลูกค้า เบอร์โทรศัพท์ ประวัติการซื้อขาย และเอกสารแนบทั้งหมดในระบบนี้ไว้เป็นความลับสูงสุดของบริษัทอย่างเคร่งครัด ห้ามมิให้ทำซ้ำ คัดลอก ส่งต่อ บันทึกหน้าจอ หรือเปิดเผยข้อมูลเหล่านั้นต่อบุคคลภายนอกไม่ว่าในกรณีใดๆ ทั้งสิ้น</p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 text-xs mb-1">2. การคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance)</p>
                  <p>การดำเนินการติดต่อ ประสานงาน หรือเก็บประวัติลูกค้า ต้องกระทำภายใต้หน้าที่ปฏิบัติงานที่ได้รับมอบหมายของบริษัทเท่านั้น ห้ามนำข้อมูลส่วนตัวของลูกค้าไปใช้ประโยชน์ส่วนตนโดยเด็ดขาด การกระทำทั้งหมดต้องเป็นไปตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 text-xs mb-1">3. ความรับผิดชอบต่อบัญชีใช้งาน (Account Security)</p>
                  <p>ผู้ใช้งานตกลงเก็บรักษาบัญชีล็อกอินและรหัสผ่านไว้เป็นความลับส่วนบุคคล ห้ามแบ่งปัน บัญชีนี้ให้ผู้อื่น หรือเปิดเข้าใช้งานบัญชีพร้อมกันหลายคน หากพบเห็นหรือตรวจพบการกระทำอันน่าสงสัย บัญชีของท่านอาจถูกระงับการทำงานชั่วคราวเพื่อตรวจสอบความปลอดภัย</p>
                </div>

                <div>
                  <p className="font-bold text-slate-800 text-xs mb-1">4. ความถูกต้องเที่ยงตรงของข้อมูลการโทร</p>
                  <p>การบันทึกสถานะการโทร เหตุผลการปฏิเสธ และบันทึกคำสนทนา จะต้องสะท้อนตามข้อเท็จจริงจริงจากการโทรประสานงานเท่านั้น ห้ามไม่ให้ตกแต่ง ดัดแปลง หรือบันทึกข้อมูลเท็จอันขัดต่อกฎระเบียบปฏิบัติงาน</p>
                </div>
              </div>

              {/* Accept Box Checkbox */}
              <label className="flex gap-3 items-start cursor-pointer select-none border border-slate-100 rounded-xl p-3 bg-white hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={acceptChecked}
                  onChange={(e) => setAcceptChecked(e.target.checked)}
                  className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary/20 transition-all shrink-0 mt-0.5"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-800">ฉันยอมรับข้อตกลงและนโยบาย</p>
                  <p className="text-slate-500 mt-0.5 text-[10px]">ยืนยันว่าได้อ่าน ทำความเข้าใจ และยอมรับเงื่อนไขการปฏิบัติตามมาตรฐานข้างต้น</p>
                </div>
              </label>

              {/* Actions Button */}
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleAcceptTerms}
                  disabled={!acceptChecked || isSubmitting}
                  className={`
                    w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider
                    transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer
                    ${!acceptChecked || isSubmitting
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transform hover:-translate-y-0.5 active:scale-95'
                    }
                  `}
                >
                  {isSubmitting ? "กำลังบันทึกข้อมูล..." : "ยอมรับข้อตกลงและเข้าสู่ระบบ"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScreen('login');
                    setTempUser(null);
                    setAcceptChecked(false);
                  }}
                  className="w-full py-2 bg-transparent text-slate-500 hover:text-slate-800 font-semibold text-xs border-none cursor-pointer text-center hover:underline"
                >
                  ย้อนกลับหน้าล็อกอิน
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Block */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">รหัสผ่านตั้งต้นกรุณาติดต่อผู้พัฒนาหรือแอดมินสูงสุด</p>
          <p className="text-[9px] text-slate-400/80 mt-1">© {new Date().getFullYear()} ColdCall System. All rights reserved.</p>
        </div>
      </div>

      {/* Forgot Password Modal (Support Overlay) */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 border border-slate-100 flex flex-col space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500 flex items-center justify-center">
                <HelpCircle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">ลืมรหัสผ่านความปลอดภัย?</h3>
                <p className="text-[10px] text-slate-500">ขั้นตอนช่วยเหลือสิทธิ์ผู้ใช้งานระบบ</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              สำหรับระบบบริหารงาน **ColdCall System** เพื่อความปลอดภัยสูงสุดของคลังรายชื่อแอดมินไม่สามารถรีเซ็ตรหัสผ่านได้ด้วยตัวเอง
            </p>
            <p className="text-xs text-slate-600 leading-relaxed font-bold bg-slate-50 border border-slate-100 p-3 rounded-xl">
              🔑 โปรดติดต่อแอดมินผู้จัดการ (Manager) ของระบบคุณเพื่อทำตั้งค่ารหัสผ่านใหม่
            </p>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all border-none cursor-pointer"
            >
              รับทราบและปิดหน้านี้
            </button>
          </div>
        </div>
      )}

      {/* Local keyframes and rules injection */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0.8;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        /* Hide default browser password reveal icon (Edge/IE) */
        input::-ms-reveal,
        input::-ms-clear {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default LoginView;
