import React, { useState } from 'react';
import { ArrowLeft, Phone, Delete, MessageSquare } from 'lucide-react';
import { MeshNode } from '../types/mesh';
import { voiceCallService } from '../services/voiceCallService';
import { formatPhoneNumber, cleanPhoneNumber, getNodePhoneNumber, SYSTEM_PHONE_PREFIX } from '../services/phoneSystem';
import { meshManager } from '../services/meshProtocol';

interface KeypadViewProps {
  nodes: MeshNode[];
  onBack: () => void;
  onOpenChatWithNode: (nodeId: string) => void;
  onAddContact?: (phoneNumber: string) => void;
}

interface KeypadButtonDef {
  digit: string;
  sub?: string;
  isSpecial?: boolean;
}

const KEYPAD_ROWS: KeypadButtonDef[][] = [
  [
    { digit: '1', sub: '' },
    { digit: '2', sub: 'ABC' },
    { digit: '3', sub: 'DEF' },
  ],
  [
    { digit: '4', sub: 'GHI' },
    { digit: '5', sub: 'JKL' },
    { digit: '6', sub: 'MNO' },
  ],
  [
    { digit: '7', sub: 'PQRS' },
    { digit: '8', sub: 'TUV' },
    { digit: '9', sub: 'WXYZ' },
  ],
  [
    { digit: '*', sub: '', isSpecial: true },
    { digit: '0', sub: '+' },
    { digit: '#', sub: '', isSpecial: true },
  ],
];

export const KeypadView: React.FC<KeypadViewProps> = ({
  nodes,
  onBack,
  onOpenChatWithNode,
  onAddContact,
}) => {
  const [digits, setDigits] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Find if typed digits match any known contact with exact number match
  const clean = cleanPhoneNumber(digits);
  const matchedContact = nodes.find((n) => {
    if (!n || n.isSelf || n.isGroup || n.id === 'group-broadcast') return false;
    const directPhone = cleanPhoneNumber(n.phoneNumber);
    const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
    return clean.length >= 3 && ((directPhone && directPhone === clean) || (nodePhone && nodePhone === clean));
  });

  const handleDigitPress = (digit: string) => {
    setFeedbackMsg(null);
    if (digits.length >= 15) return;
    setDigits((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setFeedbackMsg(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setFeedbackMsg(null);
    setDigits('');
  };

  const handleCall = () => {
    const raw = cleanPhoneNumber(digits);
    if (!raw) {
      setFeedbackMsg('Insira o número para ligar');
      return;
    }

    if (raw.length < 3) {
      setFeedbackMsg('Insira um número válido para ligar');
      return;
    }

    // Check if matched to a known real contact with EXACT phone match
    const targetNode = nodes.find((n) => {
      if (!n || n.isSelf || n.isGroup || n.id === 'group-broadcast') return false;
      const directPhone = cleanPhoneNumber(n.phoneNumber);
      const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
      return (directPhone && directPhone === raw) || (nodePhone && nodePhone === raw);
    });

    if (targetNode) {
      voiceCallService.startCall(targetNode.id, targetNode.name, targetNode.callsign || targetNode.name);
    } else {
      // Start call with the exact number typed
      const formatted = formatPhoneNumber(raw) || digits;
      voiceCallService.startCall(`node_phone_${raw}`, formatted, `TEL-${raw.slice(-4)}`);
    }
  };

  const handleOpenChat = () => {
    const raw = cleanPhoneNumber(digits);
    if (!raw) {
      setFeedbackMsg('Insira o número para conversar');
      return;
    }

    // Check if matched to a known real contact with EXACT phone match
    const targetNode = nodes.find((n) => {
      if (!n || n.isSelf || n.isGroup || n.id === 'group-broadcast') return false;
      const directPhone = cleanPhoneNumber(n.phoneNumber);
      const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
      return (directPhone && directPhone === raw) || (nodePhone && nodePhone === raw);
    });

    if (targetNode) {
      onOpenChatWithNode(targetNode.id);
    } else {
      // Create and save new node with the exact number typed as the name
      const formatted = formatPhoneNumber(raw) || digits;
      const newNode: MeshNode = {
        id: `node_phone_${raw}`,
        name: formatted,
        username: `tel.${raw}`,
        callsign: `TEL-${raw.slice(-4)}`,
        phoneNumber: raw,
        avatarColor: '#18181b',
        avatarInitials: raw.slice(0, 2),
        role: 'CLIENT',
        hardware: 'ESP32 DIY SX1262',
        isOnline: true,
        lastHeard: Date.now(),
        batteryPct: 100,
        batteryVoltage: 4.2,
        gps: { lat: 38.72, lng: -9.14, alt: 50 },
        x: 50,
        y: 50,
        antennaDbi: 3.0,
        hopsAway: 1,
        rssi: -45,
        snr: 12.0,
        packetsForwarded: 0,
      };
      meshManager.addNode(newNode);
      onOpenChatWithNode(newNode.id);
    }
  };

  const formattedDisplay = formatPhoneNumber(digits);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-md mx-auto w-full bg-black text-white font-sans select-none justify-between pb-8 pt-2">
      {/* 1. Top Bar with Back Arrow matching the screenshot */}
      <div className="h-14 px-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-3 text-white hover:text-slate-300 active:scale-95 transition-all cursor-pointer rounded-full"
          title="Voltar"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
        </button>

        {matchedContact && (
          <div className="text-center animate-fadeIn">
            <span className="text-xs font-semibold text-emerald-400">
              {matchedContact.name}
            </span>
          </div>
        )}

        <div className="w-8" />
      </div>

      {/* 2. Number Display with Vertical Green Indicator / Cursor */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-[100px] max-h-48">
        <div className="flex items-center justify-center relative w-full">
          {digits.length === 0 ? (
            /* Matches screenshot: single vertical green cursor bar | */
            <div className="w-[3px] h-11 bg-[#22c55e] rounded-full animate-pulse" />
          ) : (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-normal tracking-wide text-white font-sans">
                {formattedDisplay}
              </span>
              <span className="inline-block w-[3px] h-8 sm:h-9 bg-[#22c55e] rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {feedbackMsg && (
          <p className="text-xs text-amber-400 font-medium mt-2 text-center animate-fadeIn">
            {feedbackMsg}
          </p>
        )}
      </div>

      {/* 3. Dialpad Grid and Call Button matching the screenshot measurements and style */}
      <div className="px-6 space-y-4 max-w-[320px] sm:max-w-[340px] mx-auto w-full">
        {/* 4 Rows of 3 circular buttons each */}
        <div className="space-y-4 sm:space-y-4.5">
          {KEYPAD_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-3 gap-x-6 sm:gap-x-7 place-items-center">
              {row.map((item) => (
                <button
                  key={item.digit}
                  onClick={() => handleDigitPress(item.digit)}
                  className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] rounded-full bg-[#20252b] hover:bg-[#282f37] active:bg-[#323942] active:scale-95 text-white flex flex-col items-center justify-center transition-all cursor-pointer shadow-md shadow-black/40 group"
                >
                  <span
                    className={`font-normal text-white leading-none ${
                      item.digit === '*'
                        ? 'text-3xl pt-1'
                        : item.digit === '#'
                        ? 'text-2xl pt-0.5'
                        : 'text-[28px] sm:text-[30px]'
                    }`}
                  >
                    {item.digit}
                  </span>
                  {item.sub ? (
                    <span className="text-[10px] font-medium tracking-[0.14em] text-[#8e9aa8] mt-0.5 uppercase leading-none">
                      {item.sub}
                    </span>
                  ) : item.digit === '1' ? (
                    <span className="h-[10px] mt-0.5" />
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom Call Row: [Optional Chat] [Call Button (Green)] [Backspace] */}
        <div className="grid grid-cols-3 gap-x-6 sm:gap-x-7 place-items-center pt-2">
          {/* Left item: Chat button if contact matched or digits typed */}
          <div className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] flex items-center justify-center">
            {digits.length >= 4 && (
              <button
                onClick={handleOpenChat}
                className="w-12 h-12 rounded-full bg-[#20252b] hover:bg-[#282f37] active:scale-95 text-emerald-400 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Abrir Conversa"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Center item: Green Call Button matching screenshot */}
          <button
            onClick={handleCall}
            className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] rounded-full bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-green-950/30"
            title="Iniciar Chamada"
          >
            <Phone className="w-8 h-8 text-black fill-black" />
          </button>

          {/* Right item: Backspace button matching Google Phone dialer ergonomics */}
          <div className="w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] flex items-center justify-center">
            {digits.length > 0 && (
              <button
                onClick={handleBackspace}
                onDoubleClick={handleClearAll}
                className="p-3 text-[#8e9aa8] hover:text-white active:scale-95 transition-all cursor-pointer rounded-full"
                title="Apagar (duplo clique para limpar tudo)"
              >
                <Delete className="w-7 h-7 stroke-[1.8]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
