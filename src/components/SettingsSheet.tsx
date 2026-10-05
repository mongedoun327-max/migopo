import React from 'react';
import {
  X,
  ChevronRight,
  Globe,
  Radio,
  Shield,
  Cpu,
  Layers,
  Share2,
  Mic,
  MessageCircle,
  ExternalLink,
  User,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { BleDeviceStatus, UserRegistration } from '../types/mesh';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  myProfile: UserRegistration;
  bleStatus: BleDeviceStatus;
  onOpenProfile: () => void;
  onOpenHardware: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
  myProfile,
  bleStatus,
  onOpenProfile,
  onOpenHardware,
}) => {
  if (!isOpen) return null;

  const settingRows = [
    {
      id: 'profile',
      title: 'Identidade do Operador',
      subtitle: `${myProfile.name} (@${myProfile.username}) · ${myProfile.callsign}`,
      icon: User,
      onClick: () => {
        onClose();
        onOpenProfile();
      },
    },
    {
      id: 'frequency',
      title: 'Frequência Regional LoRa',
      subtitle: `${myProfile.frequencyBand} (Padrão 868 MHz Europa/Portugal)`,
      icon: Radio,
      onClick: () => {},
    },
    {
      id: 'hardware',
      title: 'Módulo LoRa & BLE',
      subtitle: bleStatus.isConnected
        ? `Conectado: ${bleStatus.deviceName}`
        : 'Simulador Virtual / ESP32 BLE',
      icon: Cpu,
      onClick: () => {
        onClose();
        onOpenHardware();
      },
    },
    {
      id: 'codec',
      title: 'Compressão de Voz Codec2',
      subtitle: '1200 bps · Ultra-baixa largura de banda para rádio',
      icon: Mic,
      onClick: () => {},
    },
    {
      id: 'encryption',
      title: 'Criptografia E2EE de Canal',
      subtitle: 'AES-256-GCM com autenticação GMAC',
      icon: Shield,
      onClick: () => {},
    },
    {
      id: 'hops',
      title: 'Encaminhamento Mesh (Multi-hop)',
      subtitle: 'Roteamento autônomo com limite de 3 saltos',
      icon: Share2,
      onClick: () => {},
    },
    {
      id: 'power',
      title: 'Potência de Transmissão (TX)',
      subtitle: '+20 dBm (Alcance estendido até 25 km)',
      icon: Sliders,
      onClick: () => {},
    },
    {
      id: 'language',
      title: 'Idioma',
      subtitle: 'Português (Padrão do sistema)',
      icon: Globe,
      onClick: () => {},
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container matching Screenshot 2 */}
      <div className="relative w-full max-w-lg bg-slate-950 border-t border-slate-800 rounded-t-[32px] p-6 shadow-2xl space-y-5 max-h-[88vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200">
        {/* Grab Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between pt-1 pb-2 border-b border-slate-900">
          <h2 className="text-xl font-bold tracking-tight text-white">Configurações</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setting Rows List */}
        <div className="divide-y divide-slate-900/60">
          {settingRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.id}
                onClick={row.onClick}
                className="w-full py-3.5 flex items-center justify-between text-left hover:bg-slate-900/40 rounded-xl px-2 transition-colors group"
              >
                <div className="flex items-center gap-3.5 pr-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-white truncate">
                      {row.title}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {row.subtitle}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-semibold rounded-2xl text-xs transition-colors"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
