import { MeshNode, MeshPacket, MeshChannel, LoRaPhyConfig, UserRegistration } from '../types/mesh';
import { calculateAirtime, DEFAULT_LORA_CONFIG, DutyCycleMonitor } from './loraPhy';
import { bleBridge } from './bleBridge';
import { encryptPacketPayload, decryptPacketPayload, DEFAULT_PRIMARY_CHANNEL_KEY } from './cryptoEngine';
import { audioEngine } from './audioCodec';

export interface HopPropagationStep {
  packetId: string;
  fromNodeId: string;
  toNodeId: string;
  hopRemaining: number;
  snr: number;
  rssi: number;
  timestamp: number;
}

const STORAGE_KEY_PROFILE = 'lora_my_profile_v3';
const STORAGE_KEY_CONTACTS = 'lora_contacts_v3';
const STORAGE_KEY_PACKETS = 'lora_packets_v3';

export class MeshNetworkManager {
  private nodes: MeshNode[] = [];
  private channels: MeshChannel[] = [
    {
      id: 0,
      name: 'Geral #Todos',
      color: '#10b981',
      isEncrypted: false,
      pskKey: '',
      description: 'Canal primário aberto para todos os operadores conectados.',
    },
    {
      id: 1,
      name: 'Tático #Privado',
      color: '#3b82f6',
      isEncrypted: true,
      pskKey: DEFAULT_PRIMARY_CHANNEL_KEY,
      description: 'Canal operacional cifrado com AES-256-GCM para missões diretas.',
    },
    {
      id: 2,
      name: 'Emergência #SOS',
      color: '#ef4444',
      isEncrypted: false,
      pskKey: '',
      description: 'Canal prioritário de alerta máximo, busca e salvamento.',
    },
  ];

  private packets: MeshPacket[] = [];
  private seenPacketIds: Set<string> = new Set();
  private loraConfig: LoRaPhyConfig = { ...DEFAULT_LORA_CONFIG };
  private dutyCycleMonitor = new DutyCycleMonitor();

  private packetListeners: ((packets: MeshPacket[]) => void)[] = [];
  private nodeListeners: ((nodes: MeshNode[]) => void)[] = [];
  private hopStepListeners: ((step: HopPropagationStep) => void)[] = [];

  // Real offline P2P airwaves channel for local multi-window and multi-device RF transport
  private airwaveChannel: BroadcastChannel | null = null;
  private serverSyncInterval: number | null = null;
  private lastSyncedPacketTimestamp: number = 0;

  constructor() {
    this.initP2PAirwaves();
    this.loadStateFromStorage();
    this.startRealNetworkSync();
  }

  private initP2PAirwaves(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.airwaveChannel = new BroadcastChannel('lora_mesh_airwaves_rf');
      this.airwaveChannel.onmessage = (event) => {
        if (event.data && event.data.id) {
          this.handleInboundAirwavePacket(event.data as MeshPacket);
        }
      };
    }
  }

  private loadStateFromStorage(): void {
    // 1. Load User Registration
    let profile: UserRegistration | null = null;
    try {
      const storedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (storedProfile) {
        profile = JSON.parse(storedProfile);
      }
    } catch (e) {
      console.warn('Error reading profile from local storage:', e);
    }

    if (!profile) {
      // Generate a unique identity for this device/user
      const randomSuffix = Math.floor(Math.random() * 900 + 100);
      const nodeId = 'node-' + Math.random().toString(36).substring(2, 9);
      profile = {
        name: `Operador ${randomSuffix}`,
        username: `operador.${randomSuffix}`,
        callsign: `ALFA-${randomSuffix.toString().slice(0, 2)}`,
        bio: 'Nó LoRa em campo',
        nodeId,
        role: 'BASE_STATION',
        hardware: 'TTGO T-Beam v1.2',
        publicKeyHex: '04' + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join(''),
        channelPsk: DEFAULT_PRIMARY_CHANNEL_KEY,
        frequencyBand: '868MHz',
        registeredAt: Date.now(),
      };
      this.saveMyProfile(profile);
    }

    // Common group broadcast channel node (open frequency)
    const broadcastGroupNode: MeshNode = {
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

    // Self Node created from profile
    const selfNode: MeshNode = {
      id: profile.nodeId,
      name: `${profile.name} (Você)`,
      username: profile.username,
      callsign: profile.callsign,
      avatarColor: '#10b981',
      avatarInitials: profile.name.slice(0, 2).toUpperCase(),
      bio: profile.bio,
      statusText: 'Online no rádio LoRa',
      hardware: profile.hardware,
      role: profile.role,
      batteryPct: 100,
      batteryVoltage: 4.2,
      gps: { lat: 38.7169, lng: -9.1399, alt: 45 },
      x: 25,
      y: 65,
      antennaDbi: 3.5,
      isSelf: true,
      isOnline: true,
      lastHeard: Date.now(),
      hopsAway: 0,
      rssi: -55,
      snr: 9.5,
      packetsForwarded: 0,
    };

    // 2. Load Real Contacts (NO fake simulated users)
    let contacts: MeshNode[] = [];
    try {
      const storedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
      if (storedContacts) {
        contacts = JSON.parse(storedContacts);
      }
    } catch (e) {
      console.warn('Error reading contacts from local storage:', e);
    }

    this.nodes = [selfNode, broadcastGroupNode, ...contacts.filter((c) => c.id !== selfNode.id && c.id !== 'group-broadcast')];

    // 3. Load Packets
    try {
      const storedPackets = localStorage.getItem(STORAGE_KEY_PACKETS);
      if (storedPackets) {
        this.packets = JSON.parse(storedPackets);
        this.packets.forEach((p) => {
          this.seenPacketIds.add(p.id);
          if (p.timestamp > this.lastSyncedPacketTimestamp) {
            this.lastSyncedPacketTimestamp = p.timestamp;
          }
        });
      } else {
        this.seedInitialMessages(selfNode.id);
      }
    } catch (e) {
      this.seedInitialMessages(selfNode.id);
    }
  }

  /**
   * Periodically syncs with server API to discover all other real users who have the system open!
   */
  private startRealNetworkSync(): void {
    const sync = async () => {
      try {
        const selfNode = this.nodes.find((n) => n.isSelf);
        if (selfNode) {
          // Announce connection presence only without transmitting custom personal profile alterations
          await fetch('/api/mesh/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selfNode.id,
              name: 'Operador LoRa',
              username: 'operador.' + selfNode.id.slice(-4),
              callsign: 'NÓ-' + selfNode.id.slice(-3).toUpperCase(),
              avatarColor: selfNode.avatarColor || '#10b981',
              avatarInitials: 'OP',
              bio: 'Operador na rede LoRa',
              statusText: 'Online',
              hardware: selfNode.hardware,
              role: selfNode.role,
              batteryPct: selfNode.batteryPct || 100,
              batteryVoltage: selfNode.batteryVoltage || 4.2,
              gps: selfNode.gps,
              x: selfNode.x,
              y: selfNode.y,
              antennaDbi: selfNode.antennaDbi || 3.0,
            }),
          });
        }

        // Fetch all real connected nodes
        const nodesResp = await fetch('/api/mesh/nodes');
        if (nodesResp.ok) {
          const remoteNodes = await nodesResp.json();
          let changed = false;

          if (Array.isArray(remoteNodes)) {
            remoteNodes.forEach((rNode: MeshNode) => {
              if (!rNode || !rNode.id) return;
              if (selfNode && rNode.id === selfNode.id) return;

              const existingIdx = this.nodes.findIndex((n) => n && n.id === rNode.id);
              if (existingIdx >= 0) {
                // Update online status only - do NOT overwrite local names or contact preferences
                this.nodes[existingIdx].isOnline = rNode.isOnline;
                this.nodes[existingIdx].lastHeard = rNode.lastHeard;
              } else {
                this.nodes.push(rNode);
                changed = true;
              }
            });
          }

          if (changed) {
            this.saveContactsToStorage(this.nodes);
            this.notifyNodes();
          }
        }

        // Fetch any real packets sent since last sync
        const packetsResp = await fetch(`/api/mesh/packets?since=${this.lastSyncedPacketTimestamp}`);
        if (packetsResp.ok) {
          const incomingPackets = await packetsResp.json();
          let newPacketAdded = false;

          if (Array.isArray(incomingPackets)) {
            incomingPackets.forEach((pkt: MeshPacket) => {
              if (!pkt || !pkt.id) return;
              if (!this.seenPacketIds.has(pkt.id)) {
                this.seenPacketIds.add(pkt.id);
                this.packets.push(pkt);
                if (pkt.timestamp > this.lastSyncedPacketTimestamp) {
                  this.lastSyncedPacketTimestamp = pkt.timestamp;
                }
                newPacketAdded = true;
              }
            });
          }

          if (newPacketAdded) {
            this.savePacketsToStorage();
            this.notifyPackets();
          }
        }
      } catch (err) {
        // Server unreachable -> continues seamlessly purely on local storage & local RF
      }
    };

    // Run first sync immediately then every 2.5 seconds
    sync();
    this.serverSyncInterval = window.setInterval(sync, 2500);
  }

  private savePacketsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PACKETS, JSON.stringify(this.packets.slice(-150)));
    } catch (e) {
      console.warn('Could not save packets to localStorage:', e);
    }
  }

  private saveContactsToStorage(contacts: MeshNode[]): void {
    try {
      const filtered = contacts.filter((c) => !c.isSelf && c.id !== 'group-broadcast');
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Could not save contacts to localStorage:', e);
    }
  }

  getMyProfile(): UserRegistration {
    const selfNode = this.nodes.find((n) => n.isSelf) || this.nodes[0];
    return {
      name: selfNode.name.replace(' (Você)', ''),
      username: selfNode.username,
      callsign: selfNode.callsign,
      bio: selfNode.bio || '',
      nodeId: selfNode.id,
      role: selfNode.role,
      hardware: selfNode.hardware,
      publicKeyHex: '04' + selfNode.id,
      channelPsk: DEFAULT_PRIMARY_CHANNEL_KEY,
      frequencyBand: this.loraConfig.frequency,
      registeredAt: Date.now(),
    };
  }

  saveMyProfile(profile: UserRegistration): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Could not save profile to localStorage:', e);
    }

    const selfIdx = this.nodes.findIndex((n) => n && n.isSelf);
    if (selfIdx >= 0) {
      this.nodes[selfIdx].name = `${profile.name} (Você)`;
      this.nodes[selfIdx].username = profile.username;
      this.nodes[selfIdx].callsign = profile.callsign;
      this.nodes[selfIdx].bio = profile.bio;
      this.nodes[selfIdx].hardware = profile.hardware;
      this.nodes[selfIdx].role = profile.role;
      this.nodes[selfIdx].avatarInitials = profile.name.slice(0, 2).toUpperCase();
    }
    this.notifyNodes();

    // Stored strictly local to the user's device - NO broadcast or transmission to other users
    bleBridge.addLog(`[PERFIL] Perfil atualizado localmente no dispositivo (não transmitido para a rede).`);
  }

  /**
   * Node Announcement is disabled to prevent broadcasting profile alterations to other users
   */
  async broadcastNodeAnnouncement(): Promise<void> {
    // Intentionally kept local-only to protect user privacy and prevent profile changes from being sent to other users
    bleBridge.addLog(`[PRIVACIDADE] Alterações de perfil mantidas privadas no dispositivo local.`);
  }

  getNodes(): MeshNode[] {
    return [...this.nodes];
  }

  getChannels(): MeshChannel[] {
    return [...this.channels];
  }

  getPackets(): MeshPacket[] {
    return [...this.packets];
  }

  getLoRaConfig(): LoRaPhyConfig {
    return { ...this.loraConfig };
  }

  setLoRaConfig(config: Partial<LoRaPhyConfig>): void {
    this.loraConfig = { ...this.loraConfig, ...config };
    bleBridge.addLog(`[CONFIG] LoRa PHY updated: SF${this.loraConfig.spreadingFactor} | BW ${this.loraConfig.bandwidth}kHz | CR ${this.loraConfig.codingRate}`);
  }

  subscribePackets(listener: (packets: MeshPacket[]) => void): () => void {
    this.packetListeners.push(listener);
    listener([...this.packets]);
    return () => {
      this.packetListeners = this.packetListeners.filter((l) => l !== listener);
    };
  }

  subscribeNodes(listener: (nodes: MeshNode[]) => void): () => void {
    this.nodeListeners.push(listener);
    listener([...this.nodes]);
    return () => {
      this.nodeListeners = this.nodeListeners.filter((l) => l !== listener);
    };
  }

  onHopStep(listener: (step: HopPropagationStep) => void): () => void {
    this.hopStepListeners.push(listener);
    return () => {
      this.hopStepListeners = this.hopStepListeners.filter((l) => l !== listener);
    };
  }

  private notifyPackets(): void {
    this.packetListeners.forEach((l) => l([...this.packets]));
  }

  private notifyNodes(): void {
    this.nodeListeners.forEach((l) => l([...this.nodes]));
  }

  /**
   * Broadcast or send a new packet from self node through the mesh network
   */
  async sendPacket(params: {
    toNodeId?: string;
    channelId: number;
    packetType: MeshPacket['packetType'];
    payloadText?: string;
    voiceBurst?: MeshPacket['voiceBurst'];
    location?: { lat: number; lng: number; alt?: number };
    hopLimit?: number;
  }): Promise<MeshPacket> {
    const selfNode = this.nodes.find((n) => n.isSelf) || this.nodes[0];
    const channel = this.channels.find((c) => c.id === params.channelId) || this.channels[0];

    const packetId = 'pkt_' + Math.random().toString(36).substring(2, 10);
    const hopLimit = params.hopLimit ?? 3;

    // Calculate real payload size
    let payloadSize = 20; // base headers
    if (params.payloadText) payloadSize += params.payloadText.length;
    if (params.voiceBurst) payloadSize += params.voiceBurst.compressedByteSize;
    if (params.location) payloadSize += 16;

    // Airtime calculation via Semtech AN1200.13
    const airtimeResult = calculateAirtime(payloadSize, this.loraConfig);
    this.dutyCycleMonitor.recordTransmission(airtimeResult.totalAirtimeMs);

    let encrypted = false;
    let authTag: string | undefined;

    if (channel.isEncrypted && channel.pskKey) {
      encrypted = true;
      const rawPayload = params.payloadText || (params.voiceBurst ? params.voiceBurst.bitstreamBase64 : '');
      const enc = await encryptPacketPayload(rawPayload, channel.pskKey);
      authTag = enc.authTagHex.slice(0, 8);
    }

    const packet: MeshPacket = {
      id: packetId,
      timestamp: Date.now(),
      fromNodeId: selfNode.id,
      toNodeId: params.toNodeId || 'BROADCAST',
      channelId: params.channelId,
      hopLimit: hopLimit,
      hopStart: hopLimit,
      packetType: params.packetType,
      payloadText: params.payloadText,
      voiceBurst: params.voiceBurst,
      location: params.location,
      encrypted,
      authTag,
      airtimeMs: Math.round(airtimeResult.totalAirtimeMs),
      rssiDbm: -58,
      snrDb: 9.0,
      pathTraveled: [selfNode.id],
    };

    this.seenPacketIds.add(packetId);
    this.packets.push(packet);
    this.savePacketsToStorage();
    this.notifyPackets();

    // Inform BLE Bridge / ESP32 module & Broadcast over local airwaves & server
    await this.sendOverRealTransports(packet, payloadSize);

    // Audio squelch feedback
    audioEngine.playRadioSquelch('intro');

    return packet;
  }

  /**
   * Sends packet over real transports: Web Bluetooth (ESP32) + Local Airwaves (BroadcastChannel) + Server API
   */
  private async sendOverRealTransports(packet: MeshPacket, payloadSize: number = 40): Promise<void> {
    // 1. Transmit over Web Bluetooth to physical ESP32 if paired
    await bleBridge.transmitPacket(JSON.stringify(packet), payloadSize);

    // 2. Transmit over real BroadcastChannel to any other local browser tab/window
    if (this.airwaveChannel) {
      this.airwaveChannel.postMessage(packet);
    }

    // 3. Post to Server API so other real users connected to the app receive it
    try {
      await fetch('/api/mesh/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      });
    } catch (e) {
      // Offline fallback
    }
  }

  /**
   * Handle real packet arriving over the airwaves from another node
   */
  private handleInboundAirwavePacket(packet: MeshPacket): void {
    if (!packet || !packet.id) return;
    const selfNode = this.nodes.find((n) => n?.isSelf);
    if (!selfNode || !selfNode.id) return;

    // Ignore packets from self
    if (packet.fromNodeId === selfNode.id) return;

    // Deduplication check
    if (this.seenPacketIds.has(packet.id)) return;
    this.seenPacketIds.add(packet.id);

    // Handle Node Announcement: registers a new real contact!
    if (packet.packetType === 'NODE_ANNOUNCEMENT' && packet.payloadText) {
      try {
        const info = JSON.parse(packet.payloadText);
        const existing = this.nodes.find((n) => n && n.id === packet.fromNodeId);
        if (!existing) {
          const newContact: MeshNode = {
            id: packet.fromNodeId,
            name: info.name || 'Operador Descoberto',
            username: info.username || 'operador.' + packet.fromNodeId.slice(0, 5),
            callsign: info.callsign || 'NÓ-RF',
            avatarColor: '#10b981',
            avatarInitials: (info.name || 'RF').slice(0, 2).toUpperCase(),
            bio: info.bio || 'Descoberto via rádio LoRa',
            statusText: 'Online no rádio LoRa · A 1 salto',
            hardware: info.hardware || 'TTGO T-Beam v1.2',
            role: info.role || 'CLIENT',
            batteryPct: 100,
            batteryVoltage: 4.2,
            gps: { lat: 38.72, lng: -9.14, alt: 60 },
            x: Math.floor(Math.random() * 60 + 20),
            y: Math.floor(Math.random() * 60 + 20),
            antennaDbi: 3.0,
            isOnline: true,
            lastHeard: Date.now(),
            hopsAway: 1,
            rssi: packet.rssiDbm || -70,
            snr: packet.snrDb || 6.5,
            packetsForwarded: 0,
          };
          this.nodes.push(newContact);
          this.saveContactsToStorage(this.nodes);
          this.notifyNodes();
          bleBridge.addLog(`[MESH] Novo nó descoberto nas ondas de rádio: ${newContact.name} (${newContact.callsign})`);
        }
      } catch (e) {
        console.warn('Could not parse node announcement:', e);
      }
    }

    // Record incoming packet
    this.packets.push(packet);
    this.savePacketsToStorage();
    this.notifyPackets();

    // Squelch static acoustic feedback on receipt
    audioEngine.playRadioSquelch('outro');
  }

  /**
   * Toggle like / heart reaction on a message (Instagram style)
   */
  async toggleLikeMessage(packetId: string): Promise<void> {
    const packet = this.packets.find((p) => p.id === packetId);
    if (packet) {
      packet.likedByMe = !packet.likedByMe;
      this.savePacketsToStorage();
      this.notifyPackets();

      try {
        await fetch(`/api/mesh/packets/${packetId}/like`, { method: 'POST' });
      } catch (e) {
        // Offline
      }
    }
  }

  /**
   * Add a new custom node / contact into the mesh
   */
  addCustomNode(params: Partial<MeshNode>): MeshNode {
    const id = 'node-' + Math.random().toString(36).substring(2, 8);
    const name = params.name || 'Novo Operador';
    const newNode: MeshNode = {
      id,
      name,
      username: params.username || name.toLowerCase().replace(/\s+/g, '.') + '.' + Math.floor(Math.random() * 90 + 10),
      callsign: params.callsign || 'NÓ-' + Math.floor(Math.random() * 900 + 100),
      avatarColor: '#10b981',
      avatarInitials: name.slice(0, 2).toUpperCase(),
      statusText: 'Online no rádio LoRa',
      hardware: params.hardware || 'TTGO T-Beam v1.2',
      role: params.role || 'CLIENT',
      batteryPct: 100,
      batteryVoltage: 4.2,
      gps: { lat: 38.73, lng: -9.14, alt: 80 },
      x: params.x || Math.floor(Math.random() * 60 + 20),
      y: params.y || Math.floor(Math.random() * 60 + 20),
      antennaDbi: 3.0,
      isOnline: true,
      lastHeard: Date.now(),
      hopsAway: 1,
      rssi: -65,
      snr: 7.5,
      packetsForwarded: 0,
    };

    this.nodes.push(newNode);
    this.saveContactsToStorage(this.nodes);
    this.notifyNodes();
    bleBridge.addLog(`[MESH] Novo nó adicionado: ${newNode.name} (${newNode.callsign})`);
    return newNode;
  }

  /**
   * Initial clean welcome orientation message (NO fake conversations)
   */
  private seedInitialMessages(selfId: string): void {
    this.packets = [
      {
        id: 'pkt_welcome_1',
        timestamp: Date.now() - 30000,
        fromNodeId: 'group-broadcast',
        toNodeId: 'BROADCAST',
        channelId: 0,
        hopLimit: 3,
        hopStart: 3,
        packetType: 'TEXT_MSG',
        payloadText: 'Bem-vindo ao LoRa Direct. Este sistema é 100% real. Todos os operadores que abrirem esta aplicação aparecem na sua lista de conversas. Envie mensagens, grave áudio PTT ou envie o seu GPS.',
        encrypted: false,
        airtimeMs: 135,
        rssiDbm: -55,
        snrDb: 9.0,
        pathTraveled: ['group-broadcast'],
      },
    ];
    this.savePacketsToStorage();
  }

  updateNodePosition(nodeId: string, x: number, y: number): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.x = Math.max(5, Math.min(95, x));
      node.y = Math.max(5, Math.min(95, y));
      this.saveContactsToStorage(this.nodes);
      this.notifyNodes();
    }
  }
}

export const meshManager = new MeshNetworkManager();
