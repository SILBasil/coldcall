import React, { useState, useEffect } from 'react';
import { 
  X, Save, ChevronLeft, PhoneCall, MapPin, Target, ListChecks, 
  Plus, Check, MessageSquare, Users, Phone, Clock, Star, 
  Activity, Award, History as HistoryIcon, Phone as PhoneIcon, 
  FileText, Loader2, QrCode, Facebook
} from 'lucide-react';

import QRCodeModal from '../common/QRCodeModal';
import { leadService } from '../../services/leadService';
import ContactHistory from '../common/ContactHistory';
import HistoryCalendar from '../common/HistoryCalendar';


const LeadEntryForm = ({ customer, onBack, showToast, currentAdminId, currentAdminName, readonly = false }) => {
  const [matchingTopics, setMatchingTopics] = useState([]);
  const [masterTopics, setMasterTopics] = useState([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const [formState, setFormState] = useState({
    checklist: { chat: false, group: false, remark: '' },
    callTracking: { date: '', count: 0, remark: '' },
    sampleStatus: { catalogue: false, sampleReceived: false, date: '' },
    visitStatus: { visit: false, month: '', remark: '' },
    status: '',
    orderDetail: '',
    score: 0,
    prefTime: '',
    remark: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeDialPhone, setActiveDialPhone] = useState(customer.activePhone || customer.phone);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isSocialEdit, setIsSocialEdit] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ 
    lineId: customer.lineId || '', 
    facebookUrl: customer.facebookUrl || '' 
  });
  const [historyLogs, setHistoryLogs] = useState([]);
  const openedAtRef = React.useRef(Date.now());



  // Log 'open customer' event on mount and fetch history
  useEffect(() => {
    const init = async () => {
      try {
        await leadService.logActivity({
          adminId: currentAdminId,
          adminName: currentAdminName,
          customerId: customer.id || customer.phone,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerStage: customer.stage,
          action: `เปิดดูข้อมูลลูกค้า (Lead): ${customer.name}`,
          type: 'open'
        });
        
        const logs = await leadService.getSaveSnapshots(customer.id || customer.phone);
        setHistoryLogs(logs);
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [customer.id]);

  // Load master topics from Firestore, then set working topics
  useEffect(() => {
    const loadTopics = async () => {
      try {
        let all = await leadService.getMasterTopics();
        // Auto-seed if Firestore is empty
        if (all.length === 0) {
          await leadService.seedDefaultTopics();
          all = await leadService.getMasterTopics();
        }
        setMasterTopics(all);

        // Deduplicate by title (safety for dev StrictMode double-invoke)
        const seen = new Set();
        const uniqueAll = all.filter(t => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });

        // Restore saved topics if exist, otherwise use defaults
        if (customer.matchingTopics && customer.matchingTopics.length > 0) {
          setMatchingTopics(customer.matchingTopics);
        } else {
          const defaults = uniqueAll.filter(t => t.isDefault).map(t => ({
            id: t.id, title: t.title, checked: false, detail: '', problem: ''
          }));
          setMatchingTopics(defaults);
        }
      } catch (err) {
        console.error('Failed to load topics:', err);
      }
    };
    loadTopics();
  }, [customer.id]);

  useEffect(() => {
    if (customer.formState) {
      setFormState(customer.formState);
    }
  }, [customer]);

  const addTopic = (masterTopic) => {
    const exists = matchingTopics.some(t => t.title === masterTopic.title);
    if (!exists) {
      const newId = Date.now();
      setMatchingTopics([...matchingTopics, { id: newId, title: masterTopic.title, checked: false, detail: '', problem: '' }]);
    }
    setShowTopicPicker(false);
  };

  const logCall = async () => {
    try {
      await leadService.logActivity({
        adminId: currentAdminId,
        adminName: currentAdminName,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerStage: customer.stage,
        action: `โทรหาลูกค้าแล้วเมื่อเวลา ${new Date().toLocaleTimeString('th-TH')}`,
        type: 'call'
      });
      // Increment attempt count
      setFormState(prev => ({
        ...prev,
        callTracking: { ...prev.callTracking, count: prev.callTracking.count + 1, date: new Date().toISOString().split('T')[0] }
      }));
      showToast("บันทึกประวัติการโทรเรียบร้อย");
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการบันทึกประวัติการโทร", "error");
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const duration = Math.floor((Date.now() - openedAtRef.current) / 1000);

      const updates = {
        formState,
        matchingTopics,
        lineId: socialLinks.lineId,
        facebookUrl: socialLinks.facebookUrl,
        lastUpdated: new Date()
      };

      // Auto-transition to Retention if Closed Won
      if (formState.status === '✅ ปิดดีลสำเร็จ (Closed Won)') {
        updates.stage = 'customer';
        updates.wonAt = new Date();
      } else if (formState.status === '❌ ปิดดีลไม่ได้ (Closed Lost)') {
        updates.lostAt = new Date();
      }

      await leadService.updateCustomer(customer.id || customer.phone, updates);

      
      await leadService.logActivity({
        adminId: currentAdminId,
        adminName: currentAdminName,
        customerId: customer.id || customer.phone,
        customerName: customer.name,
        customerPhone: customer.phone,
        previousStage: customer.stage || 'pool',
        customerStage: updates.stage || customer.stage || 'qualified',
        action: `บันทึกข้อมูลลูกค้า: ${formState.status || 'อัปเดตข้อมูลทั่วไป'}${updates.stage === 'customer' ? ' (ย้ายไปกลุ่ม Retention)' : ''}`,
        type: 'save',
        duration,
        reasons: formState.orderDetail ? [formState.orderDetail] : [],
        snapshot: { formState, matchingTopics }
      });
      
      const updatedLogs = await leadService.getSaveSnapshots(customer.id || customer.phone);
      setHistoryLogs(updatedLogs);

      openedAtRef.current = Date.now(); // reset timer after save

      showToast(updates.stage === 'customer' ? "บันทึกข้อมูล ย้ายลูกค้าไปยังระบบติดตามกลุ่ม Retention สำเร็จ" : "บันทึกข้อมูลเรียบร้อยแล้ว...");
      
      // กลับหน้าหลักอัตโนมัติหลังบันทึก
      setTimeout(() => {
        if (onBack) onBack();
      }, 1500);
      
    } catch (err) {
      console.error("Save error:", err);
      showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLastUpdatedText = () => {
    if (historyLogs && historyLogs.length > 0) {
       const latest = historyLogs[0];
       const date = latest.timestamp?.toDate ? latest.timestamp.toDate() : new Date(latest.timestamp);
       return `อัปเดตล่าสุด: ${date.toLocaleDateString('th-TH')} ${date.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} (${latest.adminName || 'Admin'})`;
    }
    if (customer.updatedAt) {
       const date = customer.updatedAt?.toDate ? customer.updatedAt.toDate() : new Date(customer.updatedAt);
       return `อัปเดตล่าสุด: ${date.toLocaleDateString('th-TH')} ${date.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}`;
    }
    return "💡 ข้อมูลเริ่มต้นจากบอท (ยังไม่มีการบันทึกเพิ่ม)";
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-700 max-w-[1400px] mx-auto pb-10">
      {/* Read-only Banner for Pool leads */}
      {readonly && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
          <span className="text-xl">🔒</span>
          <div>
            <div className="text-sm font-black text-amber-700 uppercase tracking-wide">ข้อมูลระบบอ่านอย่างเดียว (Read-only)</div>
            <div className="text-xs text-amber-600">รายชื่อนี้อยู่ใน Master Pool จึงไม่สามารถแก้ไขข้อมูลได้โดยตรง หากจะแก้ไขให้โทรและตอบแบบสอบถามก่อนจึงจะบันทึกได้</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between group px-1">
        <div className="flex items-center gap-6">
          {/* Back Button on the far left - Premium Style */}
          <button
              onClick={onBack}
              className="group/back flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-slate-100 shadow-sm active:scale-95 cursor-pointer"
            >
              <div className="p-2 bg-slate-50 group-hover/back:bg-primary/10 rounded-xl transition-colors">
                <ChevronLeft size={18} className="group-hover/back:-translate-x-0.5 transition-transform" /> 
              </div>
              <span className="hidden md:inline">กลับหน้าหลัก</span>
          </button>

          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-2xl font-black text-slate-800 shrink-0 shadow-md border border-slate-100 group-hover:scale-105 transition-transform duration-500">
              {customer.name?.charAt(0) || '?'}
            </div>
            <div>
              <div className="flex items-center gap-4 mb-2 leading-none">
                <div className="text-2xl font-black text-slate-900 tracking-tighter italic">{customer.name}</div>
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-100/50 rounded-xl text-xs font-black text-indigo-500 uppercase tracking-widest shadow-sm">LS-{customer.id}</span>
              </div>
              
              {/* LAST UPDATED TEXT  */}
              <div className="text-xs font-black text-emerald-600 mb-2 mt-[-2px] tracking-wide inline-flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100/50 shadow-sm">
                 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                 {getLastUpdatedText()}
              </div>

              <div className="flex flex-wrap gap-4 text-sm font-black text-slate-600 uppercase tracking-widest italic mt-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shadow-sm whitespace-nowrap w-fit">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm"><FileText size={14} className="text-amber-500" /></div>
                  <span className="tracking-tight">{customer.businessType || 'ไม่ระบุประเภทธุรกิจ'}</span> 
                  <span className="mx-1 opacity-40">|</span> 
                  📦 <span className="tracking-tight">{customer.usageQuantity || '?'}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <span 
                      className={`flex items-center gap-2 group/phone cursor-pointer px-3 py-1.5 rounded-xl border transition-all ${activeDialPhone === customer.phone ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white'}`}
                      onClick={() => {
                        setActiveDialPhone(customer.phone);
                        setShowQrModal(true);
                      }}
                    >
                       <PhoneCall size={14} className={activeDialPhone === customer.phone ? 'text-primary' : 'text-slate-400'} /> 
                       <span className="font-black tracking-wider">{customer.phone}</span>
                       <QrCode size={14} className="opacity-40 group-hover/phone:opacity-100" />
                    </span>

                    {customer.allPhones?.filter(p => p !== customer.phone).map((p, i) => (
                      <span 
                        key={i}
                        className={`flex items-center gap-2 group/phone cursor-pointer px-3 py-1.5 rounded-xl border transition-all ${activeDialPhone === p ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white'}`}
                        onClick={() => {
                          setActiveDialPhone(p);
                          setShowQrModal(true);
                        }}
                      >
                         <PhoneCall size={14} className={activeDialPhone === p ? 'text-primary' : 'text-slate-400'} /> 
                         <span className="font-black tracking-wider">{p}</span>
                         <QrCode size={14} className="opacity-40 group-hover/phone:opacity-100" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

           <div className="flex gap-3 relative">
             {/* Edit Social Input Popover */}
             {isSocialEdit && (
               <div className="absolute top-full right-0 mt-4 p-6 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-50 w-80 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 italic text-left">เชื่อมต่อโซเชียลมีเดีย (Social Connect)</div>
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#06C755] uppercase tracking-[0.2em] pl-1 italic block text-left">LINE ID / OA ID</label>
                        <input 
                           type="text" 
                           value={socialLinks.lineId}
                           onChange={(e) => setSocialLinks({...socialLinks, lineId: e.target.value})}
                           placeholder="ตัวอย่าง @shop_name"
                           className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-black border border-slate-100 outline-none focus:border-[#06C755]/30 shadow-inner"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#1877F2] uppercase tracking-[0.2em] pl-1 italic block text-left">Facebook Profile / Page</label>
                        <input 
                           type="text" 
                           value={socialLinks.facebookUrl}
                           onChange={(e) => setSocialLinks({...socialLinks, facebookUrl: e.target.value})}
                           placeholder="Ex. https://fb.com/..."
                           className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-black border border-slate-100 outline-none focus:border-[#1877F2]/30 shadow-inner"
                        />
                     </div>
                     <button 
                       onClick={() => setIsSocialEdit(false)}
                       className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary transition-all mt-2 shadow-lg border-none cursor-pointer"
                     >
                       ปิดและบันทึกชั่วคราว
                     </button>
                  </div>
               </div>
             )}

             <button 
                 onClick={() => {
                   const s = !isHistoryOpen;
                   setIsHistoryOpen(s);
                   if (s) setIsSocialEdit(false);
                 }}
                 className={`px-5 py-2.5 rounded-2xl transition-all text-sm font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 border-none cursor-pointer ${isHistoryOpen ? 'bg-primary text-white shadow-primary/20' : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'}`}
               >
                 <HistoryIcon size={16} />
                 ดูประวัติย้อนหลัง
               </button>

              <div className="w-px h-10 bg-slate-100 mx-1 self-center" />

              <button 
                 onClick={async () => {
                   try {
                     // SMART LOGIC: If ID exists, build the link
                     if (socialLinks.lineId) {
                        const id = socialLinks.lineId.startsWith('@') ? socialLinks.lineId.slice(1) : socialLinks.lineId;
                        // Line OA format usually https://line.me/R/ti/p/ or ti/p/~
                        const url = socialLinks.lineId.startsWith('@') 
                          ? `https://line.me/R/ti/p/${id}`
                          : `https://line.me/ti/p/~${id}`;
                        window.open(url, '_blank');
                     }
                     
                     await navigator.clipboard.writeText(`สวัสดีครับคุณ ${customer.name}...`);

                     showToast(socialLinks.lineId ? "เปิด LINE และคัดลอกข้อความทักทายสำเร็จ" : "คัดลอกข้อความทักทายเรียบร้อย (ยังไม่มี LINE ID)");
                   } catch (err) {
                     console.error(err);
                   }
                 }}
                 className={`px-5 py-2.5 transition-all text-sm font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 rounded-2xl group/line border-none cursor-pointer ${socialLinks.lineId ? 'bg-[#06C755] text-white shadow-[#06C755]/20' : 'bg-white text-[#06C755] border border-[#06C755]/20 hover:bg-[#06C755] hover:text-white'}`}
              >
                 <div className={`p-1.5 rounded-lg transition-colors ${socialLinks.lineId ? 'bg-white/20' : 'bg-[#06C755]/10 group-hover/line:bg-white/20'}`}>
                    <MessageSquare size={16} />
                 </div>
                 LINE
              </button>
              <button 
                 onClick={async () => {
                   try {
                     // SMART LOGIC: If Url exists, open it directly
                     if (socialLinks.facebookUrl) {
                        window.open(socialLinks.facebookUrl, '_blank');
                     } else {
                        // FB Search Fallback
                        const searchUrl = `https://www.facebook.com/search/top/?q=${encodeURIComponent(customer.name)}`;
                        window.open(searchUrl, '_blank');
                     }
                     
                     await navigator.clipboard.writeText(`ขอบพระคุณคุณ ${customer.name}...`);

                     showToast("คัดลอกข้อความทักทายและเปิดหน้าค้นหา Facebook สำเร็จ");
                   } catch (err) {
                     console.error(err);
                   }
                 }}
                 className={`px-5 py-2.5 transition-all text-sm font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 rounded-2xl group/fb border-none cursor-pointer ${socialLinks.facebookUrl ? 'bg-[#1877F2] text-white shadow-[#1877F2]/20' : 'bg-white text-[#1877F2] border border-[#1877F2]/20 hover:bg-[#1877F2] hover:text-white'}`}
              >
                 <div className={`p-1.5 rounded-lg transition-colors ${socialLinks.facebookUrl ? 'bg-white/20' : 'bg-[#1877F2]/10 group-hover/fb:bg-white/20'}`}>
                    <Facebook size={16} /> 
                 </div>
                 FB
              </button>

              {!readonly && (
                <button 
                  onClick={() => {
                    const s = !isSocialEdit;
                    setIsSocialEdit(s);
                    if (s) setIsHistoryOpen(false);
                  }}
                  className={`p-3 rounded-2xl transition-all border shadow-sm cursor-pointer ${isSocialEdit ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-100 text-slate-600 hover:text-primary hover:border-primary/20'}`}
                  title="Update Social Links"
                >
                    <Plus size={20} />
                </button>
              )}



              <QRCodeModal 
                 isOpen={showQrModal} 
                 onClose={() => setShowQrModal(false)}
                 phone={activeDialPhone}
                 name={customer.name}
               />



              {isHistoryOpen && (


                <HistoryCalendar 
                  logs={historyLogs} 
                  onClose={() => setIsHistoryOpen(false)}
                  onRestore={(snapshot) => {
                    if (snapshot.formState) setFormState(prev => ({ ...prev, ...snapshot.formState }));
                    if (snapshot.matchingTopics) setMatchingTopics(snapshot.matchingTopics);
                    showToast("ดึงข้อมูลย้อนหลังจากประวัติสำเร็จ");
                    setIsHistoryOpen(false);
                  }} 
                />
              )}
           </div>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-start ${readonly && 'opacity-80 pointer-events-none'}`}>
         <div className="lg:col-span-8 space-y-6">
           <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100 group/section">
             <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex justify-between items-center group-hover/section:bg-primary/5 transition-colors duration-500">
               <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-primary/10 rounded-xl group-hover/section:scale-105 transition-transform shadow-inner">
                    <Target size={22} className="text-primary" />
                 </div>
                 <div>
                    <div className="text-sm font-black text-slate-900 tracking-widest uppercase italic">1. ความต้องการและข้อมูลของลูกค้า (Needs Mapping)</div>
                 </div>
               </div>
               {!readonly && (
                 <button onClick={() => setShowTopicPicker(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-lg border-none cursor-pointer">
                   <Plus size={14} className="text-primary" /> เพิ่มหัวข้อ
                 </button>
               )}
             </div>
             <div className="p-8">
               <div className="grid grid-cols-12 gap-4 text-xs font-black text-slate-600 uppercase tracking-[0.2em] mb-4 px-3 italic border-b border-slate-100 pb-3">
                 <div className="col-span-4">หัวข้อความต้องการ (Topic)</div>
                 <div className="col-span-4">รายละเอียด / เพิ่มเติม</div>
                 <div className="col-span-4">ปัญหาของลูกค้า (Painpoints)</div>
               </div>
               <div className="space-y-3">
                 {matchingTopics.map((t, idx) => (
                   <div key={t.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl transition-all duration-500 group/row">
                     <div className="col-span-4 flex items-center gap-4">
                        <label className="relative flex items-center cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={t.checked} 
                             onChange={(e) => {
                               const newTopics = [...matchingTopics];
                               newTopics[idx].checked = e.target.checked;
                               setMatchingTopics(newTopics);
                             }}
                             className="peer h-6 w-6 bg-white border border-slate-200 rounded-lg checked:bg-primary checked:border-primary transition-all appearance-none cursor-pointer shadow-sm" 
                           />
                           <Check size={14} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                        </label>
                       <span className="text-sm font-black text-slate-800 tracking-tight group-hover/row:text-primary transition-colors">{t.title}</span>
                     </div>
                     <div className="col-span-4">
                       <input 
                         type="text" 
                         value={t.detail || ''}
                         onChange={(e) => {
                           const newTopics = [...matchingTopics];
                           newTopics[idx].detail = e.target.value;
                           setMatchingTopics(newTopics);
                         }}
                         placeholder="รายละเอียดเพิ่มเติม..." 
                         className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl outline-none font-black text-xs text-slate-700 focus:border-primary/30 transition-all shadow-inner" 
                       />
                     </div>
                     <div className="col-span-3">
                       <input 
                         type="text" 
                         value={t.problem || ''}
                         onChange={(e) => {
                           const newTopics = [...matchingTopics];
                           newTopics[idx].problem = e.target.value;
                           setMatchingTopics(newTopics);
                         }}
                         placeholder="ระบุปัญหาของลูกค้า..." 
                         className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl outline-none font-black text-xs text-rose-600 placeholder:text-rose-400 focus:border-rose-300 transition-all shadow-inner" 
                       />
                     </div>
                     <div className="col-span-1 flex justify-end">
                       {!readonly && (
                         <button onClick={() => setMatchingTopics(matchingTopics.filter((_, i) => i !== idx))}
                           className="opacity-0 group-hover/row:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all border-none bg-transparent cursor-pointer">
                           <X size={14} />
                         </button>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>

           {/* Topic Picker Modal */}
           {showTopicPicker && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowTopicPicker(false)}>
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                 <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                   <div className="font-black text-sm text-slate-800 uppercase tracking-tight">เลือกหัวข้อความต้องการจาก Master List</div>
                   <button onClick={() => setShowTopicPicker(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors border-none bg-transparent cursor-pointer"><X size={16} /></button>
                 </div>
                 <div className="p-3 max-h-72 overflow-y-auto space-y-1">
                   {masterTopics.length === 0 ? (
                     <div className="p-6 text-center text-slate-400 text-xs font-bold">ยังไม่มีหัวข้อในฐานข้อมูล สามารถเพิ่มหัวข้อเพิ่มได้ที่ Settings</div>
                   ) : masterTopics.map(mt => {
                     const alreadyAdded = matchingTopics.some(t => t.title === mt.title);
                     return (
                       <button key={mt.id} onClick={() => !alreadyAdded && addTopic(mt)} disabled={alreadyAdded}
                         className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all border-none cursor-pointer
                           ${alreadyAdded ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 active:scale-95'}`}
                       >
                         <span className="flex items-center gap-2">
                           {mt.isDefault && <span className="text-amber-400 text-xs">⭐</span>}
                           {mt.title}
                         </span>
                         {alreadyAdded && <span className="text-[10px] font-black text-slate-300 uppercase">เพิ่มแล้ว</span>}
                       </button>
                     );
                   })}
                 </div>
               </div>
             </div>
           )}

           <div className="bg-white rounded-[2.5rem] shadow-sm overflow-hidden border border-slate-100 group/section">
             <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex items-center gap-4 group-hover/section:bg-primary/5 transition-colors duration-500">
               <div className="p-2.5 bg-primary/10 rounded-xl group-hover/section:scale-105 transition-transform shadow-inner">
                 <ListChecks size={22} className="text-primary" />
               </div>
               <div>
                 <div className="text-sm font-black text-slate-900 tracking-widest uppercase italic">2. ตารางบันทึกการทำงาน (Work Log)</div>
               </div>
             </div>
             <div className="p-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="flex items-center gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                   <label className="flex items-center gap-3 cursor-pointer group/check">
                     <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={formState.checklist.chat}
                          onChange={(e) => setFormState({...formState, checklist: {...formState.checklist, chat: e.target.checked}})}
                          className="peer h-6 w-6 bg-white border border-slate-200 rounded-lg checked:bg-primary transition-all appearance-none cursor-pointer shadow-sm" 
                        />
                        <Check size={14} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                     </div>
                     <span className="text-xs font-black text-slate-700 uppercase tracking-widest">ทักแชทลูกค้า</span>
                   </label>
                   <label className="flex items-center gap-3 cursor-pointer group/check pl-6 border-l border-slate-200">
                     <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={formState.checklist.group}
                          onChange={(e) => setFormState({...formState, checklist: {...formState.checklist, group: e.target.checked}})}
                          className="peer h-6 w-6 bg-white border border-slate-200 rounded-lg checked:bg-emerald-500 transition-all appearance-none cursor-pointer shadow-sm" 
                        />
                        <Check size={14} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                     </div>
                     <span className="text-xs font-black text-slate-700 uppercase tracking-widest">สร้างกลุ่มสื่อสาร</span>
                   </label>
                 </div>
                 <input 
                   type="text" 
                   value={formState.checklist.remark}
                   onChange={(e) => setFormState({...formState, checklist: {...formState.checklist, remark: e.target.value}})}
                   placeholder="ใส่หมายเหตุเพิ่มเติมเกี่ยวกับแชท/กลุ่ม..." 
                   className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-700 outline-none focus:border-primary/20 transition-all shadow-inner" 
                 />
               </div>

               <div className="p-6 bg-primary/[0.02] rounded-[2rem] border border-primary/10 grid grid-cols-1 md:grid-cols-4 gap-6 items-center shadow-sm">
                 <label className="flex items-center gap-4 cursor-pointer group/call">
                   <div className="relative flex items-center">
                     <input 
                       type="checkbox" 
                       checked={!!formState.callTracking.date}
                       onChange={(e) => {
                         const date = e.target.checked ? new Date().toISOString().split('T')[0] : '';

                         setFormState({...formState, callTracking: {...formState.callTracking, date}});
                       }}
                       className="peer h-8 w-8 bg-white border border-primary/20 rounded-xl checked:bg-primary transition-all appearance-none cursor-pointer shadow-md" 
                     />
                     <Check size={18} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                   </div>
                   <span className="text-lg font-black text-slate-900 tracking-tighter">โทรศัพท์</span>
                 </label>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 italic">วันที่โทรล่าสุด (Date)</label>
                    <input 
                      type="date" 
                      value={formState.callTracking.date}
                      onChange={(e) => setFormState({...formState, callTracking: {...formState.callTracking, date: e.target.value}})}
                      className="w-full bg-white px-4 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 italic">จำนวนครั้งที่โทร (Attempts)</label>
                    <input 
                      type="number" 
                      value={formState.callTracking.count}
                      onChange={(e) => setFormState({...formState, callTracking: {...formState.callTracking, count: parseInt(e.target.value) || 0}})}
                      className="w-full bg-white px-4 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 italic">ผลการติดต่อ (Result)</label>
                    <select 
                      value={formState.callTracking.remark}
                      onChange={(e) => setFormState({...formState, callTracking: {...formState.callTracking, remark: e.target.value}})}
                      className="w-full bg-white px-4 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm cursor-pointer"
                    >
                      <option value="">เลือกสถานะการโทร...</option>
                      <option>ไม่มีคนรับสาย</option>
                      <option>สายไม่ว่าง / ติดสายอื่น</option>
                      <option>สนใจขอข้อมูลเพิ่มเติม / ส่งเอกสาร</option>
                      <option>เบอร์โทรศัพท์ไม่ถูกต้อง</option>
                    </select>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                 <div className="md:col-span-3 flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100 shadow-sm transition-all hover:bg-amber-50">
                     <input 
                       type="checkbox" 
                       checked={formState.sampleStatus.catalogue}
                       onChange={(e) => setFormState({...formState, sampleStatus: {...formState.sampleStatus, catalogue: e.target.checked}})}
                       className="peer h-6 w-6 bg-white border border-amber-200 rounded-lg checked:bg-amber-500 transition-all appearance-none cursor-pointer shadow-md"
                     />
                     <span className="text-xs font-black text-slate-800 uppercase tracking-widest">ส่งแคตตาล็อกสินค้า</span>
                 </div>
                 <div className="md:col-span-4 flex items-center gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:bg-emerald-50">
                     <input 
                       type="checkbox" 
                       checked={formState.sampleStatus.sampleReceived}
                       onChange={(e) => setFormState({...formState, sampleStatus: {...formState.sampleStatus, sampleReceived: e.target.checked}})}
                       className="peer h-6 w-6 bg-white border border-emerald-200 rounded-lg checked:bg-emerald-500 transition-all appearance-none cursor-pointer shadow-md"
                     />
                     <span className="text-xs font-black text-slate-800 uppercase tracking-widest">ยืนยันส่งตัวอย่างกล่อง</span>
                 </div>
                 <div className="md:col-span-5 space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1 italic">วันที่ยืนยันดำเนินการ (Confirmed Date)</label>
                    <input 
                      type="date" 
                      value={formState.sampleStatus.date}
                      onChange={(e) => setFormState({...formState, sampleStatus: {...formState.sampleStatus, date: e.target.value}})}
                      className="w-full bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-inner" 
                    />
                 </div>
               </div>

               <div className="p-6 border-2 border-dashed border-slate-100 rounded-[2rem] grid grid-cols-1 md:grid-cols-4 gap-6 items-center bg-slate-50/30">
                 <div className="flex items-center gap-4">
                    <input 
                      type="checkbox" 
                      checked={formState.visitStatus.visit}
                      onChange={(e) => setFormState({...formState, visitStatus: {...formState.visitStatus, visit: e.target.checked}})}
                      className="peer h-8 w-8 bg-white border border-slate-200 rounded-xl checked:bg-slate-800 transition-all appearance-none cursor-pointer shadow-md"
                    />
                    <span className="text-sm font-black text-slate-900 leading-none uppercase tracking-widest">นัดเข้าพบ/ดูหน้างาน</span>
                 </div>
                 <div className="space-y-2">
                    <select 
                      value={formState.visitStatus.month}
                      onChange={(e) => setFormState({...formState, visitStatus: {...formState.visitStatus, month: e.target.value}})}
                      className="w-full bg-white px-4 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm cursor-pointer"
                    >
                      <option value="">เลือกเดือนที่สะดวกนัดพบ...</option>
                      {['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].map(m => <option key={m}>{m}</option>)}
                    </select>
                 </div>
                 <div className="md:col-span-2">
                    <input 
                      type="text" 
                      value={formState.visitStatus.remark}
                      onChange={(e) => setFormState({...formState, visitStatus: {...formState.visitStatus, remark: e.target.value}})}
                      placeholder="ระบุรายละเอียดการนัดพบลูกค้า..." 
                      className="w-full bg-white px-5 py-2.5 rounded-xl text-xs font-black border border-slate-100 outline-none shadow-sm" 
                    />
                 </div>
               </div>
             </div>
           </div>
         </div>

         <div className="lg:col-span-4 space-y-6">
           <div className="bg-white rounded-[2.5rem] shadow-sm p-8 border-t-[8px] border-primary group/sidebar overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[5rem] group-hover/sidebar:scale-110 transition-transform" />
             
             <div className="relative z-10 space-y-8">
                <div>
                   <div className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-1 italic">สถานะความคืบหน้าและการปิดดีล</div>
                   <div className="h-1 w-10 bg-primary/20 mt-3 rounded-full" />
                </div>
                
                <div className="space-y-5">
                  <div>
                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">3. บันทึกผลการปิดดีล (Closing Record)</label>
                     <div className="relative">
                        <select 
                          value={formState.status}
                          onChange={(e) => setFormState({...formState, status: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-black text-sm outline-none focus:border-primary/20 appearance-none shadow-inner cursor-pointer"
                        >
                          <option value="">เลือกผลการปิดดีล...</option>
                          <option value="✅ ปิดดีลสำเร็จ (Closed Won)">✅ ปิดดีลสำเร็จ (Closed Won)</option>
                          <option value="❌ ปิดดีลไม่ได้ (Closed Lost)">❌ ปิดดีลไม่ได้ (Closed Lost)</option>
                          <option value="⏳ รอการตัดสินใจ (Pending)">⏳ รอการตัดสินใจ (Pending)</option>
                        </select>
                     </div>
                  </div>
                  
                  <div>
                     <input 
                       type="text" 
                       value={formState.orderDetail}
                       onChange={(e) => setFormState({...formState, orderDetail: e.target.value})}
                       placeholder="สรุปรายการสั่งสินค้าครั้งแรก หรือระบุเหตุผลปิดดีลล้มเหลว..."
                       className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-800 font-black text-xs outline-none shadow-inner"
                     />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shadow-inner">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1 italic">คะแนนความสนใจ (Bot Score)</label>
                     <div className="flex items-center gap-3">
                        <Star size={18} className="text-amber-400 fill-amber-400" />
                        <input 
                          type="number" 
                          value={formState.score}
                          onChange={(e) => setFormState({...formState, score: parseInt(e.target.value) || 0})}
                          className="bg-transparent text-2xl font-black w-full outline-none text-slate-900 italic tracking-tighter" 
                        />
                     </div>
                  </div>
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shadow-inner">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1 italic">ช่วงเวลาที่สะดวกคุย (Pref Time)</label>
                     <div className="flex items-center gap-3">
                        <Clock size={18} className="text-primary" />
                        <input 
                          type="text" 
                          value={formState.prefTime}
                          onChange={(e) => setFormState({...formState, prefTime: e.target.value})}
                          placeholder="เช่น 10:00 - 12:00" 
                          className="bg-transparent text-xs font-black w-full outline-none text-slate-800 uppercase" 
                        />
                     </div>
                  </div>
                </div>

                <div className="pt-2 relative">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1 italic">บันทึกหมายเหตุการโทรและการประเมิน (Notes)</label>
                  <textarea 
                    value={formState.remark}
                    onChange={(e) => setFormState({...formState, remark: e.target.value})}
                    placeholder="พิมพ์รายละเอียดสรุปผลการพูดคุย ปัญหา ความคิดเห็นของลูกค้าอย่างละเอียด..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-800 text-sm font-black h-40 resize-none outline-none leading-relaxed mb-6 shadow-inner" 
                  />

                  {!readonly && (
                    <div className="space-y-4 pt-2">
                      <button 
                        onClick={() => handleSave()}
                        disabled={isSubmitting}
                        className="w-full py-5 bg-primary hover:bg-slate-900 text-white rounded-[2rem] font-black text-sm shadow-2xl transition-all active:scale-95 uppercase flex items-center justify-center gap-4 shadow-primary/20 border-none cursor-pointer"
                      >
                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                        <span className="tracking-widest">{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลลูกค้าทั้งหมด'}</span>
                      </button>
                    </div>
                  )}
                </div>
             </div>
           </div>

           <div className="bg-white rounded-[2.5rem] shadow-sm p-8 border border-slate-100 overflow-hidden relative group/history italic">
              <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-4 relative z-10">
                 <div className="flex items-center gap-4">
                    <HistoryIcon size={20} className="text-slate-600 group-hover/history:rotate-[-45deg] transition-transform" />
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-800">ประวัติกิจกรรมและการบันทึก (Audit Log)</div>
                 </div>
                 {!readonly && (
                   <button 
                     onClick={logCall}
                     className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center gap-3 shadow-lg active:scale-95 border-none cursor-pointer"
                   >
                     <PhoneIcon size={14} className="text-primary" /> LOG CALL
                   </button>
                 )}
              </div>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar relative z-10">
                 <ContactHistory customerId={customer.id} />
              </div>
           </div>
         </div>
       </div>
     </div>
  );
};

export default LeadEntryForm;
