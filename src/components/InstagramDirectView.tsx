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
} from 'lucide-react';
import { MeshNode, MeshPacket, AudioVoiceBurst } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';
import { audioEngine } from '../services/audioCodec';
import { voiceCallService } from '../services/voiceCallService';

interface InstagramDirectViewProps {
  nodes: MeshNode[];
  packets: MeshPacket[];
  initialSelectedContactId?: string;
  onOpenHardwareTools?: () => void;
  onOpenMap?: () => void;
  onOpenEditName?: () => void;
  onOpenProfileRegistration?: () => void;
}

export const InstagramDirectView: React.FC<InstagramDirectViewProps> = ({
  nodes,
  packets,
  initialSelectedContactId,
  onOpenHardwareTools,
  onOpenMap,
  onOpenEditName,
  onOpenProfileRegistration,
}) => {
  // Safe fallback self node
  const fallbackSelfNode: MeshNode = {
    id: 'node-self',
    name: 'Eu',
    username: 'utilizador',
    callsign: 'EU',
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

  // Default active contact: initialSelectedContactId or group-broadcast or first contact
  const [selectedContactId, setSelectedContactId] = useState<string>(
    initialSelectedContactId || 'group-broadcast'
  );

  useEffect(() => {
    if (initialSelectedContactId) {
      setSelectedContactId(initialSelectedContactId);
    }
  }, [initialSelectedContactId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [currentlyPlayingAudioId, setCurrentlyPlayingAudioId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const canvasWaveRef = useRef<HTMLCanvasElement | null>(null);

  // Filter contacts by search query
  const filteredContacts = otherContacts.filter((c) => {
    if (!c) return false;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q))
    );
  });

  const activeContact: MeshNode | undefined =
    (selectedContactId ? nodes.find((n) => n && n.id === selectedContactId) : undefined) ||
    otherContacts[0] ||
    nodes.find((n) => n && n.id === 'group-broadcast') ||
    nodes[0] ||
    undefined;

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
    <div className="flex h-[calc(100vh-3.5rem)] max-w-6xl mx-auto overflow-hidden bg-slate-950 text-slate-100 border-x border-slate-900 font-sans">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Clean Contacts List (WhatsApp / Instagram style)            */}
      {/* ========================================================================= */}
      <div
        className={`w-full md:w-80 lg:w-88 flex flex-col border-r border-slate-900 bg-slate-950 shrink-0 ${
          selectedContactId && 'hidden md:flex'
        }`}
      >
        {/* Simple Top Bar */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-900">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-white">Conversas</h1>
            <button
              onClick={onOpenEditName || onOpenProfileRegistration}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Clique para alterar o seu nome diretamente"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate max-w-[120px]">
                {selfNode.name}
              </span>
              <Pencil className="w-3 h-3 text-slate-500 hover:text-emerald-400 shrink-0" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyLink}
              className="p-2 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-1.5"
              title="Copiar link para convidar amigo"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-[11px] font-medium hidden sm:inline">
                {copiedLink ? 'Link Copiado!' : 'Convidar Amigo'}
              </span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-900/60">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-800 text-slate-400">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/40">
          {filteredContacts.map((contact) => {
            if (!contact || !contact.id) return null;
            const isSelected = contact.id === selectedContactId;

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
                onClick={() => setSelectedContactId(contact.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left ${
                  isSelected
                    ? 'bg-slate-900 border-l-2 border-emerald-500'
                    : 'hover:bg-slate-900/50'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                    style={{ backgroundColor: contact.avatarColor || '#10b981' }}
                  >
                    {contact.avatarInitials || (contact.name ? contact.name.slice(0, 2).toUpperCase() : 'C')}
                  </div>
                  {contact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-white truncate">
                      {contact.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lastMsg
                        ? new Date(lastMsg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 truncate">
                    {lastMsg ? (
                      lastMsg.packetType === 'VOICE_BURST' ? (
                        <span className="text-emerald-400 font-medium">🎤 Áudio ({lastMsg.voiceBurst?.durationSeconds.toFixed(1)}s)</span>
                      ) : (
                        lastMsg.payloadText
                      )
                    ) : (
                      'Toque para conversar'
                    )}
                  </p>
                </div>
              </button>
            );
          })}

          {/* Simple Invitation when alone */}
          {otherContacts.filter((c) => !c.isGroup).length === 0 && (
            <div className="p-4 m-3 bg-slate-900/30 rounded-xl border border-slate-800/80 text-center space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                Nenhum colega conectado ainda
              </p>
              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link para Amigo'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Clean, Simple Chat Area                                     */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-slate-950 relative ${
          !selectedContactId ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}
      >
        {selectedContactId && activeContact ? (
          <>
            {/* Header: Just Name and Status */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-900 bg-slate-950 z-10 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedContactId('')}
                  className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white"
                    style={{ backgroundColor: activeContact.avatarColor || '#10b981' }}
                  >
                    {activeContact.avatarInitials || (activeContact.name ? activeContact.name.slice(0, 2).toUpperCase() : 'C')}
                  </div>
                  {activeContact.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-white leading-tight">
                    {activeContact.name}
                  </h2>
                  <p className="text-[11px] text-emerald-400">
                    {activeContact.isGroup ? 'Canal Geral' : 'Online'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!activeContact.isGroup && (
                  <>
                    <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-emerald-400 font-medium">
                      <Signal className="w-3 h-3 text-emerald-400" />
                      <span>Sinal Forte HD</span>
                    </div>

                    <button
                      onClick={() =>
                        voiceCallService.startCall(
                          activeContact.id,
                          activeContact.name,
                          activeContact.callsign
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full font-bold text-xs transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                      title="Fazer Chamada de Voz Direta (Sinal Forte HD)"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Chamada de Voz</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleSendLocation}
                  className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-900 rounded-full transition-colors"
                  title="Enviar Localização"
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {threadPackets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shadow-md">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-white">Canal Aberto</div>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Envie uma mensagem de texto, grave uma nota de voz ou partilhe a sua localização com {activeContact.name}.
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
                          {/* Bubble */}
                          <div
                            onDoubleClick={() => meshManager.toggleLikeMessage(pkt.id)}
                            className={`p-3 transition-all select-none ${
                              isMe
                                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-xs shadow-sm'
                                : 'bg-slate-900 text-slate-100 rounded-2xl rounded-bl-xs shadow-sm border border-slate-800/80'
                            }`}
                          >
                            {/* Voice Note */}
                            {pkt.packetType === 'VOICE_BURST' && pkt.voiceBurst ? (
                              <div className="flex items-center gap-3 min-w-[190px]">
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
                                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
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
                            <div className="absolute -bottom-2 right-2 bg-slate-950 border border-slate-800 rounded-full px-1.5 py-0.5 shadow-sm flex items-center text-[10px]">
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

                      <span className="text-[10px] text-slate-500 mt-1 px-1">
                        {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="px-4 py-3 bg-slate-950 border-t border-slate-900 shrink-0">
              {isRecordingVoice ? (
                /* Recording Mode */
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 rounded-full border border-red-500/40">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-mono text-red-400 font-bold text-xs">
                    0:0{Math.floor(recordSeconds)}
                  </span>

                  <div className="flex-1 h-6">
                    <canvas ref={canvasWaveRef} width={200} height={24} className="w-full h-full" />
                  </div>

                  <button
                    onClick={handleCancelVoice}
                    className="text-xs text-slate-400 hover:text-white font-medium"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleStopAndSendVoice}
                    className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
                    title="Enviar áudio"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Text Input Bar */
                <form
                  onSubmit={handleSendText}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full border border-slate-800 focus-within:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={handleSendLocation}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-sky-400 transition-colors"
                    title="Enviar localização"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Mensagem..."
                    className="flex-1 bg-transparent border-none text-xs text-slate-100 focus:outline-none placeholder:text-slate-500"
                  />

                  {textInput.trim() ? (
                    <button
                      type="submit"
                      className="px-3.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-full transition-colors"
                    >
                      Enviar
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleStartVoice}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Gravar áudio"
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSendHeart}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                        title="Enviar coração"
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shadow-xl">
              <Radio className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Nenhuma conversa selecionada</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Escolha uma pessoa na lista à esquerda ou clique em <strong>"+"</strong> para adicionar um novo contacto.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
