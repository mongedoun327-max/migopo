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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#12161c] border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Nova Conversa
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                Selecione um contacto ou digite um número
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Bar: Search / Number */}
        <div className="p-4 border-b border-slate-800/60 bg-black/20">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1f242c] rounded-2xl border border-slate-700/60 focus-within:border-emerald-500 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digitar número (ex: 4116 0001) ou nome..."
              className="bg-transparent border-none text-xs text-white placeholder:text-slate-400 focus:outline-none w-full"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Start Card if number was typed */}
          {isNumberQuery && (
            <div className="mt-3 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Iniciar conversa com número
                  </div>
                  <div className="text-xs font-mono text-emerald-400 truncate">
                    {formatPhoneNumber(clean)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleStartWithNumber(clean)}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
              >
                Conversar
              </button>
            </div>
          )}
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 divide-y divide-slate-800/40">
          <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Contactos Existentes ({filteredNodes.length})
          </div>

          {filteredNodes.map((contact) => {
            const phone = getNodePhoneNumber(contact.id);
            const formattedPhone = contact.phoneNumber || formatPhoneNumber(phone);

            return (
              <div
                key={contact.id}
                onClick={() => {
                  onSelectContact(contact.id);
                  onClose();
                }}
                className="flex items-center gap-3.5 px-3 py-2.5 rounded-2xl hover:bg-slate-800/60 active:bg-slate-800 cursor-pointer transition-colors group pt-2.5"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md bg-[#18181b]"
                    style={{ backgroundColor: contact.avatarColor || '#18181b' }}
                  >
                    {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                  </div>
                  {contact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#12161c]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {contact.name}
                    </h4>
                    {contact.callsign && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {contact.callsign}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                    {formattedPhone}
                  </p>
                </div>

                {/* Action Icon */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 group-hover:text-emerald-400 group-hover:bg-slate-700/50 transition-colors shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
              </div>
            );
          })}

          {filteredNodes.length === 0 && !isNumberQuery && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nenhum contacto encontrado para "{query}"
            </div>
          )}
        </div>

        {/* Footer: Add new contact to address book */}
        {onOpenRegisterNewContact && (
          <div className="p-3 border-t border-slate-800/80 bg-black/30">
            <button
              onClick={() => {
                onClose();
                onOpenRegisterNewContact();
              }}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700 active:scale-98 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Cadastrar Novo Contacto na Agenda</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
