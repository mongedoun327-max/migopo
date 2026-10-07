import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Map, Cpu, Bluetooth, Globe, Zap, Layers, Radio, Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { BleDeviceStatus } from '../types/mesh';
import { bleBridge } from '../services/bleBridge';
import { usePWAInstall } from '../hooks/usePWAInstall';

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
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  if (!isOpen) return null;

  const handleInstallApp = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowPwaGuide(true);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-white text-black flex flex-col font-sans select-none animate-fadeIn overflow-y-auto">
      <div className="max-w-[368px] mx-auto w-full min-h-screen flex flex-col justify-between bg-white">
        <div>
          {/* Top Bar with Back Arrow and Centered Title "Definições" matching definicoes.svg */}
          <div className="h-[60px] px-5 flex items-center justify-between border-b border-[#EEEEEE] bg-white relative">
            <button
              onClick={onClose}
              className="p-1 -ml-1 text-black hover:opacity-70 transition-opacity cursor-pointer z-10"
              title="Voltar"
            >
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <path d="M34 20 H18 M18 20 L25 13 M18 20 L25 27" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <h1 className="text-[25px] font-normal text-black tracking-tight absolute inset-x-0 text-center pointer-events-none">
              Definições
            </h1>

            <div className="w-6" />
          </div>

          {/* Settings Menu List matching definicoes.svg */}
          <div className="px-5 pt-7 space-y-7">
            {/* Item 1: Mapa de nós */}
            <div>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToMap();
                }}
                className="w-full text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Vertical accent bar with brandGradient */}
                  <div
                    className="w-[5px] h-[54px] rounded-[2.5px] shrink-0"
                    style={{
                      background: 'linear-gradient(180deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                    }}
                  />
                  <span className="text-[21px] font-semibold text-black tracking-tight">
                    Mapa de nós
                  </span>
                </div>

                {/* Map icon matching definicoes.svg */}
                <div className="p-2">
                  <svg width="24" height="24" viewBox="312 106 28 26" fill="none" stroke="#000000" strokeWidth="1.7" strokeLinejoin="round">
                    <path d="M315 113 L322 109 L330 113 L337 109 V125 L330 129 L322 125 L315 129 Z M322 109 V125 M330 113 V129" />
                  </svg>
                </div>
              </button>

              {/* Divider below item 1 */}
              <div className="mt-7 border-b border-[#EEEEEE]" />
            </div>

            {/* Item 2: ESP32BLE with Dropdown Chevron & visual dot */}
            <div>
              <button
                onClick={() => setIsEsp32Expanded(!isEsp32Expanded)}
                className="w-full text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Vertical bar (gradient when connected or expanded, gray otherwise) */}
                  <div
                    className={`w-[5px] h-[54px] rounded-[2.5px] shrink-0 transition-colors ${
                      bleStatus.isConnected || isEsp32Expanded
                        ? 'bg-gradient-to-b from-[#FFBB7D] via-[#EFD1BE] to-[#B3BDDC]'
                        : 'bg-[#EEEEEE]'
                    }`}
                  />
                  <span className="text-[21px] font-semibold text-black tracking-tight">
                    ESP32BLE
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2">
                  {/* Chevron matching SVG */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="310 208 22 16"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${isEsp32Expanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M314 213 L321 220 L328 213" />
                  </svg>

                  {/* Visual indicator dot with brandGradient */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                    }}
                  />
                </div>
              </button>

              {/* Expanded Hardware & BLE Controls */}
              {isEsp32Expanded && (
                <div className="mt-5 p-4 bg-[#FAFAFA] border border-[#EEEEEE] rounded-[16px] space-y-4 animate-fadeIn">
                  {/* Bluetooth Status & Connect */}
                  <div className="space-y-2 pb-3 border-b border-[#EEEEEE]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            bleStatus.isConnected ? 'bg-[#00B98B] animate-pulse' : 'bg-neutral-400'
                          }`}
                        />
                        <span className="text-xs font-semibold text-black">
                          {bleStatus.isConnected
                            ? `Conectado: ${bleStatus.deviceName || 'ESP32 LoRa'}`
                            : 'Nenhum rádio físico conectado'}
                        </span>
                      </div>

                      {bleStatus.isConnected ? (
                        <button
                          onClick={handleDisconnectBle}
                          className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectBle}
                          disabled={isConnecting}
                          className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-full text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>{isConnecting ? 'A pesquisar...' : 'Ligar Bluetooth'}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#777777] leading-relaxed">
                      Ligue a sua placa física ESP32, Heltec ou TTGO T-Beam para transmitir dados off-grid via rádio.
                    </p>
                  </div>

                  {/* Frequência Regional */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-black flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-black" />
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
                          className={`py-2 px-1 text-center rounded-[10px] text-xs font-semibold border transition-all cursor-pointer ${
                            selectedRegion === f.id
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-white border-[#DDDDDD] text-[#777777] hover:border-black'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Perfis Otimizados de Rádio */}
                  <div className="space-y-2 pt-2 border-t border-[#EEEEEE]">
                    <span className="text-xs font-semibold text-black flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-black" />
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
                            className={`py-2 px-1 flex flex-col items-center gap-1 rounded-[10px] text-[11px] font-semibold border transition-all cursor-pointer ${
                              activeProfile === p.id
                                ? 'bg-black text-white border-black'
                                : 'bg-white border-[#DDDDDD] text-[#777777] hover:border-black'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Divider below item 2 */}
            <div className="border-b border-[#EEEEEE]" />

            {/* Item 3: Instalar no Dispositivo (PWA) */}
            <div>
              <button
                onClick={handleInstallApp}
                className="w-full text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Vertical bar */}
                  <div
                    className="w-[5px] h-[54px] rounded-[2.5px] shrink-0"
                    style={{
                      background: 'linear-gradient(180deg, #FFBB7D 0%, #EFD1BE 48%, #B3BDDC 100%)',
                    }}
                  />
                  <div>
                    <span className="text-[21px] font-semibold text-black tracking-tight block">
                      Instalar no Dispositivo
                    </span>
                    <span className="text-xs text-[#777777]">
                      {isInstalled
                        ? 'Aplicação já instalada no ecrã principal'
                        : isInstallable
                        ? 'Toque para instalar diretamente (PWA)'
                        : 'Instalar no telemóvel ou computador'}
                    </span>
                  </div>
                </div>

                <div className="p-2 flex items-center gap-2">
                  {isInstalled ? (
                    <CheckCircle2 className="w-5 h-5 text-[#00B98B]" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </button>

              {/* Divider below item 3 */}
              <div className="mt-7 border-b border-[#EEEEEE]" />
            </div>
          </div>
        </div>

        {/* PWA Guided Installation Dialog */}
        {showPwaGuide && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-black">
              <div className="flex items-center justify-between pb-3 border-b border-[#EEEEEE]">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-black" />
                  <h3 className="font-bold text-base text-black">Instalar no Dispositivo</h3>
                </div>
                <button
                  onClick={() => setShowPwaGuide(false)}
                  className="text-[#777777] hover:text-black p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3 text-xs leading-relaxed text-[#555555]">
                  <p>
                    Para instalar no seu <strong>iPhone ou iPad</strong>:
                  </p>
                  <ol className="space-y-2.5 bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 rounded-xl font-medium text-black">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        1
                      </span>
                      <span>
                        Toque no botão de <strong>Partilhar</strong>{' '}
                        <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> na barra inferior do Safari.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        2
                      </span>
                      <span>
                        Role para baixo e selecione{' '}
                        <strong>"Adicionar ao ecrã principal"</strong>{' '}
                        <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-600" />.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        3
                      </span>
                      <span>
                        Toque em <strong>Adicionar</strong> no canto superior direito.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 text-xs leading-relaxed text-[#555555]">
                  <p>
                    Para instalar no seu navegador:
                  </p>
                  <ol className="space-y-2.5 bg-[#FAFAFA] border border-[#EEEEEE] p-3.5 rounded-xl font-medium text-black">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        1
                      </span>
                      <span>
                        Abra o menu do navegador (três pontos <strong>⋮</strong>).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        2
                      </span>
                      <span>
                        Selecione <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => setShowPwaGuide(false)}
                  className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
