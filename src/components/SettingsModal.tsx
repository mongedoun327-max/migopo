import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Map, Cpu, Bluetooth, Globe, Zap, Layers, Radio } from 'lucide-react';
import { BleDeviceStatus } from '../types/mesh';
import { bleBridge } from '../services/bleBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMap: () => void;
  bleStatus: BleDeviceStatus;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onNavigateToMap,
  bleStatus,
}) => {
  const [isEsp32Expanded, setIsEsp32Expanded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('868MHz');
  const [activeProfile, setActiveProfile] = useState<'balanced' | 'long_range' | 'fast'>('balanced');
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnectBle = async () => {
    setIsConnecting(true);
    try {
      await bleBridge.connectHardwareBle();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectBle = () => {
    bleBridge.disconnect();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col font-sans animate-fadeIn">
      {/* Top Bar with Back Arrow and Centered Title "Definições" */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-900 bg-black relative">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-white hover:text-slate-300 rounded-full hover:bg-slate-900 transition-colors z-10"
          title="Voltar"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="text-xl font-bold text-white tracking-tight absolute inset-x-0 text-center pointer-events-none">
          Definições
        </h1>

        <div className="w-10" />
      </div>

      {/* Settings Menu List matching image 3 */}
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        {/* Item 1: Mapa de nós */}
        <div>
          <button
            onClick={() => {
              onClose();
              onNavigateToMap();
            }}
            className="w-full text-left py-4 flex items-center justify-between text-white hover:text-emerald-400 transition-colors group cursor-pointer"
          >
            <span className="text-xl font-bold text-white group-hover:text-emerald-400">
              Mapa de nós
            </span>
            <Map className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </button>
        </div>

        {/* Item 2: ESP32BLE with Dropdown Chevron */}
        <div className="border-t border-slate-900 pt-4">
          <button
            onClick={() => setIsEsp32Expanded(!isEsp32Expanded)}
            className="w-full text-left py-3 flex items-center justify-between text-white hover:text-emerald-400 transition-colors group cursor-pointer"
          >
            <span className="text-xl font-bold text-white group-hover:text-emerald-400">
              ESP32BLE
            </span>
            {isEsp32Expanded ? (
              <ChevronUp className="w-6 h-6 text-white group-hover:text-emerald-400 transition-colors" />
            ) : (
              <ChevronDown className="w-6 h-6 text-white group-hover:text-emerald-400 transition-colors" />
            )}
          </button>

          {/* Expanded Hardware & BLE Controls */}
          {isEsp32Expanded && (
            <div className="mt-4 p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-5 animate-fadeIn">
              {/* Bluetooth Status & Connect */}
              <div className="space-y-3 pb-4 border-b border-slate-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        bleStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">
                      {bleStatus.isConnected
                        ? `Conectado: ${bleStatus.deviceName || 'ESP32 LoRa'}`
                        : 'Nenhum rádio físico conectado'}
                    </span>
                  </div>

                  {bleStatus.isConnected ? (
                    <button
                      onClick={handleDisconnectBle}
                      className="px-3 py-1.5 bg-red-950/40 text-red-400 border border-red-800/60 rounded-xl text-xs font-semibold hover:bg-red-900/40 transition-colors"
                    >
                      Desconectar
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectBle}
                      disabled={isConnecting}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Bluetooth className="w-3.5 h-3.5" />
                      <span>{isConnecting ? 'A pesquisar...' : 'Ligar Bluetooth'}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Ligue a sua placa física ESP32, Heltec ou TTGO T-Beam para transmitir dados off-grid via ondas de rádio.
                </p>
              </div>

              {/* Frequência Regional */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Frequência da Região</span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '868MHz', label: '868 MHz (UE)' },
                    { id: '915MHz', label: '915 MHz (BR/US)' },
                    { id: '433MHz', label: '433 MHz (Geral)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedRegion(f.id)}
                      className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                        selectedRegion === f.id
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Perfis Otimizados de Rádio */}
              <div className="space-y-2 pt-2 border-t border-slate-900">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Perfil de Rádio</span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'balanced', label: 'Padrão HD', icon: Zap },
                    { id: 'long_range', label: 'Alcance Máx.', icon: Layers },
                    { id: 'fast', label: 'Rápido', icon: Radio },
                  ].map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setActiveProfile(p.id as any)}
                        className={`py-2 px-2 flex flex-col items-center gap-1 rounded-xl text-[11px] font-semibold border transition-all ${
                          activeProfile === p.id
                            ? 'bg-emerald-950/40 border-emerald-500 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
