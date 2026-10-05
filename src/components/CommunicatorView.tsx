import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Lock,
  Radio,
  MapPin,
  Clock,
  Play,
  Square,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Signal,
  Cpu,
  Layers,
} from 'lucide-react';
import { MeshPacket, MeshChannel, MeshNode, Codec2Mode, AudioVoiceBurst } from '../types/mesh';
import { audioEngine, calculateCompressionStats } from '../services/audioCodec';
import { meshManager } from '../services/meshProtocol';
import { calculateAirtime } from '../services/loraPhy';

interface CommunicatorViewProps {
  channels: MeshChannel[];
  selectedChannelId: number;
  onSelectChannel: (id: number) => void;
  packets: MeshPacket[];
  nodes: MeshNode[];
  onTriggerSos: () => void;
}

export const CommunicatorView: React.FC<CommunicatorViewProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  packets,
  nodes,
  onTriggerSos,
}) => {
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [codecMode, setCodecMode] = useState<Codec2Mode>('1200bps');
  const [simulatedVocoder, setSimulatedVocoder] = useState(true);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [waveformBuffer, setWaveformBuffer] = useState<number[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [pttMode, setPttMode] = useState<'hold' | 'toggle'>('toggle');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];
  const channelPackets = packets.filter(
    (p) => p.channelId === selectedChannelId || p.packetType === 'SOS_BEACON'
  );

  // Auto scroll to bottom when new packet arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelPackets.length]);

  // Handle Recording Timer & Max 10s Limit
  useEffect(() => {
    if (isRecording) {
      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordDuration(elapsed);
        if (elapsed >= 10.0) {
          // Max burst limit to protect LoRa airtime
          handleStopAndSendVoice();
        }
      }, 100);
    } else {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setRecordDuration(0);
    }

    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      const started = await audioEngine.startRecording((data) => {
        // Draw live waveform to canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#020617';
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
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handleStopAndSendVoice = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsTransmitting(true);

    try {
      const voiceBurst = await audioEngine.stopRecording(codecMode);
      if (voiceBurst && voiceBurst.durationSeconds >= 0.4) {
        await meshManager.sendPacket({
          channelId: selectedChannelId,
          packetType: 'VOICE_BURST',
          voiceBurst,
          payloadText: `Nota de Voz PTT (${voiceBurst.durationSeconds}s @ ${codecMode})`,
        });
      }
    } catch (e) {
      console.error('Voice send error:', e);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || isTransmitting) return;

    const textToSend = textInput.trim();
    setTextInput('');
    setIsTransmitting(true);

    try {
      await meshManager.sendPacket({
        channelId: selectedChannelId,
        packetType: 'TEXT_MSG',
        payloadText: textToSend,
      });
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleSendGpsPing = async () => {
    const selfNode = nodes.find((n) => n.isSelf) || nodes[0];
    await meshManager.sendPacket({
      channelId: selectedChannelId,
      packetType: 'LOCATION_PING',
      location: selfNode.gps,
      payloadText: `Beacon GPS: ${selfNode.gps.lat.toFixed(4)}°N, ${selfNode.gps.lng.toFixed(4)}°W (${selfNode.gps.alt}m alt)`,
    });
  };

  const handlePlayVoice = async (burst: AudioVoiceBurst, packetId: string) => {
    if (currentlyPlayingId === packetId) return;
    setCurrentlyPlayingId(packetId);
    try {
      await audioEngine.playVoiceBurst(burst, simulatedVocoder);
    } finally {
      setCurrentlyPlayingId(null);
    }
  };

  const handleSpeakText = (text: string) => {
    audioEngine.speakText(text);
  };

  // Compression stats for current recording duration
  const compression = calculateCompressionStats(recordDuration || 3.0);
  const selectedCompressedBytes =
    codecMode === '700bps'
      ? compression.codec2_700Bytes
      : codecMode === '1200bps'
      ? compression.codec2_1200Bytes
      : Math.round((recordDuration || 3.0) * 300);

  const loraConfig = meshManager.getLoRaConfig();
  const airtimeEstimate = calculateAirtime(selectedCompressedBytes, loraConfig);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3">
      {/* Top Channel Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-lg border border-slate-800">
          {channels.map((ch) => {
            const isSelected = ch.id === selectedChannelId;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ch.color }}
                />
                <span>{ch.name}</span>
                {ch.isEncrypted && <Lock className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Quick Tactical Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSendGpsPing}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Enviar Coordenadas GPS via LoRa"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">GPS Ping</span>
          </button>

          <label className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={simulatedVocoder}
              onChange={(e) => setSimulatedVocoder(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Vocoder Codec2 Rádio</span>
          </label>
        </div>
      </div>

      {/* Main Message Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
        {channelPackets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500">
            <Radio className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-400">Canal {activeChannel.name} sem transmissões recentes</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Use o botão PTT abaixo para enviar notas de voz comprimidas ou digite uma mensagem tática.
            </p>
          </div>
        ) : (
          channelPackets.map((pkt) => {
            const senderNode = nodes.find((n) => n.id === pkt.fromNodeId);
            const isSelf = pkt.fromNodeId === 'node-alfa-01' || senderNode?.isSelf;
            const isSos = pkt.packetType === 'SOS_BEACON';
            const isPlaying = currentlyPlayingId === pkt.id;

            return (
              <div
                key={pkt.id}
                className={`flex flex-col ${
                  isSelf ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-xl rounded-xl p-3 border transition-all ${
                    isSos
                      ? 'bg-red-950/40 border-red-600/60 shadow-lg shadow-red-950/30'
                      : isSelf
                      ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                  }`}
                >
                  {/* Sender Metadata Bar (Clean zero-pill typography) */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pb-1.5 border-b border-slate-800/60 mb-2">
                    <span className="font-semibold text-slate-200">
                      {senderNode ? senderNode.callsign : pkt.fromNodeId}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>{new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      Saltos: {pkt.hopStart - pkt.hopLimit}/{pkt.hopStart}
                    </span>
                    {pkt.encrypted && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                          <Lock className="w-2.5 h-2.5" /> E2EE
                        </span>
                      </>
                    )}
                  </div>

                  {/* Packet Content: Voice Burst vs Text */}
                  {pkt.packetType === 'VOICE_BURST' && pkt.voiceBurst ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePlayVoice(pkt.voiceBurst!, pkt.id)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isPlaying
                              ? 'bg-emerald-500 text-slate-950 animate-pulse'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                          title="Reproduzir nota de voz Codec2"
                        >
                          {isPlaying ? (
                            <Square className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-slate-200">
                              Áudio Codec2 ({pkt.voiceBurst.codecMode})
                            </span>
                            <span className="font-mono text-emerald-400 text-[11px]">
                              {pkt.voiceBurst.durationSeconds.toFixed(1)}s · {pkt.voiceBurst.compressedByteSize}B
                            </span>
                          </div>

                          {/* Mini Waveform visualization */}
                          <div className="h-6 flex items-center gap-0.5 bg-slate-950/60 rounded px-2 py-1 border border-slate-800">
                            {pkt.voiceBurst.waveformSamples.map((amp, idx) => (
                              <div
                                key={idx}
                                className={`w-1 rounded-full transition-all ${
                                  isPlaying ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                style={{ height: `${Math.max(15, amp * 100)}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {pkt.voiceBurst.transcription && (
                        <p className="text-xs text-slate-300 italic pl-1 border-l-2 border-slate-700">
                          "{pkt.voiceBurst.transcription}"
                        </p>
                      )}
                    </div>
                  ) : pkt.packetType === 'LOCATION_PING' ? (
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded bg-sky-950/50 border border-sky-800/40 text-sky-400 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-mono text-slate-200">{pkt.payloadText}</p>
                        <p className="text-[11px] text-slate-400">
                          Coordenadas broadcast para todos os nós mesh em alcance.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-200 leading-relaxed break-words">
                        {pkt.payloadText}
                      </p>
                      <button
                        onClick={() => handleSpeakText(pkt.payloadText || '')}
                        className="text-slate-500 hover:text-slate-300 p-1 shrink-0"
                        title="Ouvir mensagem por sintetizador de voz (TTS)"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Radio Physical Metrics & Path Breadcrumbs */}
                  <div className="mt-2.5 pt-1.5 border-t border-slate-800/50 flex flex-wrap items-center justify-between text-[10px] text-slate-400 font-mono gap-y-1">
                    <div className="flex items-center gap-2">
                      <span>RSSI: {pkt.rssiDbm} dBm</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>SNR: {pkt.snrDb > 0 ? `+${pkt.snrDb}` : pkt.snrDb} dB</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span>Airtime: {pkt.airtimeMs}ms</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      <span>Rota:</span>
                      {pkt.pathTraveled.map((nodeId, idx) => {
                        const n = nodes.find((x) => x.id === nodeId);
                        return (
                          <span key={nodeId} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-slate-600">→</span>}
                            <span className={nodeId === pkt.fromNodeId ? 'text-slate-300' : 'text-emerald-400'}>
                              {n ? n.callsign.split('-')[0] : nodeId.slice(0, 5)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* PTT Recording Active State Panel */}
      {isRecording && (
        <div className="mb-2 p-3 bg-slate-900 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-black/50">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">A GRAVAR VOZ PTT</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  {recordDuration.toFixed(1)}s / 10.0s
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Compressão Codec2: <span className="text-slate-200 font-mono">{selectedCompressedBytes} bytes</span> (~{airtimeEstimate.totalAirtimeMs.toFixed(0)}ms airtime)
              </p>
            </div>
          </div>

          <div className="w-full sm:w-64 h-8 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
            <canvas ref={canvasRef} width={256} height={32} className="w-full h-full" />
          </div>

          <button
            onClick={handleStopAndSendVoice}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transmitir no Mesh</span>
          </button>
        </div>
      )}

      {/* Bottom PTT Control & Text Input Bar */}
      <div className="shrink-0 pt-2 border-t border-slate-800/80">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Main PTT Push-to-Talk Button */}
          <div className="flex items-center gap-2">
            <button
              onMouseDown={pttMode === 'hold' ? handleStartRecording : undefined}
              onMouseUp={pttMode === 'hold' ? handleStopAndSendVoice : undefined}
              onTouchStart={pttMode === 'hold' ? handleStartRecording : undefined}
              onTouchEnd={pttMode === 'hold' ? handleStopAndSendVoice : undefined}
              onClick={pttMode === 'toggle' ? (isRecording ? handleStopAndSendVoice : handleStartRecording) : undefined}
              disabled={isTransmitting}
              className={`h-12 px-5 rounded-xl font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2.5 transition-all select-none ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50 scale-[0.98]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/40 active:scale-95'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>SOLTAR P/ ENVIAR</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>PTT VOZ</span>
                </>
              )}
            </button>

            {/* Codec2 Bitrate Select */}
            <select
              value={codecMode}
              onChange={(e) => setCodecMode(e.target.value as Codec2Mode)}
              className="h-12 px-2.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono rounded-xl focus:border-emerald-500 focus:outline-none"
              title="Taxa de bits do Codec2 (ultra-baixa largura de banda)"
            >
              <option value="700bps">700 bps (Extremo)</option>
              <option value="1200bps">1200 bps (Padrão)</option>
              <option value="2400bps">2400 bps (Nítido)</option>
              <option value="3200bps">3200 bps (Voz Alta)</option>
            </select>
          </div>

          {/* Text Message Field */}
          <form onSubmit={handleSendText} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Mensagem de rádio em #${activeChannel.name}...`}
              className="flex-1 h-12 px-4 bg-slate-900/90 border border-slate-800 text-slate-100 text-sm rounded-xl focus:border-emerald-500 focus:outline-none placeholder:text-slate-500 font-sans"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isTransmitting}
              className="h-12 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 rounded-xl transition-colors flex items-center justify-center shrink-0 border border-slate-700/60"
              title="Transmitir mensagem de texto"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Status Line: Radio Airtime & Bandwidth savings */}
        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 font-mono px-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400">
              <Signal className="w-3 h-3" />
              <span>SF{loraConfig.spreadingFactor} · BW {loraConfig.bandwidth}kHz · {loraConfig.frequency}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">
              Voz LoRa: <strong className="text-slate-300 font-normal">~98% menos bytes</strong> que VoIP tradicional
            </span>
            <button
              onClick={() => setPttMode(pttMode === 'hold' ? 'toggle' : 'hold')}
              className="text-slate-400 hover:text-slate-300 underline"
            >
              PTT: {pttMode === 'hold' ? 'Premir & Segurar' : 'Clique Inicia/Para'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
