import React, { useState } from 'react';
import { ArrowLeft, Pencil, Phone, Copy, Check, ShieldCheck } from 'lucide-react';
import { formatPhoneNumber, getMyPermanentPhoneNumber } from '../services/phoneSystem';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  avatarColor?: string;
  avatarInitials?: string;
  onOpenEditName: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userName,
  avatarColor = '#10b981',
  avatarInitials = 'BA',
  onOpenEditName,
}) => {
  const [copied, setCopied] = useState(false);
  const myPhoneNumber = getMyPermanentPhoneNumber();
  const formattedNumber = formatPhoneNumber(myPhoneNumber);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col font-sans animate-fadeIn">
      {/* Top Bar with Back Arrow and Edit Pencil */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          onClick={onOpenEditName}
          className="p-2 -mr-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors"
          title="Editar Nome"
        >
          <Pencil className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Content Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full text-center">
        {/* Large Circular Avatar matching image 2 */}
        <div className="relative mb-8">
          <div
            className="w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center text-white font-bold text-6xl sm:text-7xl shadow-2xl transition-transform hover:scale-105"
            style={{ backgroundColor: avatarColor || '#18181b' }}
          >
            {avatarInitials || userName.slice(0, 2).toUpperCase()}
          </div>
        </div>

        {/* User Name */}
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
          {userName}
        </h1>

        {/* 8-Digit Unique Number: 4116 XXXX */}
        <div
          onClick={handleCopy}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-100 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
          title="Clique para copiar o seu número"
        >
          <Phone className="w-5 h-5 text-slate-300 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xl sm:text-2xl font-bold tracking-wider font-mono">
            {formattedNumber}
          </span>
          <div className="pl-1">
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
            )}
          </div>
        </div>

        {/* Informative Rule Badge */}
        <div className="mt-8 p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-xs text-slate-400 max-w-xs space-y-1 text-left">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Número Único do Sistema (Prefixo 4116)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Este é o seu identificador individual intransferível. Os outros operadores precisam deste número para falar consigo ou fazer chamadas.
          </p>
        </div>
      </div>
    </div>
  );
};
