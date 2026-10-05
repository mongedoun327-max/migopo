import express from 'express';
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  // In-memory real mesh network state across all real users
  let registeredNodes: ServerNode[] = [];
  let meshPackets: ServerPacket[] = [];

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
      registeredNodes[existingIndex] = {
        ...registeredNodes[existingIndex],
        ...node,
        lastHeard: Date.now(),
        isOnline: true,
      };
    } else {
      registeredNodes.push(node);
      console.log(`[LoRaMesh] Novo operador real registrado: ${node.name} (@${node.username}) [${node.id}]`);
    }

    res.json({ success: true, node });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LoRaMesh] Servidor 100% Real rodando na porta ${PORT}`);
  });
}

startServer();
