import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { leadService } from '../../services/leadService';

const LoginView = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await leadService.authenticateUser(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        setIsSubmitting(false);
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen antialiased bg-white overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex w-[40%] flex-col justify-between bg-[#3F33A9] relative p-12 text-white">
        {/* Background Bar Chart Graphic */}
        <div className="absolute bottom-0 left-0 right-0 h-3/4 flex items-end justify-around px-4 opacity-10 pointer-events-none">
          <div className="w-[8%] bg-white h-[20%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[35%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[25%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[50%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[40%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[65%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[55%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[80%] rounded-t-md"></div>
          <div className="w-[8%] bg-white h-[100%] rounded-t-md"></div>
        </div>

        <div className="relative z-10">
          <div className="text-xs font-bold tracking-widest mb-16 opacity-80 uppercase">
            COLDCALL SYSTEM
          </div>
          <h1 className="text-6xl font-black leading-tight mb-8">
            Coldcall<br/>Management<br/>System
          </h1>
          <p className="text-sm opacity-80 max-w-sm leading-relaxed">
            ระบบบริหารและจัดการ<br/>แผนงาน สำหรับทีมงาน
          </p>
        </div>

        <div className="relative z-10 text-[10px] opacity-40 tracking-widest">
          Coldcall System - Internal
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-[60%] flex items-center justify-center p-8 relative">
        <div className="w-full max-w-[420px]">
          <div className="mb-10">
            <h2 className="text-2xl font-black text-gray-900 mb-2">เข้าสู่ระบบ</h2>
            <p className="text-sm text-gray-400 font-medium">กรุณากรอกชื่อผู้ใช้และรหัสผ่านของคุณ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-500 text-sm p-3 rounded-lg flex items-center gap-2 animate-shake font-medium">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-800">
                Email (ชื่อผู้ใช้งาน)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-[#5244E2] focus:ring-0 transition-colors bg-white"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-800">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-[#5244E2] focus:ring-0 transition-colors bg-slate-50 focus:bg-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">รหัสผ่านตั้งต้น - ติดต่อแอดมินระบบ</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full mt-2 py-4 rounded-xl font-bold text-sm tracking-wide
                transition-all flex items-center justify-center gap-2 
                ${isSubmitting ? 'bg-[#c5cbf7] text-white cursor-not-allowed' : 'bg-[#AAB3FB] hover:bg-[#97a2f9] text-white'}
              `}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </div>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </button>
          </form>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
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
