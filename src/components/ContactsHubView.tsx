import React, { useState } from 'react';
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
import { HistoryIcon } from './HistoryIcon';
import { ContactsIcon } from './ContactsIcon';
import { FavoritesIcon } from './FavoritesIcon';

export interface CallRecordDetail {
  id: string;
  type: 'outgoing' | 'incoming' | 'missed';
  label: string;
  time: string;
  duration: string;
  dataSize: string;
}

export interface CallHistoryItem {
  id: string;
  node: MeshNode;
  callCount: number;
  formattedDate: string;
  formattedTime: string;
  calls: CallRecordDetail[];
}

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
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'contacts' | 'favorites'>('contacts');
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

  const handleStartCall = (node: MeshNode) => {
    voiceCallService.startCall(node.id, node.name, node.callsign);
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

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CallHistoryItem | null>(null);
  const [isHistoryMenuOpen, setIsHistoryMenuOpen] = useState(false);

  // Call history formatted with individual call logs matching screenshot
  const callHistory: CallHistoryItem[] = [
    {
      id: 'hist-hebo',
      node: otherContacts.find((c) => c.name.toLowerCase().includes('hebo')) || {
        id: 'node-hebo-py',
        name: 'Hebo Py',
        username: 'hebo.py',
        callsign: 'HEBO-244',
        phoneNumber: '+244 974 831 531',
        avatarColor: '#f59e0b',
        avatarInitials: 'HP',
        role: 'CLIENT',
        hardware: 'TTGO T-Beam v1.2',
        isOnline: true,
        lastHeard: Date.now(),
        batteryPct: 92,
        batteryVoltage: 4.1,
        gps: { lat: -8.8399, lng: 13.2894, alt: 40 },
        x: 45,
        y: 55,
        antennaDbi: 3.0,
        hopsAway: 1,
        rssi: -58,
        snr: 10.5,
        packetsForwarded: 14,
      },
      callCount: 3,
      formattedDate: '29 de setembro',
      formattedTime: '11:31',
      calls: [
        {
          id: 'c-1',
          type: 'outgoing',
          label: 'Efetuada',
          time: '11:05',
          duration: '4 min e 7 s',
          dataSize: '1,7 MB',
        },
        {
          id: 'c-2',
          type: 'outgoing',
          label: 'Efetuada',
          time: '11:24',
          duration: '5 min e 35 s',
          dataSize: '2,2 MB',
        },
        {
          id: 'c-3',
          type: 'outgoing',
          label: 'Efetuada',
          time: '11:31',
          duration: '4 min e 49 s',
          dataSize: '2,2 MB',
        },
      ],
    },
    {
      id: 'hist-1',
      node: otherContacts.find((c) => c.name.toLowerCase().includes('andré') || c.name.toLowerCase().includes('andre')) ||
        otherContacts[0] || { id: 'mock-andre', name: 'André', callsign: 'ANDRE-01', phoneNumber: '4116 0001' },
      callCount: 2,
      formattedDate: '29 de setembro',
      formattedTime: '11:31',
      calls: [
        {
          id: 'ca-1',
          type: 'outgoing',
          label: 'Efetuada',
          time: '10:15',
          duration: '2 min e 14 s',
          dataSize: '1,1 MB',
        },
        {
          id: 'ca-2',
          type: 'outgoing',
          label: 'Efetuada',
          time: '11:31',
          duration: '3 min e 40 s',
          dataSize: '1,8 MB',
        },
      ],
    },
    {
      id: 'hist-2',
      node: otherContacts.find((c) => c.name.toLowerCase().includes('josh')) ||
        otherContacts[1] || { id: 'mock-josh', name: 'Josh', callsign: 'JOSH-02', phoneNumber: '4116 0002' },
      callCount: 1,
      formattedDate: '09 de setembro',
      formattedTime: '08:51',
      calls: [
        {
          id: 'cj-1',
          type: 'outgoing',
          label: 'Efetuada',
          time: '08:51',
          duration: '1 min e 20 s',
          dataSize: '750 KB',
        },
      ],
    },
    {
      id: 'hist-3',
      node: otherContacts.find((c) => c.name.toLowerCase().includes('zox')) ||
        otherContacts[2] || { id: 'mock-zox', name: 'Zox', callsign: 'ZOX-03', phoneNumber: '4116 0003' },
      callCount: 1,
      formattedDate: '01 de Agosto',
      formattedTime: '17:35',
      calls: [
        {
          id: 'cz-1',
          type: 'outgoing',
          label: 'Efetuada',
          time: '17:35',
          duration: '5 min e 02 s',
          dataSize: '2,6 MB',
        },
      ],
    },
  ];

  // =========================================================================
  // VIEW: Call Details ("Dados da chamada") matching Screenshot_20261006-212358.png
  // Triggered ONLY when clicking an item inside the History tab
  // =========================================================================
  if (selectedHistoryItem) {
    const itemNode = selectedHistoryItem.node;
    const phoneDisplay = itemNode.phoneNumber || formatPhoneNumber(getNodePhoneNumber(itemNode.id));

    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-md mx-auto w-full bg-black text-white font-sans select-none animate-fadeIn">
        {/* Top Bar with Back Arrow, Title "Dados da chamada", and More ⋮ */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-900 bg-black">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedHistoryItem(null);
                setIsHistoryMenuOpen(false);
              }}
              className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Voltar ao histórico"
            >
              <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <h2 className="text-xl font-normal text-white">
              Dados da chamada
            </h2>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsHistoryMenuOpen(!isHistoryMenuOpen)}
              className="p-2 -mr-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isHistoryMenuOpen && (
              <div className="absolute right-0 top-12 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-fadeIn">
                <button
                  onClick={() => {
                    setIsHistoryMenuOpen(false);
                    setSelectedContact(itemNode);
                    setSelectedHistoryItem(null);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Ver Perfil Completo
                </button>
                <button
                  onClick={() => {
                    setIsHistoryMenuOpen(false);
                    handleStartCall(itemNode);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-emerald-400 hover:bg-slate-800 transition-colors"
                >
                  Ligar para {itemNode.name}
                </button>
                <button
                  onClick={() => {
                    setIsHistoryMenuOpen(false);
                    setSelectedHistoryItem(null);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-slate-800 transition-colors border-t border-slate-800/80 mt-1"
                >
                  Limpar Registos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Profile Section: Avatar, Name, Phone, 3 Actions */}
        <div className="px-6 pt-6 pb-6 flex flex-col items-center text-center">
          {/* Centered Large Circular Avatar matching screenshot */}
          {itemNode.name.toLowerCase().includes('hebo') ? (
            <div className="w-32 h-32 rounded-full bg-[#f59e0b] overflow-hidden flex items-center justify-center shadow-2xl relative border-2 border-amber-400/40">
              <svg viewBox="0 0 100 100" className="w-28 h-28">
                {/* Spiderman figure matching the screenshot's yellow avatar */}
                <path d="M50 18 C38 18 30 28 30 42 C30 56 40 68 50 72 C60 68 70 56 70 42 C70 28 62 18 50 18 Z" fill="#ef4444" />
                <path d="M36 40 Q50 34 64 40" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                <path d="M40 50 Q50 46 60 50" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                <path d="M50 18 L50 72" stroke="#1e293b" strokeWidth="1.5" fill="none" />
                <path d="M38 36 Q46 40 44 46 Q38 44 36 40 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                <path d="M62 36 Q54 40 56 46 Q62 44 64 40 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                <path d="M24 76 C28 64 40 65 50 67 C60 65 72 64 76 76 C72 86 28 86 24 76 Z" fill="#2563eb" />
                <path d="M40 67 L50 88 L60 67" fill="#dc2626" />
              </svg>
            </div>
          ) : (
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center font-bold text-5xl shadow-2xl text-white border-2 border-slate-800"
              style={{ backgroundColor: itemNode.avatarColor || '#18181b' }}
            >
              {itemNode.avatarInitials || itemNode.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Contact Name */}
          <h1 className="text-2xl font-normal text-white mt-4 tracking-tight">
            {itemNode.name}
          </h1>

          {/* Contact Phone Number */}
          <p className="text-sm text-slate-400 mt-1 font-normal tracking-wide">
            {phoneDisplay}
          </p>

          {/* 2 Circular Action Buttons: Mensagem e Voz */}
          <div className="flex items-center justify-center gap-10 mt-6 w-full max-w-xs">
            {/* 1. Mensagem */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => onOpenChatWithNode(itemNode.id)}
                className="w-14 h-14 rounded-full bg-[#1e2329] hover:bg-[#282f37] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Enviar Mensagem"
              >
                <MessageSquare className="w-6 h-6 stroke-[1.8]" />
              </button>
              <span className="text-xs text-slate-300 mt-2 font-normal">Mensagem</span>
            </div>

            {/* 2. Voz */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => handleStartCall(itemNode)}
                className="w-14 h-14 rounded-full bg-[#1e2329] hover:bg-[#282f37] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Chamada de Voz"
              >
                <Phone className="w-6 h-6 stroke-[1.8]" />
              </button>
              <span className="text-xs text-slate-300 mt-2 font-normal">Voz</span>
            </div>
          </div>
        </div>

        {/* Call Breakdown Section matching screenshot */}
        <div className="flex-1 border-t border-slate-900/80 px-6 pt-5 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-400 mb-4">
            {selectedHistoryItem.formattedDate}
          </h3>

          <div className="space-y-6">
            {selectedHistoryItem.calls.map((call) => (
              <div key={call.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[#22c55e]">
                    <PhoneOutgoing className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="text-[15px] font-normal text-white">{call.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{call.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">{call.duration}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{call.dataSize}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: Contact Details (User Image 6)
  // Triggered when clicking a contact from the Contacts / Favorites tab
  // =========================================================================
  if (selectedContact) {
    const isFav = favoriteIds.has(selectedContact.id);
    const phoneNumber = formatPhoneNumber(selectedContact.phoneNumber || getNodePhoneNumber(selectedContact.id));

    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-md mx-auto w-full bg-black text-white font-sans select-none animate-fadeIn">
        {/* Top Bar with Back Arrow, Delete, Star, Edit Pencil */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black">
          <button
            onClick={() => setSelectedContact(null)}
            className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
            title="Voltar aos contactos"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDeleteContact(selectedContact.id)}
              className="p-2 text-white hover:text-red-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Eliminar contacto"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button
              onClick={() => toggleFavorite(selectedContact.id)}
              className="p-2 text-white hover:text-amber-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star
                className={`w-5 h-5 ${
                  isFav ? 'text-amber-400 fill-amber-400' : 'text-white'
                }`}
              />
            </button>

            <button
              onClick={() => {
                setEditingNameValue(selectedContact.name);
                setIsEditingName(true);
              }}
              className="p-2 -mr-2 text-white hover:text-emerald-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Editar nome"
            >
              <Pencil className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contact Profile Details Body */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
          {/* Centered Large Circular Avatar */}
          <div className="relative mb-8">
            <div
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center font-bold text-6xl sm:text-7xl shadow-2xl transition-transform hover:scale-105"
              style={{ backgroundColor: selectedContact.avatarColor || '#18181b' }}
            >
              {selectedContact.avatarInitials || selectedContact.name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Contact Name (editable) */}
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={editingNameValue}
                onChange={(e) => setEditingNameValue(e.target.value)}
                autoFocus
                className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-1.5 text-xl font-bold text-white text-center focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSaveEditedName}
                className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              {selectedContact.name}
            </h1>
          )}

          {/* 8-Digit Unique Number: 4116 XXXX */}
          <p className="text-xl font-bold tracking-wider font-mono text-slate-200 mb-10">
            {phoneNumber}
          </p>

          {/* Two Prominent Action Buttons matching user image 6 */}
          <div className="flex items-center justify-center gap-6 w-full max-w-xs">
            {/* Ligar: Black pill with phone icon */}
            <button
              onClick={() => handleStartCall(selectedContact)}
              className="w-36 py-3.5 bg-[#18181b] hover:bg-slate-900 border border-slate-700/80 active:scale-95 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg"
              title="Fazer chamada de voz"
            >
              <Phone className="w-5 h-5 text-white fill-white/10" />
            </button>

            {/* Mensagem: Outlined pill with message icon */}
            <button
              onClick={() => handleStartMessage(selectedContact)}
              className="w-36 py-3.5 bg-transparent border-2 border-white hover:bg-white/10 active:scale-95 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg"
              title="Enviar mensagem"
            >
              <MessageSquare className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: Main Contact List with 3 Sub-Tabs (User Image 5)
  // =========================================================================
  const favoriteContacts = otherContacts.filter((c) => favoriteIds.has(c.id));

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-md mx-auto w-full bg-black text-white font-sans select-none">
      {/* Top Bar with Back Arrow matching image 6 and 5 */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {activeSubTab !== 'history' && (
          <button
            onClick={onOpenAddContact}
            className="p-2 -mr-2 text-slate-300 hover:text-emerald-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
            title="Adicionar Novo Contacto"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Content Area based on Active Sub-Tab */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 relative">
        {/* SUB-TAB 1: CONTACTOS (Image 5) */}
        {activeSubTab === 'contacts' && (
          <div className="space-y-4">
            {otherContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center gap-6 py-2 px-2 hover:bg-slate-900/50 rounded-2xl cursor-pointer transition-colors group"
              >
                {/* Large Round Avatar matching image 5 */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md shrink-0"
                  style={{ backgroundColor: contact.avatarColor || '#18181b' }}
                >
                  {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                    {contact.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    {formatPhoneNumber(contact.phoneNumber || getNodePhoneNumber(contact.id))}
                  </p>
                </div>
              </div>
            ))}

            {otherContacts.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400 font-medium">Nenhum contacto adicionado ainda</p>
                <button
                  onClick={onOpenAddContact}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Adicionar por Número
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: HISTÓRICO matching user image 6 */}
        {activeSubTab === 'history' && (
          <div className="space-y-6 relative min-h-[calc(100vh-14rem)]">
            <div className="space-y-6">
              {callHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedHistoryItem(item)}
                  className="flex items-center gap-6 py-2 px-2 hover:bg-slate-900/50 rounded-2xl cursor-pointer transition-colors group"
                >
                  {/* Large Round Avatar matching image 6 and screenshot */}
                  {item.node.name.toLowerCase().includes('hebo') ? (
                    <div className="w-16 h-16 rounded-full bg-[#f59e0b] overflow-hidden flex items-center justify-center shadow-md shrink-0 border border-amber-400/30">
                      <svg viewBox="0 0 100 100" className="w-14 h-14">
                        <path d="M50 18 C38 18 30 28 30 42 C30 56 40 68 50 72 C60 68 70 56 70 42 C70 28 62 18 50 18 Z" fill="#ef4444" />
                        <path d="M38 36 Q46 40 44 46 Q38 44 36 40 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                        <path d="M62 36 Q54 40 56 46 Q62 44 64 40 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                        <path d="M24 76 C28 64 40 65 50 67 C60 65 72 64 76 76 C72 86 28 86 24 76 Z" fill="#2563eb" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md shrink-0 bg-[#18181b]">
                      {item.node.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  {/* Name and Date • Time matching image 6 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                      {item.callCount && item.callCount > 1 ? `${item.node.name} (${item.callCount})` : item.node.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      {item.formattedDate} <span className="mx-1">•</span> {item.formattedTime}
                    </p>
                  </div>

                  {/* Direct Call Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCall(item.node as MeshNode);
                    }}
                    className="p-3 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 rounded-full transition-colors cursor-pointer shrink-0"
                    title="Ligar agora"
                  >
                    <Phone className="w-5 h-5 text-white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Floating Call Button at bottom right matching image 6 */}
            <div className="fixed bottom-20 right-6 sm:right-8 z-30">
              <button
                onClick={() => (onOpenKeypad ? onOpenKeypad() : onBack())}
                className="w-16 h-16 rounded-full bg-white text-black border-2 border-black hover:bg-slate-100 active:scale-95 shadow-2xl flex items-center justify-center transition-all cursor-pointer"
                title="Novo Chamador / Teclado"
              >
                <Phone className="w-7 h-7 text-black stroke-[2.2]" />
              </button>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: FAVORITOS */}
        {activeSubTab === 'favorites' && (
          <div className="space-y-4">
            {favoriteContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center gap-6 py-2 px-2 hover:bg-slate-900/50 rounded-2xl cursor-pointer transition-colors group"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md shrink-0 relative"
                  style={{ backgroundColor: contact.avatarColor || '#18181b' }}
                >
                  {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-slate-950">
                    <Star className="w-2.5 h-2.5 fill-slate-950" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                    {contact.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    {formatPhoneNumber(contact.phoneNumber || getNodePhoneNumber(contact.id))}
                  </p>
                </div>
              </div>
            ))}

            {favoriteContacts.length === 0 && (
              <div className="text-center py-16 space-y-2 text-slate-400">
                <Star className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-medium">Nenhum contacto favorito ainda</p>
                <p className="text-xs text-slate-500">Toque num contacto e clique na estrela ⭐ para fixar nos favoritos.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sub-Tabs matching user image 5 */}
      <div className="h-16 border-t border-slate-900 bg-black grid grid-cols-3 items-center px-4">
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
            activeSubTab === 'history' ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <HistoryIcon className="w-5 h-5 mb-1" />
          <span className="text-xs">Histórico</span>
        </button>

        <button
          onClick={() => setActiveSubTab('contacts')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
            activeSubTab === 'contacts' ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ContactsIcon className="w-5 h-5 mb-1" />
          <span className="text-xs">Contactos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('favorites')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors cursor-pointer ${
            activeSubTab === 'favorites' ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <FavoritesIcon className="w-5 h-5 mb-1" />
          <span className="text-xs">Favoritos</span>
        </button>
      </div>
    </div>
  );
};
