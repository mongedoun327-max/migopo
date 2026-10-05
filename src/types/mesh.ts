export type LoRaFrequencyBand = '868MHz' | '915MHz' | '433MHz' | '923MHz';

export type SpreadingFactor = 7 | 8 | 9 | 10 | 11 | 12;

export type LoRaBandwidth = 62.5 | 125 | 250 | 500; // in kHz

export type CodingRate = '4/5' | '4/6' | '4/7' | '4/8';

export interface LoRaPhyConfig {
  frequency: LoRaFrequencyBand;
  spreadingFactor: SpreadingFactor;
  bandwidth: LoRaBandwidth;
  codingRate: CodingRate;
  txPowerDbm: number; // 2 to 22 dBm
  preambleLength: number; // default 8 or 16
  syncWord: string; // 0x12 (private) or 0x34 (public)
  crcEnabled: boolean;
}

export type Codec2Mode = '700bps' | '1200bps' | '2400bps' | '3200bps';

export interface AudioVoiceBurst {
  id: string;
  durationSeconds: number;
  sampleRate: number;
  rawByteSize: number;
  compressedByteSize: number;
  codecMode: Codec2Mode;
  audioBlobUrl: string;
  bitstreamBase64: string;
  waveformSamples: number[];
  transcription?: string;
  createdAt: number;
}

export type PacketType =
  | 'VOICE_BURST'
  | 'TEXT_MSG'
  | 'SOS_BEACON'
  | 'LOCATION_PING'
  | 'NODE_TELEMETRY'
  | 'NODE_ANNOUNCEMENT'
  | 'ROUTING_ACK';

export interface UserRegistration {
  name: string;
  username: string; // e.g. 'miguel.campo'
  callsign: string; // e.g. 'ALFA-01'
  bio: string;
  nodeId: string; // Cryptographic Node ID e.g. '!e8f2491a'
  role: NodeRole;
  hardware: 'TTGO T-Beam v1.2' | 'Heltec WiFi LoRa 32 V3' | 'RAK4631 WisBlock' | 'ESP32 DIY SX1262';
  publicKeyHex: string;
  channelPsk: string;
  frequencyBand: LoRaFrequencyBand;
  registeredAt: number;
}

export interface MeshPacket {
  id: string; // 32-bit hex or unique string
  timestamp: number;
  fromNodeId: string;
  toNodeId: string; // 'BROADCAST' or specific node
  channelId: number; // 0=Public, 1=Tactical-1, 2=Emergency SOS
  hopLimit: number; // Remaining hops (TTL)
  hopStart: number; // Initial hop count
  packetType: PacketType;
  payloadText?: string;
  voiceBurst?: AudioVoiceBurst;
  location?: { lat: number; lng: number; alt?: number };
  encrypted: boolean;
  authTag?: string;
  airtimeMs: number;
  rssiDbm: number;
  snrDb: number;
  pathTraveled: string[]; // Node IDs that forwarded this packet
  likedByMe?: boolean;
}

export type NodeRole = 'CLIENT' | 'ROUTER_REPEATER' | 'TRACKER' | 'BASE_STATION';

export interface MeshNode {
  id: string;
  name: string;
  username: string; // e.g. 'sofia.patrulha'
  callsign: string;
  avatarColor?: string; // Hex color for avatar
  avatarInitials?: string;
  avatarUrl?: string;
  bio?: string;
  statusText?: string;
  isGroup?: boolean;
  hardware: 'TTGO T-Beam v1.2' | 'Heltec WiFi LoRa 32 V3' | 'RAK4631 WisBlock' | 'ESP32 DIY SX1262';
  role: NodeRole;
  batteryPct: number;
  batteryVoltage: number;
  gps: {
    lat: number;
    lng: number;
    alt: number;
  };
  x: number; // 0-100% on map canvas
  y: number; // 0-100% on map canvas
  antennaDbi: number;
  isSelf?: boolean;
  isOnline: boolean;
  lastHeard: number;
  hopsAway: number;
  rssi: number; // dBm
  snr: number; // dB
  packetsForwarded: number;
}

export interface MeshChannel {
  id: number;
  name: string;
  color: string;
  isEncrypted: boolean;
  pskKey: string; // AES-256 Base64 or Passphrase
  description: string;
}

export interface BleDeviceStatus {
  isConnected: boolean;
  isWebBleAvailable: boolean;
  deviceName: string | null;
  mode: 'HARDWARE_BLE';
  rssi: number;
  batteryPct: number;
  firmwareVersion: string;
  rxBytesTotal: number;
  txBytesTotal: number;
  lastSerialLog: string[];
}
