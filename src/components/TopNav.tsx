import React from 'react';
import { Bluetooth, Map, MessageSquare, Cpu } from 'lucide-react';
import { BleDeviceStatus } from '../types/mesh';

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  bleStatus: BleDeviceStatus;
  onOpenBleModal: () => void;
  onTriggerSos?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  bleStatus,
  onOpenBleModal,
}) => {
  const navItems = [
    { id: 'direct', label: 'Mensagens', icon: MessageSquare },
    { id: 'topology', label: 'Mapa Mesh', icon: Map },
    { id: 'hardware', label: 'Hardware & BLE', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-bold text-base tracking-tight text-white leading-none">
            LoRa<span className="text-emerald-400">Direct</span>
          </span>
        </div>

        {/* Zone 2: Segmented Nav Control */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800/80 shadow-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Hardware Connection Status */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenBleModal}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all flex items-center gap-2 border ${
              bleStatus.isConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Estado da Ligação Bluetooth"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                bleStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <Bluetooth className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              {bleStatus.isConnected ? (bleStatus.deviceName || 'Rádio Conectado') : 'Ligar Rádio'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
