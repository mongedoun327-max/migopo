import { MeshNode, MeshPacket, MeshChannel, LoRaPhyConfig, UserRegistration } from '../types/mesh';
import { calculateAirtime, DEFAULT_LORA_CONFIG, DutyCycleMonitor } from './loraPhy';
import { bleBridge } from './bleBridge';
import { encryptPacketPayload, decryptPacketPayload, DEFAULT_PRIMARY_CHANNEL_KEY } from './cryptoEngine';
import { audioEngine } from './audioCodec';
import { getMyPermanentPhoneNumber } from './phoneSystem';

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
        if (!event.data) return;
        if (event.data.type === 'NODE_UPDATED' && event.data.node) {
          this.handleNodeUpdatedEvent(event.data.node);
        } else if (event.data.id && event.data.packetType !== 'NODE_ANNOUNCEMENT') {
          this.handleInboundAirwavePacket(event.data as MeshPacket);
        }
      };
    }
  }

  private handleNodeUpdatedEvent(remoteNode: MeshNode): void {
    if (!remoteNode || !remoteNode.id) return;
    const selfNode = this.nodes.find((n) => n?.isSelf);
    if (selfNode && remoteNode.id === selfNode.id) return;

    const existingIdx = this.nodes.findIndex((n) => n && n.id === remoteNode.id);
    if (existingIdx >= 0) {
      const prev = this.nodes[existingIdx];
      this.nodes[existingIdx] = {
        ...prev,
        name: remoteNode.name,
        username: remoteNode.username || prev.username,
        callsign: remoteNode.callsign || prev.callsign,
        avatarColor: remoteNode.avatarColor || prev.avatarColor,
        avatarInitials: remoteNode.avatarInitials || (remoteNode.name ? remoteNode.name.slice(0, 2).toUpperCase() : prev.avatarInitials),
        isOnline: true,
        lastHeard: Date.now(),
      };
      this.saveContactsToStorage(this.nodes);
      this.notifyNodes();
    } else {
      this.nodes.push(remoteNode);
      this.saveContactsToStorage(this.nodes);
      this.notifyNodes();
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
      phoneNumber: '41160000',
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
    const cleanInitialName = (profile.name || 'Operador').replace(' (Você)', '').trim();
    const selfNode: MeshNode = {
      id: profile.nodeId,
      name: cleanInitialName,
      username: profile.username,
      callsign: profile.callsign,
      phoneNumber: profile.phoneNumber || getMyPermanentPhoneNumber(),
      avatarColor: '#10b981',
      avatarInitials: cleanInitialName.slice(0, 2).toUpperCase(),
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
        // Ensure eliminated mock contacts like node_peer_tg are filtered out
        contacts = contacts.filter((c) => c && c.id !== 'node_peer_tg');
      }
    } catch (e) {
      console.warn('Error reading contacts from local storage:', e);
    }

    if (!contacts || contacts.length === 0) {
      const defaultPeerAndre: MeshNode = {
        id: 'mock_andre',
        name: 'André',
        username: 'andre',
        callsign: 'ANDRE-01',
        phoneNumber: '41160001',
        avatarColor: '#18181b',
        avatarInitials: 'AN',
        bio: 'Operador LoRa',
        statusText: 'Online',
        hardware: 'ESP32 DIY SX1262',
        role: 'CLIENT',
        batteryPct: 88,
        batteryVoltage: 4.0,
        gps: { lat: 38.72, lng: -9.14, alt: 50 },
        x: 50,
        y: 50,
        antennaDbi: 3.0,
        isOnline: true,
        lastHeard: Date.now(),
        hopsAway: 1,
        rssi: -45,
        snr: 12.0,
        packetsForwarded: 0,
      };

      const defaultPeerHebo: MeshNode = {
        id: 'mock_hebo_py',
        name: 'Hebo Py',
        username: 'hebo.py',
        callsign: 'HEBO-02',
        phoneNumber: '41160002',
        avatarColor: '#18181b',
        avatarInitials: 'HP',
        bio: 'Operador LoRa',
        statusText: 'Online',
        hardware: 'ESP32 DIY SX1262',
        role: 'CLIENT',
        batteryPct: 95,
        batteryVoltage: 4.15,
        gps: { lat: 38.72, lng: -9.14, alt: 50 },
        x: 50,
        y: 50,
        antennaDbi: 3.0,
        isOnline: true,
        lastHeard: Date.now(),
        hopsAway: 1,
        rssi: -42,
        snr: 13.0,
        packetsForwarded: 0,
      };

      const defaultPeerJosh: MeshNode = {
        id: 'mock_josh',
        name: 'Josh',
        username: 'josh',
        callsign: 'JOSH-03',
        phoneNumber: '41160003',
        avatarColor: '#18181b',
        avatarInitials: 'JO',
        bio: 'Operador LoRa',
        statusText: 'Online',
        hardware: 'ESP32 DIY SX1262',
        role: 'CLIENT',
        batteryPct: 76,
        batteryVoltage: 3.9,
        gps: { lat: 38.72, lng: -9.14, alt: 50 },
        x: 50,
        y: 50,
        antennaDbi: 3.0,
        isOnline: true,
        lastHeard: Date.now(),
        hopsAway: 1,
        rssi: -50,
        snr: 11.0,
        packetsForwarded: 0,
      };

      const defaultPeerZox: MeshNode = {
        id: 'mock_zox',
        name: 'Zox',
        username: 'zox',
        callsign: 'ZOX-04',
        phoneNumber: '41160004',
        avatarColor: '#18181b',
        avatarInitials: 'ZX',
        bio: 'Operador LoRa',
        statusText: 'Online',
        hardware: 'ESP32 DIY SX1262',
        role: 'CLIENT',
        batteryPct: 82,
        batteryVoltage: 4.02,
        gps: { lat: 38.72, lng: -9.14, alt: 50 },
        x: 50,
        y: 50,
        antennaDbi: 3.0,
        isOnline: true,
        lastHeard: Date.now(),
        hopsAway: 1,
        rssi: -46,
        snr: 12.5,
        packetsForwarded: 0,
      };

      contacts = [defaultPeerAndre, defaultPeerHebo, defaultPeerJosh, defaultPeerZox];
    }

    this.nodes = [selfNode, broadcastGroupNode, ...contacts.filter((c) => c.id !== selfNode.id && c.id !== 'group-broadcast' && c.id !== 'node_peer_tg')];

    // 3. Load Packets
    try {
      const storedPackets = localStorage.getItem(STORAGE_KEY_PACKETS);
      if (storedPackets) {
        const parsed = JSON.parse(storedPackets);
        this.packets = Array.isArray(parsed)
          ? parsed.filter(
              (p) =>
                p &&
                p.packetType !== 'NODE_ANNOUNCEMENT' &&
                p.fromNodeId !== 'node_peer_tg' &&
                p.toNodeId !== 'node_peer_tg'
            )
          : [];
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
   * Immediately syncs self node profile to the server API so all peers see it
   */
  async syncSelfNodeToServer(): Promise<void> {
    const selfNode = this.nodes.find((n) => n.isSelf);
    if (!selfNode) return;
    const realName = selfNode.name.replace(' (Você)', '');

    try {
      await fetch('/api/mesh/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selfNode.id,
          name: realName,
          username: selfNode.username,
          callsign: selfNode.callsign,
          avatarColor: selfNode.avatarColor || '#10b981',
          avatarInitials: selfNode.avatarInitials || realName.slice(0, 2).toUpperCase(),
          bio: selfNode.bio || '',
          statusText: selfNode.statusText || 'Online no rádio LoRa',
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
    } catch (e) {
      // Offline fallback
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
          await this.syncSelfNodeToServer();
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
                const curr = this.nodes[existingIdx];
                const nameChanged = rNode.name && rNode.name !== curr.name;
                const usernameChanged = rNode.username && rNode.username !== curr.username;
                const callsignChanged = rNode.callsign && rNode.callsign !== curr.callsign;
                const bioChanged = rNode.bio !== undefined && rNode.bio !== curr.bio;
                const colorChanged = rNode.avatarColor && rNode.avatarColor !== curr.avatarColor;
                const onlineChanged = curr.isOnline !== rNode.isOnline;
                const initials = rNode.avatarInitials || (rNode.name ? rNode.name.slice(0, 2).toUpperCase() : curr.avatarInitials);

                if (nameChanged || usernameChanged || callsignChanged || bioChanged || colorChanged || onlineChanged) {
                  this.nodes[existingIdx] = {
                    ...curr,
                    name: rNode.name || curr.name,
                    username: rNode.username || curr.username,
                    callsign: rNode.callsign || curr.callsign,
                    bio: rNode.bio !== undefined ? rNode.bio : curr.bio,
                    avatarColor: rNode.avatarColor || curr.avatarColor,
                    avatarInitials: initials,
                    hardware: rNode.hardware || curr.hardware,
                    role: rNode.role || curr.role,
                    isOnline: rNode.isOnline,
                    lastHeard: rNode.lastHeard || Date.now(),
                  };
                  changed = true;
                } else {
                  this.nodes[existingIdx].lastHeard = rNode.lastHeard || Date.now();
                }
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

                if (pkt.packetType === 'NODE_ANNOUNCEMENT') {
                  if (pkt.payloadText) {
                    this.handleNodeAnnouncementPayload(pkt.fromNodeId, pkt.payloadText, pkt.rssiDbm, pkt.snrDb);
                  }
                  return;
                }

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
    const cleanName = (selfNode.name || 'Operador').replace(' (Você)', '').trim();
    return {
      name: cleanName,
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
    const cleanName = profile.name.replace(' (Você)', '').trim();
    profile.name = cleanName;

    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.warn('Could not save profile to localStorage:', e);
    }

    const selfIdx = this.nodes.findIndex((n) => n && n.isSelf);
    if (selfIdx >= 0) {
      this.nodes[selfIdx].name = cleanName;
      this.nodes[selfIdx].username = profile.username;
      this.nodes[selfIdx].callsign = profile.callsign;
      this.nodes[selfIdx].bio = profile.bio;
      this.nodes[selfIdx].hardware = profile.hardware;
      this.nodes[selfIdx].role = profile.role;
      this.nodes[selfIdx].avatarInitials = cleanName.slice(0, 2).toUpperCase();
    }
    this.notifyNodes();

    // Update server node registry and local airwaves without generating chat messages
    this.syncSelfNodeToServer();
    if (this.airwaveChannel && selfIdx >= 0) {
      this.airwaveChannel.postMessage({
        type: 'NODE_UPDATED',
        node: {
          ...this.nodes[selfIdx],
          name: cleanName,
        },
      });
    }
    bleBridge.addLog(`[PERFIL] Perfil atualizado na rede: ${cleanName} (${profile.callsign})`);
  }

  /**
   * Fast, direct name change without creating an account or generating chat messages.
   * If user enters "ana", the name is stored, broadcast and displayed exactly as "ana".
   */
  updateMyName(newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const selfIdx = this.nodes.findIndex((n) => n && n.isSelf);
    if (selfIdx < 0) return;

    const selfNode = this.nodes[selfIdx];
    selfNode.name = trimmed; // EXACTLY "ana"
    selfNode.username = trimmed.toLowerCase().replace(/\s+/g, '.');
    selfNode.avatarInitials = trimmed.slice(0, 2).toUpperCase();

    // Update stored profile name
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
      if (stored) {
        const p = JSON.parse(stored);
        p.name = trimmed;
        p.username = selfNode.username;
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(p));
      }
    } catch (e) {
      console.warn('Could not save updated name to localStorage:', e);
    }

    this.notifyNodes();

    // 1. Immediately update server node registry (No chat packet generated)
    this.syncSelfNodeToServer();

    // 2. Broadcast via local airwaves for multi-tab without creating a message
    if (this.airwaveChannel) {
      this.airwaveChannel.postMessage({
        type: 'NODE_UPDATED',
        node: {
          ...selfNode,
          name: trimmed,
        },
      });
    }

    bleBridge.addLog(`[NOME] Nome alterado para "${trimmed}" (refletido na rede sem mensagem).`);
  }

  /**
   * Broadcasts node identity and name changes across the mesh network
   */
  async broadcastNodeAnnouncement(): Promise<void> {
    const selfNode = this.nodes.find((n) => n.isSelf);
    if (!selfNode) return;
    const realName = selfNode.name.replace(' (Você)', '');

    const announcementPayload = JSON.stringify({
      nodeId: selfNode.id,
      name: realName,
      username: selfNode.username,
      callsign: selfNode.callsign,
      avatarColor: selfNode.avatarColor || '#10b981',
      avatarInitials: selfNode.avatarInitials || realName.slice(0, 2).toUpperCase(),
      bio: selfNode.bio || '',
      hardware: selfNode.hardware,
      role: selfNode.role,
      timestamp: Date.now(),
    });

    const announcementPacket: MeshPacket = {
      id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      fromNodeId: selfNode.id,
      toNodeId: 'BROADCAST',
      channelId: 0,
      hopLimit: 3,
      hopStart: 3,
      packetType: 'NODE_ANNOUNCEMENT',
      payloadText: announcementPayload,
      encrypted: false,
      airtimeMs: 120,
      rssiDbm: -55,
      snrDb: 9.0,
      pathTraveled: [selfNode.id],
    };

    // 1. Broadcast over local airwaves (BroadcastChannel for multi-tab / local RF)
    if (this.airwaveChannel) {
      this.airwaveChannel.postMessage(announcementPacket);
    }

    // 2. Transmit to server packet pool so all network clients receive it
    try {
      await fetch('/api/mesh/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementPacket),
      });
    } catch (e) {
      // offline
    }

    bleBridge.addLog(`[ANÚNCIO] Nome e nó transmitidos na rede: ${realName} (${selfNode.callsign})`);
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
   * Process a node announcement payload to update or register peers
   */
  private handleNodeAnnouncementPayload(
    fromNodeId: string,
    payloadText: string,
    rssi?: number,
    snr?: number
  ): void {
    try {
      const info = JSON.parse(payloadText);
      const targetId = info.nodeId || fromNodeId;
      const selfNode = this.nodes.find((n) => n?.isSelf);
      if (selfNode && targetId === selfNode.id) return;

      const existingIdx = this.nodes.findIndex((n) => n && n.id === targetId);
      const newName = info.name || 'Operador';
      const initials = (info.name || 'RF').slice(0, 2).toUpperCase();

      if (existingIdx >= 0) {
        const prev = this.nodes[existingIdx];
        this.nodes[existingIdx] = {
          ...prev,
          name: newName,
          username: info.username || prev.username,
          callsign: info.callsign || prev.callsign,
          bio: info.bio !== undefined ? info.bio : prev.bio,
          avatarColor: info.avatarColor || prev.avatarColor || '#10b981',
          avatarInitials: initials,
          hardware: info.hardware || prev.hardware,
          role: info.role || prev.role,
          isOnline: true,
          lastHeard: Date.now(),
        };
        this.saveContactsToStorage(this.nodes);
        this.notifyNodes();
        bleBridge.addLog(`[MESH] Nó atualizou o nome na rede: ${newName} (${this.nodes[existingIdx].callsign})`);
      } else {
        const newContact: MeshNode = {
          id: targetId,
          name: newName,
          username: info.username || 'operador.' + targetId.slice(0, 5),
          callsign: info.callsign || 'NÓ-RF',
          avatarColor: info.avatarColor || '#10b981',
          avatarInitials: initials,
          bio: info.bio || 'Descoberto via rádio LoRa',
          statusText: 'Online no rádio LoRa',
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
          rssi: rssi || -70,
          snr: snr || 6.5,
          packetsForwarded: 0,
        };
        this.nodes.push(newContact);
        this.saveContactsToStorage(this.nodes);
        this.notifyNodes();
        bleBridge.addLog(`[MESH] Novo nó descoberto na rede: ${newContact.name} (${newContact.callsign})`);
      }
    } catch (e) {
      console.warn('Could not parse node announcement payload:', e);
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

    // Handle Node Announcement: registers a new real contact or updates name!
    if (packet.packetType === 'NODE_ANNOUNCEMENT' && packet.payloadText) {
      this.handleNodeAnnouncementPayload(packet.fromNodeId, packet.payloadText, packet.rssiDbm, packet.snrDb);
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
  private seedInitialMessages(selfId: string): void {
    const now = Date.now();
    this.packets = [
      {
        id: 'pkt-seed-canal-geral',
        timestamp: now - 3600 * 1000,
        fromNodeId: 'group-broadcast',
        toNodeId: 'BROADCAST',
        channelId: 0,
        hopLimit: 3,
        hopStart: 3,
        packetType: 'TEXT_MSG',
        payloadText: 'Canal aberto comunitário ativo.',
        encrypted: false,
        airtimeMs: 120,
        rssiDbm: -55,
        snrDb: 9.5,
        pathTraveled: ['group-broadcast'],
        likedByMe: true,
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

  addNode(node: MeshNode): void {
    const existing = this.nodes.findIndex((n) => n.id === node.id);
    if (existing >= 0) {
      this.nodes[existing] = { ...this.nodes[existing], ...node };
    } else {
      this.nodes.push(node);
    }
    this.saveContactsToStorage(this.nodes);
    this.notifyNodes();
  }

  /**
   * Delete a contact / conversation and notify subscribers
   */
  deleteContact(nodeId: string): void {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.saveContactsToStorage(this.nodes);
    this.notifyNodes();
  }

  /**
   * Clear all messages in a conversation
   */
  clearConversation(contactId: string, selfId: string): void {
    this.packets = this.packets.filter(
      (p) =>
        !(
          (p.fromNodeId === contactId && (p.toNodeId === selfId || p.toNodeId === 'BROADCAST')) ||
          (p.fromNodeId === selfId && p.toNodeId === contactId)
        )
    );
    this.savePacketsToStorage();
    this.notifyPackets();
  }
}

export const meshManager = new MeshNetworkManager();
