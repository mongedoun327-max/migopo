import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Star,
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
import { ConversasIcon } from './ConversasIcon';
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

  // Active contact: controlled by selectedContactId
  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialSelectedContactId || ''
  );

  // Purely compute activeContact with useMemo without side-effects
  const activeContact: MeshNode | undefined = useMemo(() => {
    if (!selectedContactId) return undefined;
    const found = nodes.find((n) => n && n.id === selectedContactId);
    if (found) return found;

    // Check meshManager nodes as well
    const mmFound = meshManager.getNodes().find((n) => n && n.id === selectedContactId);
    if (mmFound) return mmFound;

    // If selectedContactId starts with node_phone_, provide pure fallback representation
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
      return dynamicNode;
    }

    return undefined;
  }, [selectedContactId, nodes]);

  const otherContacts = useMemo(() => {
    const list = [...nodes.filter((n) => n && !n.isSelf)];
    if (activeContact && !list.some((c) => c.id === activeContact.id)) {
      list.push(activeContact);
    }
    return list;
  }, [nodes, activeContact]);

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
  const [isEditingContactName, setIsEditingContactName] = useState(false);
  const [editingContactNameValue, setEditingContactNameValue] = useState('');
  const [favoriteContactIds, setFavoriteContactIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('lora_favorite_contacts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavoriteContact = (nodeId: string) => {
    setFavoriteContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      try {
        localStorage.setItem('lora_favorite_contacts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

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

  // Asynchronously register dynamic phone contacts to meshManager without updating App during render
  useEffect(() => {
    if (selectedContactId && selectedContactId.startsWith('node_phone_')) {
      const exists = nodes.some((n) => n && n.id === selectedContactId);
      if (!exists) {
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
      }
    }
  }, [selectedContactId, nodes]);

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
    <div className="flex h-screen md:h-[calc(100vh-3.5rem)] max-w-6xl mx-auto overflow-hidden bg-white text-black md:border-x md:border-[#EEEEEE] font-sans">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Conversas List (Design adaptado ao SVG)                      */}
      {/* ========================================================================= */}
      <div
        className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-[#EEEEEE] bg-white shrink-0 relative ${
          selectedContactId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Top Header matching SVG Cabeçalho */}
        <div className="pt-6 pb-4 px-5 flex items-center justify-between bg-white shrink-0">
          <h1 className="text-[38px] leading-[44px] font-normal tracking-[-1.3px] text-black select-none">
            Conversas
          </h1>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 rounded-full bg-black flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition-colors shadow-sm"
              title="Mais opções"
            >
              <div className="flex flex-col items-center gap-[3.2px]">
                <span className="w-[3.2px] h-[3.2px] rounded-full bg-white block" />
                <span className="w-[3.2px] h-[3.2px] rounded-full bg-white block" />
                <span className="w-[3.2px] h-[3.2px] rounded-full bg-white block" />
              </div>
            </button>

            {/* Popup Menu */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#EEEEEE] rounded-2xl p-1.5 shadow-xl z-50 animate-fadeIn text-left">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-black hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsSettingsModalOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-black hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span>Definições</span>
                  </button>

                  <div className="h-px bg-[#EEEEEE] my-1" />

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAddContactOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-neutral-50 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Adicionar por Número</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pesquisa rounded pill matching SVG */}
        <div className="px-5 pb-3 bg-white shrink-0">
          <div className="h-[42px] px-4 rounded-full border border-black bg-white flex items-center gap-2.5 transition-shadow">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#707070"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="shrink-0"
            >
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M10.5 10.5 L14.5 14.5" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="bg-transparent border-none text-[13px] text-black focus:outline-none w-full placeholder:text-[#777777]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#777777] hover:text-black p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Contextual Options Bar when cards are marked */}
        {markedContactIds.size > 0 && (
          <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-2 shadow-sm z-20 sticky top-0">
            <div className="flex items-center gap-1.5 pl-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-900">
                {markedContactIds.size} {markedContactIds.size === 1 ? 'marcada' : 'marcadas'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePinMarked}
                className="px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-black border border-slate-200 text-xs flex items-center gap-1 transition-colors"
                title="Fixar / Desafixar no topo"
              >
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] hidden sm:inline">Fixar</span>
              </button>

              <button
                type="button"
                onClick={handleMuteMarked}
                className="px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-black border border-slate-200 text-xs flex items-center gap-1 transition-colors"
                title="Silenciar / Ativar notificações"
              >
                <BellOff className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[11px] hidden sm:inline">Silenciar</span>
              </button>

              <button
                type="button"
                onClick={handleClearMessagesMarked}
                className="px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-black border border-slate-200 text-xs flex items-center gap-1 transition-colors"
                title="Limpar mensagens da conversa"
              >
                <Eraser className="w-3.5 h-3.5 text-slate-500" />
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
                className="p-1 text-slate-400 hover:text-black rounded-lg hover:bg-slate-100 transition-colors ml-1"
                title="Desmarcar / Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conversations List matching SVG */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          {filteredContacts.map((contact) => {
            if (!contact || !contact.id) return null;
            const isSelected = contact.id === selectedContactId;
            const isMarked = markedContactIds.has(contact.id);
            const isPinned = pinnedContactIds.has(contact.id);
            const isMuted = mutedContactIds.has(contact.id);
            const isSwiping = activeSwipeId === contact.id;
            const currentOffset = isSwiping ? swipeOffset : 0;
            const willDelete = Math.abs(currentOffset) >= 90;

            const isCanalGeral = contact.id === 'group-broadcast' || contact.isGroup;

            // Last message in thread
            const lastMsg = packets
              .filter(
                (p) =>
                  p &&
                  ((p.fromNodeId === contact.id && (p.toNodeId === selfNode?.id || p.toNodeId === 'BROADCAST')) ||
                  (p.fromNodeId === selfNode?.id && p.toNodeId === contact.id))
              )
              .slice(-1)[0];

            const hasHeart = isCanalGeral || lastMsg?.likedByMe;
            const timeDisplay = lastMsg
              ? new Date(lastMsg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : isCanalGeral
              ? '16:59'
              : '22:49';

            const phoneFormatted = formatPhoneNumber(
              contact.phoneNumber || getNodePhoneNumber(contact.id)
            );

            return (
              <div key={contact.id} className="relative">
                <button
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
                      ? 'bg-emerald-50'
                      : isSelected
                      ? 'bg-neutral-100'
                      : 'bg-white hover:bg-neutral-50/80 transition-colors'
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

                  {/* Foreground Sliding Content */}
                  <div
                    style={{
                      transform: `translateX(${currentOffset}px)`,
                      transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
                    }}
                    className={`relative z-10 w-full px-5 py-3.5 flex items-center gap-3.5 select-none touch-pan-y ${
                      isMarked ? 'bg-emerald-50' : isSelected ? 'bg-neutral-100' : 'bg-white'
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
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'border border-slate-300 opacity-60 hover:opacity-100'
                        }`}
                        title={isMarked ? 'Desmarcar' : 'Pressione para marcar'}
                      >
                        {isMarked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    )}

                    {/* Avatar Circle matching SVG */}
                    <div className="relative shrink-0 w-14 h-14">
                      {isCanalGeral ? (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-black shadow-xs select-none"
                          style={{
                            background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                          }}
                        >
                          CG
                        </div>
                      ) : (
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-xs select-none"
                          style={{
                            backgroundColor: contact.avatarColor === '#10b981' ? '#000000' : (contact.avatarColor || '#000000'),
                          }}
                        >
                          {contact.avatarInitials || (contact.name ? contact.name.slice(0, 2).toUpperCase() : 'C')}
                        </div>
                      )}

                      {/* Indicador de áudio no topo direito (ex. Canal Geral) */}
                      {isCanalGeral && (
                        <div
                          className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-[#FFC58F] border-2 border-white flex items-center justify-center shadow-xs"
                          title="Indicador de áudio"
                        >
                          <svg
                            width="9"
                            height="11"
                            viewBox="67 135 8 12"
                            fill="none"
                            stroke="#000000"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="69.5" y="136" width="3" height="5" rx="1.5" />
                            <path d="M67.8 139.5 V140.4 A3.2 3.2 0 0 0 74.2 140.4 V139.5 M71 143.6 V146 M69 146 H73" />
                          </svg>
                        </div>
                      )}

                      {/* Presença (green dot) na base direita */}
                      {contact.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-[13px] h-[13px] rounded-full bg-[#00B98B] border-2 border-white" />
                      )}

                      {/* Pinned badge */}
                      {isPinned && !isCanalGeral && (
                        <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xs">
                          <Pin className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Content details matching SVG */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-base font-semibold text-black truncate leading-tight">
                            {contact.name}
                          </span>
                          {isMuted && <BellOff className="w-3.5 h-3.5 text-[#929292] shrink-0" />}
                        </div>
                        <span className="text-[11px] text-[#777777] shrink-0 font-normal ml-2">
                          {timeDisplay}
                        </span>
                      </div>

                      <div className="text-xs text-[#666666] font-normal mb-1 font-mono tracking-tight">
                        {phoneFormatted}
                      </div>

                      <div className="flex items-center gap-1.5 min-h-[18px]">
                        {hasHeart && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="90 180 16 16"
                            fill="#E94658"
                            className="inline-block shrink-0"
                          >
                            <path d="M98 186 C95 182 91 184 92 187 C93 190 98 193 98 193 C98 193 103 190 104 187 C105 184 101 182 98 186Z" />
                          </svg>
                        )}
                        <p className="text-[13px] text-[#777777] truncate font-normal leading-normal">
                          {lastMsg ? (
                            lastMsg.packetType === 'VOICE_BURST' ? (
                              <span>Áudio ({lastMsg.voiceBurst?.durationSeconds.toFixed(1)}s)</span>
                            ) : lastMsg.packetType === 'LOCATION_PING' ? (
                              <span>📍 Localização partilhada</span>
                            ) : (
                              lastMsg.payloadText
                            )
                          ) : isCanalGeral ? (
                            ''
                          ) : (
                            'oi'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Indented Divider matching SVG <path d="M92 211 H334" stroke="#EEEEEE" stroke-width="1"/> */}
                <div className="ml-[88px] mr-5 h-px bg-[#EEEEEE]" />
              </div>
            );
          })}

          {/* Simple Invitation when alone */}
          {otherContacts.filter((c) => !c.isGroup && !deletedContactIds.has(c.id)).length === 0 && (
            <div className="p-6 m-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-center space-y-3">
              <p className="text-sm text-neutral-600 font-medium">
                Nenhum colega conectado ainda
              </p>
              <button
                onClick={() => setIsAddContactOpen(true)}
                className="w-full py-2.5 px-4 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Adicionar por Número 4116</span>
              </button>
            </div>
          )}

          {/* Undo Toast when deleted */}
          {undoToast && (
            <div className="sticky bottom-3 mx-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex items-center justify-between text-xs text-white backdrop-blur-md animate-fadeIn z-30">
              <div className="flex items-center gap-2 truncate pr-2">
                <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">{undoToast.name} eliminada</span>
              </div>
              <button
                onClick={handleUndoDelete}
                className="px-3 py-1 bg-white hover:bg-neutral-100 text-black font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Desfazer</span>
              </button>
            </div>
          )}
        </div>

        {/* Floating Action Button at bottom-right of Conversas (matching SVG Nova conversa) */}
        <div className="fixed bottom-20 md:bottom-8 right-6 z-30 pointer-events-auto">
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="w-[60px] h-[60px] rounded-full bg-black text-white hover:bg-neutral-800 active:scale-95 shadow-[0_5px_14px_rgba(0,0,0,0.18)] flex items-center justify-center transition-all cursor-pointer"
            title="Nova conversa"
          >
            <svg
              width="24"
              height="24"
              viewBox="293 544 24 25"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M295 546 H313 A2 2 0 0 1 315 548 V560 A2 2 0 0 1 313 562 H301 L294 567 V548 A2 2 0 0 1 296 546Z" />
              <path d="M300 554 H309 M304.5 549.5 V558.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Active User Conversation                                    */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-white relative ${
          !selectedContactId ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}
      >
        {selectedContactId && activeContact ? (
          <>
            {/* Header: Design Limpo Preto e Branco */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#EEEEEE] bg-white z-10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBackToConversationsList();
                  }}
                  className="p-1.5 -ml-1 text-black hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer mr-1 shrink-0"
                  title="Voltar às conversas"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <div
                  onClick={() => setContactProfileModalNode(activeContact)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer group select-none"
                  title="Ver detalhes do contacto"
                >
                  <div className="relative shrink-0">
                    {activeContact.isGroup || activeContact.id === 'group-broadcast' ? (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-black shadow-xs group-hover:scale-105 transition-transform"
                        style={{
                          background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                        }}
                      >
                        CG
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor:
                            activeContact.avatarColor === '#10b981'
                              ? '#000000'
                              : activeContact.avatarColor || '#000000',
                        }}
                      >
                        {activeContact.avatarInitials ||
                          (activeContact.name ? activeContact.name.slice(0, 2).toUpperCase() : 'C')}
                      </div>
                    )}
                    {activeContact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00B98B] border-2 border-white" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-black leading-tight truncate group-hover:text-neutral-700 transition-colors">
                      {activeContact.name}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {activeContact.isGroup ? (
                        <span className="text-[11px] text-[#666666] font-medium">Canal Geral LoRa</span>
                      ) : (
                        <span className="text-[11px] font-mono text-[#666666] font-medium flex items-center gap-1">
                          <span>{formatPhoneNumber(activeContact.phoneNumber || getNodePhoneNumber(activeContact.id))}</span>
                          <span className="text-neutral-400">•</span>
                          <span className="text-[#00B98B]">Online</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-1 relative">
                {!activeContact.isGroup && (
                  <button
                    onClick={() =>
                      voiceCallService.startCall(
                        activeContact.id,
                        activeContact.name,
                        activeContact.callsign,
                        activeContact.phoneNumber || getNodePhoneNumber(activeContact.id),
                        activeContact
                      )
                    }
                    className="p-2 text-black hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                    title="Fazer chamada de voz"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                  className="p-2 text-black hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
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
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-[#EEEEEE] rounded-2xl p-1.5 shadow-xl z-50 animate-fadeIn text-left">
                      {!activeContact.isGroup && (
                        <button
                          onClick={() => {
                            setIsChatMenuOpen(false);
                            setContactProfileModalNode(activeContact);
                          }}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-black hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Ver Perfil</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          handleToggleMuteContact(activeContact.id);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-black hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{mutedContactIds.has(activeContact.id) ? 'Ativar Notificações' : 'Silenciar'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          meshManager.clearConversation(activeContact.id, selfNode.id);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-black hover:bg-neutral-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>Limpar Mensagens</span>
                      </button>

                      <div className="h-px bg-[#EEEEEE] my-1" />

                      <button
                        onClick={() => {
                          setIsChatMenuOpen(false);
                          handleDeleteContact(activeContact.id, activeContact.name);
                        }}
                        className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar Conversa</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#F8F9FA]">
              {threadPackets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black shadow-xs">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div className="text-base font-bold text-black">Canal Aberto e Pronto</div>
                  <p className="text-xs text-[#777777] max-w-xs leading-relaxed">
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
                          <span className="text-[11px] font-semibold text-black">
                            {senderDisplayName}
                          </span>
                          {senderCallsign && (
                            <span className="text-[9px] font-mono text-[#666666] uppercase bg-neutral-200 px-1 py-0.5 rounded">
                              {senderCallsign}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-end gap-2 max-w-[85%] sm:max-w-md">
                        <div className="relative">
                          {/* Bubble */}
                          <div
                            onDoubleClick={() => meshManager.toggleLikeMessage(pkt.id)}
                            className={`p-3.5 transition-all select-none ${
                              isMe
                                ? 'bg-black text-white rounded-2xl rounded-br-xs shadow-xs'
                                : 'bg-white text-black rounded-2xl rounded-bl-xs shadow-xs border border-[#EEEEEE]'
                            }`}
                          >
                            {/* Voice Note */}
                            {pkt.packetType === 'VOICE_BURST' && pkt.voiceBurst ? (
                              <div className="flex items-center gap-3 min-w-[200px]">
                                <button
                                  onClick={() => handlePlayVoice(pkt.voiceBurst!, pkt.id)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
                                    isPlaying
                                      ? isMe
                                        ? 'bg-white text-black'
                                        : 'bg-black text-white'
                                      : isMe
                                      ? 'bg-white/20 text-white hover:bg-white/30'
                                      : 'bg-black text-white hover:bg-neutral-800'
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
                                          isMe ? 'bg-white/80' : 'bg-black'
                                        }`}
                                        style={{ height: `${Math.max(25, v * 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                  <div
                                    className={`text-[10px] font-mono mt-0.5 ${
                                      isMe ? 'text-white/70' : 'text-[#777777]'
                                    }`}
                                  >
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
                                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className={`text-xs font-semibold block ${isMe ? 'text-white' : 'text-black'}`}>
                                    Localização Partilhada
                                  </span>
                                  <span className="text-[10px] text-sky-500 hover:underline">
                                    Ver no Mapa Mesh →
                                  </span>
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
                            <div className="absolute -bottom-2 right-2 bg-white border border-[#EEEEEE] rounded-full px-1.5 py-0.5 shadow-xs flex items-center text-[10px]">
                              <Heart className="w-3 h-3 fill-[#E94658] text-[#E94658]" />
                            </div>
                          )}
                        </div>

                        {/* Hover Heart button */}
                        <button
                          onClick={() => meshManager.toggleLikeMessage(pkt.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#777777] hover:text-[#E94658] transition-opacity cursor-pointer"
                          title="Gostar"
                        >
                          <Heart className={`w-3.5 h-3.5 ${pkt.likedByMe ? 'fill-[#E94658] text-[#E94658]' : ''}`} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-[#777777] mt-1 px-1">
                        <span>
                          {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck className="w-3 h-3 text-[#00B98B]" />}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="px-4 py-3 bg-white border-t border-[#EEEEEE] shrink-0">
              {isRecordingVoice ? (
                /* Recording Mode */
                <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-50 rounded-full border border-red-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-red-600 font-bold text-xs">
                    0:0{Math.floor(recordSeconds)}
                  </span>

                  <div className="flex-1 h-6">
                    <canvas ref={canvasWaveRef} width={200} height={24} className="w-full h-full" />
                  </div>

                  <button
                    onClick={handleCancelVoice}
                    className="text-xs text-neutral-500 hover:text-black font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleStopAndSendVoice}
                    className="w-8 h-8 rounded-full bg-black text-white hover:bg-neutral-800 flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
                    title="Enviar áudio"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Text Input Bar */
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2"
                >
                  <button
                    type="button"
                    onClick={handleSendLocation}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#777777] hover:text-sky-600 hover:bg-neutral-100 transition-colors shrink-0 cursor-pointer"
                    title="Enviar localização"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Mensagem..."
                    className="flex-1 bg-[#F4F4F5] hover:bg-[#EFEFEF] focus:bg-white text-black placeholder-[#777777] text-sm px-5 py-3 rounded-full border border-neutral-200 focus:outline-none focus:border-black transition-all"
                  />

                  {textInput.trim() ? (
                    <button
                      type="submit"
                      className="px-5 py-3 bg-black hover:bg-neutral-800 active:scale-95 text-white font-bold text-xs rounded-full transition-all shrink-0 cursor-pointer shadow-sm"
                    >
                      Enviar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleStartVoice}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[#777777] hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
                        title="Gravar áudio"
                      >
                        <Mic className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSendHeart}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[#777777] hover:text-[#E94658] hover:bg-neutral-100 transition-colors cursor-pointer"
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
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-black shadow-xs">
              <ConversasIcon className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-black">Nenhuma conversa selecionada</h3>
              <p className="text-xs text-[#777777] leading-relaxed">
                Escolha uma conversa na lista à esquerda ou clique no botão circular <strong>"+"</strong> para iniciar uma nova conversa.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contact Profile Details View ("Perfil do contato" matching perfil-contato.svg) */}
      {contactProfileModalNode && (
        <div className="fixed inset-0 z-50 bg-white text-black flex flex-col font-sans select-none animate-fadeIn justify-between pb-8">
          <div>
            {/* Top Bar with Back Arrow, Delete, Star, Edit Pencil matching perfil-contato.svg */}
            <div className="h-[58px] px-5 flex items-center justify-between border-b border-[#EEEEEE] bg-white">
              <button
                onClick={() => {
                  setContactProfileModalNode(null);
                  setIsEditingContactName(false);
                }}
                className="p-1 -ml-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
                title="Voltar ao chat"
              >
                <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                  <path d="M34 20 H18 M18 20 L25 13 M18 20 L25 27" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {!contactProfileModalNode.isGroup && contactProfileModalNode.id !== 'group-broadcast' && (
                <div className="flex items-center gap-4">
                  {/* Excluir (Lixeira matching SVG) */}
                  <button
                    onClick={() => {
                      handleDeleteContact(contactProfileModalNode.id, contactProfileModalNode.name);
                      setContactProfileModalNode(null);
                      handleSelectContact('');
                    }}
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
                    onClick={() => toggleFavoriteContact(contactProfileModalNode.id)}
                    className="p-1 text-black transition-colors cursor-pointer"
                    title={favoriteContactIds.has(contactProfileModalNode.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <svg width="24" height="24" viewBox="285 17 26 25" fill={favoriteContactIds.has(contactProfileModalNode.id) ? '#000000' : 'none'} stroke="#000000" strokeWidth="1.8" strokeLinejoin="round">
                      <path d="M298 19 L301 26 L309 27 L303 32 L305 40 L298 36 L291 40 L293 32 L287 27 L295 26 Z" />
                    </svg>
                  </button>

                  {/* Editar (Lápis matching SVG) */}
                  <button
                    onClick={() => {
                      setEditingContactNameValue(contactProfileModalNode.name);
                      setIsEditingContactName(!isEditingContactName);
                    }}
                    className="p-1 -mr-1 text-black hover:opacity-70 transition-opacity cursor-pointer"
                    title="Editar contato"
                  >
                    <svg width="22" height="22" viewBox="326 17 23 23" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinejoin="round">
                      <path d="M333 37 L347 23 L343 19 L329 33 L328 38 Z M340 22 L344 26" />
                    </svg>
                  </button>
                </div>
              )}
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
                  {contactProfileModalNode.isGroup || contactProfileModalNode.id === 'group-broadcast'
                    ? 'CG'
                    : contactProfileModalNode.avatarInitials || contactProfileModalNode.name.slice(0, 2).toUpperCase()}
                </div>
              </div>

              {/* Contact Name (24px, font-weight 600) */}
              {isEditingContactName ? (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={editingContactNameValue}
                    onChange={(e) => setEditingContactNameValue(e.target.value)}
                    autoFocus
                    className="bg-neutral-100 border border-neutral-300 rounded-xl px-4 py-1.5 text-xl font-bold text-black text-center focus:outline-none focus:border-black"
                  />
                  <button
                    onClick={() => {
                      if (editingContactNameValue.trim()) {
                        const updated = { ...contactProfileModalNode, name: editingContactNameValue.trim() };
                        meshManager.addNode(updated);
                        setContactProfileModalNode(updated);
                      }
                      setIsEditingContactName(false);
                    }}
                    className="p-2 rounded-xl bg-black text-white font-bold hover:bg-neutral-800 cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <h1 className="text-[24px] font-semibold text-black tracking-tight mb-2">
                  {contactProfileModalNode.name}
                </h1>
              )}

              {/* 8-Digit Phone Number (21px, font-weight 600, tracking-wide) */}
              <p className="text-[21px] font-semibold tracking-wider text-black font-mono">
                {formatPhoneNumber(
                  contactProfileModalNode.phoneNumber || getNodePhoneNumber(contactProfileModalNode.id)
                )}
              </p>

              {contactProfileModalNode.isGroup && (
                <p className="text-xs text-[#777777] mt-3 max-w-xs mx-auto">
                  Canal público aberto irradiado para todos os nós LoRa na frequência local.
                </p>
              )}
            </div>
          </div>

          {/* Two Prominent Action Buttons matching perfil-contato.svg (144x52, rx=26) */}
          <div className="flex items-center justify-center gap-6 px-5 mt-10">
            {/* Ligar: Black pill with phone icon */}
            <button
              onClick={() => {
                const phone = contactProfileModalNode.phoneNumber || getNodePhoneNumber(contactProfileModalNode.id);
                voiceCallService.startCall(
                  contactProfileModalNode.id,
                  contactProfileModalNode.name,
                  contactProfileModalNode.callsign,
                  phone,
                  contactProfileModalNode
                );
                setContactProfileModalNode(null);
              }}
              className="w-[144px] h-[52px] rounded-[26px] bg-black text-white flex items-center justify-center hover:bg-neutral-800 active:scale-95 transition-all shadow-md cursor-pointer"
              title="Fazer chamada de voz"
            >
              <svg width="26" height="26" viewBox="38 522 36 36" fill="none">
                <path
                  d="M40 527 C40 524.5 42.3 523 44.7 523.8 L50 526 L52.2 533 L48.3 535.7 C50.9 541 55.2 545.3 60.5 547.9 L63.2 544 L70.2 546.2 L72.4 551.4 C73.4 553.8 71.7 556 69.1 556 C53.9 555.1 41 542.3 40 527Z"
                  fill="#FFFFFF"
                />
              </svg>
            </button>

            {/* Mensagem: White pill with black stroke and message icon */}
            <button
              onClick={() => {
                handleSelectContact(contactProfileModalNode.id);
                setContactProfileModalNode(null);
              }}
              className="w-[144px] h-[52px] rounded-[26px] bg-white border border-[#000000] text-black flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Voltar ao chat"
            >
              <svg width="26" height="26" viewBox="194 522 36 36" fill="none">
                <path
                  d="M198 528 H222 A3 3 0 0 1 225 531 V543 A3 3 0 0 1 222 546 H208 L198 554 V546 A3 3 0 0 1 195 543 V531 A3 3 0 0 1 198 528Z"
                  fill="#000000"
                />
              </svg>
            </button>
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
