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

  // Helper to find a contact strictly by its exact phone number
  const findTargetNode = (rawPhone: string): MeshNode | undefined => {
    if (!rawPhone || rawPhone.length < 3) return undefined;

    // Check against nodes list
    const matched = nodes.find((n) => {
      if (!n || n.isSelf) return false;
      if (n.id === 'group-broadcast' || n.isGroup) {
        return rawPhone === '41160000';
      }
      const directPhone = cleanPhoneNumber(n.phoneNumber);
      const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
      return directPhone === rawPhone || nodePhone === rawPhone;
    });
    if (matched) return matched;

    // Also check meshManager internal nodes
    const mmNodes = meshManager.getNodes();
    return mmNodes.find((n) => {
      if (!n || n.isSelf) return false;
      if (n.id === 'group-broadcast' || n.isGroup) {
        return rawPhone === '41160000';
      }
      const directPhone = cleanPhoneNumber(n.phoneNumber);
      const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
      return directPhone === rawPhone || nodePhone === rawPhone;
    });
  };

  // Find if typed digits match any known contact with exact number match
  const clean = cleanPhoneNumber(digits);
  const matchedContact = findTargetNode(clean);

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
    const targetNode = findTargetNode(raw);

    if (targetNode) {
      const phone = targetNode.phoneNumber || raw;
      voiceCallService.startCall(targetNode.id, targetNode.name, targetNode.callsign || targetNode.name, phone, targetNode);
    } else {
      // Start call with the exact number typed and persist node
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
      voiceCallService.startCall(newNode.id, newNode.name, newNode.callsign, raw, newNode);
    }
  };

  const handleOpenChat = () => {
    const raw = cleanPhoneNumber(digits);
    if (!raw) {
      setFeedbackMsg('Insira o número para conversar');
      return;
    }

    // Check if matched to a known real contact with EXACT phone match
    const targetNode = findTargetNode(raw);

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
    <div className="flex flex-col min-h-screen sm:min-h-[660px] max-w-[368px] mx-auto w-full bg-white text-black font-sans select-none justify-between pb-8 pt-3 px-4">
      {/* 1. Voltar (Back arrow matching SVG) */}
      <div className="h-12 flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-black hover:text-neutral-700 active:scale-95 transition-transform cursor-pointer rounded-full"
          title="Voltar"
        >
          <svg width="24" height="24" viewBox="16 18 22 20" fill="none">
            <path
              d="M34 28 H19 M19 28 L26 21 M19 28 L26 35"
              stroke="#000000"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {matchedContact && (
          <div className="text-center animate-fadeIn">
            <span className="text-xs font-semibold text-emerald-600">
              {matchedContact.name}
            </span>
          </div>
        )}

        <div className="w-8" />
      </div>

      {/* 2. Cursor do número / Visor matching SVG */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-[90px] max-h-36">
        <div className="flex items-center justify-center relative w-full">
          {digits.length === 0 ? (
            /* Cursor vertical de 3x44 com rx=1.5 em preto */
            <div className="w-[3px] h-11 bg-black rounded-[1.5px] animate-pulse" />
          ) : (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-3xl sm:text-[38px] font-normal tracking-wide text-black font-sans">
                {formattedDisplay}
              </span>
              <span className="inline-block w-[3px] h-9 bg-black rounded-[1.5px] animate-pulse" />
            </div>
          )}
        </div>

        {feedbackMsg && (
          <p className="text-xs text-amber-600 font-medium mt-2 text-center animate-fadeIn">
            {feedbackMsg}
          </p>
        )}
      </div>

      {/* 3. Teclas (Keypad 4 rows of 3 black circular keys) */}
      <div className="space-y-4.5 max-w-[320px] mx-auto w-full">
        {KEYPAD_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-3 gap-x-5 place-items-center">
            {row.map((item) => (
              <button
                key={item.digit}
                onClick={() => handleDigitPress(item.digit)}
                className="w-[74px] h-[74px] rounded-full bg-black hover:bg-neutral-800 active:scale-95 text-white flex flex-col items-center justify-center transition-transform cursor-pointer shadow-xs select-none"
              >
                <span
                  className={`font-normal text-white leading-none ${
                    item.digit === '*'
                      ? 'text-3xl pt-1'
                      : item.digit === '#'
                      ? 'text-2xl pt-0.5'
                      : 'text-[28px]'
                  }`}
                >
                  {item.digit}
                </span>

                {item.sub ? (
                  <span
                    className={`text-[#B8BBC5] leading-none mt-0.5 select-none ${
                      item.digit === '0'
                        ? 'text-[10px] font-normal'
                        : 'text-[9px] font-normal tracking-[1.3px] uppercase'
                    }`}
                  >
                    {item.sub}
                  </span>
                ) : item.digit === '1' ? (
                  <span className="h-[9px] mt-0.5" />
                ) : null}
              </button>
            ))}
          </div>
        ))}

        {/* 4. Linha de Chamada: [Chat] [Botão de Chamada Gradiente] [Apagar] */}
        <div className="grid grid-cols-3 gap-x-5 place-items-center pt-2">
          {/* Esquerda: Chat opcional se digitou número */}
          <div className="w-[74px] h-[74px] flex items-center justify-center">
            {digits.length >= 4 && (
              <button
                onClick={handleOpenChat}
                className="w-12 h-12 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-xs"
                title="Abrir Conversa"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Centro: Botão de Chamada com Gradiente e Ícone do SVG */}
          <button
            onClick={handleCall}
            className="w-[74px] h-[74px] rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-[0_6px_16px_rgba(0,0,0,0.16)]"
            style={{
              background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
            }}
            title="Iniciar Chamada"
          >
            {/* Ícone de telefone do SVG */}
            <svg width="34" height="34" viewBox="168 531 34 35" fill="none">
              <path
                d="M169 536 C169 533.5 171.3 532 173.7 532.8 L179 535 L181.2 542 L177.3 544.7 C179.9 550 184.2 554.3 189.5 556.9 L192.2 553 L199.2 555.2 L201.4 560.4 C202.4 562.8 200.7 565 198.1 565 C182.9 564.1 170 551.3 169 536Z"
                fill="#000000"
              />
            </svg>
          </button>

          {/* Direita: Botão de Apagar */}
          <div className="w-[74px] h-[74px] flex items-center justify-center">
            {digits.length > 0 && (
              <button
                onClick={handleBackspace}
                onDoubleClick={handleClearAll}
                className="p-3 text-neutral-500 hover:text-black active:scale-95 transition-all cursor-pointer rounded-full"
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
