import React, { useState } from 'react';
import {
  Cpu,
  Bluetooth,
  BluetoothOff,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sliders,
  Sparkles,
  Shield,
  Layers,
  Zap,
  Globe,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { BleDeviceStatus, LoRaPhyConfig } from '../types/mesh';
import { bleBridge } from '../services/bleBridge';
import { meshManager } from '../services/meshProtocol';

interface HardwareBlePanelProps {
  bleStatus: BleDeviceStatus;
}

export const HardwareBlePanel: React.FC<HardwareBlePanelProps> = ({ bleStatus }) => {
  const [loraConfig, setLoraConfig] = useState<LoRaPhyConfig>(meshManager.getLoRaConfig());
  const [activeProfile, setActiveProfile] = useState<'balanced' | 'long_range' | 'fast'>('balanced');
  const [connectMessage, setConnectMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  // Real Hardware BLE Connection
  const handleConnectHardware = async () => {
    setIsConnecting(true);
    setConnectMessage(null);
    try {
      const result = await bleBridge.connectHardwareBle();
      if (result.success) {
        setConnectMessage({ text: 'Dispositivo emparelhado com sucesso.', type: 'success' });
      } else {
        setConnectMessage({ text: result.message, type: 'error' });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    bleBridge.disconnect();
    setConnectMessage({ text: 'Dispositivo desconectado.', type: 'success' });
  };

  // Pre-configured, high-performance profiles ready to use
  const applyPresetProfile = (profile: 'balanced' | 'long_range' | 'fast') => {
    setActiveProfile(profile);
    let updated: Partial<LoRaPhyConfig> = {};

    if (profile === 'balanced') {
      // Best balanced profile for clear voice notes and fast text
      updated = {
        spreadingFactor: 9,
        bandwidth: 250,
        codingRate: '4/5',
        txPowerDbm: 20,
      };
    } else if (profile === 'long_range') {
      // Maximum penetration through buildings, trees, and long distance
      updated = {
        spreadingFactor: 11,
        bandwidth: 125,
        codingRate: '4/8',
        txPowerDbm: 22,
      };
    } else if (profile === 'fast') {
      // High speed for dense nearby teams
      updated = {
        spreadingFactor: 7,
        bandwidth: 500,
        codingRate: '4/5',
        txPowerDbm: 14,
      };
    }

    const newConfig = { ...loraConfig, ...updated };
    setLoraConfig(newConfig);
    meshManager.setLoRaConfig(newConfig);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  // Region Frequency Selector
  const handleSelectRegion = (freq: '868MHz' | '915MHz' | '433MHz') => {
    const updated = { ...loraConfig, frequency: freq };
    setLoraConfig(updated);
    meshManager.setLoRaConfig(updated);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-slate-900 pb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <span>Configurações de Hardware & Rádio</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Ligue a sua placa física ESP32 / T-Beam por Bluetooth para comunicar sem internet através de ondas de rádio LoRa.
        </p>
      </div>

      {/* Confirmation Banner */}
      {savedBanner && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configurações otimizadas aplicadas ao rádio com sucesso!</span>
        </div>
      )}

      {/* 1. REAL BLUETOOTH CONNECTION CARD (NO SIMULATIONS) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-emerald-400" />
              <span>Ligação Bluetooth ao Rádio Físico</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Conexão com placas ESP32, TTGO T-Beam, Heltec LoRa ou Meshtastic.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {bleStatus.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-slate-800 hover:bg-red-950/50 hover:text-red-400 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 hover:border-red-900/60 transition-colors flex items-center gap-1.5"
              >
                <BluetoothOff className="w-3.5 h-3.5" />
                <span>Desconectar Rádio</span>
              </button>
            ) : (
              <button
                onClick={handleConnectHardware}
                disabled={isConnecting}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                <Bluetooth className="w-4 h-4" />
                <span>{isConnecting ? 'A pesquisar rádio...' : 'Ligar Rádio Bluetooth'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
          <div
            className={`w-3 h-3 rounded-full ${
              bleStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
            }`}
          />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-slate-200">
              {bleStatus.isConnected
                ? `Rádio Conectado: ${bleStatus.deviceName || 'ESP32 LoRa'}`
                : 'Nenhum rádio físico conectado no momento'}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {bleStatus.isConnected
                ? 'Todas as mensagens e áudios enviados no chat estão a ser transmitidos diretamente pelas ondas de rádio da sua placa.'
                : 'O sistema está a operar em sincronismo de rede local até conectar a sua placa por Bluetooth.'}
            </p>
          </div>
        </div>

        {connectMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              connectMessage.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
                : 'bg-amber-950/40 border border-amber-800/60 text-amber-300'
            }`}
          >
            {connectMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{connectMessage.text}</span>
          </div>
        )}
      </div>

      {/* 2. PRE-CONFIGURED, TESTED PROFILES READY TO USE */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Configurações Prontas do Rádio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Perfis otimizados e testados para máxima estabilidade. Escolha o modo ideal para a sua missão com um só clique:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Preset 1: Balanced (Default) */}
          <button
            onClick={() => applyPresetProfile('balanced')}
            className={`p-4 rounded-xl text-left border transition-all ${
              activeProfile === 'balanced'
                ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/50'
                : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Padrão Otimizado</span>
              </span>
              {activeProfile === 'balanced' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O equilíbrio perfeito. Ideal para notas de voz PTT nítidas e mensagens de texto instantâneas em qualquer terreno.
            </p>
            <div className="mt-3 text-[10px] font-mono text-emerald-400/90 font-medium">
              SF9 · 250 kHz · 100mW (20 dBm)
            </div>
          </button>

          {/* Preset 2: Long Range */}
          <button
            onClick={() => applyPresetProfile('long_range')}
            className={`p-4 rounded-xl text-left border transition-all ${
              activeProfile === 'long_range'
                ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/50'
                : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Alcance Máximo</span>
              </span>
              {activeProfile === 'long_range' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Maior penetração de sinal para áreas rurais, florestas densas, montanhas ou longas distâncias entre operadores.
            </p>
            <div className="mt-3 text-[10px] font-mono text-sky-400/90 font-medium">
              SF11 · 125 kHz · Máx. Potência (22 dBm)
            </div>
          </button>

          {/* Preset 3: Fast */}
          <button
            onClick={() => applyPresetProfile('fast')}
            className={`p-4 rounded-xl text-left border transition-all ${
              activeProfile === 'fast'
                ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/50'
                : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Alta Velocidade</span>
              </span>
              {activeProfile === 'fast' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                  ATIVO
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Envio ultrarrápido com baixo tempo de transmissão no ar, indicado para equipas muito próximas em ambiente urbano.
            </p>
            <div className="mt-3 text-[10px] font-mono text-amber-400/90 font-medium">
              SF7 · 500 kHz · 25mW (14 dBm)
            </div>
          </button>
        </div>
      </div>

      {/* 3. FREQUENCY REGION SELECTOR */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span>Frequência da Sua Região</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleSelectRegion('868MHz')}
            className={`p-3 rounded-xl border text-left transition-colors ${
              loraConfig.frequency === '868MHz'
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs">🇪🇺 Europa & África (868 MHz)</div>
            <div className="text-[10px] text-slate-400 mt-1">Canal ISM 868.125 MHz (Recomendado)</div>
          </button>

          <button
            onClick={() => handleSelectRegion('915MHz')}
            className={`p-3 rounded-xl border text-left transition-colors ${
              loraConfig.frequency === '915MHz'
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs">🇧🇷 Américas & Brasil (915 MHz)</div>
            <div className="text-[10px] text-slate-400 mt-1">Canal ISM 915.000 MHz</div>
          </button>

          <button
            onClick={() => handleSelectRegion('433MHz')}
            className={`p-3 rounded-xl border text-left transition-colors ${
              loraConfig.frequency === '433MHz'
                ? 'bg-emerald-950/40 border-emerald-500 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-xs">🌐 Geral / Amador (433 MHz)</div>
            <div className="text-[10px] text-slate-400 mt-1">Canal ISM 433.175 MHz</div>
          </button>
        </div>
      </div>
    </div>
  );
};
