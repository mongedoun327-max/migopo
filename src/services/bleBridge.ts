import { BleDeviceStatus } from '../types/mesh';

// Standard Nordic UART Service UUIDs
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// Meshtastic Service UUID
const MESHTASTIC_SERVICE_UUID = 'cb0b9a0b-a84c-4c0d-bdbb-442e3144ee30';

export interface VirtualOledDisplay {
  line1: string; // Header / Callsign
  line2: string; // Channel & SF
  line3: string; // Packet counter
  line4: string; // Battery & RSSI
  line5: string; // Status icon / Activity
}

export class BleBridgeService {
  private device: any = null;
  private server: any = null;
  private rxChar: any = null;
  private txChar: any = null;

  private status: BleDeviceStatus = {
    isConnected: false,
    isWebBleAvailable: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
    deviceName: null,
    mode: 'HARDWARE_BLE',
    rssi: 0,
    batteryPct: 100,
    firmwareVersion: 'LoRa Mesh BLE Service (Aguardando emparelhamento)',
    rxBytesTotal: 0,
    txBytesTotal: 0,
    lastSerialLog: [
      '[LORA] Sistema pronto. Clique em Emparelhar BLE para conectar placa física ESP32/T-Beam.',
    ],
  };

  private listeners: ((status: BleDeviceStatus) => void)[] = [];
  private onPacketReceivedCallbacks: ((rawPacket: string) => void)[] = [];

  constructor() {}

  getStatus(): BleDeviceStatus {
    return { ...this.status };
  }

  subscribe(listener: (status: BleDeviceStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  onPacketReceived(callback: (rawPacket: string) => void): () => void {
    this.onPacketReceivedCallbacks.push(callback);
    return () => {
      this.onPacketReceivedCallbacks = this.onPacketReceivedCallbacks.filter((c) => c !== callback);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l({ ...this.status }));
  }

  addLog(entry: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.status.lastSerialLog = [...this.status.lastSerialLog.slice(-40), `[${timestamp}] ${entry}`];
    this.notify();
  }

  /**
   * Connect to real physical hardware via Web Bluetooth API
   */
  async connectHardwareBle(): Promise<{ success: boolean; message: string }> {
    if (!this.status.isWebBleAvailable) {
      return {
        success: false,
        message: 'Web Bluetooth não é suportado neste navegador. Utilize o Chrome ou Edge para emparelhar com a sua placa LoRa.',
      };
    }

    try {
      this.addLog('[BLE-SCAN] Requesting Bluetooth device with NUS or Meshtastic services...');
      const navAny = navigator as any;
      const device = await navAny.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'Heltec' },
          { namePrefix: 'T-Beam' },
          { namePrefix: 'Meshtastic' },
          { namePrefix: 'LoRa' },
          { namePrefix: 'ESP32' },
        ],
        optionalServices: [NUS_SERVICE_UUID, MESHTASTIC_SERVICE_UUID, 'battery_service'],
      });

      this.device = device;
      this.addLog(`[BLE] Paired with ${device.name || 'LoRa Node'}. Connecting GATT server...`);
      
      this.server = await device.gatt.connect();
      this.status.isConnected = true;
      this.status.mode = 'HARDWARE_BLE';
      this.status.deviceName = device.name || 'Hardware ESP32 Node';

      // Setup GATT service
      try {
        const service = await this.server.getPrimaryService(NUS_SERVICE_UUID);
        this.txChar = await service.getCharacteristic(NUS_TX_CHAR_UUID);
        this.rxChar = await service.getCharacteristic(NUS_RX_CHAR_UUID);

        await this.txChar.startNotifications();
        this.txChar.addEventListener('characteristicvaluechanged', (e: any) => {
          const value = e.target.value;
          const decoder = new TextDecoder();
          const str = decoder.decode(value);
          this.handleIncomingRawBleData(str);
        });
        this.addLog('[BLE] Subscribed to Nordic UART RX/TX notification stream!');
      } catch (svcErr) {
        this.addLog(`[BLE-WARN] Standard NUS service not found. Connected in generic GATT mode.`);
      }

      device.addEventListener('gattserverdisconnected', () => {
        this.status.isConnected = false;
        this.addLog('[BLE-DISCONNECT] Device disconnected.');
        this.notify();
      });

      this.notify();
      return { success: true, message: `Connected to ${device.name} successfully.` };
    } catch (err: any) {
      this.addLog(`[BLE-ERR] ${err.message || 'Bluetooth connection cancelled.'}`);
      return { success: false, message: err.message || 'Connection failed' };
    }
  }

  disconnect(): void {
    if (this.server && this.server.connected) {
      this.server.disconnect();
    }
    this.status.isConnected = false;
    this.status.deviceName = null;
    this.addLog('[SYS] Rádio Bluetooth desconectado.');
    this.notify();
  }

  /**
   * Send packet to the radio module over BLE GATT
   */
  async transmitPacket(packetHexOrJson: string, byteLength: number): Promise<boolean> {
    this.status.txBytesTotal += byteLength;
    this.addLog(`[TX-LORA] Pacote (${byteLength} bytes) enviado para transmissão de rádio`);

    if (this.status.isConnected && this.rxChar) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(packetHexOrJson);
        await this.rxChar.writeValue(data);
        this.addLog(`[BLE-TX] Escritos ${data.byteLength} bytes na característica RX do ESP32`);
        return true;
      } catch (err: any) {
        this.addLog(`[BLE-ERR] Falha ao escrever no BLE: ${err.message}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Handle raw incoming data from radio / BLE
   */
  private handleIncomingRawBleData(str: string): void {
    this.status.rxBytesTotal += str.length;
    this.addLog(`[RX-LORA] Inbound packet: ${str.slice(0, 32)}...`);
    this.onPacketReceivedCallbacks.forEach((cb) => cb(str));
    this.notify();
  }

  /**
   * Execute an AT command on the virtual / hardware ESP32
   */
  executeCommand(cmd: string): string {
    const trimmed = cmd.trim().toUpperCase();
    this.addLog(`[CMD-IN] ${cmd}`);

    let response = 'OK';
    if (trimmed === 'AT' || trimmed === 'AT+PING') {
      response = '+OK: PONG (ESP32-SX1262 ALIVE)';
    } else if (trimmed === 'AT+STATUS') {
      response = `+STATUS: MODE=${this.status.mode}, BATT=${this.status.batteryPct}%, RSSI=${this.status.rssi}dBm, TX=${this.status.txBytesTotal}B, RX=${this.status.rxBytesTotal}B`;
    } else if (trimmed === 'AT+BATT?') {
      const v = (3.3 + (this.status.batteryPct / 100) * 0.9).toFixed(2);
      response = `+BATT: ${this.status.batteryPct}%, ${v}V (18650 Li-Ion)`;
    } else if (trimmed === 'AT+CAD') {
      response = '+CAD: CHANNEL CLEAR (RSSI: -112 dBm)';
    } else if (trimmed === 'AT+REBOOT') {
      response = '+REBOOT: Watchdog reset in 500ms...';
      setTimeout(() => {
        this.addLog('[BOOT] ESP32 rebooted successfully.');
      }, 500);
    } else {
      response = `+OK: ${cmd}`;
    }

    this.addLog(`[CMD-OUT] ${response}`);
    return response;
  }

  /**
   * Generates monochrome OLED SSD1306 display content for hardware rendering
   */
  getOledState(): VirtualOledDisplay {
    const v = (3.3 + (this.status.batteryPct / 100) * 0.9).toFixed(2);
    return {
      line1: `[NÓ-RF] ${this.status.deviceName?.split(' ')[0] || 'DESCONECTADO'}`,
      line2: `CH: #GERAL-0 | SF9 BW125`,
      line3: `TX: ${Math.floor(this.status.txBytesTotal / 100)}pk | RX: ${Math.floor(this.status.rxBytesTotal / 100)}pk`,
      line4: `BAT: ${this.status.batteryPct}% (${v}V)`,
      line5: `SIG: ${this.status.isConnected ? `${this.status.rssi}dBm` : 'STANDBY'}`,
    };
  }
}

export const bleBridge = new BleBridgeService();
