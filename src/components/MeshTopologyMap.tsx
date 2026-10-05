import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Battery,
  Navigation,
  Compass,
  Plus,
  Layers,
  Activity,
  Zap,
  Cpu,
  Signal,
  MapPin,
  X,
  Share2,
} from 'lucide-react';
import { MeshNode, MeshPacket } from '../types/mesh';
import { meshManager, HopPropagationStep } from '../services/meshProtocol';

interface MeshTopologyMapProps {
  nodes: MeshNode[];
  packets: MeshPacket[];
  onSelectNodeForDirectMessage?: (node: MeshNode) => void;
}

export const MeshTopologyMap: React.FC<MeshTopologyMapProps> = ({
  nodes,
  packets,
  onSelectNodeForDirectMessage,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDraggingNodeId, setIsDraggingNodeId] = useState<string | null>(null);
  const [activeHopSteps, setActiveHopSteps] = useState<HopPropagationStep[]>([]);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to hop steps for real-time radio animation
  useEffect(() => {
    const unsub = meshManager.onHopStep((step) => {
      setActiveHopSteps((prev) => [...prev.slice(-6), step]);
      // Remove step after 2.5 seconds
      setTimeout(() => {
        setActiveHopSteps((prev) => prev.filter((s) => s !== step));
      }, 2500);
    });
    return unsub;
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Handle Dragging Nodes on Canvas
  const handlePointerDown = (nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingNodeId || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    meshManager.updateNodePosition(isDraggingNodeId, xPct, yPct);
  };

  const handlePointerUp = () => {
    setIsDraggingNodeId(null);
  };

  // Determine line connections between nodes within radio range (distance <= 52%)
  const connections: { from: MeshNode; to: MeshNode; dist: number; quality: 'good' | 'medium' | 'weak' }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 52) {
        let quality: 'good' | 'medium' | 'weak' = 'good';
        if (dist > 38) quality = 'weak';
        else if (dist > 22) quality = 'medium';
        connections.push({ from: a, to: b, dist, quality });
      }
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4.5rem)] max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 gap-4">
      {/* Left/Center: Topographic Mesh Radar Canvas */}
      <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl">
        {/* Radar Map Header Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display font-semibold text-sm tracking-wide text-slate-200">
              RADAR DE PROPAGAÇÃO EM CAMPO
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              · {nodes.length} Nós Ativos · {connections.length} Enlaces RF
            </span>
          </div>
        </div>

        {/* Interactive Canvas Area */}
        <div
          ref={canvasContainerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex-1 relative overflow-hidden select-none cursor-crosshair bg-slate-950"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.04) 0%, transparent 80%), linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        >
          {/* Subtle Topographic Terrain Texture Backing */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none bg-cover bg-center mix-blend-luminosity"
            style={{ backgroundImage: `url('/src/assets/images/tactical_mesh_terrain_1791144648614.jpg')` }}
          />

          {/* SVG Layer for Radio Links & Wave Propagations */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Range and concentric radar rings */}
            <circle cx="50%" cy="50%" r="20%" fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <circle cx="50%" cy="50%" r="35%" fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />
            <circle cx="50%" cy="50%" r="48%" fill="none" stroke="rgba(255,255,255,0.02)" />

            {/* Static RF Links between Nodes */}
            {connections.map((c, idx) => {
              const strokeColor =
                c.quality === 'good'
                  ? 'rgba(16, 185, 129, 0.4)'
                  : c.quality === 'medium'
                  ? 'rgba(234, 179, 8, 0.35)'
                  : 'rgba(249, 115, 22, 0.3)';
              return (
                <line
                  key={idx}
                  x1={`${c.from.x}%`}
                  y1={`${c.from.y}%`}
                  x2={`${c.to.x}%`}
                  y2={`${c.to.y}%`}
                  stroke={strokeColor}
                  strokeWidth={c.quality === 'good' ? 1.5 : 1}
                  strokeDasharray={c.quality === 'weak' ? '4 3' : undefined}
                />
              );
            })}

            {/* Animated Hop Step Wave Beam */}
            {activeHopSteps.map((step, idx) => {
              const fromN = nodes.find((n) => n.id === step.fromNodeId);
              const toN = nodes.find((n) => n.id === step.toNodeId);
              if (!fromN || !toN) return null;

              return (
                <g key={idx}>
                  <line
                    x1={`${fromN.x}%`}
                    y1={`${fromN.y}%`}
                    x2={`${toN.x}%`}
                    y2={`${toN.y}%`}
                    stroke="#10b981"
                    strokeWidth="3"
                    className="animate-pulse"
                  />
                  <circle
                    cx={`${toN.x}%`}
                    cy={`${toN.y}%`}
                    r="24"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    className="animate-ping"
                  />
                </g>
              );
            })}
          </svg>

          {/* Interactive Draggable Nodes */}
          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isSelf = node.isSelf;
            const isRepeater = node.role === 'ROUTER_REPEATER' || node.role === 'BASE_STATION';

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handlePointerDown(node.id, e)}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute z-20 cursor-grab active:cursor-grabbing p-1.5 rounded-xl transition-transform flex flex-col items-center group ${
                  isSelected ? 'scale-110' : 'hover:scale-105'
                }`}
              >
                {/* Node RF Bubble / Coverage Outline on Hover or Selection */}
                {isSelected && (
                  <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 bg-emerald-500/5 -z-10 pointer-events-none animate-pulse" />
                )}

                {/* Node Icon Box */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-colors border ${
                    isSelf
                      ? 'bg-emerald-600 text-slate-950 border-emerald-400 font-bold ring-2 ring-emerald-500/30'
                      : isRepeater
                      ? 'bg-amber-600 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {isRepeater ? (
                    <Zap className="w-4 h-4 fill-current" />
                  ) : (
                    <Radio className="w-4 h-4" />
                  )}
                </div>

                {/* Node Label / Callsign */}
                <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] font-mono whitespace-nowrap text-slate-200 flex items-center gap-1 shadow-md">
                  <span className="font-semibold">{node.callsign}</span>
                  {node.hopsAway > 0 && (
                    <span className="text-slate-400">· {node.hopsAway}s</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Canvas Drag Helper Hint */}
          <div className="absolute bottom-3 left-4 text-[11px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800/80 pointer-events-none">
            💡 Dica: Arraste os nós para testar o alcance RF e saltos automáticos no terreno.
          </div>
        </div>
      </div>

      {/* Right Drawer: Selected Node Telemetry & Configuration */}
      <div className="w-full lg:w-84 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col shrink-0">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                  {selectedNode.role.replace('_', ' ')}
                </span>
                <h3 className="font-display text-base font-bold text-slate-100">
                  {selectedNode.callsign}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hardware & Battery Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-emerald-400" /> Bateria
                </span>
                <div className="font-mono text-slate-100 font-bold">
                  {selectedNode.batteryPct.toFixed(0)}% · {selectedNode.batteryVoltage.toFixed(2)}V
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Signal className="w-3.5 h-3.5 text-sky-400" /> Sinal RF
                </span>
                <div className="font-mono text-slate-100 font-bold">
                  {selectedNode.rssi} dBm ({selectedNode.snr > 0 ? `+${selectedNode.snr}` : selectedNode.snr}dB)
                </div>
              </div>
            </div>

            {/* Location & GPS */}
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-red-400" /> Posição Geográfica (GPS)
              </span>
              <div className="font-mono text-slate-200">
                {selectedNode.gps.lat.toFixed(4)}°N, {selectedNode.gps.lng.toFixed(4)}°W
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Altitude: {selectedNode.gps.alt} metros
              </div>
            </div>

            {/* Hardware & Radio Specs */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Modelo Hardware:</span>
                <span className="font-mono text-slate-200">{selectedNode.hardware}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Antena:</span>
                <span className="font-mono text-slate-200">{selectedNode.antennaDbi} dBi (SMA)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Pacotes Retransmitidos:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {selectedNode.packetsForwarded} pkts
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Saltos até Base:</span>
                <span className="font-mono text-slate-200">{selectedNode.hopsAway} hops</span>
              </div>
            </div>

            {/* Direct Action */}
            <div className="pt-2">
              <button
                onClick={() => onSelectNodeForDirectMessage?.(selectedNode)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Mensagem Direta P2P Cifrada</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-slate-400 space-y-2">
            <Radio className="w-8 h-8 text-slate-600 mb-1" />
            <h4 className="text-sm font-semibold text-slate-300">Nenhum Nó Selecionado</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clique em qualquer nó no radar para inspecionar métricas de rádio, nível de bateria e rota de encaminhamento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
