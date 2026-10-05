import React, { useState } from 'react';
import {
  ShieldCheck,
  Radio,
  Cpu,
  User,
  Key,
  WifiOff,
  CheckCircle2,
  X,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { UserRegistration, LoRaFrequencyBand } from '../types/mesh';
import { meshManager } from '../services/meshProtocol';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserRegistration;
  onProfileSaved: (profile: UserRegistration) => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onProfileSaved,
}) => {
  const [name, setName] = useState(currentProfile.name);
  const [username, setUsername] = useState(currentProfile.username);
  const [callsign, setCallsign] = useState(currentProfile.callsign);
  const [bio, setBio] = useState(currentProfile.bio);
  const [hardware, setHardware] = useState(currentProfile.hardware);
  const [role, setRole] = useState(currentProfile.role);
  const [frequencyBand, setFrequencyBand] = useState<LoRaFrequencyBand>(currentProfile.frequencyBand);
  const [showIdentityCard, setShowIdentityCard] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) return;

    const cleanedUsername = username.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '.');

    const updated: UserRegistration = {
      ...currentProfile,
      name: name.trim(),
      username: cleanedUsername,
      callsign: callsign.trim().toUpperCase() || 'ALFA-01',
      bio: bio.trim(),
      hardware,
      role,
      frequencyBand,
    };

    meshManager.saveMyProfile(updated);
    onProfileSaved(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-950/40">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">
                Cadastro de Identidade Off-Grid
              </h2>
              <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <WifiOff className="w-3 h-3" />
                <span>100% Gratuito · Sem gastar dados ou internet</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Off-Grid Explanation Banner */}
        <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Radio className="w-4 h-4" />
            <span>Sincronização em Tempo Real na Rede</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ao salvar o seu nome, handle e indicativo, a alteração é <strong>transmitida instantaneamente para todos os utilizadores</strong> conectados na rede mesh.
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nome do Operador
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Miguel Santos"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Nome de Utilizador (@handle)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-mono">@</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="miguel.tactical"
                  className="w-full pl-7 pr-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Indicativo de Rádio (Callsign)
              </label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="ex: ALFA-01"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Frequência Regional LoRa
              </label>
              <select
                value={frequencyBand}
                onChange={(e) => setFrequencyBand(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="868MHz">868 MHz (Europa / Portugal)</option>
                <option value="915MHz">915 MHz (Brasil / Américas)</option>
                <option value="433MHz">433 MHz (Banda Amadora)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Módulo Hardware LoRa (ESP32)
              </label>
              <select
                value={hardware}
                onChange={(e) => setHardware(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="TTGO T-Beam v1.2">TTGO T-Beam v1.2 (com GPS)</option>
                <option value="Heltec WiFi LoRa 32 V3">Heltec WiFi LoRa 32 V3</option>
                <option value="RAK4631 WisBlock">RAK4631 WisBlock</option>
                <option value="ESP32 DIY SX1262">ESP32 DIY SX1262</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Função de Roteamento Mesh
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="BASE_STATION">Estação Base (Walkie-Talkie)</option>
                <option value="ROUTER_REPEATER">Repetidor de Pico / Colina</option>
                <option value="CLIENT">Patrulha Móvel em Terreno</option>
                <option value="TRACKER">Rastreador GPS de Emergência</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Biografia / Descrição da Equipa
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="ex: Coordenador de campo · Base Sul da Serra"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 font-sans"
            />
          </div>

          {/* Cryptographic Node Key Readout */}
          <div className="p-3 bg-slate-900/50 rounded-2xl border border-slate-800 text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                ID Criptográfico do Nó:
              </span>
              <span className="text-emerald-400 font-bold">{currentProfile.nodeId}</span>
            </div>
            <div className="text-slate-500 truncate">
              Chave Pública: {currentProfile.publicKeyHex}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-400 hover:text-white rounded-xl font-medium"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-emerald-950/30 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar & Transmitir Nome na Rede</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
