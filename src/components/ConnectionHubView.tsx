import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Settings,
  Globe,
  Wifi,
  WifiOff,
  ShieldCheck,
  ChevronRight,
  Battery,
  Signal,
  ArrowRight,
  Zap,
  Users,
  MessageSquare,
  MapPin,
  Check,
} from 'lucide-react';
import { BleDeviceStatus, MeshNode, UserRegistration } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';
import { bleBridge } from '../services/bleBridge';
import { audioEngine } from '../services/audioCodec';

interface ConnectionHubViewProps {
  bleStatus: BleDeviceStatus;
  nodes: MeshNode[];
  myProfile: UserRegistration;
  onOpenSettings: () => void;
  onOpenMessages: () => void;
  onOpenMap: () => void;
  onOpenProfile: () => void;
}

export const ConnectionHubView: React.FC<ConnectionHubViewProps> = ({
  bleStatus,
  nodes,
  myProfile,
  onOpenSettings,
  onOpenMessages,
  onOpenMap,
  onOpenProfile,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [sliderProgress, setSliderProgress] = useState<number>(0);
  const [channelModalOpen, setChannelModalOpen] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('Canal Geral #Todos');
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);

  const activeNodesCount = nodes.filter((n) => !n.isSelf && n.id !== 'group-broadcast').length;

  const channelsList = [
    { id: 'general', name: 'Canal Geral #Todos', freq: '868.100 MHz', desc: 'Frequência aberta para todos os operadores' },
    { id: 'tactical', name: 'Canal Tático #Privado', freq: '868.300 MHz', desc: 'Cifrado com chave AES-256 militar' },
    { id: 'emergency', name: 'Canal Emergência #SOS', freq: '868.500 MHz', desc: 'Canal prioritário de alerta e resgate' },
  ];

  // Handle slide to connect / disconnect
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsSliding(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSliding || !sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const maxTrack = rect.width - 56; // handle width
    const progress = Math.max(0, Math.min(1, currentX / maxTrack));
    setSliderProgress(progress);

    if (progress >= 0.85) {
      // Toggle connection
      toggleConnection();
      setIsSliding(false);
      setSliderProgress(0);
    }
  };

  const handlePointerUp = () => {
    setIsSliding(false);
    setSliderProgress(0);
  };

  const toggleConnection = () => {
    const nextState = !isConnected;
    setIsConnected(nextState);
    audioEngine.playRadioSquelch(nextState ? 'intro' : 'outro');
    if (nextState) {
      meshManager.syncSelfNodeToServer();
      meshManager.broadcastNodeAnnouncement();
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between max-w-md mx-auto px-5 py-6 select-none">
      {/* Top Bar Logo & Status */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {/* Custom Sleek Logo Mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
            <Radio className="w-4 h-4 text-slate-950" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">
            LoRa<span className="text-amber-400">Mesh</span>
          </span>
        </div>

        {/* Top-Right Quick Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Signal className="w-3.5 h-3.5 text-emerald-400" />
            <span>-58 dBm</span>
          </div>

          <button
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-300 hover:border-amber-400 transition-colors"
            title="Perfil do Operador"
          >
            {myProfile.name.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      {/* Center Zone: Luminous Breathing Sphere */}
      <div className="flex flex-col items-center justify-center my-auto py-8">
        <div className="relative flex items-center justify-center">
          {/* Outer Pulse Rings when connected */}
          {isConnected && (
            <>
              <div className="absolute w-72 h-72 rounded-full border border-amber-500/20 animate-ping opacity-30" />
              <div className="absolute w-84 h-84 rounded-full border border-rose-500/10 animate-pulse" />
            </>
          )}

          {/* Glowing Luminous Orb (Inspired by Psiphon Screen 3) */}
          <div
            onClick={toggleConnection}
            className={`w-56 h-56 rounded-full cursor-pointer transition-all duration-700 shadow-2xl relative flex items-center justify-center ${
              isConnected
                ? 'bg-gradient-to-tr from-amber-400 via-rose-300 to-sky-300 shadow-amber-500/40 hover:scale-105 active:scale-95'
                : 'bg-gradient-to-tr from-slate-700 via-slate-600 to-slate-800 opacity-60 shadow-slate-900/60'
            }`}
            style={{
              background: isConnected
                ? 'radial-gradient(circle at 35% 35%, #fed7aa 0%, #fb923c 45%, #93c5fd 100%)'
                : 'radial-gradient(circle at 35% 35%, #64748b 0%, #334155 60%, #1e293b 100%)',
              filter: isConnected ? 'drop-shadow(0 0 45px rgba(251, 146, 60, 0.45))' : 'none',
            }}
          >
            {/* Subtle inner reflection */}
            <div className="w-48 h-48 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center">
              {isConnected ? (
                <div className="flex flex-col items-center text-slate-950 font-bold">
                  <Radio className="w-8 h-8 animate-pulse text-slate-950/80" />
                  <span className="text-[11px] uppercase tracking-wider font-mono mt-1 opacity-80">
                    RF Ativo
                  </span>
                </div>
              ) : (
                <WifiOff className="w-8 h-8 text-white/50" />
              )}
            </div>
          </div>
        </div>

        {/* Region / Channel Selector Pill Badge */}
        <button
          onClick={() => setChannelModalOpen(true)}
          className="mt-10 px-4 py-2 rounded-full border border-slate-700 bg-slate-900/90 hover:bg-slate-850 hover:border-slate-600 transition-all flex items-center gap-2 text-xs font-medium text-slate-200 shadow-sm"
        >
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <span>{selectedChannel}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Dynamic Bold Headline */}
        <div className="text-center mt-6 space-y-1.5 px-4">
          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {isConnected ? 'Conexão ativa' : 'Inicie sua conexão'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            {isConnected
              ? `${activeNodesCount > 0 ? `${activeNodesCount} colega(s) conectado(s)` : 'Aguardando colegas'} · Canal 868 MHz · Sem internet`
              : 'Deslize o botão abaixo para ligar o rádio LoRa e comunicar em malha.'}
          </p>
        </div>
      </div>

      {/* Bottom Zone: Slide to Connect & Settings Circle */}
      <div className="space-y-4 pb-2">
        <div className="flex items-center gap-3">
          {/* Slide-to-Connect Capsule Track */}
          <div
            ref={sliderTrackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`flex-1 h-16 rounded-full relative p-1.5 transition-colors cursor-pointer flex items-center shadow-inner ${
              isConnected
                ? 'bg-slate-800/90 border border-slate-700'
                : 'bg-slate-900/90 border border-slate-800'
            }`}
          >
            {/* Sliding Thumb Knob */}
            <div
              className={`w-13 h-13 rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-transform ${
                isConnected
                  ? 'bg-rose-500 hover:bg-rose-400'
                  : 'bg-white text-slate-950 hover:bg-slate-100'
              }`}
              style={{
                transform: `translateX(${
                  sliderProgress * ((sliderTrackRef.current?.clientWidth || 260) - 56)
                }px)`,
                transition: isSliding ? 'none' : 'transform 0.25s ease-out',
              }}
            >
              <ArrowRight
                className={`w-5 h-5 transition-transform ${
                  isConnected ? 'rotate-180 text-white' : 'text-slate-950'
                }`}
              />
            </div>

            {/* Label inside the track */}
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400 pointer-events-none pl-8">
              {isConnected ? 'Deslize para desligar' : 'Deslize para ligar'}
            </span>
          </div>

          {/* Settings Circle Button */}
          <button
            onClick={onOpenSettings}
            className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 flex items-center justify-center text-slate-200 transition-all active:scale-95 shadow-md shrink-0"
            title="Abrir Configurações"
          >
            <Settings className="w-6 h-6 text-slate-300" />
          </button>
        </div>

        {/* Quick Shortcut Pills for Direct Messages & Map */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onOpenMessages}
            className="py-2.5 px-3 bg-slate-900/70 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Abrir Conversas</span>
          </button>

          <button
            onClick={onOpenMap}
            className="py-2.5 px-3 bg-slate-900/70 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>Mapa da Malha</span>
          </button>
        </div>
      </div>

      {/* Channel / Region Selection Bottom Sheet Dialog */}
      {channelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-[28px] sm:rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />
            <h3 className="font-bold text-base text-white">Selecionar Canal LoRa</h3>
            <div className="space-y-2">
              {channelsList.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setSelectedChannel(ch.name);
                    setChannelModalOpen(false);
                    audioEngine.playRadioSquelch('intro');
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    selectedChannel === ch.name
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs text-white">{ch.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{ch.desc}</div>
                    <div className="text-[10px] font-mono text-amber-400/90 mt-1">{ch.freq}</div>
                  </div>
                  {selectedChannel === ch.name && (
                    <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setChannelModalOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
