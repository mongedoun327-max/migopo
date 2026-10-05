import React, { useState } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Zap,
  Minimize2,
  Maximize2,
  Signal,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { voiceCallService, VoiceCallState } from '../services/voiceCallService';

interface VoiceCallModalProps {
  callState: VoiceCallState;
}

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({ callState }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (callState.status === 'IDLE') return null;

  // -------------------------------------------------------------
  // 1. INCOMING CALL SCREEN
  // -------------------------------------------------------------
  if (callState.status === 'INCOMING') {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute -top-16 -left-16 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Incoming Header */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Chamada de Voz em Direto
            </span>
            <h2 className="text-xl font-bold text-white truncate px-2">
              {callState.peerName || 'Operador'}
            </h2>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>{callState.peerCallsign || 'REDE LORA'}</span>
            </div>
          </div>

          {/* Pulsing Avatar */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute w-28 h-28 rounded-full border-2 border-emerald-500/30 animate-ping" />
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-3xl shadow-xl shadow-emerald-500/30 z-10">
              {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Signal Guarantee Indicator */}
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs space-y-1 text-left">
            <div className="flex items-center justify-between font-semibold text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sinal 100% Forte Garantido</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700/60 font-mono">
                HD OPUS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Ligação com roteamento adaptativo sem limites de distância ou região.
            </p>
          </div>

          {/* Action Buttons: Accept / Reject */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => voiceCallService.rejectCall()}
              className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-red-950/60 text-slate-300 hover:text-red-400 border border-slate-800 hover:border-red-900/60 transition-all font-semibold text-xs flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-4 h-4 text-red-400" />
              <span>Recusar</span>
            </button>

            <button
              onClick={() => voiceCallService.acceptCall()}
              className="py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Atender</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. OUTGOING CALLING SCREEN
  // -------------------------------------------------------------
  if (callState.status === 'CALLING') {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-6 shadow-2xl">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              A chamar...
            </span>
            <h2 className="text-xl font-bold text-white truncate px-2">
              {callState.peerName || 'Operador'}
            </h2>
            <p className="text-xs text-slate-400">
              A sincronizar canal e reforçar sinal de voz...
            </p>
          </div>

          {/* Pulsing Avatar */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute w-28 h-28 rounded-full border border-amber-500/20 animate-ping" />
            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-slate-200 font-bold text-3xl shadow-xl z-10">
              {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span>Sinal calibrado para qualidade cristalina</span>
          </div>

          <button
            onClick={() => voiceCallService.hangup()}
            className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950 transition-all active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancelar Chamada</span>
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. MINIMIZED FLOATING PILL (WHEN CALL IS IN PROGRESS)
  // -------------------------------------------------------------
  if (isMinimized && callState.status === 'CONNECTED') {
    return (
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2.5 p-2 bg-slate-950/95 border border-emerald-500/40 rounded-full shadow-2xl backdrop-blur-md animate-fadeIn">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-xs">
          {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
        </div>

        <div className="flex flex-col pr-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white truncate max-w-[100px]">
              {callState.peerName}
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            {voiceCallService.formatDuration(callState.durationSeconds)}
          </span>
        </div>

        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
          title="Expandir Chamada"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => voiceCallService.hangup()}
          className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
          title="Desligar Chamada"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 4. FULL CONNECTED IN-CALL SCREEN
  // -------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Top Controls: Minimize & Encryption */}
        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-900">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Voz Criptografada P2P</span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            title="Minimizar chamada"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Peer Info & Duration */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white truncate px-4">
            {callState.peerName}
          </h2>
          <div className="text-sm font-mono font-bold text-emerald-400 tracking-wider">
            {voiceCallService.formatDuration(callState.durationSeconds)}
          </div>
        </div>

        {/* Peer Avatar & Live Sound Wave Rings */}
        <div className="relative flex items-center justify-center py-2">
          {/* Animated sound wave bars when voice active */}
          <div
            className={`absolute w-36 h-36 rounded-full border-2 border-emerald-500/20 transition-all duration-200 ${
              callState.localVolume > 10 || callState.remoteVolume > 10 ? 'scale-110 border-emerald-400/40' : 'scale-100'
            }`}
          />
          <div
            className={`absolute w-44 h-44 rounded-full border border-teal-500/10 transition-all duration-300 ${
              callState.localVolume > 20 || callState.remoteVolume > 20 ? 'scale-115 border-teal-400/30' : 'scale-95'
            }`}
          />

          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-4xl shadow-2xl shadow-emerald-500/30 z-10">
            {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
          </div>
        </div>

        {/* Dynamic Voice Visualizer Waveform */}
        <div className="flex items-center justify-center gap-1.5 h-8 px-6">
          {[12, 28, 45, 75, 95, 60, 80, 40, 90, 65, 30, 15].map((baseHeight, i) => {
            const dynamicScale = Math.max(
              0.2,
              Math.min(1.0, (callState.localVolume + callState.remoteVolume + 15) / 100)
            );
            const height = Math.max(4, Math.round(baseHeight * dynamicScale));
            return (
              <div
                key={i}
                className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>

        {/* Signal Quality & Strong Connection Guarantee Card */}
        <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Signal className="w-4 h-4 text-emerald-400" />
              <span>Sinal Excelente ({callState.signalQuality.percentage}%)</span>
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  className={`w-1 rounded-full ${
                    bar <= callState.signalQuality.bars ? 'bg-emerald-400 h-3.5' : 'bg-slate-700 h-2'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Potência: {callState.signalQuality.rssiDbm} dBm</span>
            <span>SNR: +{callState.signalQuality.snrDb} dB</span>
            <span className="text-emerald-400">Latência: 16ms</span>
          </div>

          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>Roteamento: {callState.signalQuality.relayPath}</span>
            <span className="text-slate-300 font-medium">Qualquer Região</span>
          </div>
        </div>

        {/* In-Call Actions */}
        <div className="flex items-center justify-center gap-4 pt-1">
          {/* Mute Mic */}
          <button
            onClick={() => voiceCallService.toggleMute()}
            className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              callState.isMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
            }`}
            title={callState.isMuted ? 'Desativar Mudo' : 'Silenciar Microfone'}
          >
            {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="text-[9px] font-medium">{callState.isMuted ? 'Mudo' : 'Micro'}</span>
          </button>

          {/* Super Signal Booster (+12dB Amplifier) */}
          <button
            onClick={() => voiceCallService.toggleBoost()}
            className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              callState.isBoosted
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
            title="Amplificador digital de sinal e volume de voz (+12dB)"
          >
            <Zap className={`w-5 h-5 ${callState.isBoosted ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="text-[9px] font-bold">{callState.isBoosted ? '+12dB HD' : 'Normal'}</span>
          </button>

          {/* End Call (Red Button) */}
          <button
            onClick={() => voiceCallService.hangup()}
            className="w-14 h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex flex-col items-center justify-center gap-0.5 shadow-xl shadow-red-950 transition-all active:scale-95"
            title="Desligar Chamada"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="text-[9px] font-bold">Desligar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
