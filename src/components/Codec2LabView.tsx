import React, { useState } from 'react';
import {
  Mic,
  Play,
  Volume2,
  Cpu,
  Activity,
  Layers,
  Sparkles,
  Check,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { audioEngine, calculateCompressionStats } from '../services/audioCodec';
import { AudioVoiceBurst } from '../types/mesh';

export const Codec2LabView: React.FC = () => {
  const [durationSec, setDurationSec] = useState(3.0);
  const [demoPhrase, setDemoPhrase] = useState(
    'Patrulha Alfa em reconhecimento. Rota desimpedida até ao cume.'
  );
  const [isPlayingMode, setIsPlayingMode] = useState<string | null>(null);
  const [testBurst, setTestBurst] = useState<AudioVoiceBurst | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const stats = calculateCompressionStats(durationSec, demoPhrase.length);

  const handleRecordTestSample = async () => {
    if (isRecording) {
      setIsRecording(false);
      const burst = await audioEngine.stopRecording('1200bps');
      if (burst) {
        setTestBurst(burst);
        setDurationSec(burst.durationSeconds);
      }
    } else {
      const started = await audioEngine.startRecording();
      if (started) {
        setIsRecording(true);
      }
    }
  };

  const handlePlayFormat = async (format: 'raw' | 'codec2_1200' | 'codec2_700' | 'tts') => {
    setIsPlayingMode(format);
    try {
      if (format === 'tts') {
        audioEngine.speakText(demoPhrase);
      } else if (format === 'raw') {
        if (testBurst) {
          await audioEngine.playVoiceBurst(testBurst, false);
        } else {
          // Play simulated speech
          audioEngine.speakText(demoPhrase);
        }
      } else {
        // Play with vocoder harmonic synthesis
        const burstToPlay = testBurst || {
          id: 'demo_lab',
          durationSeconds: durationSec,
          sampleRate: 8000,
          rawByteSize: stats.rawPcmBytes,
          compressedByteSize: format === 'codec2_700' ? stats.codec2_700Bytes : stats.codec2_1200Bytes,
          codecMode: format === 'codec2_700' ? '700bps' : '1200bps',
          audioBlobUrl: '',
          bitstreamBase64: 'kdf94j39dfj...',
          waveformSamples: [0.3, 0.6, 0.8, 0.9, 0.7, 0.5, 0.4, 0.2],
          createdAt: Date.now(),
        };
        await audioEngine.playVoiceBurst(burstToPlay, true);
      }
    } finally {
      setTimeout(() => setIsPlayingMode(null), 1500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Laboratório de Compressão de Áudio: Codec2 & PTT
            </h2>
            <p className="text-xs text-slate-400">
              Análise comparativa de taxas de bits para comunicação de voz sobre canais LoRa de banda estreita
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Recording & Test Bench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Audio Sample Input */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-slate-100 pb-2 border-b border-slate-800">
            Amostra de Áudio para Teste
          </h3>

          <div>
            <label className="block text-slate-400 text-xs mb-1">Frase Operacional (Texto)</label>
            <textarea
              rows={2}
              value={demoPhrase}
              onChange={(e) => setDemoPhrase(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-emerald-500 font-sans resize-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Duração Estimada da Transmissão:</span>
              <span className="font-mono text-emerald-400 font-bold">{durationSec.toFixed(1)} segundos</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={10.0}
              step={0.5}
              value={durationSec}
              onChange={(e) => setDurationSec(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleRecordTestSample}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{isRecording ? 'Parar e Analisar Amostra' : 'Gravar Minha Voz com Microfone'}</span>
            </button>
            {testBurst && (
              <p className="text-[11px] text-emerald-400 font-mono text-center mt-2">
                ✓ Amostra real capturada: {testBurst.durationSeconds}s ({testBurst.compressedByteSize}B)
              </p>
            )}
          </div>
        </div>

        {/* Center/Right: Comparison Matrix */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Matriz Comparativa de Codecs para Rádio LoRa (Duração: {durationSec.toFixed(1)}s)
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Max Payload LoRa: 255 Bytes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 font-medium">Codec / Formato</th>
                  <th className="pb-2 font-medium">Taxa Bruta</th>
                  <th className="pb-2 font-medium">Tamanho Total</th>
                  <th className="pb-2 font-medium">Viabilidade LoRa</th>
                  <th className="pb-2 font-medium text-right">Ouvir Simulação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {/* Raw PCM */}
                <tr>
                  <td className="py-2.5 font-bold text-slate-300">Raw PCM (8kHz mono)</td>
                  <td className="py-2.5 text-slate-400">128,000 bps</td>
                  <td className="py-2.5 text-red-400 font-bold">{stats.rawPcmBytes.toLocaleString()} B</td>
                  <td className="py-2.5">
                    <span className="text-red-400 flex items-center gap-1 font-sans text-[11px]">
                      <XCircle className="w-3.5 h-3.5" /> Inviável (188 pacotes)
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handlePlayFormat('raw')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans text-[11px] transition-colors"
                    >
                      Ouvir
                    </button>
                  </td>
                </tr>

                {/* Opus VoIP */}
                <tr>
                  <td className="py-2.5 font-bold text-slate-300">Opus VoIP (WhatsApp)</td>
                  <td className="py-2.5 text-slate-400">16,000 bps</td>
                  <td className="py-2.5 text-amber-400 font-bold">{stats.opusBytes.toLocaleString()} B</td>
                  <td className="py-2.5">
                    <span className="text-amber-400 flex items-center gap-1 font-sans text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Pesado (24 pacotes)
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handlePlayFormat('raw')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans text-[11px] transition-colors"
                    >
                      Ouvir
                    </button>
                  </td>
                </tr>

                {/* Codec2 1200bps */}
                <tr className="bg-emerald-950/20">
                  <td className="py-2.5 font-bold text-emerald-400">Codec2 (1200 bps) ★</td>
                  <td className="py-2.5 text-emerald-300">1,200 bps</td>
                  <td className="py-2.5 text-emerald-400 font-bold">{stats.codec2_1200Bytes} B</td>
                  <td className="py-2.5">
                    <span className="text-emerald-400 flex items-center gap-1 font-sans text-[11px] font-semibold">
                      <Check className="w-3.5 h-3.5" /> Excelente (1-2 pacotes)
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handlePlayFormat('codec2_1200')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded font-sans text-[11px] transition-colors"
                    >
                      Ouvir Vocoder
                    </button>
                  </td>
                </tr>

                {/* Codec2 700bps */}
                <tr className="bg-emerald-950/20">
                  <td className="py-2.5 font-bold text-emerald-400">Codec2 (700 bps)</td>
                  <td className="py-2.5 text-emerald-300">700 bps</td>
                  <td className="py-2.5 text-emerald-400 font-bold">{stats.codec2_700Bytes} B</td>
                  <td className="py-2.5">
                    <span className="text-emerald-400 flex items-center gap-1 font-sans text-[11px] font-semibold">
                      <Check className="w-3.5 h-3.5" /> Máximo Alcance (1 pacote)
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handlePlayFormat('codec2_700')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded font-sans text-[11px] transition-colors"
                    >
                      Ouvir Vocoder
                    </button>
                  </td>
                </tr>

                {/* TTS */}
                <tr>
                  <td className="py-2.5 font-bold text-sky-400">Texto-para-Voz (TTS)</td>
                  <td className="py-2.5 text-slate-400">~60 bps</td>
                  <td className="py-2.5 text-sky-400 font-bold">{stats.ttsPayloadBytes} B</td>
                  <td className="py-2.5">
                    <span className="text-sky-400 flex items-center gap-1 font-sans text-[11px]">
                      <Check className="w-3.5 h-3.5" /> Ultraleve (&lt; 0.1s airtime)
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handlePlayFormat('tts')}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold rounded font-sans text-[11px] transition-colors"
                    >
                      Sintetizar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Vocoder Mechanics Explainer */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-sm font-bold text-slate-100 pb-2 border-b border-slate-800">
          Como o Codec2 Consegue Comprimir Voz para Apenas centenas de bytes?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 text-sm">1. Modelagem do Aparelho Vocal</span>
            <p className="text-slate-400 leading-relaxed">
              Em vez de salvar as ondas sonoras brutas (que requerem 16.000 amostras por segundo), o Codec2 decompõe a voz humana em parâmetros físicos: frequência fundamental (pitch das cordas vocais), ganho de energia e coeficientes lineares de predição (LPC) que modelam a ressonância da garganta e boca.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 text-sm">2. Quantização em Frames de 20ms</span>
            <p className="text-slate-400 leading-relaxed">
              A cada 20 milissegundos (50 vezes por segundo), o codec extrai apenas 24 bits (a 1200bps) ou 14 bits (a 700bps). Isso permite que 1 segundo de fala humana caiba em meros 150 bytes, cabendo perfeitamente nos limites de payload do chip Semtech SX1262.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-slate-200 text-sm">3. Ressíntese Harmônica no Recetor</span>
            <p className="text-slate-400 leading-relaxed">
              O microcontrolador ESP32 ou o telemóvel do destinatário recebe os 150-450 bytes transmitidos via rádio LoRa, decodifica os parâmetros harmônicos e excita um banco de filtros digitais para recriar a fala humana perceptível, acompanhada do clássico tom tático de rádio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
