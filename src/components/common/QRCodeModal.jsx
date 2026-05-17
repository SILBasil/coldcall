import React from 'react';
import { X, QrCode, Phone, ExternalLink } from 'lucide-react';

const QRCodeModal = ({ isOpen, onClose, phone, name }) => {
  if (!isOpen) return null;

  // Using a public QR Code API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=tel:${phone}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white/20 p-3 rounded-2xl">
              <QrCode size={32} />
            </div>
            <div className="text-center">
              <div className="text-lg font-black tracking-tight">{name}</div>
              <p className="text-indigo-200 text-sm font-bold flex items-center justify-center gap-1.5">
                <Phone size={12} /> {phone}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code Body */}
        <div className="p-8 flex flex-col items-center">
          <div className="bg-slate-50 p-4 rounded-3xl border-4 border-slate-50 shadow-inner relative group">
            <img 
              src={qrUrl} 
              alt="Call QR Code" 
              className="w-48 h-48 rounded-xl"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          
          <p className="mt-6 text-xs font-bold text-slate-400 text-center leading-relaxed px-4">
            สแกน QR Code นี้<br />เพื่อโทรหาลูกค้าได้ทันทีจากสมาร์ทโฟน
          </p>
        </div>

        {/* Action Button */}
        <div className="px-8 pb-8">
          <a 
            href={`tel:${phone}`}
            className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 group shadow-xl active:scale-95"
          >
            กดโทรออกโดยตรง <ExternalLink size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
