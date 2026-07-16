import React, { useState, useEffect } from 'react';
import { Users, List, Database, Plus, Trash2, X, Loader2, AlertTriangle, ShieldX, RotateCw, Palette, ChevronRight, ShoppingBag, Repeat, Upload, FileSpreadsheet, FileDown } from 'lucide-react';
import { leadService } from '../../services/leadService';
import { dialog } from '../../utils/dialog';

// ─── Sub Pages ───────────────────────────────────────────────────────────────

const AdminsPage = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: '', username: '', password: '', color: '#374151' });

  const fetchData = async () => {
    setLoading(true);
    const allUsers = await leadService.getUsers();
    setAdmins(allUsers.filter(u => u.role === 'admin'));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (admin = null) => {
    if (admin) {
      setEditingAdmin(admin);
      setAdminForm({ name: admin.name, username: admin.username, password: admin.password, color: admin.color || '#374151' });
    } else {
      setEditingAdmin(null);
      setAdminForm({ name: '', username: '', password: '', color: '#' + Math.floor(Math.random() * 16777215).toString(16) });
    }
    setIsModalOpen(true);
  };

  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    try {
      if (editingAdmin) await leadService.updateUser(editingAdmin.id, adminForm);
      else await leadService.createUser({ ...adminForm, role: 'admin' });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
    }
  };

  const handleDeleteAdmin = async (id) => {
    const isConfirmed = await dialog.confirm({
      title: 'ลบบัญชีแอดมิน?',
      text: 'ต้องการลบบัญชีแอดมินนี้ใช่หรือไม่? ข้อมูลลูกค้าจะถูกย้ายกลับไป Unassigned',
      isDanger: true
    });
    if (isConfirmed) {
      await leadService.deleteUser(id);
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><Users size={20} className="text-indigo-600" /> จัดการบัญชีแอดมิน</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">จัดการ เพิ่ม แก้ไข หรือลบบัญชีแอดมินในระบบ</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 cursor-pointer border-none">
          <Plus size={14} /> เพิ่มแอดมินใหม่
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold text-sm">ไม่พบรายชื่อแอดมินในระบบ</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0" style={{ backgroundColor: admin.color || '#6366f1' }}>
                  {admin.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-slate-800">{admin.name}</div>
                  <div className="text-[11px] font-bold text-slate-500 mt-0.5 uppercase tracking-wide">ID: {admin.id} · @{admin.username}</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(admin)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer border-none" title="แก้ไข">
                    <ChevronRight size={16} />
                  </button>
                  <button onClick={() => handleDeleteAdmin(admin.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border-none" title="ลบ">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="font-black text-sm uppercase tracking-widest">{editingAdmin ? 'แก้ไขบัญชีแอดมิน' : 'เพิ่มบัญชีแอดมินใหม่'}</div>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors cursor-pointer border-none bg-transparent text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAdmin} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">ชื่อ - นามสกุล</label>
                <input type="text" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="ตัวอย่าง สมชาย รักสงบ" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">ชื่อผู้ใช้งาน (Username)</label>
                  <input type="text" value={adminForm.username} onChange={e => setAdminForm({ ...adminForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="mali@company.com" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">รหัสผ่าน (Password)</label>
                  <input type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="กำหนดรหัสผ่าน" required={!editingAdmin} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider">สีประจำตัว</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={adminForm.color} onChange={e => setAdminForm({ ...adminForm, color: e.target.value })} className="w-12 h-12 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer font-bold text-sm" />
                  <div className="text-xs font-bold text-slate-500">{adminForm.color?.toUpperCase()}</div>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-100 rounded-xl transition-all cursor-pointer border-none bg-transparent">ยกเลิก</button>
                <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 cursor-pointer border-none">{editingAdmin ? 'อัปเดต' : 'สร้างบัญชี'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const TopicsPage = () => {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [saving, setSaving] = useState(null); // topic id being saved

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    let data = await leadService.getMasterTopics();
    // Auto-seed default topics if database is empty
    if (data.length === 0) {
      await leadService.seedDefaultTopics();
      data = await leadService.getMasterTopics();
    }
    // Clean up Firestore duplicates (caused by dev StrictMode double-invoke)
    const removed = await leadService.deduplicateTopics();
    if (removed > 0) {
      data = await leadService.getMasterTopics();
    }
    // Sort: defaults first
    setTopics(data.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0)));
    setLoading(false);
  };

  const handleAdd = async () => {
    const t = newTopic.trim();
    if (!t) return;
    // Check duplicate
    const exists = topics.some(tp => tp.title.toLowerCase() === t.toLowerCase());
    if (exists) {
      await dialog.alert({ title: 'หัวข้อซ้ำซ้อน', text: `มีหัวข้อ "${t}" นี้อยู่ในระบบแล้ว`, icon: 'warning' });
      return;
    }
    try {
      await leadService.addMasterTopic(t, false);
      setNewTopic('');
      fetchData();
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการเพิ่มหัวข้อ: ' + err.message, icon: 'error' });
    }
  };

  const handleToggleDefault = async (topic) => {
    setSaving(topic.id);
    try {
      await leadService.updateMasterTopic(topic.id, { isDefault: !topic.isDefault });
      fetchData();
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ', icon: 'error' });
    }
    finally { setSaving(null); }
  };

  const handleDelete = async (topic) => {
    const isConfirmed = await dialog.confirm({
      title: 'ลบหัวข้อ?',
      text: `ยืนยันการลบหัวข้อ "${topic.title}" ออกจากระบบ?`,
      isDanger: true
    });
    if (!isConfirmed) return;
    try {
      await leadService.deleteMasterTopic(topic.id);
      fetchData();
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการลบหัวข้อ', icon: 'error' });
    }
  };

  const defaultTopics = topics.filter(t => t.isDefault);
  const extraTopics = topics.filter(t => !t.isDefault);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          <List size={20} className="text-indigo-600" /> ความต้องการของลูกค้า (Needs Mapping)
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          หัวข้อที่ถูกติดดาวจะถูกดึงไปมอบหมายงานให้แอดมินทันทีที่มีการทักเข้ามา
        </p>
      </div>

      {/* Add new topic */}
      <div className="flex gap-2">
        <input
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="เพิ่มหัวข้อความต้องการของลูกค้า... (ระบบตรวจสอบความซ้ำซ้อนอัตโนมัติ)"
          className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        />
        <button onClick={handleAdd} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wide hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer border-none">
          <Plus size={14} /> เพิ่ม
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Default Topics */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">⭐ หัวข้อที่แนะนำ</span>
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">{defaultTopics.length} หัวข้อ</span>
              <span className="text-[10px] text-indigo-400 ml-auto">ระบบจะสุ่มให้แอดมินอัตโนมัติ</span>
            </div>
            {defaultTopics.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">ยังไม่มีหัวข้อแนะนำ กดสัญลักษณ์ดาวด้านล่างเพื่อตั้งเป็นหัวข้อหลัก</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {defaultTopics.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-slate-800">{t.title}</span>
                    <button onClick={() => handleToggleDefault(t)} disabled={saving === t.id}
                      className="text-amber-400 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer border-none bg-transparent" title="ยกเลิกการตั้งเป็นหัวข้อหลัก">
                      {saving === t.id ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base">⭐</span>}
                    </button>
                    <button onClick={() => handleDelete(t)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border-none bg-transparent">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extra Topics */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">☆ หัวข้ออื่น ๆ</span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{extraTopics.length} หัวข้อ</span>
              <span className="text-[10px] text-slate-400 ml-auto">แอดมินสามารถเลือกหัวข้อเหล่านี้ได้เพิ่มเติม หรือกดสัญลักษณ์ดาวเพื่อตั้งเป็นหัวข้อหลัก</span>
            </div>
            {extraTopics.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">ยังไม่มีหัวข้อเพิ่มเติม</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {extraTopics.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                    <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-slate-600">{t.title}</span>
                    <button onClick={() => handleToggleDefault(t)} disabled={saving === t.id}
                      className="text-slate-300 hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-amber-50 shrink-0 cursor-pointer border-none bg-transparent" title="ตั้งเป็นหัวข้อแนะนำ">
                      {saving === t.id ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base">☆</span>}
                    </button>
                    <button onClick={() => handleDelete(t)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer border-none bg-transparent">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const DataPage = () => {
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [mockStatus, setMockStatus] = useState({ pct: 0, msg: '' });
  const [injectingNice, setInjectingNice] = useState(false);







  const handleSync = async () => {
    const isConfirmed = await dialog.confirm({
      title: 'ดึงข้อมูลจาก Google Sheet?',
      text: 'ต้องการดึงข้อมูลจาก Google Sheet ใช่หรือไม่? อาจใช้เวลา 1-2 นาที'
    });
    if (!isConfirmed) return;
    try {
      setSyncing(true);
      setMockStatus({ pct: 5, msg: 'กำลังเริ่มต้นการเชื่อมต่อ...' });
      
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      
      if (isProduction) {
        const data = await leadService.syncFromSheetsHybrid((pct, msg) => {
          setMockStatus({ pct, msg });
        });
        if (!data.success) throw new Error('การนำเข้าข้อมูลล้มเหลว');
      } else {
        setMockStatus({ pct: 30, msg: 'กำลังส่งคำขอซิงค์ข้อมูลไปยังเซิร์ฟเวอร์ท้องถิ่น...' });
        const response = await fetch('/_api/sync');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }
      await dialog.alert({ title: 'ซิงค์สำเร็จ', text: 'ซิงค์ข้อมูลเรียบร้อยแล้ว!', icon: 'success' });
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
    } finally { 
      setSyncing(false);
      setMockStatus({ pct: 0, msg: '' });
    }
  };




  const handleInjectNiceDemoData = async () => {
    const isConfirmed = await dialog.confirm({
      title: 'สร้างข้อมูลทดสอบแอดมินไนซ์?',
      text: 'ต้องการสร้างข้อมูลทดสอบสำหรับแอดมิน "ไนซ์" ใช่หรือไม่? จะมีการนำเข้าข้อมูลลูกค้า ประวัติการโทร และรายงานย้อนหลัง เพื่อใช้ในการแสดงผลระบบ (ใช้เวลาประมาณ 10-30 วินาที)'
    });
    if (!isConfirmed) return;
    try {
      setInjectingNice(true);
      setMockStatus({ pct: 5, msg: 'กำลังเริ่มต้นโหลดข้อมูล...' });
      const res = await leadService.seedNiceAdminDemoData((pct, msg) => setMockStatus({ pct, msg }));
      if (res.success) {
        await dialog.alert({
          title: 'สำเร็จ',
          text: 'สร้างข้อมูลทดสอบสำหรับแอดมินไนซ์เรียบร้อยแล้ว!',
          icon: 'success'
        });
      }
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
    } finally {
      setInjectingNice(false);
      setMockStatus({ pct: 0, msg: '' });
    }
  };

  const handleClear = async () => {
    const isConfirmed = await dialog.confirm({
      title: 'ล้างข้อมูลทั้งหมด?',
      text: '⚠️ ยืนยันการลบข้อมูลลูกค้าทั้งหมด ประวัติการทำงาน และหัวข้อหรือไม่? ข้อมูลนี้ไม่สามารถกู้คืนได้!',
      isDanger: true
    });
    if (!isConfirmed) return;
    const confirm2 = await dialog.prompt({
      title: 'ยืนยันการลบข้อมูลหลัก',
      text: 'กรุณาพิมพ์ "DELETE" เพื่อยืนยันการลบ:',
      placeholder: 'DELETE'
    });
    if (confirm2 !== 'DELETE') {
      await dialog.alert({ title: 'ยกเลิก', text: 'ยกเลิกกระบวนการล้างข้อมูล', icon: 'info' });
      return;
    }
    try {
      setClearing(true);
      await leadService.clearProjectData();
      await dialog.alert({ title: 'ล้างข้อมูลสำเร็จ', text: 'ล้างข้อมูลในระบบเรียบร้อยแล้ว!', icon: 'success' });
    } catch (err) {
      await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: err.message, icon: 'error' });
    } finally { setClearing(false); }
  };

  const ActionCard = ({ icon, title, desc, buttonLabel, buttonColor, onClick, loading, loadingLabel, progress }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className={`p-3 rounded-2xl text-white ${buttonColor === 'emerald' ? 'bg-emerald-500' : buttonColor === 'indigo' ? 'bg-indigo-500' : 'bg-rose-500'}`}>
          {icon}
        </div>
        <div>
          <div className="font-black text-sm text-slate-900 uppercase tracking-tight">{title}</div>
          <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
      {loading && progress && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-slate-600">{progress.msg}</span>
            <span className="text-indigo-600">{progress.pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}
      <button onClick={onClick} disabled={loading}
        className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer border-none
          ${loading ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' :
            buttonColor === 'emerald' ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-100' :
              buttonColor === 'indigo' ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100' :
                'bg-rose-600 text-white hover:bg-rose-700 active:scale-95 shadow-rose-100'}`}>
        {loading ? <><Loader2 size={14} className="animate-spin" /> {loadingLabel}</> : <>{buttonLabel}</>}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2"><Database size={20} className="text-emerald-600" /> จัดการข้อมูลระบบ</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">ดึงข้อมูล ล้างข้อมูล และสร้างข้อมูลจำลองการใช้งาน</p>
      </div>



      <ActionCard
        icon={<RotateCw size={22} />}
        title="ซิงค์ข้อมูลลูกค้าดิบจาก Google Sheet"
        desc="ดึงข้อมูลลูกค้าจาก Google Sheet 3 แหล่ง (ผู้สนใจใหม่, ลูกค้าซื้อครั้งแรก, และประวัติเก่า) มารวมใน Firestore อัตโนมัติ"
        buttonLabel="🔄 เริ่มต้นซิงค์ข้อมูลด้วยตนเอง (Manual Sync)"
        buttonColor="emerald"
        onClick={handleSync}
        loading={syncing}
        loadingLabel={mockStatus.msg || 'กำลังซิงค์ข้อมูล...'}
        progress={syncing ? mockStatus : null}
      />

      <ActionCard
        icon={<Palette size={22} />}
        title="สร้างข้อมูลทดสอบสำหรับแอดมิน ไนซ์ (Nice's Demo Data)"
        desc="นำเข้าข้อมูลลูกค้า 120 ราย ประวัติการติดต่อกว่า 600 รายการ และรายงานผลงานย้อนหลัง 8 สัปดาห์ เพื่อใช้เป็นตัวอย่างในการจัดแสดงระบบการทำงานจริงของแอดมิน"
        buttonLabel="✨ สร้างข้อมูลทดสอบแอดมินไนซ์"
        buttonColor="indigo"
        onClick={handleInjectNiceDemoData}
        loading={injectingNice}
        loadingLabel={mockStatus.msg || 'กำลังสร้างข้อมูล...'}
        progress={injectingNice ? mockStatus : null}
      />




      <div className="border-t border-slate-200 pt-6">

        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-rose-500" />
          <span className="text-sm font-black text-rose-600 uppercase tracking-tight">Danger Zone</span>
        </div>
        <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 shrink-0"><ShieldX size={22} /></div>
            <div>
              <div className="font-black text-sm text-slate-900 uppercase tracking-tight">ล้างข้อมูลระบบทั้งหมด (Factory Reset)</div>
              <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
                ลบข้อมูลผู้มุ่งหวัง ลูกค้าดิบ ประวัติการทำงานทั้งหมด และตารางจัดแผนการติดตาม
                <br /><span className="text-rose-500 italic">* หมายเหตุ: บัญชีแอดมินในระบบจะไม่ถูกลบ</span>
              </p>
            </div>
          </div>
          <button onClick={handleClear} disabled={clearing}
            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer border-none
              ${clearing ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95 shadow-rose-200'}`}>
            {clearing ? <><Loader2 size={14} className="animate-spin" /> กำลังล้างข้อมูลระบบ...</> : <><Trash2 size={14} /> ล้างข้อมูลทั้งหมดในระบบ (Factory Reset)</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Landing Page (no section selected) ─────────────────────────────────────

const SettingsLanding = () => (
  <div className="flex flex-col items-center justify-center h-72 text-center">
    <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mb-4">
      <Database size={28} className="text-indigo-400" />
    </div>
    <div className="text-lg font-black text-slate-700 uppercase tracking-tight">เลือกหัวข้อการตั้งค่า</div>
    <p className="text-sm font-bold text-slate-400 mt-2">กรุณาคลิกเลือกเมนูด้านซ้ายเพื่อเริ่มการตั้งค่าระบบ</p>
  </div>
);

// ─── Main SettingsView ───────────────────────────────────────────────────────

const SettingsView = ({ activeSection }) => {
  const renderPage = () => {
    switch (activeSection) {
      case 'admins': return <AdminsPage />;
      case 'topics': return <TopicsPage />;
      case 'data': return <DataPage />;
      default: return <SettingsLanding />;
    }
  };

  return (
    <div className="max-w-2xl pb-8 animate-in fade-in duration-300">
      {renderPage()}
    </div>
  );
};

export default SettingsView;
