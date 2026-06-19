import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { leadService } from '../../services/leadService';

export default function EditCustomerModal({ isOpen, onClose, customer, onSave, showToast, currentAdminId, currentAdminName }) {
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    additionalPhones: '',
    businessType: '',
    usageQuantity: '0'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfileForm({
        name: customer.name || '',
        phone: customer.phone || '',
        additionalPhones: (customer.additionalPhones || []).join(', '),
        businessType: customer.businessType || '',
        usageQuantity: String(customer.usageQuantity || 0)
      });
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) return showToast("กรุณากรอกชื่อลูกค้า", "error");
    if (!profileForm.phone.trim()) return showToast("กรุณากรอกเบอร์โทรศัพท์หลัก", "error");

    setIsSubmitting(true);
    try {
      const cleanPhone = leadService.normalizePhone(profileForm.phone);
      if (!cleanPhone) {
        showToast("รูปแบบเบอร์โทรศัพท์หลักไม่ถูกต้อง", "error");
        setIsSubmitting(false);
        return;
      }

      // Handle additional phones
      const addParts = profileForm.additionalPhones
        .split(',')
        .map(p => leadService.normalizePhone(p))
        .filter(p => p && p.length > 0);
      
      const allPhones = [cleanPhone, ...addParts];
      const uniquePhones = Array.from(new Set(allPhones));

      const updates = {
        name: profileForm.name.trim(),
        phone: cleanPhone,
        allPhones: uniquePhones,
        additionalPhones: addParts,
        businessType: profileForm.businessType.trim(),
        usageQuantity: parseInt(profileForm.usageQuantity, 10) || 0
      };

      await leadService.updateCustomer(customer.id || customer.phone, updates);

      // Log the profile update activity
      const changeDetails = [];
      if ((customer.name || '') !== updates.name) {
        changeDetails.push(`ชื่อ: "${customer.name || '-'}" -> "${updates.name}"`);
      }
      if ((customer.phone || '') !== updates.phone) {
        changeDetails.push(`เบอร์หลัก: "${customer.phone || '-'}" -> "${updates.phone}"`);
      }
      if ((customer.businessType || '') !== updates.businessType) {
        changeDetails.push(`ประเภทธุรกิจ: "${customer.businessType || '-'}" -> "${updates.businessType}"`);
      }
      if (parseInt(customer.usageQuantity || 0, 10) !== updates.usageQuantity) {
        changeDetails.push(`ปริมาณกล่อง: ${customer.usageQuantity || 0} -> ${updates.usageQuantity}`);
      }

      const detailsStr = changeDetails.length > 0 ? changeDetails.join(', ') : 'ไม่มีข้อมูลที่เปลี่ยนแปลง';

      await leadService.logActivity({
        adminId: currentAdminId || 'manager',
        adminName: currentAdminName || 'Manager',
        customerId: customer.id || customer.phone,
        customerName: updates.name,
        customerPhone: updates.phone,
        action: `แก้ไขโปรไฟล์ลูกค้าโดย ${currentAdminName || 'Manager'}`,
        type: 'save',
        details: detailsStr,
        customerStage: customer.stage || 'pool'
      });

      showToast("แก้ไขข้อมูลโปรไฟล์ลูกค้าเรียบร้อยแล้ว", "success");
      onSave();
      onClose();
    } catch (err) {
      console.error("Save Profile Error:", err);
      showToast(err.message || "เกิดข้อผิดพลาดในการบันทึกโปรไฟล์", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="bg-slate-900 px-8 py-5 flex items-center justify-between text-white">
          <div className="font-black text-sm tracking-widest uppercase">แก้ไขข้อมูลลูกค้า</div>
          <button 
            type="button"
            onClick={onClose} 
            className="hover:bg-white/20 p-2 rounded-xl transition-colors cursor-pointer border-none bg-transparent text-white"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-5 text-left font-sans">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider pl-1">ชื่อลูกค้า / ชื่อบริษัท</label>
            <input 
              type="text" 
              value={profileForm.name} 
              onChange={e => setProfileForm({...profileForm, name: e.target.value})}
              className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" 
              placeholder="ตัวอย่าง บริษัท มุ่งเจริญ จำกัด" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider pl-1">เบอร์โทรศัพท์หลัก</label>
              <input 
                type="text" 
                value={profileForm.phone} 
                onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" 
                placeholder="081XXXXXXX" 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider pl-1">ปริมาณใช้งานกล่อง (ต่อเดือน)</label>
              <input 
                type="number" 
                value={profileForm.usageQuantity} 
                onChange={e => setProfileForm({...profileForm, usageQuantity: e.target.value})}
                className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" 
                placeholder="0" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider pl-1">เบอร์โทรศัพท์เพิ่มเติม (สำรอง)</label>
            <input 
              type="text" 
              value={profileForm.additionalPhones} 
              onChange={e => setProfileForm({...profileForm, additionalPhones: e.target.value})}
              className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" 
              placeholder="เช่น 089XXXXXXX, 02XXXXXXX (คั่นด้วยจุลภาค , )" 
            />
            <span className="text-[9px] font-black text-slate-400 block pl-1">คั่นด้วยเครื่องหมายจุลภาคเพื่อระบุมากกว่าหนึ่งเบอร์โทร</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider pl-1">ประเภทธุรกิจ / สินค้าหลัก</label>
            <input 
              type="text" 
              value={profileForm.businessType} 
              onChange={e => setProfileForm({...profileForm, businessType: e.target.value})}
              className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl text-sm font-bold border border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner" 
              placeholder="เช่น โรงพิมพ์, ยา, เครื่องสำอาง" 
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all cursor-pointer border-none bg-transparent"
              disabled={isSubmitting}
            >
              ยกเลิก
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-4 bg-slate-900 hover:bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'บันทึกการแก้ไข'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
