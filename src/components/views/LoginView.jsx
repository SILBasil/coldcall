import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, PhoneCall } from 'lucide-react';
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
    <div className="flex items-center justify-center min-h-screen w-screen antialiased bg-gradient-to-tr from-sky-50 via-slate-50 to-sky-100/40 p-6 relative overflow-hidden font-sans">
      {/* Ambient decorative orbs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 md:p-12 w-full max-w-[450px] shadow-2xl border border-sky-100/50 relative z-10 flex flex-col">
        {/* Soft UI Logo Box */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-primary to-sky-400 p-4 rounded-2xl shadow-xl shadow-primary/25 text-white flex items-center justify-center">
            <PhoneCall size={28} />
          </div>
        </div>

        {/* Title Block */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">เข้าสู่ระบบ</h2>
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block">COLDCALL SYSTEM</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-500 text-xs p-3.5 rounded-2xl flex items-center gap-2 animate-shake font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Email (ชื่อผู้ใช้งาน)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 focus:border-primary focus:bg-white rounded-2xl px-4 py-3.5 text-sm font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-800 placeholder-slate-400"
              placeholder="กรอกชื่อผู้ใช้งาน"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                รหัสผ่าน
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 focus:border-primary focus:bg-white rounded-2xl px-4 py-3.5 text-sm font-medium focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-800 placeholder-slate-400"
                placeholder="กรอกรหัสผ่าน"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer border-none bg-transparent"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-1 text-center">รหัสผ่านตั้งต้น - ติดต่อแอดมินระบบ</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`
              w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest
              transition-all duration-200 flex items-center justify-center gap-2 border-none cursor-pointer mt-2
              ${isSubmitting 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-primary to-sky-500 hover:from-primary-dark hover:to-sky-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 transform hover:-translate-y-0.5'
              }
            `}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </div>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </button>
        </form>
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
