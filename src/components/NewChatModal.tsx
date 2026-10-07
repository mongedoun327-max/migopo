import React, { useState } from 'react';
import {
  X,
  Search,
  MessageSquare,
  MessageSquarePlus,
  UserPlus,
  ChevronRight,
  Phone,
  Check,
} from 'lucide-react';
import { MeshNode } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';
import {
  formatPhoneNumber,
  cleanPhoneNumber,
  getNodePhoneNumber,
  SYSTEM_PHONE_PREFIX,
} from '../services/phoneSystem';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: MeshNode[];
  onSelectContact: (nodeId: string) => void;
  onOpenRegisterNewContact?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onSelectContact,
  onOpenRegisterNewContact,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  // Filter out self node
  const availableNodes = nodes.filter((n) => n && !n.isSelf);

  const clean = cleanPhoneNumber(query);
  const isNumberQuery = clean.length >= 4;

  // Search filter
  const filteredNodes = availableNodes.filter((node) => {
    if (!query.trim()) return true;
    const qLower = query.toLowerCase().trim();
    const nameMatch = node.name.toLowerCase().includes(qLower);
    const usernameMatch = node.username?.toLowerCase().includes(qLower);
    const callsignMatch = node.callsign?.toLowerCase().includes(qLower);
    const phone = cleanPhoneNumber(getNodePhoneNumber(node.id)) || cleanPhoneNumber(node.phoneNumber);
    const phoneMatch = phone.includes(clean);
    return nameMatch || usernameMatch || callsignMatch || (clean.length > 0 && phoneMatch);
  });

  // Check if typed number matches an existing real node
  const exactMatchedNode = availableNodes.find((node) => {
    if (node.isGroup || node.id === 'group-broadcast') return false;
    const directPhone = cleanPhoneNumber(node.phoneNumber);
    const nodePhone = cleanPhoneNumber(getNodePhoneNumber(node.id));
    return clean.length >= 3 && ((directPhone && directPhone === clean) || (nodePhone && nodePhone === clean));
  });

  const handleStartWithNumber = (phoneToUse: string) => {
    const raw = cleanPhoneNumber(phoneToUse);
    if (!raw) return;

    // Check if matched
    if (exactMatchedNode) {
      onSelectContact(exactMatchedNode.id);
      onClose();
      return;
    }

    const found = availableNodes.find((n) => {
      if (n.isGroup || n.id === 'group-broadcast') return false;
      const directPhone = cleanPhoneNumber(n.phoneNumber);
      const nodePhone = cleanPhoneNumber(getNodePhoneNumber(n.id));
      return (directPhone && directPhone === raw) || (nodePhone && nodePhone === raw);
    });

    if (found) {
      onSelectContact(found.id);
      onClose();
      return;
    }

    // Format new node for this exact phone number
    const formatted = formatPhoneNumber(raw) || raw;
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
    onSelectContact(newNode.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white border border-[#EEEEEE] rounded-[14px] max-w-[368px] w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp select-none">
        {/* Header matching nova-conversa.svg */}
        <div className="px-3.5 pt-3.5 pb-3 flex items-center justify-between border-b border-[#EEEEEE] bg-white">
          <div className="flex items-center gap-3">
            {/* Conversation icon with plus inside */}
            <div className="relative w-10 h-10 shrink-0">
              <svg width="40" height="40" viewBox="15 12 38 38" fill="none">
                <defs>
                  <linearGradient id="newChatBrandGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFBB7D" />
                    <stop offset="48%" stopColor="#EFD1BE" />
                    <stop offset="100%" stopColor="#B3BDDC" />
                  </linearGradient>
                </defs>
                <circle cx="34" cy="31" r="19" fill="url(#newChatBrandGrad)" />
                <path
                  d="M26 24 H41 A3 3 0 0 1 44 27 V37 A3 3 0 0 1 41 40 H33 L26 45 V40 A3 3 0 0 1 23 37 V27 A3 3 0 0 1 26 24Z"
                  fill="#000000"
                />
                <path d="M34 28 V36 M30 32 H38" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <div>
              <h3 className="text-[18px] font-bold text-black leading-tight">
                Nova Conversa
              </h3>
              <p className="text-[11px] text-[#777777] leading-tight mt-0.5">
                Selecione um contacto ou digite um número
              </p>
            </div>
          </div>

          {/* Close button: black circle with white X */}
          <button
            onClick={onClose}
            className="w-[34px] h-[34px] rounded-full bg-black hover:bg-neutral-800 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fechar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 2 L12 12 M12 2 L2 12" />
            </svg>
          </button>
        </div>

        {/* Input Bar: Search / Number */}
        <div className="p-3 bg-white">
          <div className="h-[38px] rounded-[19px] border-[1.2px] border-black bg-white px-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="26 106 18 18" fill="none" className="shrink-0">
              <circle cx="34" cy="114" r="5.5" stroke="#777777" strokeWidth="1.5" />
              <path d="M38 118 L42 122" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digitar número (ex: 4116 0001) ou nome..."
              className="bg-transparent border-none text-[12px] text-black placeholder:text-[#777777] focus:outline-none w-full"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-[#777777] hover:text-black p-0.5 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Start Card if number was typed */}
          {isNumberQuery && (
            <div className="mt-2.5 p-2.5 rounded-[13px] bg-neutral-100 border border-neutral-300 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-black truncate">
                    Iniciar conversa com número
                  </div>
                  <div className="text-[12px] font-mono text-[#777777] truncate">
                    {formatPhoneNumber(clean)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleStartWithNumber(clean)}
                className="px-3 py-1.5 bg-black hover:bg-neutral-800 active:scale-95 text-white text-[12px] font-semibold rounded-full transition-all shadow-sm shrink-0 cursor-pointer"
              >
                Conversar
              </button>
            </div>
          )}
        </div>

        {/* Section title & divider */}
        <div className="px-3 pt-1">
          <div className="text-[12px] font-bold tracking-[0.3px] text-[#777777]">
            CONTACTOS EXISTENTES ({filteredNodes.length})
          </div>
          <div className="mt-2 border-b border-[#EEEEEE]" />
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {filteredNodes.map((contact) => {
            const phone = getNodePhoneNumber(contact.id);
            const formattedPhone = contact.phoneNumber || formatPhoneNumber(phone);
            const isGroup = contact.isGroup || contact.id === 'group-broadcast';

            return (
              <div
                key={contact.id}
                onClick={() => {
                  onSelectContact(contact.id);
                  onClose();
                }}
                className="bg-[#FAFAFA] border border-[#EEEEEE] rounded-[15px] p-2.5 flex items-center justify-between hover:bg-neutral-100/70 active:scale-[0.99] cursor-pointer transition-all"
              >
                {/* Left: Avatar + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] shadow-sm ${
                        isGroup ? 'text-black' : 'text-white'
                      }`}
                      style={{
                        background: isGroup
                          ? 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)'
                          : contact.avatarColor || '#000000',
                      }}
                    >
                      {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    {/* Presence dot */}
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00B98B] border-2 border-white" />
                  </div>

                  {/* Name and phone */}
                  <div className="min-w-0">
                    <h4 className="text-[15px] font-semibold text-black truncate leading-tight">
                      {contact.name}
                    </h4>
                    <p className="text-[13px] text-[#777777] truncate mt-0.5">
                      {formattedPhone}
                    </p>
                  </div>
                </div>

                {/* Right: Callsign badge & chat icon */}
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {contact.callsign && (
                    <span className="bg-[#F0F0F0] border border-[#DDDDDD] px-2 py-0.5 rounded-[5px] text-[10px] text-black font-mono">
                      {contact.callsign}
                    </span>
                  )}

                  <div className="w-7 h-7 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="274 212 18 20" fill="none" stroke="#000000" strokeWidth="1.4" strokeLinejoin="round">
                      <path d="M276 214 H287 A2 2 0 0 1 289 216 V226 A2 2 0 0 1 287 228 H278 L276 231 V214Z" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredNodes.length === 0 && !isNumberQuery && (
            <div className="text-center py-8 text-[#777777] text-xs">
              Nenhum contacto encontrado para "{query}"
            </div>
          )}
        </div>

        {/* Footer button matching nova-conversa.svg */}
        {onOpenRegisterNewContact && (
          <div className="p-3 border-t border-[#EEEEEE] bg-white">
            <button
              onClick={() => {
                onClose();
                onOpenRegisterNewContact();
              }}
              className="w-full h-[52px] rounded-[26px] bg-black hover:bg-neutral-800 active:scale-98 text-white text-[14px] font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-md"
            >
              <div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-black"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              >
                <svg width="14" height="14" viewBox="38 604 20 16" fill="none" stroke="#000000" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M43 606 A3 3 0 1 1 49 606 M39 617 V615 A5 5 0 0 1 49 615 M53 607 V615 M49 611 H57" />
                </svg>
              </div>
              <span>Cadastrar Novo Contacto na Agenda</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
