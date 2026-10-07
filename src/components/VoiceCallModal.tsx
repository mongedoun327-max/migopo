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
import { formatPhoneNumber } from '../services/phoneSystem';

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
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
        <div className="bg-white border border-[#EEEEEE] rounded-[14px] max-w-[368px] w-full p-6 text-center space-y-6 shadow-2xl relative select-none animate-scaleUp">
          {/* Incoming Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              />
              <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-[#777777]">
                CHAMADA RECEBIDA
              </span>
            </div>

            <h2 className="text-[23px] font-semibold text-black truncate px-2 mt-1">
              {callState.peerName || 'Operador'}
            </h2>
            <p className="text-[13px] text-[#777777]">
              {callState.peerPhone
                ? formatPhoneNumber(callState.peerPhone)
                : callState.peerCallsign || '4116 0000'}
            </p>
          </div>

          {/* Avatar with concentric outer ring */}
          <div className="relative flex items-center justify-center py-2">
            <div className="w-32 h-32 rounded-full border border-[#F0F0F0] flex items-center justify-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-[32px] text-black shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              >
                {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Signal box */}
          <div className="h-[42px] rounded-[15px] border-[1.2px] border-black bg-white px-4 flex items-center justify-center gap-3">
            <div className="flex items-end gap-1">
              <span className="w-[2px] h-[6px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[10px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[14px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[18px] bg-black rounded-[1px]" />
            </div>
            <span className="text-[13px] text-[#777777]">
              Sinal calibrado para qualidade cristalina
            </span>
          </div>

          {/* Action Buttons: Accept / Reject */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => voiceCallService.rejectCall()}
              className="h-[52px] rounded-[26px] bg-[#EEEEEE] hover:bg-neutral-200 active:scale-95 text-black font-semibold text-[14px] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Recusar</span>
            </button>

            <button
              onClick={() => voiceCallService.acceptCall()}
              className="h-[52px] rounded-[26px] bg-black hover:bg-neutral-800 text-white transition-all font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
            >
              <span>Atender</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. OUTGOING CALLING SCREEN matching chamada-em-andamento.svg
  // -------------------------------------------------------------
  if (callState.status === 'CALLING') {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
        <div className="bg-white border border-[#EEEEEE] rounded-[14px] max-w-[368px] w-full p-6 text-center space-y-6 shadow-2xl relative select-none animate-scaleUp">
          {/* Status Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              />
              <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-[#777777]">
                A CHAMAR...
              </span>
            </div>

            <h2 className="text-[23px] font-semibold text-black truncate px-2 mt-2">
              {callState.peerName || 'Operador'}
            </h2>
            <p className="text-[13px] text-[#777777] mt-1 font-mono">
              {callState.peerPhone
                ? formatPhoneNumber(callState.peerPhone)
                : callState.peerCallsign || 'A sincronizar canal...'}
            </p>
          </div>

          {/* Avatar with concentric outer ring */}
          <div className="relative flex items-center justify-center py-2">
            <div className="w-32 h-32 rounded-full border border-[#F0F0F0] flex items-center justify-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-[32px] text-black shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                }}
              >
                {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Qualidade do sinal box matching SVG */}
          <div className="h-[42px] rounded-[15px] border-[1.2px] border-black bg-white px-4 flex items-center justify-center gap-3">
            <div className="flex items-end gap-1">
              <span className="w-[2px] h-[6px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[10px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[14px] bg-black rounded-[1px]" />
              <span className="w-[2px] h-[18px] bg-black rounded-[1px]" />
            </div>
            <span className="text-[13px] text-[#777777]">
              Sinal calibrado para qualidade cristalina
            </span>
          </div>

          {/* Cancelar Chamada button matching SVG */}
          <button
            onClick={() => voiceCallService.hangup()}
            className="w-full h-[54px] rounded-[27px] bg-black hover:bg-neutral-800 active:scale-98 text-white font-semibold text-[15px] flex items-center justify-center gap-3 shadow-xl transition-all cursor-pointer"
          >
            <svg width="24" height="24" viewBox="134 348 30 32" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M139 355 C139 353.5 140.5 352.5 142 353 L146 354.5 L148 359.5 L145.5 361.5 C147.5 365.5 150 368 154 370 L156 367.5 L161 369.5 L162.5 373.5 C163 375 162 376.5 160.5 376.5 C151 375.8 140 366.8 139 355Z" />
              <path d="M137 351 L163 378" />
            </svg>
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
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 p-2 bg-white border border-[#EEEEEE] rounded-full shadow-2xl animate-fadeIn">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs"
          style={{
            background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
          }}
        >
          {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}
        </div>

        <div className="flex flex-col pr-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00B98B] animate-pulse" />
            <span className="text-xs font-semibold text-black truncate max-w-[100px]">
              {callState.peerName}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#777777]">
            {voiceCallService.formatDuration(callState.durationSeconds)}
          </span>
        </div>

        <button
          onClick={() => setIsMinimized(false)}
          className="p-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black transition-colors cursor-pointer"
          title="Expandir Chamada"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => voiceCallService.hangup()}
          className="p-1.5 rounded-full bg-black hover:bg-neutral-800 text-white transition-colors cursor-pointer"
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-white border border-[#EEEEEE] rounded-[14px] max-w-[368px] w-full p-6 text-center space-y-5 shadow-2xl relative select-none animate-scaleUp">
        {/* Top Controls: Minimize & Encryption */}
        <div className="flex items-center justify-between text-xs text-[#777777] pb-2 border-b border-[#EEEEEE]">
          <div className="flex items-center gap-1.5 text-black font-medium text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            <span>Voz Criptografada P2P</span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-lg text-black hover:bg-neutral-100 transition-colors cursor-pointer"
            title="Minimizar chamada"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Status Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
              }}
            />
            <span className="text-[12px] font-bold uppercase tracking-[0.4px] text-[#777777]">
              EM CHAMADA
            </span>
          </div>

          <h2 className="text-[23px] font-semibold text-black truncate px-2 mt-1">
            {callState.peerName}
          </h2>
          <div className="text-[14px] font-mono font-medium text-black">
            {voiceCallService.formatDuration(callState.durationSeconds)}
          </div>
        </div>

        {/* Avatar with dynamic voice activity wave rings */}
        <div className="relative flex items-center justify-center py-2">
          {/* Animated voice wave glow ring */}
          <div
            className={`w-32 h-32 rounded-full border transition-all duration-200 flex items-center justify-center ${
              callState.remoteVolume > 12
                ? 'border-[#00B98B] ring-4 ring-emerald-400/20 scale-105'
                : callState.localVolume > 12 && !callState.isMuted
                ? 'border-amber-400 ring-4 ring-amber-400/20 scale-102'
                : 'border-[#F0F0F0]'
            }`}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-[32px] text-black shadow-lg relative"
              style={{
                background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
              }}
            >
              {(callState.peerName || 'OP').slice(0, 2).toUpperCase()}

              {/* Little speaking beacon */}
              {(callState.remoteVolume > 12 || (callState.localVolume > 12 && !callState.isMuted)) && (
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#00B98B] border-2 border-white animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Live Speech Activity & Signal box */}
        <div className="h-[46px] rounded-[15px] border-[1.2px] border-black bg-white px-3 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-end gap-1 shrink-0 h-4">
              <span
                className={`w-[2.5px] rounded-[1px] transition-all duration-100 ${
                  callState.remoteVolume > 8 || callState.localVolume > 8
                    ? 'h-4 bg-[#00B98B]'
                    : 'h-1.5 bg-black'
                }`}
              />
              <span
                className={`w-[2.5px] rounded-[1px] transition-all duration-100 ${
                  callState.remoteVolume > 20 || callState.localVolume > 20
                    ? 'h-4 bg-[#00B98B]'
                    : 'h-2.5 bg-black'
                }`}
              />
              <span
                className={`w-[2.5px] rounded-[1px] transition-all duration-100 ${
                  callState.remoteVolume > 35 || callState.localVolume > 35
                    ? 'h-4 bg-[#00B98B]'
                    : 'h-3.5 bg-black'
                }`}
              />
              <span
                className={`w-[2.5px] rounded-[1px] transition-all duration-100 ${
                  callState.remoteVolume > 50 || callState.localVolume > 50
                    ? 'h-4 bg-[#00B98B]'
                    : 'h-4 bg-black'
                }`}
              />
            </div>

            <span className="text-[12px] text-black font-medium truncate">
              {callState.remoteVolume > 12 ? (
                <span className="text-[#00B98B] font-semibold">
                  A ouvir {callState.peerName}...
                </span>
              ) : callState.localVolume > 12 && !callState.isMuted ? (
                <span className="text-neutral-900 font-semibold">
                  A transmitir o seu microfone...
                </span>
              ) : (
                <span className="text-[#777777]">
                  Voz P2P Direta · Sem gastar dados
                </span>
              )}
            </span>
          </div>

          <span className="text-[10px] font-mono font-bold bg-[#F0F0F0] text-black px-2 py-0.5 rounded-full shrink-0">
            HD 48kHz
          </span>
        </div>

        {/* In-Call Controls: Mute, Boost, Hangup */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {/* Mute Mic */}
          <button
            onClick={() => voiceCallService.toggleMute()}
            className={`h-[50px] rounded-[16px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              callState.isMuted
                ? 'bg-black text-white'
                : 'bg-[#FAFAFA] border border-[#EEEEEE] text-black hover:bg-neutral-100'
            }`}
            title={callState.isMuted ? 'Desativar Mudo' : 'Silenciar Microfone'}
          >
            {callState.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="text-[9px] font-medium">{callState.isMuted ? 'Mudo' : 'Micro'}</span>
          </button>

          {/* Super Signal Booster (+12dB Amplifier) */}
          <button
            onClick={() => voiceCallService.toggleBoost()}
            className={`h-[50px] rounded-[16px] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              callState.isBoosted
                ? 'bg-black text-white'
                : 'bg-[#FAFAFA] border border-[#EEEEEE] text-black hover:bg-neutral-100'
            }`}
            title="Amplificador digital de sinal e volume de voz (+12dB)"
          >
            <Zap className="w-4 h-4" />
            <span className="text-[9px] font-bold">{callState.isBoosted ? '+12dB HD' : 'Normal'}</span>
          </button>

          {/* End Call */}
          <button
            onClick={() => voiceCallService.hangup()}
            className="h-[50px] rounded-[16px] bg-black hover:bg-neutral-800 text-white flex flex-col items-center justify-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
            title="Desligar Chamada"
          >
            <PhoneOff className="w-4 h-4 text-white" />
            <span className="text-[9px] font-bold">Desligar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
