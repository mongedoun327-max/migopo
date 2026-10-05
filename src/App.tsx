/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Share2,
  Cpu,
  Activity,
  Shield,
  Code,
  ShieldAlert,
  X,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import { TopNav } from './components/TopNav';
import { MeshTopologyMap } from './components/MeshTopologyMap';
import { HardwareBlePanel } from './components/HardwareBlePanel';
import { meshManager } from './services/meshProtocol';
import { bleBridge } from './services/bleBridge';
import { BleDeviceStatus, MeshNode, MeshPacket, UserRegistration } from './types/mesh';
import { audioEngine } from './services/audioCodec';
import { InstagramDirectView } from './components/InstagramDirectView';
import { RegistrationModal } from './components/RegistrationModal';
import { EditNameModal } from './components/EditNameModal';
import { voiceCallService, VoiceCallState } from './services/voiceCallService';
import { VoiceCallModal } from './components/VoiceCallModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('direct');
  const [nodes, setNodes] = useState<MeshNode[]>(meshManager.getNodes());
  const [packets, setPackets] = useState<MeshPacket[]>(meshManager.getPackets());
  const [bleStatus, setBleStatus] = useState<BleDeviceStatus>(bleBridge.getStatus());
  const [myProfile, setMyProfile] = useState<UserRegistration>(meshManager.getMyProfile());
  const [callState, setCallState] = useState<VoiceCallState>(voiceCallService.getState());

  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isBleModalOpen, setIsBleModalOpen] = useState(false);
  const [sosSentBanner, setSosSentBanner] = useState(false);
  const [selectedDirectNodeId, setSelectedDirectNodeId] = useState<string>('group-broadcast');

  // Subscribe to services
  useEffect(() => {
    const unsubNodes = meshManager.subscribeNodes((newNodes) => {
      setNodes(newNodes);
      const selfNode = newNodes.find((n) => n?.isSelf) || newNodes[0];
      if (selfNode) {
        voiceCallService.init(selfNode.id, selfNode.name);
      }
    });
    const unsubPackets = meshManager.subscribePackets(setPackets);
    const unsubBle = bleBridge.subscribe(setBleStatus);
    const unsubCall = voiceCallService.subscribe(setCallState);

    // Initial init
    const initialSelf = meshManager.getNodes().find((n) => n?.isSelf);
    if (initialSelf) {
      voiceCallService.init(initialSelf.id, initialSelf.name);
    }

    return () => {
      unsubNodes();
      unsubPackets();
      unsubBle();
      unsubCall();
    };
  }, []);

  const handleTriggerSos = () => {
    setIsSosModalOpen(true);
  };

  const handleConfirmSos = async () => {
    const selfNode = nodes.find((n) => n?.isSelf) || nodes[0];
    if (!selfNode) return;
    setIsSosModalOpen(false);

    audioEngine.playRadioSquelch('intro');

    await meshManager.sendPacket({
      channelId: 2, // Emergency SOS Channel
      packetType: 'SOS_BEACON',
      location: selfNode.gps || { lat: 38.72, lng: -9.14, alt: 50 },
      payloadText: `🚨 ALERTA SOS DE EMERGÊNCIA: Operador ${selfNode.callsign || 'ALFA'} requisitou apoio imediato!`,
      hopLimit: 4, // Max TTL for emergency beacon
    });

    setSosSentBanner(true);
    setTimeout(() => setSosSentBanner(false), 8000);
  };

  // Mobile Bottom Navigation Bar Items
  const mobileTabs = [
    { id: 'direct', label: 'Direct', icon: Radio },
    { id: 'topology', label: 'Mapa Nós', icon: Share2 },
    { id: 'hardware', label: 'ESP32 BLE', icon: Cpu },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Bar Navigation */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bleStatus={bleStatus}
        onOpenBleModal={() => setIsBleModalOpen(true)}
        onTriggerSos={handleTriggerSos}
      />

      {/* SOS Alert Banner */}
      {sosSentBanner && (
        <div className="bg-red-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg shadow-red-950/60 animate-bounce">
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>ALERTA SOS IRRADIADO: Rádio em emergência contínua com beacon GPS ativo no canal 2.</span>
          </div>
          <button
            onClick={() => setSosSentBanner(false)}
            className="text-white hover:text-red-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'direct' && (
          <InstagramDirectView
            nodes={nodes}
            packets={packets}
            initialSelectedContactId={selectedDirectNodeId}
            onOpenMap={() => setActiveTab('topology')}
            onOpenHardwareTools={() => setActiveTab('hardware')}
            onOpenEditName={() => setIsEditNameModalOpen(true)}
            onOpenProfileRegistration={() => setIsRegistrationModalOpen(true)}
          />
        )}

        {activeTab === 'topology' && (
          <MeshTopologyMap
            nodes={nodes}
            packets={packets}
            onSelectNodeForDirectMessage={(node) => {
              setSelectedDirectNodeId(node.id);
              setActiveTab('direct');
            }}
          />
        )}

        {activeTab === 'hardware' && (
          <HardwareBlePanel bleStatus={bleStatus} />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-slate-900 grid grid-cols-3 items-center h-14 px-2">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* SOS Emergency Confirmation Modal */}
      {isSosModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-600 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl shadow-red-950/50">
            <div className="flex items-center gap-3 text-red-500 pb-2 border-b border-red-900/60">
              <ShieldAlert className="w-7 h-7 shrink-0 animate-pulse" />
              <div>
                <h3 className="font-display font-bold text-lg text-slate-100">
                  Transmitir Alerta de Emergência SOS?
                </h3>
                <p className="text-xs text-red-400">
                  Transmissão com prioridade máxima e repetição forçada
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação enviará um pacote prioritário com as suas coordenadas GPS atuais e identificação de rádio para todos os nós vizinhos e repetidores num raio de até 25 km através da rede mesh LoRa.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-slate-400">Canal: #Emergência-SOS (ID: 2)</div>
              <div className="text-slate-400">Saltos TTL: 4 hops (Cobertura total)</div>
              <div className="text-emerald-400">Beacon GPS: Coordenadas embutidas</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSosModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSos}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-lg shadow-red-950 flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>CONFIRMAR TRANSMISSÃO SOS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLE Connection Quick Drawer / Modal */}
      {isBleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-bold text-base text-slate-100">
                  Conexão com Módulo LoRa
                </h3>
              </div>
              <button
                onClick={() => setIsBleModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                A aplicação liga-se a um módulo físico portátil (ex: <strong>TTGO T-Beam, Heltec WiFi LoRa 32 V3 ou RAK4631</strong>) via <strong>Bluetooth Low Energy (BLE)</strong>.
              </p>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Estado Atual:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {bleStatus.isConnected ? 'Rádio BLE Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Dispositivo:</span>
                  <span className="font-mono text-slate-200">{bleStatus.deviceName || 'Nenhum rádio emparelhado'}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={async () => {
                    await bleBridge.connectHardwareBle();
                    setIsBleModalOpen(false);
                  }}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Wifi className="w-4 h-4" />
                  <span>Procurar & Ligar Rádio Bluetooth (BLE)</span>
                </button>

                <button
                  onClick={() => setIsBleModalOpen(false)}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Name Change Dialog - No account creation, no chat messages */}
      <EditNameModal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        currentName={myProfile.name || (nodes.find((n) => n?.isSelf)?.name ?? 'Operador')}
        onSave={(newName) => {
          meshManager.updateMyName(newName);
          setNodes(meshManager.getNodes());
          setMyProfile(meshManager.getMyProfile());
        }}
      />

      {/* Off-Grid User Registration & Cryptographic Profile Modal */}
      <RegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        currentProfile={myProfile}
        onProfileSaved={(updated) => {
          setMyProfile(updated);
          setNodes(meshManager.getNodes());
        }}
      />

      {/* Real-time Voice Call Overlay Modal */}
      <VoiceCallModal callState={callState} />
    </div>
  );
}
