import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerNode {
  id: string;
  name: string;
  username: string;
  callsign: string;
  avatarColor: string;
  avatarInitials: string;
  bio: string;
  statusText: string;
  hardware: string;
  role: string;
  batteryPct: number;
  batteryVoltage: number;
  gps: { lat: number; lng: number; alt: number };
  x: number;
  y: number;
  antennaDbi: number;
  isOnline: boolean;
  lastHeard: number;
  hopsAway: number;
  rssi: number;
  snr: number;
  packetsForwarded: number;
  isGroup?: boolean;
}

interface ServerPacket {
  id: string;
  timestamp: number;
  fromNodeId: string;
  toNodeId: string;
  channelId: number;
  hopLimit: number;
  hopStart: number;
  packetType: string;
  payloadText?: string;
  voiceBurst?: any;
  location?: { lat: number; lng: number; alt?: number };
  encrypted: boolean;
  authTag?: string;
  airtimeMs: number;
  rssiDbm: number;
  snrDb: number;
  pathTraveled: string[];
  likedByMe?: boolean;
}

interface CallSession {
  callId: string;
  callerNodeId: string;
  callerName: string;
  targetNodeId: string;
  targetName?: string;
  status: 'RINGING' | 'CONNECTED' | 'REJECTED' | 'ENDED';
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
}

interface BufferedAudioChunk {
  callId: string;
  fromNodeId: string;
  toNodeId: string;
  audioData: string;
  mimeType: string;
  timestamp: number;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // In-memory real mesh network state across all real users
  let registeredNodes: ServerNode[] = [];
  let meshPackets: ServerPacket[] = [];

  // Voice Call Sessions and Relay State
  const callSessions = new Map<string, CallSession>();
  let bufferedAudio: BufferedAudioChunk[] = [];
  const pendingOffers = new Map<string, any>();
  const wsClients = new Map<string, Set<WebSocket>>();

  // Sequential 8-digit phone number allocation starting with 41160001
  let nextPhoneSequence = 1;
  const assignedPhoneMap = new Map<string, string>(); // nodeId -> 4116XXXX

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/call' });

  wss.on('connection', (ws: WebSocket, req) => {
    let clientNodeId: string | null = null;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      clientNodeId = url.searchParams.get('nodeId');
    } catch {
      clientNodeId = null;
    }

    if (clientNodeId) {
      if (!wsClients.has(clientNodeId)) {
        wsClients.set(clientNodeId, new Set());
      }
      wsClients.get(clientNodeId)!.add(ws);
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || !msg.type) return;

        if (msg.type === 'REGISTER') {
          const registeredId = typeof msg.nodeId === 'string' ? msg.nodeId : null;
          if (registeredId) {
            clientNodeId = registeredId;
            if (!wsClients.has(registeredId)) {
              wsClients.set(registeredId, new Set());
            }
            wsClients.get(registeredId)!.add(ws);
          }
          return;
        }

        if (msg.type === 'CALL_OFFER') {
          const { callId, callerNodeId, callerName, targetNodeId } = msg;
          const session: CallSession = {
            callId,
            callerNodeId,
            callerName,
            targetNodeId,
            status: 'RINGING',
            startedAt: Date.now(),
          };
          callSessions.set(callId, session);
          pendingOffers.set(targetNodeId, msg);

          // Broadcast to target's connected sockets
          const targetSockets = wsClients.get(targetNodeId);
          if (targetSockets && targetSockets.size > 0) {
            const payload = JSON.stringify(msg);
            targetSockets.forEach((s) => {
              if (s.readyState === WebSocket.OPEN) s.send(payload);
            });
          }
          return;
        }

        if (msg.type === 'CALL_ANSWER') {
          const { callId, callerNodeId, targetNodeId } = msg;
          const session = callSessions.get(callId);
          if (session) {
            session.status = 'CONNECTED';
            session.connectedAt = Date.now();
          }
          pendingOffers.delete(targetNodeId);

          const callerSockets = wsClients.get(callerNodeId);
          if (callerSockets) {
            const payload = JSON.stringify(msg);
            callerSockets.forEach((s) => {
              if (s.readyState === WebSocket.OPEN) s.send(payload);
            });
          }
          return;
        }

        if (msg.type === 'CALL_REJECT' || msg.type === 'CALL_HANGUP') {
          const { callId, callerNodeId, targetNodeId } = msg;
          const session = callSessions.get(callId);
          if (session) {
            session.status = msg.type === 'CALL_REJECT' ? 'REJECTED' : 'ENDED';
            session.endedAt = Date.now();
          }
          pendingOffers.delete(targetNodeId);

          // Notify both caller and target
          const payload = JSON.stringify(msg);
          [callerNodeId, targetNodeId].forEach((id) => {
            if (!id) return;
            const socks = wsClients.get(id);
            if (socks) {
              socks.forEach((s) => {
                if (s.readyState === WebSocket.OPEN) s.send(payload);
              });
            }
          });
          return;
        }

        if (msg.type === 'CALL_AUDIO_STREAM') {
          const { callId, fromNodeId, toNodeId, audioData, mimeType, timestamp } = msg;
          const chunk: BufferedAudioChunk = {
            callId,
            fromNodeId,
            toNodeId,
            audioData,
            mimeType: mimeType || 'audio/webm',
            timestamp: timestamp || Date.now(),
          };

          bufferedAudio.push(chunk);
          if (bufferedAudio.length > 200) {
            bufferedAudio.shift();
          }

          // Ultra-low latency direct forward to target
          const targetSockets = wsClients.get(toNodeId);
          if (targetSockets) {
            const payload = JSON.stringify(msg);
            targetSockets.forEach((s) => {
              if (s.readyState === WebSocket.OPEN) s.send(payload);
            });
          }
          return;
        }

        if (msg.type === 'WEBRTC_SIGNAL') {
          const { toNodeId } = msg;
          const targetSockets = wsClients.get(toNodeId);
          if (targetSockets) {
            const payload = JSON.stringify(msg);
            targetSockets.forEach((s) => {
              if (s.readyState === WebSocket.OPEN) s.send(payload);
            });
          }
          return;
        }
      } catch (err) {
        console.warn('[Call-WS] Error handling message:', err);
      }
    });

    ws.on('close', () => {
      if (clientNodeId && wsClients.has(clientNodeId)) {
        wsClients.get(clientNodeId)!.delete(ws);
        if (wsClients.get(clientNodeId)!.size === 0) {
          wsClients.delete(clientNodeId);
        }
      }
    });
  });

  // Default broadcast channel node representing the common frequency for all real users
  const broadcastGroupNode: ServerNode = {
    id: 'group-broadcast',
    name: 'Canal Geral #Todos',
    username: 'frequencia.geral',
    callsign: 'TODOS-00',
    avatarColor: '#10b981',
    avatarInitials: 'CG',
    bio: 'Canal aberto comunitário para todos os operadores conectados',
    statusText: 'Frequência aberta ativa',
    isGroup: true,
    hardware: 'ESP32 DIY SX1262',
    role: 'BASE_STATION',
    batteryPct: 100,
    batteryVoltage: 4.2,
    gps: { lat: 38.72, lng: -9.14, alt: 50 },
    x: 50,
    y: 50,
    antennaDbi: 3.0,
    isOnline: true,
    lastHeard: Date.now(),
    hopsAway: 0,
    rssi: -55,
    snr: 9.5,
    packetsForwarded: 0,
  };

  // Register or update real user node
  app.post('/api/mesh/nodes', (req, res) => {
    const node = req.body as ServerNode;
    if (!node || !node.id) {
      return res.status(400).json({ error: 'Nó inválido' });
    }

    node.lastHeard = Date.now();
    node.isOnline = true;

    const existingIndex = registeredNodes.findIndex((n) => n.id === node.id);
    if (existingIndex >= 0) {
      const oldName = registeredNodes[existingIndex].name;
      registeredNodes[existingIndex] = {
        ...registeredNodes[existingIndex],
        ...node,
        lastHeard: Date.now(),
        isOnline: true,
      };
      if (oldName !== node.name) {
        console.log(`[LoRaMesh] Operador alterou nome: "${oldName}" -> "${node.name}" (@${node.username}) [${node.id}]`);
      }
    } else {
      registeredNodes.push(node);
      console.log(`[LoRaMesh] Novo operador real registrado: ${node.name} (@${node.username}) [${node.id}]`);
    }

    const updatedNode = existingIndex >= 0 ? registeredNodes[existingIndex] : node;
    res.json({ success: true, node: updatedNode });
  });

  // Get all real connected nodes
  app.get('/api/mesh/nodes', (req, res) => {
    const now = Date.now();
    // Update online status (offline if not heard in 5 minutes)
    registeredNodes.forEach((n) => {
      n.isOnline = now - n.lastHeard < 5 * 60 * 1000;
    });

    res.json([broadcastGroupNode, ...registeredNodes]);
  });

  // Allocate unique sequential 8-digit phone number starting with 41160001
  app.post('/api/mesh/phone/allocate', (req, res) => {
    const { nodeId } = req.body;
    if (!nodeId || typeof nodeId !== 'string') {
      return res.status(400).json({ error: 'nodeId é obrigatório' });
    }

    if (assignedPhoneMap.has(nodeId)) {
      return res.json({ phoneNumber: assignedPhoneMap.get(nodeId), sequence: null });
    }

    const seqStr = nextPhoneSequence.toString().padStart(4, '0');
    const phoneNumber = `4116${seqStr}`;
    assignedPhoneMap.set(nodeId, phoneNumber);
    const assignedSeq = nextPhoneSequence;
    nextPhoneSequence++;

    console.log(`[PhoneSystem] Número 4116 gerado para nó ${nodeId}: ${phoneNumber} (#${assignedSeq})`);
    res.json({ phoneNumber, sequence: assignedSeq });
  });

  // Post a real message or voice note packet
  app.post('/api/mesh/packets', (req, res) => {
    const packet = req.body as ServerPacket;
    if (!packet || !packet.id) {
      return res.status(400).json({ error: 'Pacote inválido' });
    }

    // Deduplication check
    const exists = meshPackets.some((p) => p.id === packet.id);
    if (!exists) {
      meshPackets.push(packet);
      if (meshPackets.length > 500) {
        meshPackets.shift(); // retain last 500 packets
      }
      console.log(`[LoRaMesh] Pacote real recebido: ${packet.packetType} de ${packet.fromNodeId} para ${packet.toNodeId}`);
    }

    res.json({ success: true, packet });
  });

  // Get real packets
  app.get('/api/mesh/packets', (req, res) => {
    const since = parseInt(req.query.since as string) || 0;
    const newPackets = meshPackets.filter((p) => p.timestamp > since);
    res.json(newPackets);
  });

  // Like a packet
  app.post('/api/mesh/packets/:id/like', (req, res) => {
    const { id } = req.params;
    const packet = meshPackets.find((p) => p.id === id);
    if (packet) {
      packet.likedByMe = !packet.likedByMe;
      return res.json({ success: true, likedByMe: packet.likedByMe });
    }
    res.status(404).json({ error: 'Pacote não encontrado' });
  });

  // ==========================================
  // HTTP FALLBACK CALL SIGNALING & AUDIO STREAM
  // ==========================================
  app.post('/api/mesh/calls/offer', (req, res) => {
    const { callId, callerNodeId, callerName, targetNodeId } = req.body;
    if (!callId || !callerNodeId || !targetNodeId) {
      return res.status(400).json({ error: 'Dados de chamada incompletos' });
    }
    const session: CallSession = {
      callId,
      callerNodeId,
      callerName: callerName || 'Operador',
      targetNodeId,
      status: 'RINGING',
      startedAt: Date.now(),
    };
    callSessions.set(callId, session);
    pendingOffers.set(targetNodeId, req.body);
    res.json({ success: true, session });
  });

  app.get('/api/mesh/calls/pending', (req, res) => {
    const nodeId = req.query.nodeId as string;
    if (!nodeId) return res.json({ offer: null });
    const offer = pendingOffers.get(nodeId);
    res.json({ offer: offer || null });
  });

  app.post('/api/mesh/calls/answer', (req, res) => {
    const { callId, targetNodeId } = req.body;
    const session = callSessions.get(callId);
    if (session) {
      session.status = 'CONNECTED';
      session.connectedAt = Date.now();
    }
    pendingOffers.delete(targetNodeId);
    res.json({ success: true, session });
  });

  app.post('/api/mesh/calls/reject', (req, res) => {
    const { callId, targetNodeId } = req.body;
    const session = callSessions.get(callId);
    if (session) {
      session.status = 'REJECTED';
      session.endedAt = Date.now();
    }
    pendingOffers.delete(targetNodeId);
    res.json({ success: true, session });
  });

  app.post('/api/mesh/calls/hangup', (req, res) => {
    const { callId, targetNodeId } = req.body;
    const session = callSessions.get(callId);
    if (session) {
      session.status = 'ENDED';
      session.endedAt = Date.now();
    }
    if (targetNodeId) pendingOffers.delete(targetNodeId);
    res.json({ success: true });
  });

  app.post('/api/mesh/calls/audio', (req, res) => {
    const { callId, fromNodeId, toNodeId, audioData, mimeType } = req.body;
    if (!callId || !audioData) {
      return res.status(400).json({ error: 'Áudio inválido' });
    }
    const chunk: BufferedAudioChunk = {
      callId,
      fromNodeId,
      toNodeId,
      audioData,
      mimeType: mimeType || 'audio/webm',
      timestamp: Date.now(),
    };
    bufferedAudio.push(chunk);
    if (bufferedAudio.length > 200) bufferedAudio.shift();
    res.json({ success: true });
  });

  app.get('/api/mesh/calls/audio', (req, res) => {
    const callId = req.query.callId as string;
    const forNodeId = req.query.forNodeId as string;
    const since = parseInt(req.query.since as string) || 0;

    const chunks = bufferedAudio.filter(
      (c) => c.callId === callId && c.toNodeId === forNodeId && c.timestamp > since
    );
    res.json(chunks);
  });

  // Vite dev middleware vs static build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[LoRaMesh] Servidor 100% Real e Chamadas de Voz rodando na porta ${PORT}`);
  });
}

startServer();
