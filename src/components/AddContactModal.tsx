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
    <div className="fixed inset-0 z-50 bg-white text-black flex flex-col font-sans select-none animate-fadeIn overflow-y-auto">
      <div className="max-w-[368px] mx-auto w-full min-h-screen flex flex-col justify-between bg-white">
        {/* Top Header */}
        <div>
          <div className="h-[60px] px-5 flex items-center justify-between border-b border-[#EEEEEE] bg-white">
            <div className="flex items-center">
              <button
                type="button"
                onClick={onClose}
                className="p-1 -ml-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
                title="Voltar"
              >
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                  <path
                    d="M34 20 H18 M18 20 L25 13 M18 20 L25 27"
                    stroke="#000000"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <h1 className="text-[25px] font-normal tracking-[-0.6px] text-black ml-4">
                Novo contato
              </h1>
            </div>
            <div className="w-6" />
          </div>

          {/* Form Fields Body */}
          <form onSubmit={handleSave} className="px-5 pt-7 space-y-6">
            {/* Field: User Icon + Nome próprio */}
            <div className="flex items-center gap-3">
              <div className="w-9 shrink-0 flex items-center justify-center">
                <svg width="22" height="22" viewBox="18 106 22 22" fill="none" stroke="#000000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="30" cy="113" r="4" />
                  <path d="M23 126 V123 A7 7 0 0 1 37 123 V126" />
                </svg>
              </div>
              <div className="flex-1 bg-white border-[1.4px] border-black rounded-[13px] px-4 h-[54px] flex items-center">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Nome próprio"
                  className="bg-transparent border-none text-[14px] text-black placeholder:text-[#777777] focus:outline-none w-full"
                  autoFocus
                />
              </div>
            </div>

            {/* Field: Phone Icon + Telemóvel */}
            <div className="flex items-center gap-3">
              <div className="w-9 shrink-0 flex items-center justify-center">
                <svg width="24" height="24" viewBox="20 185 26 28" fill="none" stroke="#000000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 190 C23 188.5 24.5 187.5 26 188 L29 189.5 L31 194 L28.5 196 C30.5 200 33 202.5 37 204.5 L39 202 L43 204 L44 207.5 C44.5 209 43.5 210.5 42 210.5 C32.5 209.8 23.5 200.8 23 190Z" />
                </svg>
              </div>

              <div className="flex-1 bg-white border-[1.4px] border-black rounded-[13px] px-4 h-[54px] flex items-center">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="Telemóvel"
                  className="bg-transparent border-none text-[14px] text-black placeholder:text-[#777777] focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Field: Sync Toggle Row */}
            <div className="flex items-start gap-3 pt-2">
              <div className="w-9 shrink-0 flex items-center justify-center pt-1">
                <svg width="22" height="22" viewBox="20 263 22 20" fill="none" stroke="#000000" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 273 A8 8 0 0 1 38 267" />
                  <path d="M38 267 V273 H32" />
                  <path d="M38 273 A8 8 0 0 1 24 279" />
                  <path d="M24 279 V273 H30" />
                </svg>
              </div>

              <div className="flex-1 flex items-center justify-between gap-3">
                <div className="pr-1">
                  <h4 className="text-[16px] font-semibold text-black leading-tight">
                    Sincronizar contatos no telemóvel
                  </h4>
                  <p className="text-[13px] text-[#777777] mt-1 leading-snug">
                    Só os contactos com número de telemóvel podem ser sincronizados
                  </p>
                </div>

                {/* Toggle Switch matching SVG */}
                <button
                  type="button"
                  onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                  className={`w-12 h-7 rounded-[14px] transition-colors flex items-center px-1 shrink-0 cursor-pointer ${
                    isSyncEnabled
                      ? 'bg-black border border-black justify-end'
                      : 'bg-[#EEEEEE] border border-black justify-start'
                  }`}
                  title="Alternar sincronização"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isSyncEnabled ? 'bg-white text-black' : 'bg-black text-white'
                    }`}
                  >
                    {!isSyncEnabled ? (
                      <span className="w-2 h-0.5 bg-white rounded-full" />
                    ) : (
                      <span className="w-1.5 h-1.5 bg-black rounded-full" />
                    )}
                  </div>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2 animate-fadeIn">
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
            className={`w-full h-[56px] rounded-[28px] font-medium text-[16px] text-center transition-all ${
              isFormValid
                ? 'bg-black hover:bg-neutral-800 active:scale-98 text-white font-medium shadow-md cursor-pointer'
                : 'bg-[#EEEEEE] text-[#888888] cursor-not-allowed'
            }`}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

