import React, { useState } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';
import { cleanPhoneNumber, formatPhoneNumber } from '../services/phoneSystem';
import { MeshNode } from '../types/mesh';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddContact: (contact: Partial<MeshNode>, phoneNumber: string) => void;
  existingNodes: MeshNode[];
}

export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  onAddContact,
  existingNodes,
}) => {
  const [firstName, setFirstName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const isFormValid = firstName.trim().length > 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim()) {
      setErrorMessage('Por favor, insira o nome do contacto');
      return;
    }

    const fullName = firstName.trim();
    const rawDigits = cleanPhoneNumber(phoneInput);
    const finalPhone = rawDigits ? formatPhoneNumber(rawDigits) : `4116 ${Math.floor(1000 + Math.random() * 9000)}`;
    const newId = `node_phone_${rawDigits || Math.random().toString(36).substring(2, 8)}`;

    const newContact: Partial<MeshNode> = {
      id: newId,
      name: fullName,
      username: fullName.toLowerCase().replace(/\s+/g, '.'),
      callsign: fullName.toUpperCase().slice(0, 6) + '-' + (rawDigits ? rawDigits.slice(-2) : '01'),
      phoneNumber: finalPhone,
      avatarColor: '#18181b',
      avatarInitials: fullName.slice(0, 2).toUpperCase() || 'OP',
      role: 'CLIENT',
      hardware: 'ESP32 DIY SX1262',
      isOnline: true,
      lastHeard: Date.now(),
      batteryPct: 98,
      batteryVoltage: 4.15,
      gps: { lat: 38.72, lng: -9.14, alt: 50 },
      x: 50,
      y: 50,
      antennaDbi: 3.0,
      hopsAway: 1,
      rssi: -45,
      snr: 12.0,
      packetsForwarded: 0,
    };

    onAddContact(newContact, rawDigits || finalPhone);
    onClose();

    // Reset fields
    setFirstName('');
    setPhoneInput('');
    setIsSyncEnabled(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090d10] text-white flex flex-col font-sans select-none animate-fadeIn overflow-y-auto">
      <div className="max-w-md mx-auto w-full min-h-screen flex flex-col justify-between">
        {/* Top Header */}
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900/80 bg-[#090d10]">
            <div className="flex items-center">
              <button
                type="button"
                onClick={onClose}
                className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Voltar"
              >
                <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
              </button>

              <h1 className="text-xl font-normal text-white ml-3 tracking-tight">
                Novo contacto
              </h1>
            </div>
            <div className="w-6" />
          </div>

          {/* Form Fields Body */}
          <form onSubmit={handleSave} className="px-5 pt-8 space-y-6">
            {/* Field: User Icon + Nome próprio */}
            <div className="flex items-center gap-4">
              <div className="w-7 shrink-0 flex items-center justify-center text-[#8e9aa8]">
                <User className="w-5 h-5 stroke-[1.8]" />
              </div>
              <div className="flex-1 bg-[#13171d] border border-slate-700/60 focus-within:border-emerald-500 rounded-xl px-4 py-3.5 transition-colors">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nome próprio"
                  className="bg-transparent border-none text-sm text-white placeholder:text-[#8e9aa8] focus:outline-none w-full"
                  autoFocus
                />
              </div>
            </div>

            {/* Field: Phone Icon + Telemóvel */}
            <div className="flex items-center gap-4">
              <div className="w-7 shrink-0 flex items-center justify-center text-[#8e9aa8]">
                <Phone className="w-5 h-5 stroke-[1.8]" />
              </div>

              <div className="flex-1 bg-[#13171d] border border-slate-700/60 focus-within:border-emerald-500 rounded-xl px-4 py-3.5 transition-colors">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Telemóvel"
                  className="bg-transparent border-none text-sm text-white placeholder:text-[#8e9aa8] focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Field: Sync Toggle Row */}
            <div className="flex items-start gap-4 pt-2">
              <div className="w-7 shrink-0 flex items-center justify-center text-[#8e9aa8] pt-1">
                <RefreshCw className="w-5 h-5 stroke-[1.8]" />
              </div>

              <div className="flex-1 flex items-center justify-between gap-4">
                <div className="pr-2">
                  <h4 className="text-sm font-normal text-slate-100 leading-tight">
                    Sincronizar contacto no telemóvel
                  </h4>
                  <p className="text-xs text-[#8e9aa8] mt-1 leading-relaxed">
                    Só os contactos com número de telemóvel podem ser sincronizados
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                  className={`w-12 h-7 rounded-full transition-colors flex items-center p-0.5 shrink-0 cursor-pointer ${
                    isSyncEnabled
                      ? 'bg-emerald-500 border border-emerald-400 justify-end'
                      : 'bg-[#242b33] border border-slate-700 justify-start'
                  }`}
                  title="Alternar sincronização"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all ${
                      isSyncEnabled ? 'bg-white text-slate-950 font-bold' : 'bg-[#8e9aa8] text-slate-950'
                    }`}
                  >
                    {!isSyncEnabled ? (
                      <span className="w-2.5 h-0.5 bg-slate-900 rounded-full" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-400 flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        </div>

        {/* Bottom Button ("Guardar") */}
        <div className="p-5 pb-8 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isFormValid}
            className={`w-full py-4 rounded-full font-medium text-base text-center transition-all ${
              isFormValid
                ? 'bg-[#22c55e] hover:bg-[#16a34a] active:scale-98 text-slate-950 font-bold shadow-lg shadow-emerald-950/30 cursor-pointer'
                : 'bg-[#181d24] text-[#556372] cursor-not-allowed'
            }`}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

