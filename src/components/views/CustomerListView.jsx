import React, { useState, useEffect } from 'react';
import { Search, Users, AlertCircle, Loader2, PhoneCall, QrCode, X, MessageSquare, Star, Info, ChevronLeft, ChevronRight, Plus, Calendar, Clock, Edit2, RotateCcw, FileSpreadsheet, Upload, FileDown, CheckCircle2, AlertTriangle, Trash2, CheckSquare, Square, Filter } from 'lucide-react';
import { ADMINS, MONTHS_TRACKING } from '../../constants';
import { leadService } from '../../services/leadService';
import RetentionTableView from './RetentionTableView';
import QRCodeModal from '../common/QRCodeModal';
import { TableSkeleton } from '../common/Skeleton';
import CustomSelect from '../common/CustomSelect';
import EditCustomerModal from '../common/EditCustomerModal';
import { dialog } from '../../utils/dialog';

const getLocalDateString = (dateInput) => {
  let date = dateInput;
  if (!date) date = new Date();
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) {
    return '';
  }
  const tzOffset = date.getTimezoneOffset() * 60000;
  return (new Date(date.getTime() - tzOffset)).toISOString().split('T')[0];
};

const formatLastActionDate = (customer) => {
  if (customer.lastActionDate) {
    const parts = customer.lastActionDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${d}/${m}/${y + 543}`;
    }
  }
  if (customer.lastCallDate) {
    const dateStr = customer.lastCallDate;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        let y = parseInt(parts[2], 10);
        if (y < 2400) y += 543;
        return `${d}/${m}/${y}`;
      }
    }
    return dateStr;
  }
  return 'ยังไม่มีการติดต่อ';
};

const parseAnyDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  
  const str = String(dateInput).trim();
  
  // Try YYYY-MM-DD
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
  }
  
  // Try D/M/YYYY (Thai Buddhist)
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y > 2400) y -= 543;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d);
      }
    }
  }
  
  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  d.setDate(diff);
  return d;
};

const getWeeksBetween = (dateA, dateB) => {
  const startA = getStartOfWeek(dateA);
  const startB = getStartOfWeek(dateB);
  const msDiff = startB.getTime() - startA.getTime();
  const weeks = Math.round(msDiff / (7 * 24 * 60 * 60 * 1000));
  return weeks;
};

const getFrequencyInWeeks = (amount, unit) => {
  const amt = parseInt(amount) || 1;
  if (unit === 'เดือน') {
    return amt * 4;
  }
  return amt; // default is 'สัปดาห์'
};

const getIsFollowedUpChecked = (customer, todayDate) => {
  if (customer.gridData && todayDate) {
    const curMonth = MONTHS_TRACKING[todayDate.getMonth()];
    const day = todayDate.getDate();
    const curWeek = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
    const fWeekKey = `${curMonth}-${curWeek}-followup`;
    if (customer.gridData[fWeekKey] !== undefined) {
      return customer.gridData[fWeekKey] === true;
    }
  }

  const actionDate = parseAnyDate(customer.lastActionDate) || parseAnyDate(customer.lastCallDate);
  if (!actionDate) return false;
  
  const elapsedWeeks = getWeeksBetween(actionDate, todayDate);
  
  return elapsedWeeks === 0;
};

const getIsOrderChecked = (customer, todayDate) => {
  if (customer.gridData && todayDate) {
    const curMonth = MONTHS_TRACKING[todayDate.getMonth()];
    const day = todayDate.getDate();
    const curWeek = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
    const oWeekKey = `${curMonth}-${curWeek}-order`;
    if (customer.gridData[oWeekKey] !== undefined) {
      return customer.gridData[oWeekKey] === true;
    }
  }

  const status = customer.status || '';
  const isWon = status.includes('สั่งซื้อ') || 
                status.includes('ปิดดีลสำเร็จ') || 
                status.includes('Closed Won');
  if (!isWon) return false;
  
  const orderDate = parseAnyDate(customer.lastOrderDate) || 
                    parseAnyDate(customer.lastActionDate) || 
                    parseAnyDate(customer.lastCallDate);
  if (!orderDate) return false;
  
  const elapsedWeeks = getWeeksBetween(orderDate, todayDate);
  
  return elapsedWeeks === 0;
};


const getWeekDays = (baseDate) => {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  
  const weekDays = [];
  for (let i = 0; i < 5; i++) { 
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDays.push(date);
  }
  return weekDays;
};

const isDateTracked = (customer, date) => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const kDate = `${y}-${m}-${d}`;
  
  if (customer.gridData && customer.gridData[`${kDate}-followup`] !== undefined) {
     return customer.gridData[`${kDate}-followup`] === true;
  }
  
  const lastCall = parseAnyDate(customer.lastCallDate) || parseAnyDate(customer.lastActionDate);
  if (lastCall) {
     const ly = lastCall.getFullYear();
     const lm = (lastCall.getMonth() + 1).toString().padStart(2, '0');
     const ld = lastCall.getDate().toString().padStart(2, '0');
     if (`${ly}-${lm}-${ld}` === kDate) return true;
  }
  
  return false;
};

const CustomerListView = ({ type, setView, activeTab, setActiveTab, currentAdminId, currentAdminName, role, showToast, onCall }) => {
  const isManager = role === 'manager';
  const [qrModal, setQrModal] = useState({ open: false, phone: '', name: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, count: 0, hasMore: false });
  const [cursorHistory, setCursorHistory] = useState([null]); // [0, Page1LastDoc, Page2LastDoc, ...]
  const [currentPage, setCurrentPage] = useState(() => type?.startsWith('retention') ? (parseInt(sessionStorage.getItem('retention_currentPage')) || 1) : 1);
  const [admins, setAdmins] = useState([]);
  const [assignedThisWeekIds, setAssignedThisWeekIds] = useState(new Set());
  const [completedThisWeekIds, setCompletedThisWeekIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => type?.startsWith('retention') ? (sessionStorage.getItem('retention_searchTerm') || '') : '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => type?.startsWith('retention') ? (sessionStorage.getItem('retention_searchTerm') || '') : '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterActionDate, setFilterActionDate] = useState('all'); // 'all', 'today', 'not_today'
    const [retentionSubTab, setRetentionSubTab] = useState(() => {
    if (type === 'retention-pending') return 'pending';
    if (type === 'retention-tracked') return 'tracked';
    if (type === 'retention-ordered') return 'ordered';
    if (type === 'retention-all') return 'all';
    return type?.startsWith('retention') ? (sessionStorage.getItem('retention_retentionSubTab') || 'all') : 'all';
  });
  
  // Retention Manual Dropdowns
  const [filterFreqAmt, setFilterFreqAmt] = useState(() => sessionStorage.getItem('retention_filterFreqAmt') || '');
  const [filterFreqUnit, setFilterFreqUnit] = useState(() => sessionStorage.getItem('retention_filterFreqUnit') || '');
  const [filterTrackStatus, setFilterTrackStatus] = useState(() => sessionStorage.getItem('retention_filterTrackStatus') || '');
  const [filterOrderStatus, setFilterOrderStatus] = useState(() => sessionStorage.getItem('retention_filterOrderStatus') || '');

  // Time Machine for Retention testing
  const [mockTodayStr, setMockTodayStr] = useState(() => {
    return localStorage.getItem('mockTodayStr') || new Date().toISOString().split('T')[0];
  });
  const mockToday = new Date(mockTodayStr);
  const currentWeekDays = getWeekDays(mockToday);

  useEffect(() => {
    localStorage.setItem('mockTodayStr', mockTodayStr);
  }, [mockTodayStr]);

  // CSV Import States
  const [importStep, setImportStep] = useState('idle'); // 'idle', 'reading', 'parsed', 'uploading', 'complete'
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMsg, setImportStatusMsg] = useState('');
  const [parsedData, setParsedData] = useState({ valid: [], duplicates: [], invalid: [] });
  const [importSummary, setImportSummary] = useState({ success: 0, duplicate: 0, invalid: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (type?.startsWith('retention')) {
      const lastType = sessionStorage.getItem('lastRetentionType');
      if (lastType && lastType !== type) {
        // Clear all filters from state
        setSearchTerm('');
        setDebouncedSearch('');
        setFilterFreqAmt('');
        setFilterFreqUnit('');
        setFilterTrackStatus('');
        setFilterOrderStatus('');
        setCurrentPage(1);

        // Also clear them from sessionStorage
        sessionStorage.removeItem('retention_searchTerm');
        sessionStorage.removeItem('retention_filterFreqAmt');
        sessionStorage.removeItem('retention_filterFreqUnit');
        sessionStorage.removeItem('retention_filterTrackStatus');
        sessionStorage.removeItem('retention_filterOrderStatus');
        sessionStorage.removeItem('retention_currentPage');
      }
      sessionStorage.setItem('lastRetentionType', type);

      setFilterStatus('all');
      setFilterActionDate('all');
      setLeads([]);
      setSelected([]);
      setLoading(true);
    } else {
      setFilterStatus('all');
      setFilterActionDate('all');
      setRetentionSubTab('all');
      setCurrentPage(1); 
      setCursorHistory([null]); 
      setSearchTerm('');
      setDebouncedSearch('');
      setFilterFreqAmt('');
      setFilterFreqUnit('');
      setFilterTrackStatus('');
      setFilterOrderStatus('');
      setLeads([]);          // Clear stale data immediately
      setSelected([]);       // Clear selected items
      setLoading(true);      // Show loading state right away
    }
  }, [type, currentAdminId, activeTab]);

  // Persist retention filters in sessionStorage
  useEffect(() => {
    if (type?.startsWith('retention')) {
      sessionStorage.setItem('retention_retentionSubTab', retentionSubTab);
      sessionStorage.setItem('retention_searchTerm', searchTerm);
      sessionStorage.setItem('retention_currentPage', currentPage);
      sessionStorage.setItem('retention_filterFreqAmt', filterFreqAmt);
      sessionStorage.setItem('retention_filterFreqUnit', filterFreqUnit);
      sessionStorage.setItem('retention_filterTrackStatus', filterTrackStatus);
      sessionStorage.setItem('retention_filterOrderStatus', filterOrderStatus);
    }
  }, [type, retentionSubTab, searchTerm, currentPage, filterFreqAmt, filterFreqUnit, filterTrackStatus, filterOrderStatus]);

  useEffect(() => {
    if (type?.startsWith('retention')) {
      loadSummaries();
    }
  }, [mockTodayStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (type?.startsWith('retention')) {
      if (type === 'retention-pending') setRetentionSubTab('pending');
      else if (type === 'retention-tracked') setRetentionSubTab('tracked');
      else if (type === 'retention-ordered') setRetentionSubTab('ordered');
      else if (type === 'retention-all') setRetentionSubTab('all');
    }
  }, [type]);

  useEffect(() => {
    fetchLeads();
  }, [currentAdminId, role, activeTab, type, currentPage, debouncedSearch]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const stage = type === 'master-pool' ? 'all' : (type === 'follow-up' ? 'qualified' : ((type === 'new-leads') ? 'pool' : 'customer'));
      const currentCursor = cursorHistory[currentPage - 1];

      let res;
      if (type?.startsWith('retention') && debouncedSearch.length < 2) {
         const allData = await leadService.getAllRegularCustomers(activeTab === 'my' ? currentAdminId : null);
         res = {
            data: allData,
            lastDoc: null,
            pagination: { total: allData.length, count: allData.length, hasMore: false }
         };
      } else if (debouncedSearch.length >= 2) {
         const searchData = await leadService.searchCustomers(debouncedSearch);
         const adminFiltered = activeTab === 'my' && currentAdminId 
            ? searchData.filter(d => d.responsibleId === currentAdminId) 
            : searchData;
         let finalData = stage === 'all' 
            ? adminFiltered 
            : adminFiltered.filter(d => d.stage === stage);
         res = {
            data: finalData,
            lastDoc: null,
            pagination: { total: finalData.length, count: finalData.length, hasMore: false }
         };
      } else {
         const options = {};
         res = await leadService.getCustomersByStagePaginated(stage, activeTab === 'my' ? currentAdminId : null, currentCursor, 50, options);
      }

      if (res && res.data) {
        // Filter out soft deleted items
        const nonDeleted = res.data.filter(l => l.stage !== 'trash');
        setLeads(nonDeleted);
        setPagination(res.pagination);
        if (res.lastDoc && cursorHistory.length === currentPage && debouncedSearch.length < 2) {
          setCursorHistory([...cursorHistory, res.lastDoc]);
        }
      } else {
        setLeads([]);
      }

      // --- Lazy Load Summaries (Non-blocking for the list) ---
      loadSummaries();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const refreshSingleLead = async (id) => {
    if (type?.startsWith('retention')) {
      const updatedCustomer = await leadService.getCustomerById(id);
      if (updatedCustomer) {
        setLeads(prev => prev.map(l => l.id === id ? updatedCustomer : l));
      }
    } else {
      fetchLeads();
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['ชื่อลูกค้า', 'เบอร์โทรศัพท์', 'ประเภทธุรกิจ'];
    const sampleRow = ['บริษัท รวยทรัพย์ขนส่ง จำกัด', '1234567890', 'ร้านค้าปลีก/ส่ง'];
    
    const csvContent = "\uFEFF" + [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "coldcall_customer_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportStep('reading');
    setImportProgress(0);
    setImportStatusMsg('กำลังอ่านและวิเคราะห์โครงสร้างไฟล์...');

    const cleanValue = (val) => {
      if (!val) return '';
      let s = val.toString().trim();
      if (s.startsWith('="') && s.endsWith('"')) {
        s = s.substring(2, s.length - 1);
      } else if (s.startsWith('=')) {
        s = s.substring(1).replace(/^"|"$/g, '');
      } else if (s.startsWith("'")) {
        s = s.substring(1);
      }
      return s.trim();
    };

    const parseAndValidatePhone = (rawPhone) => {
      if (!rawPhone) return { valid: false, error: 'ไม่พบข้อมูลเบอร์โทรศัพท์' };
      let orig = rawPhone.toString().trim();
      
      if (orig.startsWith('="') && orig.endsWith('"')) {
        orig = orig.substring(2, orig.length - 1);
      } else if (orig.startsWith('=')) {
        orig = orig.substring(1).replace(/^"|"$/g, '');
      } else if (orig.startsWith("'")) {
        orig = orig.substring(1);
      }
      orig = orig.trim();

      let firstPart = orig;
      if (orig.includes('-')) {
        const hyphenParts = orig.split('-');
        const lastPart = hyphenParts[hyphenParts.length - 1].trim();
        if (lastPart.length > 0 && lastPart.length <= 2 && /^\d+$/.test(lastPart)) {
          firstPart = hyphenParts.slice(0, -1).join('');
        } else {
          firstPart = hyphenParts.join('');
        }
      }

      let phone = firstPart.replace(/[^0-9]/g, '');

      if (phone && !phone.startsWith('0') && !phone.startsWith('+')) {
        if (phone.length === 9 || phone.length === 8 || phone.length === 10) {
          phone = '0' + phone;
        }
      }

      if (!phone) {
        return { valid: false, error: 'ไม่พบตัวเลขเบอร์โทรศัพท์', original: orig };
      }
      if (phone.startsWith('+')) {
        if (phone.length < 10 || phone.length > 15) {
          return { valid: false, error: `เบอร์ต่างประเทศความยาวไม่ถูกต้อง (${phone.length} หลัก)`, phone, original: orig };
        }
      } else {
        if (phone.length !== 9 && phone.length !== 10 && phone.length !== 11) {
          return { valid: false, error: `ความยาวเบอร์โทรไม่ถูกต้อง (${phone.length} หลัก)`, phone, original: orig };
        }
        if (!phone.startsWith('0')) {
          return { valid: false, error: 'เบอร์โทรต้องเริ่มต้นด้วยเลข 0', phone, original: orig };
        }
      }

      return { valid: true, phone, original: orig };
    };

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      try {
        const lines = text.split('\n');
        if (lines.length < 2) {
          await dialog.alert({ title: 'ไฟล์ไม่ถูกต้อง', text: 'ไฟล์ไม่มีข้อมูลหรือโครงสร้างไม่ถูกต้อง', icon: 'error' });
          setImportStep('idle');
          return;
        }

        const delimiter = lines[0].includes(';') ? ';' : ',';
        const rawHeaders = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
        
        const nameIdx = rawHeaders.findIndex(h => h.includes('ชื่อ') || h.includes('name'));
        const phoneIdx = rawHeaders.findIndex(h => h.includes('เบอร์') || h.includes('โทร') || h.includes('phone') || h.includes('tel'));
        const businessIdx = rawHeaders.findIndex(h => h.includes('ธุรกิจ') || h.includes('business'));
        const statusIdx = rawHeaders.findIndex(h => h.includes('สถานะ') || h.includes('status'));
        const freqAmtIdx = rawHeaders.findIndex(h => h.includes('ถี่') && (h.includes('เลข') || h.includes('จำนวน') || h.includes('amount') || h.includes('amt')));
        const freqUnitIdx = rawHeaders.findIndex(h => h.includes('ถี่') && (h.includes('หน่วย') || h.includes('unit')));

        if (phoneIdx === -1) {
          await dialog.alert({ title: 'ไม่พบคอลัมน์สำคัญ', text: 'ไม่พบคอลัมน์ เบอร์โทรศัพท์ กรุณาใช้เทมเพลตที่ระบบให้ดาวน์โหลด', icon: 'error' });
          setImportStep('idle');
          return;
        }

        const validFormattedRows = [];
        const invalidRows = [];

        const rawLines = lines.slice(1).map(l => l.trim()).filter(l => l);
        const totalLines = rawLines.length;

        let currentIndex = 0;
        const CHUNK_SIZE = 200;

        const processChunk = () => {
          const end = Math.min(currentIndex + CHUNK_SIZE, totalLines);
          for (let i = currentIndex; i < end; i++) {
            const line = rawLines[i];
            
            const row = [];
            let insideQuote = false;
            let current = '';
            for (let char of line) {
              if (char === '"') {
                insideQuote = !insideQuote;
              } else if (char === delimiter && !insideQuote) {
                row.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
              } else {
                current += char;
              }
            }
            row.push(current.trim().replace(/^"|"$/g, ''));

            if (row.length === 0 || !row.join('').trim()) continue;

            const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : '';
            const validation = parseAndValidatePhone(rawPhone);

            const rowData = {
              name: nameIdx !== -1 && row[nameIdx] ? cleanValue(row[nameIdx]) : 'ไม่ระบุชื่อลูกค้า',
              businessType: businessIdx !== -1 && row[businessIdx] ? cleanValue(row[businessIdx]) : 'ทั่วไป',
              status: '🆕 รอดำเนินการ',
              stage: 'pool',
              freqAmount: 1,
              freqUnit: 'สัปดาห์',
              originalPhone: rawPhone
            };

            if (validation.valid) {
              validFormattedRows.push({ ...rowData, phone: validation.phone });
            } else {
              invalidRows.push({ ...rowData, phone: '', error: validation.error });
            }
          }

          currentIndex = end;
          setImportProgress((currentIndex / totalLines) * 100);
          setImportStatusMsg(`กำลังวิเคราะห์ไฟล์ข้อมูล... (${currentIndex} / ${totalLines})`);

          if (currentIndex < totalLines) {
            setTimeout(processChunk, 16);
          } else {
            runDuplicationChecks();
          }
        };

        const runDuplicationChecks = async () => {
          setImportStatusMsg('กำลังตรวจสอบเบอร์โทรซ้ำซ้อนในระบบ...');
          
          const validRows = [];
          const duplicateRows = [];
          const seenPhonesInFile = new Set();
          
          const uniqueFormattedRows = [];
          for (const row of validFormattedRows) {
            if (seenPhonesInFile.has(row.phone)) {
              duplicateRows.push({ ...row, error: 'เบอร์โทรศัพท์ซ้ำซ้อนในไฟล์เดียวกัน' });
            } else {
              seenPhonesInFile.add(row.phone);
              uniqueFormattedRows.push(row);
            }
          }
          
          try {
            const uniquePhones = uniqueFormattedRows.map(r => r.phone);
            const existingPhones = await leadService.checkPhonesExist(uniquePhones);
            
            for (const row of uniqueFormattedRows) {
              if (existingPhones.has(row.phone)) {
                duplicateRows.push({ ...row, error: 'มีเบอร์โทรศัพท์นี้อยู่ในระบบแล้ว' });
              } else {
                validRows.push(row);
              }
            }
          } catch (err) {
            console.error("Duplication check failed:", err);
            validRows.push(...uniqueFormattedRows);
          }
          
          setParsedData({ valid: validRows, duplicates: duplicateRows, invalid: invalidRows });
          setImportStep('parsed');
        };

        processChunk();

      } catch (err) {
        await dialog.alert({ title: 'เกิดข้อผิดพลาด', text: 'เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์: ' + err.message, icon: 'error' });
        setImportStep('idle');
      }
    };

    reader.readAsText(file, 'utf-8');
    event.target.value = null;
  };

  const handleStartDbImport = async () => {
    if (parsedData.valid.length === 0) return;

    setImportStep('uploading');
    setImportProgress(0);
    setImportStatusMsg('กำลังบันทึกข้อมูลเข้าสู่ฐานข้อมูล...');

    const validRows = [...parsedData.valid];
    const total = validRows.length;
    
    let success = 0;
    let failed = 0;
    const failedImportRows = [];
    
    let currentIndex = 0;
    const CHUNK_SIZE = 15;

    const saveChunk = async () => {
      const end = Math.min(currentIndex + CHUNK_SIZE, total);
      const chunk = validRows.slice(currentIndex, end);

      const promises = chunk.map(async (row) => {
        try {
          await leadService.addManualLead(row);
          success++;
        } catch (err) {
          failed++;
          failedImportRows.push({ ...row, error: err.message || 'บันทึกลงฐานข้อมูลล้มเหลว' });
        }
      });

      await Promise.all(promises);
      
      currentIndex = end;
      setImportProgress((currentIndex / total) * 100);
      setImportStatusMsg(`กำลังนำเข้าข้อมูล... (สำเร็จ ${success} / ล้มเหลว ${failed} / จาก ${total})`);

      if (currentIndex < total) {
        setTimeout(saveChunk, 50);
      } else {
        setImportSummary({ 
          success, 
          duplicate: parsedData.duplicates.length,
          invalid: parsedData.invalid.length,
          failed,
          total: parsedData.valid.length + parsedData.duplicates.length + parsedData.invalid.length
        });
        
        if (failedImportRows.length > 0) {
          setParsedData(prev => ({
            ...prev,
            invalid: [...prev.invalid, ...failedImportRows]
          }));
        }

        setImportStep('complete');
        fetchLeads();
        
        if (showToast) {
          if (failed > 0) {
            showToast(`นำเข้าสำเร็จ ${success} รายการ, ล้มเหลว ${failed} รายการ`, 'warning');
          } else {
            showToast(`นำเข้าข้อมูลสำเร็จทั้งหมด ${success} รายการ`, 'success');
          }
        }
      }
    };

    saveChunk();
  };

  const handleCancelImport = () => {
    setImportStep('idle');
    setImportProgress(0);
    setImportStatusMsg('');
    setParsedData({ valid: [], duplicates: [], invalid: [] });
    setImportSummary({ success: 0, duplicate: 0, invalid: 0, failed: 0, total: 0 });
  };

  const downloadReportCSV = (rows, defaultFilename) => {
    const headers = ['ชื่อลูกค้า', 'เบอร์โทรศัพท์', 'ประเภทธุรกิจ', 'สาเหตุ'];
    const csvRows = [headers.join(',')];
    
    rows.forEach(row => {
      const escaped = [
        row.name || '',
        row.phone || row.originalPhone || '',
        row.businessType || '',
        row.error || 'ข้อมูลไม่ผ่านเกณฑ์'
      ].map(val => `"${val.toString().replace(/"/g, '""')}"`);
      csvRows.push(escaped.join(','));
    });

    const csvContent = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${defaultFilename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSoftDeleteSingle = async (customer) => {
    const confirmDelete = await dialog.confirm({
      title: 'ย้ายรายชื่อไปที่ถังขยะ?',
      text: `คุณต้องการย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะใช่หรือไม่?\n\n*หมายเหตุ: รายชื่อในถังขยะจะถูกเก็บไว้เป็นเวลา 30 วันก่อนจะถูกลบออกถาวรโดยอัตโนมัติ`,
      isDanger: true
    });
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await leadService.deleteCustomerSoft(customer.id || customer.phone, customer.stage || 'pool');
      showToast("ย้ายรายชื่อไปที่ถังขยะเรียบร้อยแล้ว", "success");
      
      await leadService.logActivity({
        adminId: currentAdminId || 'manager',
        adminName: currentAdminName || 'Manager',
        action: `ย้ายรายชื่อ "${customer.name || customer.phone}" ไปที่ถังขยะ`,
        type: 'soft-delete',
        customerId: customer.id || customer.phone,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerStage: 'trash'
      });

      setSelected(prev => prev.filter(id => id !== (customer.id || customer.phone)));
      fetchLeads();
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการลบรายชื่อ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSoftDelete = async () => {
    const confirmDelete = await dialog.confirm({
      title: 'ย้ายรายชื่อที่เลือกไปที่ถังขยะ?',
      text: `คุณต้องการย้ายรายชื่อที่เลือกทั้งหมด ${selected.length} รายการไปที่ถังขยะใช่หรือไม่?\n\n*หมายเหตุ: รายชื่อในถังขยะจะถูกเก็บไว้เป็นเวลา 30 วันก่อนจะถูกลบออกถาวรโดยอัตโนมัติ`,
      isDanger: true
    });
    if (!confirmDelete) return;

    try {
      setLoading(true);
      
      const promises = selected.map(async (id) => {
        const customer = leads.find(l => l.id === id);
        const originalStage = customer?.stage || 'pool';
        await leadService.deleteCustomerSoft(id, originalStage);
      });
      
      await Promise.all(promises);

      await leadService.logActivity({
        adminId: 'manager',
        adminName: 'Manager',
        action: `ย้ายรายชื่อจำนวน ${selected.length} รายการไปที่ถังขยะ (Bulk)`,
        type: 'soft-delete-bulk',
        details: `IDs: ${selected.join(', ')}`
      });

      showToast(`ย้ายรายชื่อ ${selected.length} รายการไปที่ถังขยะเรียบร้อยแล้ว`, "success");
      setSelected([]);
      fetchLeads();
    } catch (err) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการลบหลายรายชื่อ", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMockupLead = async () => {
    setIsAdding(true);
    try {
      const randomPhone = '08' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const randomNo = Math.floor(Math.random() * 10000);
      const mockupData = {
        phone: randomPhone,
        name: `ลูกค้าทดสอบ (Mockup ${randomNo})`,
        businessType: 'ร้านค้าปลีก/ส่ง',
        customerNo: `M-${randomNo}`,
        status: '🆕 รอดำเนินการ',
        stage: 'pool'
      };
      
      await leadService.addMockupManualLead(mockupData);
      if (showToast) showToast(`เพิ่มลูกค้าทดสอบ ${randomPhone} สำเร็จแล้ว`);
      fetchLeads(); // refresh the list
    } catch (err) {
      if (showToast) showToast(err.message || 'เกิดข้อผิดพลาดในการเพิ่มลูกค้าทดสอบ', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddMockRetentionLead = async () => {
    setIsAdding(true);
    try {
      const getMockDate = (pastDays) => {
         const d = new Date(mockToday.getTime() - (pastDays * 24 * 60 * 60 * 1000));
         return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
      };

      const mocks = [
        {
          phone: '090' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านกาแฟริมน้ำ`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(3),
          freqAmount: 1,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ลูกค้าสั่งชานม แฟรนไชส์ร้านกาแฟริมน้ำประจำ'
        },
        {
          phone: '091' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านขนมหวานปังปิ้ง (รอบ 2 สัปดาห์)`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(14),
          freqAmount: 2,
          freqUnit: 'สัปดาห์',
          responsibleId: null,
          remark: 'ลูกค้าสั่งวัตถุดิบและเบเกอรี่ทุก 2 สัปดาห์สม่ำเสมอ'
        },
        {
          phone: '092' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: โชห่วยมินิมาร์ท (รอบ 1 เดือน)`,
          stage: 'customer',
          status: '❌ ปิดดีลไม่ได้',
          lastOrderDate: getMockDate(40),
          freqAmount: 1,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ไม่ได้ซื้อนานแล้ว โทรไปไม่มีคนรับสายหรือแจ้งว่ายังไม่สะดวกสั่ง'
        },
        {
          phone: '093' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: ร้านเบเกอรี่โฮมเมด`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(90),
          freqAmount: 3,
          freqUnit: 'เดือน',
          responsibleId: null,
          remark: 'ซื้อซ้ำต่อเนื่อง สั่งซื้อล่าสุดเมื่อ 3 เดือนที่แล้ว'
        },
        {
          phone: '094' + Math.floor(Math.random() * 1000000).toString().padStart(7, '0'),
          name: `ร้านค้า: มินิมาร์ท ปตท. (รอบ 1 สัปดาห์)`,
          stage: 'customer',
          status: '✅ สั่งซื้อแล้ว',
          lastOrderDate: getMockDate(5),
          freqAmount: 1,
          freqUnit: 'สัปดาห์',
          responsibleId: null,
          remark: 'จัดส่งวัตถุดิบทุกวันจันทร์ ร้านค้าเปิดใหม่ประจำสัปดาห์'
        }
      ];
      
      for (const m of mocks) {
         await leadService.addMockupManualLead(m);
      }

      if (showToast) showToast(`สร้างข้อมูลจำลอง Retention สำเร็จ 5 รายการ`);
      fetchLeads();
    } catch (err) {
      if (showToast) showToast(err.message || 'เกิดข้อผิดพลาดในการสร้างข้อมูลจำลอง', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const loadSummaries = async () => {
    try {
      const now = type?.startsWith('retention') ? mockToday : new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const start = new Date(now);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      const [allUsers] = await Promise.all([leadService.getUsers()]);
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      setAdmins(adminUsers);

      const adminIdsToFetch = (isManager || !currentAdminId)
        ? adminUsers.map(u => u.id)
        : [currentAdminId];

      const allSummaries = await Promise.all(
        adminIdsToFetch.map(aid => leadService.getWeeklyAdminSummary({
          adminId: aid,
          startDate: start,
          endDate: end
        }))
      );

      const mergedCompleted = new Set();
      const mergedAssigned = new Set();
      allSummaries.forEach(logs => {
        if (logs) {
          (logs.completedFullList || []).forEach(id => mergedCompleted.add(id));
          (logs.assignedFullList || []).forEach(id => mergedAssigned.add(id));
        }
      });

      setCompletedThisWeekIds(mergedCompleted);
      setAssignedThisWeekIds(mergedAssigned);
    } catch (e) {
      console.error("Summary load error", e);
    }
  };

  const parseThaiDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10) - 543;
    return new Date(y, m, d);
  };

  const getNextDueDate = (lastOrderDateStr, amount, unit) => {
    const d = parseThaiDate(lastOrderDateStr);
    if (!d) return null;
    const amt = parseInt(amount) || 0;
    if (unit === 'เดือน') {
       d.setMonth(d.getMonth() + amt);
    } else {
       d.setDate(d.getDate() + (amt * 7));
    }
    return d;
  };

  const filteredData = leads.filter(l => {
    const matchesSearch = 
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone?.includes(searchTerm);
    
    if (!matchesSearch) return false;

    // Filter by action date for admins in all views
    if (!isManager) {
      const todayVal = type?.startsWith('retention') ? mockToday : new Date();
      const todayStr = getLocalDateString(todayVal);
      const todayTh = todayVal.toLocaleDateString('th-TH');
      const isDoneToday = type?.startsWith('retention')
        ? getIsFollowedUpChecked(l, mockToday)
        : (l.lastActionDate === todayStr) || (l.lastCallDate === todayTh);
      
      if (filterActionDate === 'today' && !isDoneToday) return false;
      if (filterActionDate === 'not_today' && isDoneToday) return false;
    }

    if (filterStatus === 'all' && !type?.startsWith('retention')) return true;

    if (type?.startsWith('retention')) {
       if (filterFreqAmt) {
          const amt = parseInt(l.freqAmount) || 1;
          const filterAmt = parseInt(filterFreqAmt);
          if (filterAmt === 3) {
              if (amt < 3) return false;
          } else {
              if (amt !== filterAmt) return false;
          }
       }
       if (filterFreqUnit && l.freqUnit !== filterFreqUnit) return false;

       const isCompleted = getIsFollowedUpChecked(l, mockToday);
       
       const baseDateForDue = l.lastOrderDate || l.lastActionDate || l.lastCallDate;
       const dueDate = getNextDueDate(baseDateForDue, l.freqAmount, l.freqUnit);
       const endOfMockToday = new Date(mockToday);
       endOfMockToday.setHours(23, 59, 59, 999);
       const isDue = dueDate ? (dueDate <= endOfMockToday) : true;

       const isFreqFilterActive = filterFreqAmt || filterFreqUnit;
       if (!isFreqFilterActive) {
          if (!isDue && !isCompleted) return false;
       }

       if (filterTrackStatus === 'tracked') {
          if (!isCompleted) return false;
       } else if (filterTrackStatus === 'not_tracked') {
          if (isCompleted) return false;
       }
       
       const isOrdered = getIsOrderChecked(l, mockToday);
       if (filterOrderStatus === 'bought') {
          if (!isOrdered) return false;
       } else if (filterOrderStatus === 'not_bought') {
          if (isOrdered) return false;
       }

       if (retentionSubTab === 'pending') {
          if (isCompleted || isOrdered) return false;
       } else if (retentionSubTab === 'ordered') {
          if (!isOrdered) return false;
       } else if (retentionSubTab === 'tracked') {
          if (!isCompleted || isOrdered) return false;
       }

       return matchesSearch;
    }
    
    const isCompleted = completedThisWeekIds.has(l.id) || completedThisWeekIds.has(l.phone);
    const isAssigned = (l.responsibleId && l.responsibleId !== 'Unassigned');
    const matchesWeeklyAssigned = assignedThisWeekIds.size === 0 
      ? true 
      : assignedThisWeekIds.has(l.id) || assignedThisWeekIds.has(l.phone);
    
    if (filterStatus === 'todo') {
      return matchesSearch && matchesWeeklyAssigned && !isCompleted;
    }
    
    if (filterStatus === 'due') {
      return matchesSearch && matchesWeeklyAssigned && isCompleted;
    }

    if (filterStatus === 'unassigned') {
      return matchesSearch && !isAssigned;
    }
    
    return matchesSearch;
  });

  const isFrontendPagination = type?.startsWith('retention');
  const pagedData = isFrontendPagination 
    ? filteredData.slice((currentPage - 1) * 50, currentPage * 50)
    : filteredData;
    
  const displayPagination = isFrontendPagination 
    ? {
        total: filteredData.length,
        count: pagedData.length,
        hasMore: currentPage < Math.ceil(filteredData.length / 50)
      }
    : pagination;


  const todayVal = type?.startsWith('retention') ? mockToday : new Date();
  const todayStr = getLocalDateString(todayVal);
  const todayTh = todayVal.toLocaleDateString('th-TH');

  const doneTodayCount = leads.filter(l => {
    if (type?.startsWith('retention')) {
      return getIsFollowedUpChecked(l, mockToday);
    }
    const isDoneToday = 
      (l.lastActionDate === todayStr) || 
      (l.lastCallDate === todayTh);
    return isDoneToday;
  }).length;

  const notDoneTodayCount = leads.length - doneTodayCount;

  if (loading && leads.length === 0) {
     return <TableSkeleton />;
  }

  const handleToggleGridCell = async (customer, month, week, cellType) => {
    try {
      const gridData = customer.gridData || {};
      const key = `${month}-${week}-${cellType}`;
      const newGridValue = !gridData[key];
      const updatedGridData = { ...gridData, [key]: newGridValue };

      const hasFollowup = updatedGridData[`${month}-${week}-followup`] || false;
      const hasOrder = updatedGridData[`${month}-${week}-order`] || false;
      let delta = 0;
      if (cellType === 'followup') {
        if (newGridValue && !hasOrder) delta = 1;
        if (!newGridValue && !hasOrder) delta = -1;
      } else if (cellType === 'order') {
        if (newGridValue && hasFollowup) delta = -1;
        if (!newGridValue && hasFollowup) delta = 1;
      }

      let newAmount = parseInt(customer.freqAmount) || 1;
      let newUnit = customer.freqUnit || 'สัปดาห์';
      if (delta !== 0) {
        newAmount += delta;
        if (delta > 0) {
          if (newUnit === 'สัปดาห์' && newAmount > 4) {
            newAmount = 1;
            newUnit = 'เดือน';
          }
        } else {
          if (newAmount < 1) {
            if (newUnit === 'เดือน') {
              newAmount = 4;
              newUnit = 'สัปดาห์';
            } else {
              newAmount = 1;
            }
          }
        }
      }

      await leadService.updateCustomer(customer.id || customer.phone, {
        gridData: updatedGridData,
        freqAmount: newAmount,
        freqUnit: newUnit
      });

      setLeads(prev => prev.map(item => 
        (item.id === customer.id || item.phone === customer.phone)
          ? { ...item, gridData: updatedGridData, freqAmount: newAmount, freqUnit: newUnit }
          : item
      ));
    } catch (err) {
      console.error("Error toggling grid cell:", err);
    }
  };

  const handleUpdateCustomerLocal = (id, fields) => {
    setLeads(prev => prev.map(l => (l.id === id || l.phone === id) ? { ...l, ...fields } : l));
  };

  if (activeTab === 'rentention-grid') {
     return (
       <RetentionTableView 
         data={leads} 
         pagination={pagination}
         onPageChange={setCurrentPage}
         onManage={(l) => {
           if (!isManager) {
             onCall(l, type === 'master-pool');
           }
         }} 
         onToggleGridCell={handleToggleGridCell}
         onUpdateCustomerLocal={handleUpdateCustomerLocal}
       />
     );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-500 gap-4">
      <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm font-sans relative z-50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์ หรือเลขที่ลูกค้า..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-300 outline-none transition-all shadow-inner"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (currentPage !== 1) setCurrentPage(1); // Reset to page 1 on search
            }}
          />
        </div>

        <div className="flex flex-nowrap items-center gap-2">
           {type?.startsWith('retention') ? null : isManager ? (
             <CustomSelect
               value={filterStatus}
               onChange={e => setFilterStatus(e.target.value)}
               containerClassName="w-64"
               className="py-2 text-xs font-black"
               dropdownZIndex={100}
               options={[
                 { value: 'all', label: `ลูกค้าทั้งหมด (${displayPagination.total})` },
                 ...(type !== 'master-pool' ? [
                   { value: 'todo',       label: 'งานที่ค้างมอบหมาย' },
                   { value: 'unassigned', label: 'ยังไม่ได้มอบหมาย' },
                   { value: 'due',        label: 'งานที่ติดตามแล้ว' },
                 ] : []),
               ]}
             />
           ) : (
             <CustomSelect
               value={filterActionDate}
               onChange={e => setFilterActionDate(e.target.value)}
               containerClassName="w-64"
               className="py-2 text-xs font-black"
               dropdownZIndex={100}
               options={[
                 { value: 'all',      label: `ลูกค้าทั้งหมด (${displayPagination.total})` },
                 { value: 'not_today', label: `วันนี้ (ยังไม่ได้ทำ) (${notDoneTodayCount})` },
               ]}
             />
           )}

           {type === 'master-pool' && importStep === 'idle' && (
              <div className="flex items-center gap-2 ml-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 text-center">
                    <Upload size={13} /> นำเข้าไฟล์ CSV
                  </div>
                </label>
                
                <button
                  onClick={handleDownloadTemplate}
                  title="ดาวน์โหลดเทมเพลต Excel (.csv)"
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200 transition-all active:scale-95 cursor-pointer flex items-center justify-center shadow-sm"
                >
                  <FileDown size={14} />
                </button>
              </div>
            )}
        </div>
      </div>

      {type?.startsWith('retention') && (
        <div className="shrink-0 flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm font-sans relative z-40">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 border-r border-slate-100">
             ตัวกรองพิเศษ :
          </div>
          
          
          
          <CustomSelect 
             value={filterFreqAmt}
             onChange={e => setFilterFreqAmt(e.target.value)}
             className="px-3 py-2 text-xs"
             containerClassName="w-full sm:w-56"
             placeholder="-- กรองระดับความรอบความถี่ --"
             options={[
               { value: '', label: '-- กรองระดับความรอบความถี่ --' },
               { value: '1', label: '1' },
               { value: '2', label: '2' },
               { value: '3', label: '3' }
             ]}
          />

          <CustomSelect 
             value={filterFreqUnit}
             onChange={e => setFilterFreqUnit(e.target.value)}
             className="px-3 py-2 text-xs"
             containerClassName="w-full sm:w-56"
             placeholder="-- กรองหน่วยรอบ --"
             options={[
               { value: '', label: '-- กรองหน่วยรอบ --' },
               { value: 'สัปดาห์', label: 'สัปดาห์' },
               { value: 'เดือน', label: 'เดือน' }
             ]}
          />

          <CustomSelect 
             value={filterTrackStatus}
             onChange={e => setFilterTrackStatus(e.target.value)}
             className="px-3 py-2 text-xs"
             containerClassName="w-full sm:w-56"
             placeholder="-- สถานะการติดตามสัปดาห์นี้ --"
             options={[
               { value: '', label: '-- สถานะการติดตามสัปดาห์นี้ --' },
               { value: 'tracked', label: 'ติดตามแล้ว' },
               { value: 'not_tracked', label: 'ยังไม่ได้ติดตาม' }
             ]}
          />

          <CustomSelect 
             value={filterOrderStatus}
             onChange={e => setFilterOrderStatus(e.target.value)}
             className="px-3 py-2 text-xs"
             containerClassName="w-full sm:w-56"
             placeholder="-- สถานะการสั่งซื้อจริง --"
             options={[
               { value: '', label: '-- สถานะการสั่งซื้อจริง --' },
               { value: 'bought', label: 'สั่งซื้อแล้ว' },
               { value: 'not_bought', label: 'ยังไม่ได้สั่งซื้อ' }
             ]}
          />

          <button
            onClick={() => {
              setFilterFreqAmt('');
              setFilterFreqUnit('');
              setFilterTrackStatus('');
              setFilterOrderStatus('');
            }}
            className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 border border-rose-100 cursor-pointer"
          >
            <RotateCcw size={12} />
            ล้างตัวกรอง
          </button>
        </div>
      )}

      {/* CSV File Import Modal Panel (Only for master-pool) */}
      {type === 'master-pool' && importStep !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300 relative">
            <button
              onClick={handleCancelImport}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
              title="ปิดหน้าต่างนี้"
            >
              <X size={18} />
            </button>

            {/* Reading or Uploading Progress */}
            {(importStep === 'reading' || importStep === 'uploading') && (
              <div className="space-y-4 py-4 pr-8">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-700">
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-600" />
                    {importStatusMsg}
                  </span>
                  <span className="text-indigo-600">{Math.round(importProgress)}%</span>
                </div>
                <div className="h-3 bg-slate-200/50 rounded-full overflow-hidden shadow-inner border border-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Parsed Preview Section */}
            {importStep === 'parsed' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pr-8">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase italic">สรุปผลการวิเคราะห์ไฟล์ข้อมูล</h4>
                    <p className="text-[11px] text-slate-500 font-bold mt-0.5">กรุณาตรวจสอบสรุปข้อมูลก่อนกดยืนยันนำเข้าลงฐานข้อมูล</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCancelImport}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black border border-slate-200 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      ยกเลิก / เคลียร์ไฟล์
                    </button>
                    <button
                      onClick={handleStartDbImport}
                      disabled={parsedData.valid.length === 0}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 transition-all active:scale-95 cursor-pointer"
                    >
                      เริ่มนำเข้าข้อมูล ({parsedData.valid.length} รายการ)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลทั้งหมด</span>
                    <span className="text-xl font-black text-slate-800 mt-1">{parsedData.valid.length + parsedData.duplicates.length + parsedData.invalid.length} รายการ</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center border-l-4 border-l-emerald-500">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">พร้อมนำเข้า (ปกติ)</span>
                    <span className="text-xl font-black text-slate-800 mt-1">{parsedData.valid.length} รายการ</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center border-l-4 border-l-amber-500">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">เบอร์ซ้ำ (ในระบบ/ไฟล์)</span>
                    <span className="text-xl font-black text-slate-800 mt-1">{parsedData.duplicates.length} รายการ</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center border-l-4 border-l-rose-500">
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">เบอร์มีปัญหา (รูปแบบผิด)</span>
                    <span className="text-xl font-black text-slate-800 mt-1">{parsedData.invalid.length} รายการ</span>
                  </div>
                </div>

                {(parsedData.duplicates.length > 0 || parsedData.invalid.length > 0) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex flex-col gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
                          ระบบพบรายการที่ไม่สามารถนำเข้าได้ เนื่องจากข้อมูลไม่ตรงเงื่อนไข (เบอร์โทรซ้ำ หรือเบอร์มีปัญหารูปแบบผิด) เบอร์เหล่านี้จะถูกข้ามตอนกดยืนยันนำเข้า ท่านสามารถดาวน์โหลดรายงานแยกเป็นไฟล์เพื่อนำไปแก้ไขหรือตรวจสอบได้ตามด้านล่างนี้
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/50">
                      {parsedData.duplicates.length > 0 && (
                        <button
                          onClick={() => downloadReportCSV(parsedData.duplicates, 'duplicate_leads_report')}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black border border-amber-200 transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <FileDown size={12} />
                          ดาวน์โหลดรายงานเบอร์ซ้ำ ({parsedData.duplicates.length})
                        </button>
                      )}
                      {parsedData.invalid.length > 0 && (
                        <button
                          onClick={() => downloadReportCSV(parsedData.invalid, 'invalid_leads_report')}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black border border-rose-100 transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <FileDown size={12} />
                          ดาวน์โหลดรายงานเบอร์มีปัญหา ({parsedData.invalid.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import Complete Summary */}
            {importStep === 'complete' && (
              <div className="space-y-4 animate-in zoom-in-95 duration-300 pr-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-emerald-100">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-800 uppercase italic">นำเข้าข้อมูลเสร็จสมบูรณ์!</h4>
                    <p className="text-[11px] text-emerald-600 font-bold mt-0.5">ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว (เบอร์นำเข้าใหม่ทั้งหมดจะแสดงในเมนู "รายชื่อเบอร์ใหม่")</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-emerald-100/50 shadow-sm">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">วิเคราะห์ทั้งหมด</span>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{importSummary.total} รายการ</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">นำเข้าสำเร็จ</span>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{importSummary.success} รายการ</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">ข้ามเบอร์ซ้ำในระบบ</span>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{importSummary.duplicate} รายการ</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">ล้มเหลว/ฟอร์แมตผิด</span>
                    <div className="text-lg font-black text-slate-800 mt-0.5">{importSummary.invalid + importSummary.failed} รายการ</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCancelImport}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black border border-slate-200 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    ปิดหน้าต่างนี้
                  </button>
                  <button
                    onClick={() => {
                      handleCancelImport();
                      if (setView) setView('new-leads');
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <PhoneCall size={13} />
                    ไปดูที่ "รายชื่อเบอร์ใหม่"
                  </button>
                  {parsedData.duplicates.length > 0 && (
                    <button
                      onClick={() => downloadReportCSV(parsedData.duplicates, 'duplicate_leads_report')}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-black border border-amber-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <FileDown size={14} />
                      ดาวน์โหลดรายงานเบอร์ซ้ำ ({parsedData.duplicates.length})
                    </button>
                  )}
                  {parsedData.invalid.length > 0 && (
                    <button
                      onClick={() => downloadReportCSV(parsedData.invalid, 'invalid_leads_report')}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black border border-rose-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    >
                      <FileDown size={14} />
                      ดาวน์โหลดรายงานเบอร์มีปัญหา ({parsedData.invalid.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden font-sans flex flex-col relative z-10">
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse table-fixed relative">
            <thead className="sticky top-0 z-50 bg-slate-50/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b border-slate-200">
                {isManager && (
                  <th className="px-4 py-4 w-12 text-center">
                    <div 
                      onClick={() => {
                        const allIds = pagedData.map(l => l.id);
                        if (allIds.length === 0) return;
                        if (allIds.every(id => selected.includes(id))) {
                          setSelected(prev => prev.filter(id => !allIds.includes(id)));
                        } else {
                          setSelected(prev => Array.from(new Set([...prev, ...allIds])));
                        }
                      }}
                      className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                    >
                      {pagedData.length > 0 && filteredData.every(l => selected.includes(l.id))
                        ? <CheckSquare size={16} className="text-indigo-600" />
                        : <Square size={16} />
                      }
                    </div>
                  </th>
                )}
                <th className={`px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic ${type === 'master-pool' ? 'w-[30%]' : 'w-[22%]'}`}>No. / เลขที่ลูกค้า</th>
                <th className={`px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic ${type === 'master-pool' ? 'w-[20%]' : 'w-[13%]'}`}>เบอร์โทรศัพท์ / QR Code</th>
                {type === 'master-pool' && (
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[18%]">หมวดหมู่ปัจจุบัน</th>
                )}
                {type?.startsWith('retention') ? (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[15%]">ผู้รับผิดชอบ</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic w-[12%]">ติดตามสัปดาห์นี้</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic w-[11%]">สั่งซื้อสำเร็จ</th>
                    {!isManager && (
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[15%]">ทำเบอร์ล่าสุดวันไหน</th>
                    )}
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[17%]">สถานะ / ผู้รับผิดชอบ</th>
                    {!isManager && (
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[15%]">ทำเบอร์ล่าสุดวันไหน</th>
                    )}
                  </>
                )}
                {isManager && type !== 'master-pool' && !type?.startsWith('retention') && (
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[15%]">ทำเบอร์ล่าสุดวันไหน</th>
                )}
                <th className={`px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic ${type?.startsWith('retention') ? 'w-[14%]' : 'w-[11%]'}`}>ความรอบการติดตาม</th>
                {type !== 'master-pool' && !type?.startsWith('retention') && (
                  <>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-widest italic w-[11%]">Coldcall Rating</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest italic w-[6%]">คะแนนบอท</th>
                  </>
                )}
                <th className="px-6 py-4 text-right text-xs font-black text-slate-600 uppercase tracking-widest italic w-[8%]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedData.length > 0 ? (
                pagedData.map((l, index) => {
                  const isCompleted = type?.startsWith('retention')
                    ? getIsFollowedUpChecked(l, mockToday)
                    : (completedThisWeekIds.has(l.id) || completedThisWeekIds.has(l.phone));
                  const isOrdered = type?.startsWith('retention')
                    ? getIsOrderChecked(l, mockToday)
                    : (l.status === '✅ สั่งซื้อแล้ว' || l.status === 'สั่งซื้อแล้ว');
                  const isAssigned = assignedThisWeekIds.has(l.id) || assignedThisWeekIds.has(l.phone);
                  // Pool stage is ALWAYS view-only - no editing allowed
                  const isPoolView = type === 'master-pool';
                  const readonly = isPoolView;

                  return (
                    <tr 
                      key={l.id} 
                      className={`transition-colors group ${(isPoolView || isManager) ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/50'}`}
                      onClick={() => !isPoolView && !isManager && onCall(l, readonly)}
                    >
                      {isManager && (
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div 
                            onClick={() => {
                              setSelected(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]);
                            }}
                            className="flex items-center justify-center cursor-pointer hover:text-indigo-600 transition-colors"
                          >
                            {selected.includes(l.id) 
                              ? <CheckSquare size={16} className="text-indigo-600" />
                              : <Square size={16} />
                            }
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-300">
                              <span className="text-[10px] font-black text-slate-400">NO.</span>
                              <span className="text-[11px] font-black text-slate-600 leading-none">{(currentPage - 1) * 50 + index + 1}</span>
                           </div>
                           <div>
                              <div className={`text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 ${isCompleted ? 'line-through opacity-40' : ''}`}>
                                {l.name || 'ไม่ระบุชื่อลูกค้า'}
                                {isAssigned && !isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic flex items-center gap-1.5">
                                 {isPoolView
                                   ? <span className="text-amber-500">⚠️ ข้อมูลบอทระบบ (Read-only)</span>
                                   : 'คลิกเพื่อดูรายละเอียด / โทรติดตาม'}
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                           <div className="text-sm font-black text-indigo-600 tracking-wider flex items-center gap-2">
                              {l.phone}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQrModal({ open: true, phone: l.phone, name: l.name });
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <QrCode size={12} />
                              </button>
                           </div>
                           {l.allPhones?.length > 1 && (
                             <div className="flex flex-wrap gap-1">
                                {l.allPhones.slice(1).map((p, i) => (
                                  <div key={i} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {p}
                                  </div>
                                ))}
                             </div>
                           )}
                        </div>
                      </td>
                      {type === 'master-pool' && (
                         <td className="px-6 py-4">
                           {(() => {
                             const inactiveStatuses = [
                               'ปิดเครื่อง / ติดต่อไม่ได้',
                               'ไม่สนใจ',
                               'เลิกขาย/ปิดกิจการ',
                               'ยังไม่สะดวกคุยตอนนี้',
                               'ติดต่อยาก / รอสายยาว',
                               'ลูกค้ามีสินค้าเหลือในสต็อก',
                               'ต้องการของแถม/โปรโมชั่นพิเศษ',
                               'โทรไม่รับ',
                               'โทรไม่ซื้อ'
                             ];
                             let label = '';
                             let badgeStyle = '';
                             
                             if (l.stage === 'pool') {
                               if (l.status === '🆕 รอดำเนินการ') {
                                 label = 'เบอร์ใหม่';
                                 badgeStyle = 'bg-slate-50 text-slate-600 border-slate-200';
                               } else {
                                 label = 'คลังเบอร์โทร';
                                 badgeStyle = 'bg-indigo-50 text-indigo-600 border-indigo-100';
                               }
                             } else if (l.stage === 'qualified') {
                               label = 'ลูกค้ารอตัดสินใจ';
                               badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                             } else if (l.stage === 'customer') {
                               if (inactiveStatuses.includes(l.status)) {
                                 label = 'ลูกค้าหาย';
                                 badgeStyle = 'bg-rose-50 text-rose-600 border-rose-100';
                               } else {
                                 label = 'ลูกค้าประจำ';
                                 badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                               }
                             } else {
                               label = l.stage || '-';
                               badgeStyle = 'bg-slate-50 text-slate-500 border-slate-100';
                             }

                             return (
                               <span className={`inline-flex items-center px-2.5 py-1 border rounded-xl text-xs font-black uppercase tracking-wider shadow-sm ${badgeStyle}`}>
                                 {label}
                               </span>
                             );
                           })()}
                         </td>
                       )}
                      {type?.startsWith('retention') ? (
                        <>
                          {/* 1. ผู้รับผิดชอบ (Responsible Admin) */}
                          <td className="px-6 py-4">
                            {l.responsibleName && l.responsibleName !== 'Unassigned' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner">
                                  <span className="text-[10px] font-black text-indigo-600">
                                    {l.responsibleName.substring(0, 2)}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-slate-700">{l.responsibleName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shadow-inner">
                                  <span className="text-[10px] font-black text-slate-400">-</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 italic">Unassigned</span>
                              </div>
                            )}
                          </td>

                          {/* 2. ติดตามสัปดาห์นี้ (Follow-up) */}
                          <td className="px-6 py-4 text-center">
                            {type?.startsWith('retention') ? (
                              <div className="flex items-center justify-center gap-1">
                                {['จ', 'อ', 'พ', 'พฤ', 'ศ'].map((label, i) => {
                                  const dateToCheck = currentWeekDays[i];
                                  const tracked = isDateTracked(l, dateToCheck);
                                  return (
                                    <div 
                                      key={i}
                                      title={`${label} ${dateToCheck.getDate()}/${dateToCheck.getMonth()+1}`}
                                      className={`flex flex-col items-center justify-center w-6 h-8 rounded-md border shadow-sm transition-all ${
                                        tracked 
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50 scale-110 z-10' 
                                          : 'bg-slate-50 border-slate-100 text-slate-300 scale-95 opacity-70'
                                      }`}
                                    >
                                      <span className="text-[8px] font-black leading-none mb-0.5">{label}</span>
                                      {tracked ? <CheckSquare size={10} strokeWidth={4} /> : <Square size={10} strokeWidth={2} />}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              isCompleted ? (
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-black shadow-sm transform hover:scale-110 transition-transform duration-300">
                                  ✅
                                </span>
                              ) : (
                                <span className="text-slate-200">-</span>
                              )
                            )}
                          </td>

                          {/* 3. สั่งซื้อสำเร็จ (Order) */}
                          <td className="px-6 py-4 text-center">
                            {isOrdered ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-black shadow-sm transform hover:scale-110 transition-transform duration-300">
                                ✅
                              </span>
                            ) : (
                              <span className="text-slate-200">-</span>
                            )}
                          </td>

                          {!isManager && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                  <Calendar size={14} className="text-slate-500" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-800 leading-tight">
                                    {formatLastActionDate(l)}
                                  </span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                                    ทำล่าสุดวันไหน
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5">
                               <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest italic ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'} shadow-sm border`}>
                                  {l.status || 'รอดำเนินการ'}
                               </span>
                               {l.responsibleName && l.responsibleName !== 'Unassigned' ? (
                                 <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-50" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase italic">{l.responsibleName}</span>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                    <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                                 </div>
                               )}
                            </div>
                          </td>
                          {!isManager && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                                  <Calendar size={14} className="text-slate-500" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-800 leading-tight">
                                    {formatLastActionDate(l)}
                                  </span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                                    ทำล่าสุดวันไหน
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}
                        </>
                      )}
                      {isManager && type !== 'master-pool' && !type?.startsWith('retention') && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                              <Calendar size={14} className="text-slate-500" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-slate-800 leading-tight">
                                {formatLastActionDate(l)}
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                                ทำล่าสุดวันไหน
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                            <Clock size={14} className="text-slate-500" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 leading-tight">
                              {l.freqAmount || 1} {l.freqUnit || 'สัปดาห์'}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                              รอบการติดตาม
                            </span>
                          </div>
                        </div>
                      </td>
                      {type !== 'master-pool' && !type?.startsWith('retention') && (
                        <>
                          <td className="px-6 py-4">
                            <div className="text-xs font-black text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 italic line-clamp-2 max-w-[150px]">
                               {l.bot_ratingText || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div
                              onClick={(e) => { e.stopPropagation(); setDrawerData(l); }}
                              className="inline-flex items-center justify-center min-w-[32px] h-8 bg-amber-50 rounded-xl border border-amber-100 text-amber-600 font-black text-sm cursor-pointer hover:bg-amber-100 hover:border-amber-200 transition-all active:scale-95"
                              title="แบบประเมินความสนใจของบอท (Q&A)"
                            >
                               {l.bot_score}/5
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 text-sm font-bold">
                          {isManager || !readonly ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomerForEdit(l);
                                  setIsEditModalOpen(true);
                                }}
                                className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-200 active:scale-95 cursor-pointer flex items-center justify-center"
                                title="แก้ไขข้อมูลลูกค้า"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSoftDeleteSingle(l);
                                }}
                                className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 active:scale-95 cursor-pointer flex items-center justify-center"
                                title="ย้ายไปถังขยะ"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              className="p-2.5 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed shadow-none border border-slate-100 flex items-center justify-center"
                              disabled
                              title="ระบบอ่านอย่างเดียว"
                            >
                              <PhoneCall size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-600">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                       <AlertCircle size={40} className="stroke-[1px]" />
                       <div className="text-sm font-black uppercase tracking-widest italic">ไม่พบข้อมูลรายชื่อลูกค้าในเงื่อนไขนี้</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {(currentPage > 1 || displayPagination.hasMore) && (
          <div className="shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs font-black text-slate-500 uppercase tracking-widest italic">
              แสดงผลหน้าที่ {currentPage} (รายการที่ {(currentPage - 1) * 50 + 1} - {(currentPage - 1) * 50 + displayPagination.count} จากทั้งหมด {displayPagination.total})
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${currentPage === 1 ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 active:scale-95 shadow-sm'}`}
              >
                <ChevronLeft size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">หน้าก่อนหน้า</span>
              </button>
              
              <div className="w-12 h-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-xs font-black text-indigo-600 shadow-inner">
                {currentPage}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!displayPagination.hasMore}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${!displayPagination.hasMore ? 'bg-slate-100 text-slate-300 border-slate-100' : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100'}`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">หน้าถัดไป</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay */}
      {drawerData && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm transition-all"
          onClick={() => setDrawerData(null)}
        />
      )}

      {/* Drawer Panel */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full md:w-[450px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${drawerData ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {drawerData && (
          <>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-200 shadow-sm text-indigo-600">
                   <Info size={20} />
                 </div>
                 <div>
                   <h2 className="text-lg font-black text-slate-800 uppercase italic leading-tight">รายละเอียดและประวัติบอท</h2>
                   <p className="text-xs text-slate-500 font-bold mt-0.5">{drawerData.name || 'ไม่ระบุชื่อลูกค้า'}</p>
                 </div>
               </div>
               <button 
                 onClick={() => setDrawerData(null)}
                 className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-danger hover:bg-danger/10 transition-all border border-slate-200"
               >
                 <X size={18} />
               </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto font-sans space-y-6">
              
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">เลขที่ลูกค้า</div>
                  <div className="text-xl font-black text-slate-800">{drawerData.customerNo || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">คะแนนความสนใจ</div>
                  <div className="flex items-center gap-1 text-2xl font-black text-amber-500">
                     {drawerData.bot_score} <Star size={18} fill="currentColor" />
                  </div>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                 <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <PhoneCall size={12} /> เบอร์โทรศัพท์ติดต่อของลูกค้า
                 </div>
                 <div className="space-y-2">
                   <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-indigo-100 shadow-sm group">
                       <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">เบอร์โทรศัพท์หลัก</span>
                         <span className="text-sm font-black text-indigo-600">{drawerData.phone}</span>
                       </div>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (type === 'master-pool' || isManager) {
                             setQrModal({ open: true, phone: drawerData.phone, name: drawerData.name });
                           } else {
                             onCall(drawerData, false, drawerData.phone);
                           }
                         }}
                         className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                         title={type === 'master-pool' || isManager ? 'แสดง QR Code' : 'โทรติดต่อ'}
                       >
                         {type === 'master-pool' || isManager ? <QrCode size={14} /> : <PhoneCall size={14} />}
                       </button>
                   </div>
                   {drawerData.allPhones?.length > 1 && drawerData.allPhones.slice(1).map((p, i) => (
                     <div key={i} className="flex items-center justify-between bg-white/50 px-3 py-2 rounded-xl border border-indigo-50 group">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">เบอร์โทรศัพท์สำรอง {i+1}</span>
                           <span className="text-sm font-black text-slate-600">{p}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (type === 'master-pool' || isManager) {
                              setQrModal({ open: true, phone: p, name: drawerData.name });
                            } else {
                              onCall(drawerData, false, p);
                            }
                          }}
                          className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                          title={type === 'master-pool' || isManager ? 'แสดง QR Code' : 'โทรติดต่อ'}
                        >
                          {type === 'master-pool' || isManager ? <QrCode size={14} /> : <PhoneCall size={14} />}
                        </button>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Q&A Section */}
              <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                   <MessageSquare size={12} /> แบบประเมินความสนใจของบอท (Q&A)
                 </div>
                 
                 <div className="space-y-3">
                   {[
                     { q: "1. ทำไมลูกค้าถึงสนใจแบรนด์เรา?", a: drawerData.q1_business },
                     { q: "2. ลูกค้าเคยใช้บริการบรรจุภัณฑ์ประเภทใดบ้าง?", a: drawerData.q2_usage },
                     { q: "3. ต้องการรับตัวอย่างกล่องสินค้าหรือไม่?", a: drawerData.q3_sample },
                     { q: "4. ความต้องการนำไปจัดจำหน่ายในเขตใด?", a: drawerData.q4_visit },
                     { q: "5. ช่วงเวลาสะดวกในการให้เซลล์ติดต่อกลับ?", a: drawerData.q5_prefTime },
                     { q: "6. ยินดีแอดไลน์ทางการ @LineOA หรือไม่?", a: drawerData.q6_addLine }
                   ].map((item, idx) => (
                     <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-[11px] font-black text-slate-500 mb-1">{item.q}</div>
                        <div className="text-sm text-slate-700 font-bold leading-relaxed whitespace-pre-wrap">
                          {item.a ? item.a : <span className="text-slate-300 italic">ยังไม่มีข้อมูลคำตอบบอท</span>}
                        </div>
                     </div>
                   ))}
                 </div>
                 
                 <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="text-[11px] font-black text-slate-500 mb-1">ประเมินระดับความพึงพอใจโดยรวม (AI Score)</div>
                    <div className="text-sm font-black text-slate-800">{drawerData.bot_ratingText || '-'}</div>
                 </div>
              </div>

            </div>
            
            {/* Drawer Footer */}
            {type !== 'master-pool' && !isManager && (
               <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                 <button 
                   onClick={() => {
                     onCall(drawerData, false);
                     setDrawerData(null);
                   }}
                   className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wide shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                 >
                   <PhoneCall size={16} /> โทรติดต่อ / จัดการบันทึกประวัติการโทร
                 </button>
               </div>
            )}
          </>
        )}
      </div>

      <QRCodeModal 
        isOpen={qrModal.open} 
        onClose={() => setQrModal({ open: false, phone: '', name: '' })}
        phone={qrModal.phone}
        name={qrModal.name}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCustomerForEdit(null);
        }}
        customer={selectedCustomerForEdit}
        onSave={() => { if (selectedCustomerForEdit) refreshSingleLead(selectedCustomerForEdit.id); else fetchLeads(); }}
        showToast={showToast}
        currentAdminId={currentAdminId}
        currentAdminName={currentAdminName}
      />

      {/* Floating Bulk Actions Bar */}
      {isManager && selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center gap-6 animate-in slide-in-from-bottom-12 duration-300">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-black">
              {selected.length}
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-slate-300">รายการที่เลือก</span>
          </div>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkSoftDelete()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 border-none"
            >
              <Trash2 size={14} />
              ย้ายไปถังขยะ ({selected.length} รายการ)
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer border-none"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerListView;
