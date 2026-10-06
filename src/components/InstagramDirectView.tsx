import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  MapPin,
  Heart,
  Search,
  ChevronLeft,
  Play,
  Square,
  Mic,
  X,
  Copy,
  Check,
  UserPlus,
  Radio,
  Pencil,
  Phone,
  Signal,
  Trash2,
  Pin,
  PinOff,
  Bell,
  BellOff,
  CheckCircle2,
  Eraser,
  RotateCcw,
  MoreVertical,
  ArrowLeft,
  MessageSquarePlus,
  MessageSquare,
  CheckCheck,
} from 'lucide-react';
import { MeshNode, MeshPacket, AudioVoiceBurst, BleDeviceStatus } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';
import { audioEngine } from '../services/audioCodec';
import { voiceCallService } from '../services/voiceCallService';
import { bleBridge } from '../services/bleBridge';
import { ProfileModal } from './ProfileModal';
import { SettingsModal } from './SettingsModal';
import { AddContactModal } from './AddContactModal';
import { NewChatModal } from './NewChatModal';
import {
  formatPhoneNumber,
  cleanPhoneNumber,
  getNodePhoneNumber,
  getMyPermanentPhoneNumber,
} from '../services/phoneSystem';

interface InstagramDirectViewProps {
  nodes: MeshNode[];
  packets: MeshPacket[];
  initialSelectedContactId?: string;
  onSelectContactId?: (id: string) => void;
  onOpenHardwareTools?: () => void;
  onOpenMap?: () => void;
  onOpenEditName?: () => void;
  onOpenProfileRegistration?: () => void;
  bleStatus?: BleDeviceStatus;
}

export const InstagramDirectView: React.FC<InstagramDirectViewProps> = ({
  nodes,
  packets,
  initialSelectedContactId,
  onSelectContactId,
  onOpenHardwareTools,
  onOpenMap,
  onOpenEditName,
  onOpenProfileRegistration,
  bleStatus = bleBridge.getStatus(),
}) => {
  // Safe fallback self node
  const fallbackSelfNode: MeshNode = {
    id: 'node-self',
    name: 'Eu',
    username: 'utilizador',
    callsign: 'EU',
    phoneNumber: getMyPermanentPhoneNumber(),
    avatarColor: '#10b981',
    avatarInitials: 'EU',
    bio: '',
    statusText: 'Online',
    hardware: 'TTGO T-Beam v1.2',
    role: 'BASE_STATION',
    batteryPct: 100,
    batteryVoltage: 4.2,
    gps: { lat: 38.72, lng: -9.14, alt: 50 },
    x: 25,
    y: 65,
    antennaDbi: 3.5,
    isSelf: true,
    isOnline: true,
    lastHeard: Date.now(),
    hopsAway: 0,
    rssi: -55,
    snr: 9.0,
    packetsForwarded: 0,
  };

  const selfNode: MeshNode = nodes.find((n) => n && n.isSelf) || nodes[0] || fallbackSelfNode;
  const otherContacts = nodes.filter((n) => n && !n.isSelf);

  // Active contact: controlled by selectedContactId
  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialSelectedContactId || ''
  );

  const handleSelectContact = (id: string) => {
    setSelectedContactId(id);
    onSelectContactId?.(id);
  };

  const handleBackToConversationsList = () => {
    handleSelectContact('');
  };

  const handleToggleMuteContact = (contactId: string) => {
    setMutedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      try {
        localStorage.setItem('lora_muted_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (initialSelectedContactId !== undefined) {
      setSelectedContactId(initialSelectedContactId);
    }
  }, [initialSelectedContactId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [currentlyPlayingAudioId, setCurrentlyPlayingAudioId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // 3-Dots Menu & Modals State matching user images
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [contactProfileModalNode, setContactProfileModalNode] = useState<MeshNode | null>(null);
  const [conversationsFilter, setConversationsFilter] = useState<'all' | 'favorites' | 'unread'>('all');

  // Swipe to delete & marked card options state
  const [markedContactIds, setMarkedContactIds] = useState<Set<string>>(new Set());
  const [pinnedContactIds, setPinnedContactIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lora_pinned_contacts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set(['group-broadcast']);
    } catch {
      return new Set(['group-broadcast']);
    }
  });
  const [mutedContactIds, setMutedContactIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lora_muted_contacts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [deletedContactIds, setDeletedContactIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lora_deleted_contacts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const isDraggingHorizontallyRef = useRef<boolean>(false);
  const suppressClickRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const canvasWaveRef = useRef<HTMLCanvasElement | null>(null);

  // Filter contacts by search query & filter pills (Tudo, Favoritos, Não lidas), sorted by pinned first
  const filteredContacts = otherContacts
    .filter((c) => {
      if (!c || deletedContactIds.has(c.id)) return false;
      if (conversationsFilter === 'favorites' && !pinnedContactIds.has(c.id)) return false;
      if (conversationsFilter === 'unread') {
        const hasUnread = c.name.toLowerCase().includes('andré') || c.name.toLowerCase().includes('andre');
        if (!hasUnread) return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const cleanQ = cleanPhoneNumber(q);
      const phone = getNodePhoneNumber(c.id);
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (cleanQ && phone.includes(cleanQ)) ||
        formatPhoneNumber(phone).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aPinned = pinnedContactIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedContactIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return 0;
    });

  const handleAddNewContact = (newContact: Partial<MeshNode>, phoneNumber: string) => {
    const fullNode: MeshNode = {
      id: newContact.id || `node_phone_${phoneNumber}`,
      name: newContact.name || 'Operador',
      username: newContact.username || 'operador',
      callsign: newContact.callsign || 'OP-4116',
      phoneNumber: phoneNumber,
      avatarColor: newContact.avatarColor || '#10b981',
      avatarInitials: newContact.avatarInitials || 'OP',
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
      rssi: -42,
      snr: 14.0,
      packetsForwarded: 0,
    };

    meshManager.addNode(fullNode);
    setSelectedContactId(fullNode.id);
  };

  const handleDeleteContact = (contactId: string, contactName?: string) => {
    setDeletedContactIds((prev) => {
      const next = new Set(prev);
      next.add(contactId);
      try {
        localStorage.setItem('lora_deleted_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    meshManager.deleteContact(contactId);

    if (selectedContactId === contactId) {
      const remaining = otherContacts.filter(
        (c) => c && c.id !== contactId && !deletedContactIds.has(c.id)
      );
      setSelectedContactId(remaining.length > 0 ? remaining[0].id : '');
    }

    setMarkedContactIds((prev) => {
      const next = new Set(prev);
      next.delete(contactId);
      return next;
    });

    setUndoToast({ id: contactId, name: contactName || 'Conversa' });
    setTimeout(() => {
      setUndoToast((curr) => (curr?.id === contactId ? null : curr));
    }, 6000);
  };

  const handleUndoDelete = () => {
    if (!undoToast) return;
    setDeletedContactIds((prev) => {
      const next = new Set(prev);
      next.delete(undoToast.id);
      try {
        localStorage.setItem('lora_deleted_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setSelectedContactId(undoToast.id);
    setUndoToast(null);
  };

  const handleDeleteMarked = () => {
    if (markedContactIds.size === 0) return;
    const ids = Array.from(markedContactIds);
    ids.forEach((id) => {
      meshManager.deleteContact(id);
    });
    setDeletedContactIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try {
        localStorage.setItem('lora_deleted_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (ids.includes(selectedContactId)) {
      const remaining = otherContacts.filter(
        (c) => c && !ids.includes(c.id) && !deletedContactIds.has(c.id)
      );
      setSelectedContactId(remaining.length > 0 ? remaining[0].id : '');
    }

    setUndoToast({ id: ids[0], name: `${ids.length} conversas` });
    setMarkedContactIds(new Set());
  };

  const handlePinMarked = () => {
    setPinnedContactIds((prev) => {
      const next = new Set(prev);
      const allPinned = Array.from(markedContactIds).every((id) => next.has(id));
      markedContactIds.forEach((id) => {
        if (allPinned) next.delete(id);
        else next.add(id);
      });
      try {
        localStorage.setItem('lora_pinned_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setMarkedContactIds(new Set());
  };

  const handleMuteMarked = () => {
    setMutedContactIds((prev) => {
      const next = new Set(prev);
      const allMuted = Array.from(markedContactIds).every((id) => next.has(id));
      markedContactIds.forEach((id) => {
        if (allMuted) next.delete(id);
        else next.add(id);
      });
      try {
        localStorage.setItem('lora_muted_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
    setMarkedContactIds(new Set());
  };

  const handleClearMessagesMarked = () => {
    markedContactIds.forEach((id) => {
      meshManager.clearConversation(id, selfNode.id);
    });
    setMarkedContactIds(new Set());
  };

  const toggleMarkContact = (contactId: string) => {
    setMarkedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const onPointerDownCard = (contactId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      pointerId: e.pointerId,
    };
    isDraggingHorizontallyRef.current = false;
    suppressClickRef.current = false;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      // Long press detected: mark card and suppress upcoming click
      if (!isDraggingHorizontallyRef.current && pointerStartRef.current) {
        suppressClickRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(35); } catch {}
        }
        toggleMarkContact(contactId);
      }
    }, 380);
  };

  const onPointerMoveCard = (contactId: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    // If vertical movement detected before horizontal drag, cancel long press
    if (Math.abs(dy) > 10 && !isDraggingHorizontallyRef.current) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      return;
    }

    // Horizontal swipe threshold
    if (Math.abs(dx) > 8) {
      isDraggingHorizontallyRef.current = true;
      suppressClickRef.current = true;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      setActiveSwipeId(contactId);
      setSwipeOffset(dx);
    }
  };

  const onPointerUpCard = (contactId: string, contactName?: string, e?: React.PointerEvent<HTMLButtonElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (e && pointerStartRef.current) {
      try {
        if (e.currentTarget.hasPointerCapture(pointerStartRef.current.pointerId)) {
          e.currentTarget.releasePointerCapture(pointerStartRef.current.pointerId);
        }
      } catch {}
    }

    if (isDraggingHorizontallyRef.current && activeSwipeId === contactId) {
      suppressClickRef.current = true;
      if (Math.abs(swipeOffset) >= 90) {
        // Fly out to side and delete
        const exitDirection = swipeOffset > 0 ? 500 : -500;
        setSwipeOffset(exitDirection);
        setTimeout(() => {
          handleDeleteContact(contactId, contactName);
          setActiveSwipeId(null);
          setSwipeOffset(0);
          suppressClickRef.current = false;
        }, 180);
      } else {
        // Return smoothly
        setSwipeOffset(0);
        setTimeout(() => {
          setActiveSwipeId(null);
          suppressClickRef.current = false;
        }, 180);
      }
      isDraggingHorizontallyRef.current = false;
      pointerStartRef.current = null;
      return;
    }

    isDraggingHorizontallyRef.current = false;
    pointerStartRef.current = null;
  };

  const activeContact: MeshNode | undefined = (() => {
    if (!selectedContactId) return undefined;
    const found = nodes.find((n) => n && n.id === selectedContactId);
    if (found) return found;

    // If selectedContactId starts with node_phone_, dynamically create and register node
    if (selectedContactId.startsWith('node_phone_')) {
      const raw = selectedContactId.replace('node_phone_', '');
      const formatted = formatPhoneNumber(raw) || raw;
      const dynamicNode: MeshNode = {
        id: selectedContactId,
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
      meshManager.addNode(dynamicNode);
      return dynamicNode;
    }

    return undefined;
  })();

  // Filter messages for current thread (ignoring internal system announcements)
  const threadPackets = packets.filter((p) => {
    if (!p || p.packetType === 'NODE_ANNOUNCEMENT') return false;
    if (activeContact?.isGroup) {
      return p.toNodeId === 'BROADCAST' || p.channelId === 0;
    }
    const activeId = activeContact?.id;
    const selfId = selfNode?.id;
    if (!activeId || !selfId) return false;

    return (
      (p.fromNodeId === activeId && (p.toNodeId === selfId || p.toNodeId === 'BROADCAST')) ||
      (p.fromNodeId === selfId && p.toNodeId === activeId)
    );
  });

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadPackets.length, selectedContactId]);

  // Voice recording timer
  useEffect(() => {
    if (isRecordingVoice) {
      const start = Date.now();
      recordIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        setRecordSeconds(elapsed);
        if (elapsed >= 10) {
          handleStopAndSendVoice();
        }
      }, 100);
    } else {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      setRecordSeconds(0);
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecordingVoice]);

  // Send Text Message
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !activeContact?.id) return;

    const text = textInput.trim();
    setTextInput('');

    await meshManager.sendPacket({
      toNodeId: activeContact.id,
      channelId: activeContact.isGroup ? 0 : 1,
      packetType: 'TEXT_MSG',
      payloadText: text,
    });
  };

  // Quick Heart Send
  const handleSendHeart = async () => {
    if (!activeContact?.id) return;
    await meshManager.sendPacket({
      toNodeId: activeContact.id,
      channelId: activeContact.isGroup ? 0 : 1,
      packetType: 'TEXT_MSG',
      payloadText: '❤️',
    });
  };

  // Start Voice Recording
  const handleStartVoice = async () => {
    const started = await audioEngine.startRecording((data) => {
      const canvas = canvasWaveRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();

      const sliceWidth = canvas.width / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    });

    if (started) {
      setIsRecordingVoice(true);
    }
  };

  // Stop & Send Voice Burst
  const handleStopAndSendVoice = async () => {
    if (!isRecordingVoice || !activeContact?.id) return;
    setIsRecordingVoice(false);

    const burst = await audioEngine.stopRecording('1200bps');
    if (burst && burst.durationSeconds >= 0.4) {
      await meshManager.sendPacket({
        toNodeId: activeContact.id,
        channelId: activeContact.isGroup ? 0 : 1,
        packetType: 'VOICE_BURST',
        voiceBurst: burst,
        payloadText: `Nota de Voz (${burst.durationSeconds.toFixed(1)}s)`,
      });
    }
  };

  // Cancel Voice Recording
  const handleCancelVoice = () => {
    setIsRecordingVoice(false);
    audioEngine.stopRecording('1200bps');
  };

  // Play voice burst
  const handlePlayVoice = async (burst: AudioVoiceBurst, packetId: string) => {
    if (currentlyPlayingAudioId === packetId) return;
    setCurrentlyPlayingAudioId(packetId);
    try {
      await audioEngine.playVoiceBurst(burst, true);
    } finally {
      setCurrentlyPlayingAudioId(null);
    }
  };

  // Send GPS Coordinates
  const handleSendLocation = async () => {
    if (!activeContact?.id || !selfNode?.gps) return;
    await meshManager.sendPacket({
      toNodeId: activeContact.id,
      channelId: activeContact.isGroup ? 0 : 1,
      packetType: 'LOCATION_PING',
      location: selfNode.gps,
      payloadText: `📍 Localização partilhada`,
    });
  };

  // Copy app link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-w-6xl mx-auto overflow-hidden bg-black text-slate-100 border-x border-slate-900 font-sans">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Conversas List (Design Imagem 8)                             */}
      {/* ========================================================================= */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-slate-900 bg-black shrink-0 relative ${
          selectedContactId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header matching user Image 8 */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Conversas</h1>
          </div>

          <div className="flex items-center gap-1 relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Mais opções"
            >
              <MoreVertical className="w-6 h-6" />
            </button>

            {/* Popup Menu matching user image 1 */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#18181b] border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn text-left">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsSettingsModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Definições</span>
                  </button>

                  <div className="h-px bg-slate-800 my-1" />

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAddContactOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Adicionar por Número</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search Bar matching minimalist dark pill */}
        <div className="px-4 py-3 border-b border-slate-900/60 bg-black">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#2c2c2e] hover:bg-[#323236] focus-within:bg-[#323236] transition-colors rounded-full border border-slate-700/60">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="bg-transparent border-none text-xs text-slate-100 focus:outline-none w-full placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contextual Options Bar when cards are marked */}
        {markedContactIds.size > 0 && (
          <div className="p-2.5 bg-emerald-950/95 border-b border-emerald-500/40 flex items-center justify-between gap-2 shadow-lg backdrop-blur-md animate-fadeIn z-20 sticky top-0">
            <div className="flex items-center gap-1.5 pl-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">
                {markedContactIds.size} {markedContactIds.size === 1 ? 'marcada' : 'marcadas'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePinMarked}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs flex items-center gap-1 transition-colors"
                title="Fixar / Desafixar no topo"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] hidden sm:inline">Fixar</span>
              </button>

              <button
                type="button"
                onClick={handleMuteMarked}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs flex items-center gap-1 transition-colors"
                title="Silenciar / Ativar notificações"
              >
                <BellOff className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] hidden sm:inline">Silenciar</span>
              </button>

              <button
                type="button"
                onClick={handleClearMessagesMarked}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs flex items-center gap-1 transition-colors"
                title="Limpar mensagens da conversa"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] hidden sm:inline">Limpar</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteMarked}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-sm"
                title="Eliminar conversas marcadas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">Eliminar</span>
              </button>

              <button
                type="button"
                onClick={() => setMarkedContactIds(new Set())}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors ml-1"
                title="Desmarcar / Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conversations List matching Image 8 */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/50 relative bg-black">
          {filteredContacts.map((contact) => {
            if (!contact || !contact.id) return null;
            const isSelected = contact.id === selectedContactId;
            const isMarked = markedContactIds.has(contact.id);
            const isPinned = pinnedContactIds.has(contact.id);
            const isMuted = mutedContactIds.has(contact.id);
            const isSwiping = activeSwipeId === contact.id;
            const currentOffset = isSwiping ? swipeOffset : 0;
            const willDelete = Math.abs(currentOffset) >= 90;

            // Last message in thread
            const lastMsg = packets
              .filter(
                (p) =>
                  p &&
                  ((p.fromNodeId === contact.id && (p.toNodeId === selfNode?.id || p.toNodeId === 'BROADCAST')) ||
                  (p.fromNodeId === selfNode?.id && p.toNodeId === contact.id))
              )
              .slice(-1)[0];

            return (
              <button
                key={contact.id}
                type="button"
                onClick={(e) => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  if (markedContactIds.size > 0) {
                    toggleMarkContact(contact.id);
                  } else {
                    handleSelectContact(contact.id);
                  }
                }}
                onPointerDown={(e) => onPointerDownCard(contact.id, e)}
                onPointerMove={(e) => onPointerMoveCard(contact.id, e)}
                onPointerUp={(e) => onPointerUpCard(contact.id, contact.name, e)}
                onPointerCancel={(e) => onPointerUpCard(contact.id, contact.name, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleMarkContact(contact.id);
                }}
                className={`w-full relative overflow-hidden group select-none text-left block focus:outline-none touch-pan-y ${
                  isMarked
                    ? 'ring-2 ring-emerald-500/50 bg-[#062419]'
                    : isSelected
                    ? 'bg-[#111827]'
                    : 'bg-black hover:bg-slate-900/40'
                }`}
              >
                {/* Red Underlay: Revealed when swiping/dragging to either left or right */}
                <div
                  className={`absolute inset-0 flex items-center justify-between px-5 text-white font-bold text-xs pointer-events-none transition-colors ${
                    willDelete ? 'bg-red-700' : 'bg-red-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Trash2 className={`w-4 h-4 ${willDelete ? 'scale-125 transition-transform' : ''}`} />
                    <span className="text-[11px]">{willDelete ? 'Solte para eliminar' : 'Eliminar'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]">{willDelete ? 'Solte para eliminar' : 'Eliminar'}</span>
                    <Trash2 className={`w-4 h-4 ${willDelete ? 'scale-125 transition-transform' : ''}`} />
                  </div>
                </div>

                {/* Foreground Sliding Content matching Image 8 layout */}
                <div
                  style={{
                    transform: `translateX(${currentOffset}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
                  }}
                  className={`relative z-10 w-full px-4 py-3.5 flex items-center gap-3.5 select-none touch-pan-y ${
                    isMarked
                      ? 'border-l-4 border-emerald-500 bg-[#062419]'
                      : isSelected
                      ? 'border-l-2 border-emerald-500 bg-[#111827]'
                      : 'bg-black'
                  }`}
                >
                  {/* Selection Mark Indicator Checkbox */}
                  {markedContactIds.size > 0 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMarkContact(contact.id);
                      }}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isMarked
                          ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                          : 'border border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500'
                      }`}
                      title={isMarked ? 'Desmarcar' : 'Pressione para marcar'}
                    >
                      {isMarked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  )}

                  {/* Large Round Avatar matching Image 8 */}
                  <div className="relative shrink-0">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-md bg-[#18181b]"
                      style={{ backgroundColor: contact.avatarColor || '#18181b' }}
                    >
                      {contact.avatarInitials || (contact.name ? contact.name.slice(0, 2).toUpperCase() : 'C')}
                    </div>
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black" />
                    )}
                    {isPinned && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <Pin className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Content details matching Image 8 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                          {contact.name}
                        </span>
                        {isMuted && <BellOff className="w-3 h-3 text-slate-500 shrink-0" />}
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 font-medium">
                        {lastMsg
                          ? new Date(lastMsg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold mb-0.5">
                      <span>{formatPhoneNumber(contact.phoneNumber || getNodePhoneNumber(contact.id))}</span>
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      {lastMsg ? (
                        lastMsg.packetType === 'VOICE_BURST' ? (
                          <span className="text-emerald-400 font-medium">🎤 Áudio ({lastMsg.voiceBurst?.durationSeconds.toFixed(1)}s)</span>
                        ) : lastMsg.packetType === 'LOCATION_PING' ? (
                          <span className="text-sky-400 font-medium">📍 Localização partilhada</span>
                        ) : (
                          lastMsg.payloadText
                        )
                      ) : (
                        'Toque para conversar'
                      )}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Simple Invitation when alone */}
          {otherContacts.filter((c) => !c.isGroup && !deletedContactIds.has(c.id)).length === 0 && (
            <div className="p-6 m-4 bg-[#18181b] rounded-2xl border border-slate-800 text-center space-y-3">
              <p className="text-sm text-slate-300 font-medium">
                Nenhum colega conectado ainda
              </p>
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                <span>Adicionar por Número 4116</span>
              </button>
            </div>
          )}

          {/* Undo Toast when deleted */}
          {undoToast && (
            <div className="sticky bottom-3 mx-3 p-3 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl flex items-center justify-between text-xs text-white backdrop-blur-md animate-fadeIn z-30">
              <div className="flex items-center gap-2 truncate pr-2">
                <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">{undoToast.name} eliminada</span>
              </div>
              <button
                onClick={handleUndoDelete}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Desfazer</span>
              </button>
            </div>
          )}
        </div>

        {/* Floating Action Button at bottom-right of Conversas (Image 8) */}
        <div className="fixed bottom-20 md:bottom-8 right-6 z-30 pointer-events-auto">
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="w-14 h-14 rounded-full bg-white text-black border-2 border-black hover:bg-slate-100 active:scale-95 shadow-2xl flex items-center justify-center transition-all cursor-pointer"
            title="Nova Conversa / Selecionar Contacto ou Digitar Número"
          >
            <MessageSquarePlus className="w-6 h-6 text-black stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Active User Conversation (Design Imagem 9)                  */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-black relative ${
          !selectedContactId ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}
      >
        {selectedContactId && activeContact ? (
          <>
            {/* Header: Design Imagem 9 */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-900 bg-black z-10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={handleBackToConversationsList}
                  className="p-1.5 -ml-1 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer mr-1"
                  title="Voltar às conversas"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <div
                  onClick={() => !activeContact.isGroup && setContactProfileModalNode(activeContact)}
                  className="relative cursor-pointer shrink-0"
                  title="Ver perfil"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white bg-[#18181b] shadow-sm"
                    style={{ backgroundColor: activeContact.avatarColor || '#18181b' }}
                  >
                    {activeContact.avatarInitials || (activeContact.name ? activeContact.name.slice(0, 2).toUpperCase() : 'C')}
                  </div>
                  {activeContact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black" />
                  )}
                </div>

                <div
                  onClick={() => !activeContact.isGroup && setContactProfileModalNode(activeContact)}
                  className="min-w-0 cursor-pointer"
                >
                  <h2 className="text-base font-bold text-white leading-tight truncate hover:text-emerald-400 transition-colors">
                    {activeContact.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activeContact.isGroup ? (
                      <span className="text-[11px] text-emerald-400 font-medium">Canal Geral LoRa</span>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-400 font-medium flex items-center gap-1">
                        <span>{formatPhoneNumber(activeContact.phoneNumber || getNodePhoneNumber(activeContact.id))}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">Online</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Right Actions matching Image 9 */}
              <div className="flex items-center gap-1 relative">
                {!activeContact.isGroup && (
                  <button
                    onClick={() =>
                      voiceCallService.startCall(
                        activeContact.id,
                        activeContact.name,
                        activeContact.callsign
                      )
                    }
                    className="p-2 text-white hover:text-emerald-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Fazer chamada de voz"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={handleSendLocation}
                  className="p-2 text-white hover:text-sky-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                  title="Partilhar localização GPS"
                >
                  <MapPin className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                  className="p-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                  title="Mais opções da conversa"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu for Active Chat */}
                {isChatMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsChatMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#18181b] border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50 animate-fadeIn text-left">
                      {!activeContact.isGroup && (
                        <button
                          onClick={() => {
                            setIsChatMenuOpen(false);
                            setContactProfileModalNode(activeContact);
                          }}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Ver Perfil</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          handleToggleMuteContact(activeContact.id);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{mutedContactIds.has(activeContact.id) ? 'Ativar Notificações' : 'Silenciar'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          meshManager.clearConversation(activeContact.id, selfNode.id);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>Limpar Mensagens</span>
                      </button>

                      <div className="h-px bg-slate-800 my-1" />

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          handleDeleteContact(activeContact.id, activeContact.name);
                        }}
                        className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar Conversa</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages Feed matching Image 9 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-black">
              {threadPackets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#18181b] border border-slate-800 flex items-center justify-center text-emerald-400 shadow-md">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div className="text-base font-bold text-white">Canal Aberto e Pronto</div>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Envie uma mensagem de texto, grave uma nota de voz ou faça uma chamada com {activeContact.name}.
                  </p>
                </div>
              ) : (
                threadPackets.map((pkt) => {
                  const isMe = pkt.fromNodeId === selfNode.id;
                  const isPlaying = currentlyPlayingAudioId === pkt.id;
                  const isGroup = activeContact?.isGroup;
                  const senderNode = nodes.find((n) => n && n.id === pkt.fromNodeId);
                  const senderDisplayName = senderNode
                    ? senderNode.name
                    : (pkt.fromNodeId === 'group-broadcast' ? 'Canal Geral' : 'Operador');
                  const senderCallsign = senderNode?.callsign;

                  return (
                    <div
                      key={pkt.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                    >
                      {!isMe && isGroup && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-emerald-400">
                            {senderDisplayName}
                          </span>
                          {senderCallsign && (
                            <span className="text-[9px] font-mono text-slate-400 uppercase bg-slate-800/80 px-1 py-0.5 rounded">
                              {senderCallsign}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-end gap-2 max-w-[85%] sm:max-w-md">
                        <div className="relative">
                          {/* Bubble matching Image 9 */}
                          <div
                            onDoubleClick={() => meshManager.toggleLikeMessage(pkt.id)}
                            className={`p-3.5 transition-all select-none ${
                              isMe
                                ? 'bg-[#2c2c2e] hover:bg-[#343438] text-white rounded-2xl rounded-br-xs shadow-md'
                                : 'bg-[#18181b] text-white rounded-2xl rounded-bl-xs shadow-md border border-slate-800/80'
                            }`}
                          >
                            {/* Voice Note */}
                            {pkt.packetType === 'VOICE_BURST' && pkt.voiceBurst ? (
                              <div className="flex items-center gap-3 min-w-[200px]">
                                <button
                                  onClick={() => handlePlayVoice(pkt.voiceBurst!, pkt.id)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                                    isPlaying
                                      ? 'bg-white text-slate-950'
                                      : isMe
                                      ? 'bg-white/20 text-white hover:bg-white/30'
                                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                  }`}
                                >
                                  {isPlaying ? (
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  )}
                                </button>

                                <div className="flex-1">
                                  <div className="h-5 flex items-center gap-0.5">
                                    {pkt.voiceBurst.waveformSamples.map((v, i) => (
                                      <div
                                        key={i}
                                        className={`w-1 rounded-full ${
                                          isMe ? 'bg-white/80' : 'bg-emerald-400'
                                        }`}
                                        style={{ height: `${Math.max(25, v * 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                  <div className="text-[10px] text-white/70 font-mono mt-0.5">
                                    0:0{Math.round(pkt.voiceBurst.durationSeconds)}
                                  </div>
                                </div>
                              </div>
                            ) : pkt.packetType === 'LOCATION_PING' ? (
                              <button
                                onClick={onOpenMap}
                                className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity p-0.5"
                                title="Abrir no Mapa Mesh"
                              >
                                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-white block">Localização Partilhada</span>
                                  <span className="text-[10px] text-sky-400 hover:underline">Ver no Mapa Mesh →</span>
                                </div>
                              </button>
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {pkt.payloadText}
                              </p>
                            )}
                          </div>

                          {/* Heart Badge */}
                          {pkt.likedByMe && (
                            <div className="absolute -bottom-2 right-2 bg-black border border-slate-800 rounded-full px-1.5 py-0.5 shadow-sm flex items-center text-[10px]">
                              <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                            </div>
                          )}
                        </div>

                        {/* Hover Heart button */}
                        <button
                          onClick={() => meshManager.toggleLikeMessage(pkt.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-500 transition-opacity"
                          title="Gostar"
                        >
                          <Heart className={`w-3.5 h-3.5 ${pkt.likedByMe ? 'fill-red-500 text-red-500' : ''}`} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 px-1">
                        <span>
                          {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck className="w-3 h-3 text-emerald-400" />}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar matching Image 9 */}
            <div className="px-4 py-3 bg-black border-t border-slate-900 shrink-0">
              {isRecordingVoice ? (
                /* Recording Mode */
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#18181b] rounded-full border border-red-500/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-red-400 font-bold text-xs">
                    0:0{Math.floor(recordSeconds)}
                  </span>

                  <div className="flex-1 h-6">
                    <canvas ref={canvasWaveRef} width={200} height={24} className="w-full h-full" />
                  </div>

                  <button
                    onClick={handleCancelVoice}
                    className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleStopAndSendVoice}
                    className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
                    title="Enviar áudio"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Text Input Bar matching Image 9 */
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={handleSendLocation}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-sky-400 hover:bg-slate-900 transition-colors shrink-0"
                    title="Enviar localização"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Mensagem..."
                    className="flex-1 bg-[#2c2c2e] hover:bg-[#323236] focus:bg-[#323236] text-white placeholder-slate-400 text-sm px-5 py-3 rounded-full border border-slate-700/60 focus:outline-none focus:border-white transition-all"
                  />

                  {textInput.trim() ? (
                    <button
                      type="submit"
                      className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-full transition-all shrink-0 cursor-pointer shadow-md"
                    >
                      Enviar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleStartVoice}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-slate-900 transition-colors cursor-pointer"
                        title="Gravar áudio"
                      >
                        <Mic className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSendHeart}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-900 transition-colors cursor-pointer"
                        title="Enviar coração"
                      >
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-[#18181b] border border-slate-800 flex items-center justify-center text-emerald-400 shadow-xl">
              <Radio className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Nenhuma conversa selecionada</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Escolha uma conversa na lista à esquerda ou clique no botão circular <strong>"+"</strong> para adicionar um novo contacto.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contact Profile Details Modal (Image 6 design) */}
      {contactProfileModalNode && (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col font-sans select-none animate-fadeIn">
          {/* Top Bar with Back Arrow, Delete, Phone Call */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black">
            <button
              onClick={() => setContactProfileModalNode(null)}
              className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
              title="Voltar à conversa"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleDeleteContact(contactProfileModalNode.id, contactProfileModalNode.name);
                  setContactProfileModalNode(null);
                  handleSelectContact('');
                }}
                className="p-2 text-white hover:text-red-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Eliminar contacto"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  voiceCallService.startCall(
                    contactProfileModalNode.id,
                    contactProfileModalNode.name,
                    contactProfileModalNode.callsign
                  );
                  setContactProfileModalNode(null);
                }}
                className="p-2 text-white hover:text-emerald-400 rounded-full hover:bg-slate-900 transition-colors cursor-pointer"
                title="Fazer chamada de voz"
              >
                <Phone className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Profile Details Body matching Image 6 */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center max-w-sm mx-auto w-full">
            <div
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center font-bold text-6xl sm:text-7xl shadow-2xl mb-8 bg-[#18181b]"
              style={{ backgroundColor: contactProfileModalNode.avatarColor || '#18181b' }}
            >
              {contactProfileModalNode.avatarInitials || contactProfileModalNode.name.slice(0, 2).toUpperCase()}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              {contactProfileModalNode.name}
            </h1>

            <p className="text-xl font-bold tracking-wider font-mono text-slate-200 mb-10">
              {formatPhoneNumber(getNodePhoneNumber(contactProfileModalNode.id))}
            </p>

            {/* Action buttons matching user Image 6 */}
            <div className="flex items-center justify-center gap-6 w-full max-w-xs">
              <button
                onClick={() => {
                  voiceCallService.startCall(
                    contactProfileModalNode.id,
                    contactProfileModalNode.name,
                    contactProfileModalNode.callsign
                  );
                  setContactProfileModalNode(null);
                }}
                className="w-36 py-3.5 bg-[#18181b] hover:bg-slate-900 border border-slate-700/80 active:scale-95 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg"
                title="Fazer chamada"
              >
                <Phone className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={() => {
                  setContactProfileModalNode(null);
                }}
                className="w-36 py-3.5 bg-transparent border-2 border-white hover:bg-white/10 active:scale-95 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg"
                title="Voltar ao chat"
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Perfil Screen Modal matching user image 2 */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userName={selfNode.name}
        avatarColor={selfNode.avatarColor}
        avatarInitials={selfNode.avatarInitials}
        onOpenEditName={() => {
          setIsProfileModalOpen(false);
          onOpenEditName?.();
        }}
      />

      {/* Definições Screen Modal matching user image 3 */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onNavigateToMap={() => onOpenMap?.()}
        bleStatus={bleStatus || bleBridge.getStatus()}
      />

      {/* Add Contact by 8-Digit Number Modal (Image 7) */}
      <AddContactModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
        onAddContact={handleAddNewContact}
        existingNodes={nodes}
      />

      {/* New Chat Modal: Displays existing contacts to start conversation or enter number */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        nodes={nodes}
        onSelectContact={(id) => {
          handleSelectContact(id);
          setIsNewChatModalOpen(false);
        }}
        onOpenRegisterNewContact={() => {
          setIsNewChatModalOpen(false);
          setIsAddContactOpen(true);
        }}
      />
    </div>
  );
};
