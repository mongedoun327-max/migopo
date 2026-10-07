import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Star,
  Pencil,
  Phone,
  MessageSquare,
  Users,
  UserPlus,
  Clock,
  Check,
  PhoneOutgoing,
  MoreVertical,
} from 'lucide-react';
import { MeshNode, MeshPacket } from '../types/mesh';
import { voiceCallService } from '../services/voiceCallService';
import { formatPhoneNumber, cleanPhoneNumber, getNodePhoneNumber } from '../services/phoneSystem';
import { meshManager } from '../services/meshProtocol';
import { callHistoryService, CallHistoryItem, CallLogEntry } from '../services/callHistoryService';
import { HistoryIcon } from './HistoryIcon';
import { ContactsIcon } from './ContactsIcon';
import { FavoritesIcon } from './FavoritesIcon';

export type { CallHistoryItem, CallLogEntry };

interface ContactsHubViewProps {
  nodes: MeshNode[];
  packets: MeshPacket[];
  onBack: () => void;
  onOpenChatWithNode: (nodeId: string) => void;
  onOpenAddContact: () => void;
  onOpenKeypad?: () => void;
}

export const ContactsHubView: React.FC<ContactsHubViewProps> = ({
  nodes,
  packets,
  onBack,
  onOpenChatWithNode,
  onOpenAddContact,
  onOpenKeypad,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'contacts' | 'favorites'>('favorites');
  const [selectedContact, setSelectedContact] = useState<MeshNode | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');

  // Favorites state persisted in localStorage
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lora_favorite_contacts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const otherContacts = nodes.filter((n) => n && !n.isSelf && !n.isGroup);

  const toggleFavorite = (nodeId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      try {
        localStorage.setItem('lora_favorite_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleDeleteContact = (nodeId: string) => {
    meshManager.deleteContact(nodeId);
    setSelectedContact(null);
  };

  const handleStartCall = (node: Partial<MeshNode>) => {
    if (!node.id || !node.name) return;
    const phone = node.phoneNumber || getNodePhoneNumber(node.id);
    voiceCallService.startCall(node.id, node.name, node.callsign, phone, node);
  };

  const handleStartMessage = (node: MeshNode) => {
    onOpenChatWithNode(node.id);
  };

  const handleSaveEditedName = () => {
    if (!selectedContact || !editingNameValue.trim()) {
      setIsEditingName(false);
      return;
    }
    const updated = { ...selectedContact, name: editingNameValue.trim() };
    meshManager.addNode(updated);
    setSelectedContact(updated);
    setIsEditingName(false);
  };

  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>(() =>
    callHistoryService.getHistory()
  );

  useEffect(() => {
    return callHistoryService.subscribe((list) => {
      setCallHistory(list);
    });
  }, []);

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CallHistoryItem | null>(null);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);

  // Synchronize active call details item if new calls are logged
  const activeHistoryItem = selectedHistoryItem
    ? callHistory.find((h) => h.id === selectedHistoryItem.id) || selectedHistoryItem
    : null;

  // =========================================================================
  // VIEW: Call Details ("Dados da chamada") matching dados-da-chamada.svg
  // Triggered ONLY when clicking an item inside the History tab
  // =========================================================================
  if (activeHistoryItem) {
    const itemNode = activeHistoryItem.node;
    const phoneDisplay = itemNode.phoneNumber || formatPhoneNumber(getNodePhoneNumber(itemNode.id));

    return (
      <div className="flex flex-col min-h-screen sm:min-h-[660px] max-w-[368px] mx-auto w-full bg-white text-black font-sans select-none animate-fadeIn justify-between pb-4">
        <div>
          {/* Top Bar with Back Arrow, Title "Dados da chamada", and 3 Dots */}
          <div className="h-[60px] px-5 flex items-center justify-between border-b border-[#EEEEEE] bg-white">
            <div className="flex items-center">
              <button
                onClick={() => {
                  setSelectedHistoryItem(null);
                  setIsHistoryMenuOpen(false);
                }}
                className="p-1 -ml-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
                title="Voltar ao histórico"
              >
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                  <path d="M34 20 H18 M18 20 L25 13 M18 20 L25 27" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h2 className="text-[25px] font-normal tracking-[-0.6px] text-black ml-4">
                Dados da chamada
              </h2>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)}
                className="p-2 -mr-2 text-black hover:opacity-70 transition-opacity cursor-pointer"
                title="Mais opções"
              >
                <svg width="18" height="24" viewBox="338 20 10 20" fill="#000000">
                  <circle cx="343" cy="23" r="1.7" />
                  <circle cx="343" cy="30" r="1.7" />
                  <circle cx="343" cy="37" r="1.7" />
                </svg>
              </button>

              {isHistoryMenuOpen && (
                <div className="absolute right-0 top-12 w-52 bg-white border border-[#EEEEEE] rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn text-black">
                  <button
                    onClick={() => {
                      setIsHistoryMenuOpen(false);
                      setSelectedContact(itemNode as MeshNode);
                      setSelectedHistoryItem(null);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-black hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Ver Perfil Completo
                  </button>
                  <button
                    onClick={() => {
                      setIsHistoryMenuOpen(false);
                      handleStartCall(itemNode);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-black font-semibold hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Ligar para {itemNode.name}
                  </button>
                  <button
                    onClick={() => {
                      setIsHistoryMenuOpen(false);
                      callHistoryService.deleteHistoryItem(activeHistoryItem.id);
                      setSelectedHistoryItem(null);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-neutral-100 transition-colors border-t border-[#EEEEEE] mt-1 cursor-pointer"
                  >
                    Limpar Registos
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profile Section: Avatar, Name, Phone, 2 Actions */}
          <div className="px-6 pt-7 pb-6 flex flex-col items-center text-center">
            {/* Centered Large Circular Avatar matching dados-da-chamada.svg (r=64 / 128px) */}
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center font-semibold text-[48px] tracking-[-2px] text-black shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
              }}
            >
              {itemNode.avatarInitials || itemNode.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Contact Name (24px) */}
            <h1 className="text-[24px] font-normal text-black mt-5 tracking-tight">
              {itemNode.name}
            </h1>

            {/* Contact Phone Number (14px, #777777) */}
            <p className="text-[14px] text-[#777777] mt-1 font-normal">
              {phoneDisplay}
            </p>

            {/* 2 Circular Action Buttons: Mensagem e Voz (r=29 / 58px) matching SVG */}
            <div className="flex items-center justify-center gap-10 mt-7 w-full max-w-xs">
              {/* 1. Mensagem */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onOpenChatWithNode(itemNode.id)}
                  className="w-[58px] h-[58px] rounded-full bg-black hover:bg-neutral-800 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                  title="Enviar Mensagem"
                >
                  <svg width="22" height="22" viewBox="122 328 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round">
                    <path d="M123 330 H141 A2 2 0 0 1 143 332 V345 A2 2 0 0 1 141 347 H127 L123 351 V330Z" />
                  </svg>
                </button>
                <span className="text-[12px] text-black mt-2 font-normal">Mensagem</span>
              </div>

              {/* 2. Voz */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleStartCall(itemNode)}
                  className="w-[58px] h-[58px] rounded-full bg-black hover:bg-neutral-800 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                  title="Chamada de Voz"
                >
                  <svg width="26" height="26" viewBox="220 326 26 26" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M221 330 C221 328.5 222.5 327.5 224 328 L228 329.5 L230 334.5 L227.5 336.5 C229.5 340.5 232 343 236 345 L238 342.5 L243 344.5 L244.5 348.5 C245 350 244 351.5 242.5 351.5 C233 350.8 222 341.8 221 330Z" />
                  </svg>
                </button>
                <span className="text-[12px] text-black mt-2 font-normal">Voz</span>
              </div>
            </div>
          </div>

          {/* Call Breakdown Section matching dados-da-chamada.svg */}
          <div className="border-t border-[#EEEEEE] px-5 pt-5">
            <h3 className="text-[14px] font-semibold text-black mb-5">
              {activeHistoryItem.formattedDate}
            </h3>

            <div className="space-y-6">
              {activeHistoryItem.calls.map((call) => (
                <div key={call.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    {/* Call icon matching dados-da-chamada.svg */}
                    <svg width="22" height="22" viewBox="0 0 26 26" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M4 5 C4 3.8 5.2 3 6.4 3.5 L9.5 4.7 L10.8 8.5 L8.5 10.3 C10.2 13.2 12.5 15.5 15.4 17.2 L17.2 14.9 L21 16.2 L22.2 19.3 C22.7 20.5 21.7 21.5 20.5 21.5 C11.2 21 4.5 14.2 4 5Z" />
                      <path d="M17 3 H23 V9 M23 3 L16 10" />
                    </svg>

                    <div>
                      <div className="text-[16px] font-normal text-black leading-tight">{call.label}</div>
                      <div className="text-[11px] text-[#777777] mt-1">{call.time}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[12px] text-[#777777] font-normal">{call.duration}</div>
                    <div className="text-[11px] text-[#777777] mt-1">{call.dataSize}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: Contact Details ("Perfil do contato") matching perfil-contato.svg
  // Triggered when clicking a contact from the Contacts / Favorites tab
  // =========================================================================
  if (selectedContact) {
    const isFav = favoriteIds.has(selectedContact.id);
    const phoneNumber = formatPhoneNumber(selectedContact.phoneNumber || getNodePhoneNumber(selectedContact.id));

    return (
      <div className="flex flex-col min-h-screen sm:min-h-[660px] max-w-[368px] mx-auto w-full bg-white text-black font-sans select-none animate-fadeIn justify-between pb-8">
        <div>
          {/* Top Bar with Back Arrow, Delete, Star, Edit Pencil matching perfil-contato.svg */}
          <div className="h-[58px] px-5 flex items-center justify-between border-b border-[#EEEEEE] bg-white">
            <button
              onClick={() => setSelectedContact(null)}
              className="p-1 -ml-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
              title="Voltar aos contactos"
            >
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M34 20 H18 M18 20 L25 13 M18 20 L25 27" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex items-center gap-4">
              {/* Excluir (Lixeira matching SVG) */}
              <button
                onClick={() => handleDeleteContact(selectedContact.id)}
                className="p-1 text-black hover:text-red-500 transition-colors cursor-pointer"
                title="Excluir contato"
              >
                <svg width="22" height="22" viewBox="244 17 20 23" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M248 23 H261" />
                  <path d="M251 23 V37 H258 V23" />
                  <path d="M250 20 H259" />
                </svg>
              </button>

              {/* Favoritar (Estrela matching SVG) */}
              <button
                onClick={() => toggleFavorite(selectedContact.id)}
                className="p-1 text-black transition-colors cursor-pointer"
                title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <svg width="24" height="24" viewBox="285 17 26 25" fill={isFav ? '#000000' : 'none'} stroke="#000000" strokeWidth="1.8" strokeLinejoin="round">
                  <path d="M298 19 L301 26 L309 27 L303 32 L305 40 L298 36 L291 40 L293 32 L287 27 L295 26 Z" />
                </svg>
              </button>

              {/* Editar (Lápis matching SVG) */}
              <button
                onClick={() => {
                  setEditingNameValue(selectedContact.name);
                  setIsEditingName(true);
                }}
                className="p-1 -mr-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
                title="Editar contato"
              >
                <svg width="22" height="22" viewBox="326 17 23 23" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinejoin="round">
                  <path d="M333 37 L347 23 L343 19 L329 33 L328 38 Z M340 22 L344 26" />
                </svg>
              </button>
            </div>
          </div>

          {/* Contact Profile Details Body */}
          <div className="flex flex-col items-center justify-center px-6 pt-10 text-center">
            {/* Centered Large Circular Avatar (r=96 / 192px) matching perfil-contato.svg */}
            <div className="relative mb-8">
              <div
                className="w-48 h-48 rounded-full flex items-center justify-center font-semibold text-[62px] tracking-[-3px] text-black shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              >
                {selectedContact.avatarInitials || selectedContact.name.slice(0, 2).toUpperCase()}
              </div>
            </div>

            {/* Contact Name (24px, font-weight 600) */}
            {isEditingName ? (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  autoFocus
                  className="bg-neutral-100 border border-neutral-300 rounded-xl px-4 py-1.5 text-xl font-bold text-black text-center focus:outline-none focus:border-black"
                />
                <button
                  onClick={handleSaveEditedName}
                  className="p-2 rounded-xl bg-black text-white font-bold hover:bg-neutral-800"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1 className="text-[24px] font-semibold text-black tracking-tight mb-2">
                {selectedContact.name}
              </h1>
            )}

            {/* 8-Digit Phone Number (21px, font-weight 600, tracking-wide) */}
            <p className="text-[21px] font-semibold tracking-wider text-black">
              {phoneNumber}
            </p>
          </div>
        </div>

        {/* Two Prominent Action Buttons matching perfil-contato.svg (144x52, rx=26) */}
        <div className="flex items-center justify-center gap-6 px-5 mt-10">
          {/* Ligar: Black pill with phone icon */}
          <button
            onClick={() => handleStartCall(selectedContact)}
            className="w-[144px] h-[52px] rounded-[26px] bg-black text-white flex items-center justify-center hover:bg-neutral-800 active:scale-95 transition-all shadow-md cursor-pointer"
            title="Fazer chamada de voz"
          >
            <svg width="26" height="26" viewBox="90 486 28 28" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M92 490 C92 488.5 93.5 487.5 95 488 L99 489.5 L101 494.5 L98.5 496.5 C100.5 500.5 103 503 107 505 L109 502.5 L114 504.5 L115.5 508.5 C116 510 115 511.5 113.5 511.5 C104 510.8 93 501.8 92 490Z" />
            </svg>
          </button>

          {/* Mensagem: White pill with black border and message icon */}
          <button
            onClick={() => handleStartMessage(selectedContact)}
            className="w-[144px] h-[52px] rounded-[26px] bg-white border-2 border-black text-black flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all shadow-md cursor-pointer"
            title="Enviar mensagem"
          >
            <svg width="24" height="24" viewBox="250 487 23 25" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M252 489 H269 A2 2 0 0 1 271 491 V504 A2 2 0 0 1 269 506 H256 L252 510 V489Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: Main Contact List with 3 Sub-Tabs (Favoritos SVG Adapted Visual Identity)
  // =========================================================================
  const favoriteContacts = otherContacts.filter((c) => favoriteIds.has(c.id));

  return (
    <div className="flex flex-col min-h-screen sm:min-h-[660px] max-w-[368px] mx-auto w-full bg-white text-black font-sans select-none justify-between pb-0 pt-0 px-0">
      {/* Top Header: Voltar & Adicionar Contato matching SVG */}
      <div>
        <div className="h-14 px-5 flex items-center justify-between">
          {/* Voltar */}
          <button
            onClick={onBack}
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

          {/* Adicionar contato */}
          <button
            onClick={onOpenAddContact}
            className="p-1 -mr-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
            title="Adicionar contato"
          >
            <svg width="28" height="28" viewBox="325 15 32 24" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="340" cy="23" r="4" />
              <path d="M332 35 V32 A8 8 0 0 1 348 32 V35" />
              <path d="M350 20 V27 M346.5 23.5 H353.5" />
            </svg>
          </button>
        </div>

        {/* Big Title matching SVG (x=20, y=101, font-size=42, letter-spacing=-1.4) */}
        <div className="px-5 pt-2">
          <h1 className="text-[42px] font-normal tracking-[-1.4px] text-black leading-none">
            {activeSubTab === 'favorites' ? 'Favoritos' : activeSubTab === 'contacts' ? 'Contatos' : 'Histórico'}
          </h1>
          <div className="mt-5 border-b border-[#EEEEEE]" />
        </div>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 relative">
        {/* SUB-TAB 1: FAVORITOS (SVG mockup) */}
        {activeSubTab === 'favorites' && (
          <div className="h-full">
            {favoriteContacts.length === 0 ? (
              /* Empty state illustration exactly matching user SVG */
              <div className="flex flex-col items-center justify-center pt-10 pb-12 select-none">
                <div className="relative mb-8">
                  <svg width="124" height="124" viewBox="0 0 124 124" fill="none">
                    <defs>
                      <linearGradient id="emptyFavGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FFBB7D" />
                        <stop offset="48%" stopColor="#EFD1BE" />
                        <stop offset="100%" stopColor="#B3BDDC" />
                      </linearGradient>
                    </defs>
                    <circle cx="62" cy="62" r="62" fill="url(#emptyFavGradient)" />
                    <path
                      d="M62 23 L72 48 L99 50 L78 67 L84 94 L62 79 L40 94 L46 67 L25 50 L52 48 Z"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="2.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h3 className="text-[17px] font-semibold text-black text-center mb-3">
                  Nenhum contato favorito ainda
                </h3>
                <p className="text-[13px] text-[#777777] text-center leading-snug">
                  Toque num contato e adicione na estrela
                </p>
                <p className="text-[13px] text-[#777777] text-center leading-snug">
                  para fixar nos favoritos.
                </p>
              </div>
            ) : (
              /* Populated state */
              <div className="space-y-1">
                {favoriteContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="flex items-center gap-4 py-3 px-2 hover:bg-neutral-50 rounded-2xl cursor-pointer transition-colors border-b border-[#EEEEEE] last:border-b-0"
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-black shadow-sm shrink-0 relative border border-[#EEEEEE]"
                      style={{
                        background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                      }}
                    >
                      {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-black flex items-center justify-center text-white">
                        <Star className="w-2.5 h-2.5 fill-white" />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-[16px] font-semibold text-black truncate">
                        {contact.name}
                      </h3>
                      <p className="text-[13px] text-[#777777]">
                        {formatPhoneNumber(contact.phoneNumber || getNodePhoneNumber(contact.id))}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(contact);
                      }}
                      className="p-2.5 text-black hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                      title="Ligar"
                    >
                      <Phone className="w-5 h-5 text-black" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: CONTATOS */}
        {activeSubTab === 'contacts' && (
          <div className="space-y-1">
            {otherContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center gap-4 py-3 px-2 hover:bg-neutral-50 rounded-2xl cursor-pointer transition-colors border-b border-[#EEEEEE] last:border-b-0 group"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-black shadow-sm shrink-0 border border-[#EEEEEE]"
                  style={{
                    background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                  }}
                >
                  {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold text-black group-hover:text-neutral-700 transition-colors truncate">
                    {contact.name}
                  </h3>
                  <p className="text-[13px] text-[#777777]">
                    {formatPhoneNumber(contact.phoneNumber || getNodePhoneNumber(contact.id))}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(contact.id);
                  }}
                  className="p-2 text-[#777777] hover:text-amber-500 rounded-full transition-colors cursor-pointer"
                  title={favoriteIds.has(contact.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star
                    className={`w-5 h-5 ${
                      favoriteIds.has(contact.id) ? 'text-amber-500 fill-amber-500' : 'text-[#777777]'
                    }`}
                  />
                </button>
              </div>
            ))}

            {otherContacts.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <Users className="w-10 h-10 text-neutral-400 mx-auto" />
                <p className="text-sm text-[#777777] font-medium">Nenhum contato adicionado ainda</p>
                <button
                  onClick={onOpenAddContact}
                  className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer"
                >
                  Adicionar por Número
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: HISTÓRICO */}
        {activeSubTab === 'history' && (
          <div className="space-y-1 relative min-h-[calc(100vh-14rem)]">
            {callHistory.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div
                  className="w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-sm"
                  style={{
                    background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                  }}
                >
                  <Phone className="w-8 h-8 text-black" />
                </div>
                <h4 className="text-[17px] font-semibold text-black">
                  Nenhum registo de chamada ainda
                </h4>
                <p className="text-[13px] text-[#777777] max-w-xs mx-auto leading-relaxed">
                  Faça chamadas de voz através do teclado ou contatos para visualizar os registos detalhados aqui.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => (onOpenKeypad ? onOpenKeypad() : onBack())}
                    className="px-6 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    Abrir Teclado
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {callHistory.map((item) => {
                  const nodeName = item.node.name || item.node.phoneNumber || 'Operador';
                  const initials =
                    item.node.avatarInitials ||
                    (nodeName ? nodeName.slice(0, 2).toUpperCase() : 'OP');

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className="flex items-center gap-4 py-3 px-2 hover:bg-neutral-50 rounded-2xl cursor-pointer transition-colors border-b border-[#EEEEEE] last:border-b-0 group"
                    >
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-black shadow-sm shrink-0 border border-[#EEEEEE]"
                        style={{
                          background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                        }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-[16px] font-semibold text-black group-hover:text-neutral-700 transition-colors truncate">
                          {item.callCount && item.callCount > 1 ? `${nodeName} (${item.callCount})` : nodeName}
                        </h3>
                        <p className="text-[13px] text-[#777777] mt-0.5">
                          {item.formattedDate} <span className="mx-1">•</span> {item.formattedTime}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCall(item.node);
                        }}
                        className="p-2.5 text-black hover:bg-neutral-100 rounded-full transition-colors cursor-pointer shrink-0"
                        title="Ligar agora"
                      >
                        <Phone className="w-5 h-5 text-black" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Floating Call Button at bottom right */}
            <div className="fixed bottom-20 right-6 sm:right-8 z-30">
              <button
                onClick={() => (onOpenKeypad ? onOpenKeypad() : onBack())}
                className="w-14 h-14 rounded-full bg-black text-white hover:bg-neutral-800 active:scale-95 shadow-xl flex items-center justify-center transition-all cursor-pointer"
                title="Novo Chamador / Teclado"
              >
                <Phone className="w-6 h-6 text-white stroke-[2.2]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sub-Tabs Navigation exactly matching SVG */}
      <div className="h-16 border-t border-[#EEEEEE] bg-white grid grid-cols-3 items-center px-2 select-none">
        {/* 1. Histórico */}
        <button
          onClick={() => setActiveSubTab('history')}
          className="flex flex-col items-center justify-center min-h-[48px] cursor-pointer transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="-11 -10 22 21"
            fill="none"
            stroke={activeSubTab === 'history' ? '#000000' : '#777777'}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="0" cy="0" r="7" />
            <path d="M0 -4 V0 L3 2" />
            <path d="M-9 -2 A10 10 0 0 0 -3 9" />
          </svg>
          <span
            className={`text-[10px] mt-1 ${
              activeSubTab === 'history' ? 'font-bold text-black' : 'font-normal text-[#777777]'
            }`}
          >
            Histórico
          </span>
        </button>

        {/* 2. Contatos */}
        <button
          onClick={() => setActiveSubTab('contacts')}
          className="flex flex-col items-center justify-center min-h-[48px] cursor-pointer transition-colors"
        >
          <svg
            width="22"
            height="22"
            viewBox="-10 -10 20 20"
            fill="none"
            stroke={activeSubTab === 'contacts' ? '#000000' : '#777777'}
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="0" cy="-4" r="3.5" />
            <path d="M-7 8 V5 A7 7 0 0 1 7 5 V8" />
          </svg>
          <span
            className={`text-[10px] mt-1 ${
              activeSubTab === 'contacts' ? 'font-bold text-black' : 'font-normal text-[#777777]'
            }`}
          >
            Contatos
          </span>
        </button>

        {/* 3. Favoritos */}
        <button
          onClick={() => setActiveSubTab('favorites')}
          className="flex flex-col items-center justify-center min-h-[48px] cursor-pointer transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="-13 -13 26 26"
            fill={activeSubTab === 'favorites' ? '#000000' : 'none'}
            stroke={activeSubTab === 'favorites' ? '#000000' : '#777777'}
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path d="M0 -9 L3 -2 L11 -1 L5 4 L7 12 L0 8 L-7 12 L-5 4 L-11 -1 L-3 -2 Z" />
          </svg>
          <span
            className={`text-[10px] mt-1 ${
              activeSubTab === 'favorites' ? 'font-bold text-black' : 'font-normal text-[#777777]'
            }`}
          >
            Favoritos
          </span>
        </button>
      </div>
    </div>
  );
};
