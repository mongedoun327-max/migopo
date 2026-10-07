import { MeshNode } from '../types/mesh';
import { formatPhoneNumber, cleanPhoneNumber, getNodePhoneNumber } from './phoneSystem';

export interface CallLogEntry {
  id: string;
  type: 'outgoing' | 'incoming' | 'missed';
  label: 'Efetuada' | 'Recebida' | 'Perdida' | 'Cancelada';
  time: string; // e.g. "17:35"
  timestamp: number;
  durationSeconds: number;
  duration: string; // e.g. "4 min e 7 s", "12 s", "0 s"
  dataSize: string; // e.g. "1,7 MB", "340 KB"
}

export interface CallHistoryItem {
  id: string; // Unique group identifier (e.g. hist_<nodeId>)
  node: MeshNode;
  callCount: number;
  formattedDate: string; // e.g. "Hoje", "29 de setembro"
  formattedTime: string; // latest call time e.g. "11:31"
  lastTimestamp: number;
  calls: CallLogEntry[];
}

const STORAGE_KEY = 'lora_mesh_call_history_v2';

const PT_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatCallDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return 'Hoje';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Ontem';

  const day = date.getDate().toString().padStart(2, '0');
  const month = PT_MONTHS[date.getMonth()];
  return `${day} de ${month}`;
}

export function formatCallTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatCallDuration(
  durationSeconds: number,
  status: 'completed' | 'cancelled' | 'rejected' | 'missed'
): string {
  if (status === 'missed') return 'Não atendida';
  if (status === 'cancelled' || durationSeconds === 0) return 'Cancelada';

  if (durationSeconds < 60) {
    return `${durationSeconds} s`;
  }
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  return `${mins} min e ${secs.toString().padStart(2, '0')} s`;
}

export function formatCallDataSize(durationSeconds: number): string {
  if (durationSeconds <= 0) return '45 KB';
  const kb = durationSeconds * 7.5 + 40;
  if (kb >= 1000) {
    return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
  }
  return `${Math.round(kb)} KB`;
}

class CallHistoryService {
  private history: CallHistoryItem[] = [];
  private listeners: ((history: CallHistoryItem[]) => void)[] = [];
  private activePendingCall: {
    callId: string;
    node: MeshNode;
    direction: 'outgoing' | 'incoming';
    startedAt: number;
  } | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.history = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Error reading call history from storage:', e);
    }

    // Default seeded records matching user visual identity & previous mock
    this.history = [
      {
        id: 'hist_andre',
        node: {
          id: 'mock_andre',
          name: 'André',
          username: 'andre',
          callsign: 'ANDRE-01',
          phoneNumber: '4116 0001',
          avatarColor: '#18181b',
          avatarInitials: 'AN',
          role: 'CLIENT',
          hardware: 'ESP32 DIY SX1262',
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
        },
        callCount: 2,
        formattedDate: 'Ontem',
        formattedTime: '17:42',
        lastTimestamp: Date.now() - 1000 * 60 * 60 * 20,
        calls: [
          {
            id: 'call_andre_1',
            type: 'outgoing',
            label: 'Efetuada',
            time: '17:35',
            timestamp: Date.now() - 1000 * 60 * 60 * 20,
            durationSeconds: 195,
            duration: '3 min e 15 s',
            dataSize: '1,4 MB',
          },
          {
            id: 'call_andre_2',
            type: 'outgoing',
            label: 'Efetuada',
            time: '17:42',
            timestamp: Date.now() - 1000 * 60 * 60 * 20 + 1000 * 60 * 7,
            durationSeconds: 310,
            duration: '5 min e 10 s',
            dataSize: '2,0 MB',
          },
        ],
      },
      {
        id: 'hist_josh',
        node: {
          id: 'mock_josh',
          name: 'Josh',
          username: 'josh',
          callsign: 'JOSH-02',
          phoneNumber: '4116 0002',
          avatarColor: '#18181b',
          avatarInitials: 'JO',
          role: 'CLIENT',
          hardware: 'ESP32 DIY SX1262',
          batteryPct: 75,
          batteryVoltage: 3.9,
          gps: { lat: 38.72, lng: -9.14, alt: 50 },
          x: 50,
          y: 50,
          antennaDbi: 3.0,
          isOnline: true,
          lastHeard: Date.now(),
          hopsAway: 1,
          rssi: -65,
          snr: 8.0,
          packetsForwarded: 0,
        },
        callCount: 1,
        formattedDate: '09 de setembro',
        formattedTime: '08:51',
        lastTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 27,
        calls: [
          {
            id: 'call_josh_1',
            type: 'outgoing',
            label: 'Efetuada',
            time: '08:51',
            timestamp: Date.now() - 1000 * 60 * 60 * 24 * 27,
            durationSeconds: 80,
            duration: '1 min e 20 s',
            dataSize: '750 KB',
          },
        ],
      },
      {
        id: 'hist_zox',
        node: {
          id: 'mock_zox',
          name: 'Zox',
          username: 'zox',
          callsign: 'ZOX-03',
          phoneNumber: '4116 0003',
          avatarColor: '#18181b',
          avatarInitials: 'ZO',
          role: 'CLIENT',
          hardware: 'ESP32 DIY SX1262',
          batteryPct: 95,
          batteryVoltage: 4.18,
          gps: { lat: 38.72, lng: -9.14, alt: 50 },
          x: 50,
          y: 50,
          antennaDbi: 3.0,
          isOnline: true,
          lastHeard: Date.now(),
          hopsAway: 1,
          rssi: -42,
          snr: 14.0,
          packetsForwarded: 0,
        },
        callCount: 1,
        formattedDate: '01 de agosto',
        formattedTime: '17:35',
        lastTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 66,
        calls: [
          {
            id: 'call_zox_1',
            type: 'outgoing',
            label: 'Efetuada',
            time: '17:35',
            timestamp: Date.now() - 1000 * 60 * 60 * 24 * 66,
            durationSeconds: 302,
            duration: '5 min e 02 s',
            dataSize: '2,6 MB',
          },
        ],
      },
    ];
    this.saveToStorage();
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (e) {
      console.warn('Could not save call history to storage:', e);
    }
  }

  private notify(): void {
    const list = [...this.history];
    this.listeners.forEach((l) => l(list));
  }

  getHistory(): CallHistoryItem[] {
    return [...this.history];
  }

  subscribe(listener: (history: CallHistoryItem[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.history]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Called when a call starts (outbound or inbound)
   */
  startCallSession(params: {
    callId: string;
    node: MeshNode;
    direction: 'outgoing' | 'incoming';
  }): void {
    this.activePendingCall = {
      callId: params.callId,
      node: params.node,
      direction: params.direction,
      startedAt: Date.now(),
    };
  }

  /**
   * Called when a call ends or is cancelled
   */
  completeCallSession(
    callId: string,
    durationSeconds: number,
    status: 'completed' | 'cancelled' | 'rejected' | 'missed'
  ): void {
    const active = this.activePendingCall;
    if (!active || active.callId !== callId) {
      // If we don't have active pending call cached with matching id, return
      return;
    }

    const now = Date.now();
    const node = active.node;
    const direction = active.direction;

    let label: CallLogEntry['label'] = 'Efetuada';
    if (direction === 'incoming') {
      label = status === 'missed' || status === 'rejected' ? 'Perdida' : 'Recebida';
    } else {
      label = status === 'cancelled' ? 'Cancelada' : 'Efetuada';
    }

    const newLog: CallLogEntry = {
      id: 'call_' + now + '_' + Math.random().toString(36).substring(2, 6),
      type: direction === 'incoming' && status === 'missed' ? 'missed' : direction,
      label,
      time: formatCallTime(now),
      timestamp: now,
      durationSeconds,
      duration: formatCallDuration(durationSeconds, status),
      dataSize: formatCallDataSize(durationSeconds),
    };

    // Find if we already have an item for this node / phone number
    const targetPhone = cleanPhoneNumber(node.phoneNumber || getNodePhoneNumber(node.id));
    const targetNodeId = node.id;

    const existingIdx = this.history.findIndex((item) => {
      if (item.node.id === targetNodeId) return true;
      const itemPhone = cleanPhoneNumber(item.node.phoneNumber || getNodePhoneNumber(item.node.id));
      return targetPhone && itemPhone && targetPhone === itemPhone;
    });

    if (existingIdx >= 0) {
      const existing = this.history[existingIdx];
      const updatedCalls = [newLog, ...existing.calls];
      const updatedItem: CallHistoryItem = {
        ...existing,
        node: {
          ...existing.node,
          ...node,
          name: node.name || existing.node.name,
          phoneNumber: node.phoneNumber || existing.node.phoneNumber,
        },
        callCount: updatedCalls.length,
        formattedDate: formatCallDate(now),
        formattedTime: formatCallTime(now),
        lastTimestamp: now,
        calls: updatedCalls,
      };

      // Move to top of history
      this.history.splice(existingIdx, 1);
      this.history.unshift(updatedItem);
    } else {
      const newItem: CallHistoryItem = {
        id: 'hist_' + targetNodeId + '_' + now,
        node: { ...node },
        callCount: 1,
        formattedDate: formatCallDate(now),
        formattedTime: formatCallTime(now),
        lastTimestamp: now,
        calls: [newLog],
      };
      this.history.unshift(newItem);
    }

    this.activePendingCall = null;
    this.saveToStorage();
    this.notify();
  }

  /**
   * Delete an item from history (e.g. from "Limpar Registos")
   */
  deleteHistoryItem(itemId: string): void {
    this.history = this.history.filter((h) => h.id !== itemId);
    this.saveToStorage();
    this.notify();
  }

  /**
   * Clear all call history
   */
  clearAll(): void {
    this.history = [];
    this.saveToStorage();
    this.notify();
  }
}

export const callHistoryService = new CallHistoryService();
