import React, { useState } from 'react';
import {
  Code,
  Copy,
  Check,
  Download,
  Cpu,
  Layers,
  Smartphone,
  Terminal,
  ExternalLink,
} from 'lucide-react';

export const FirmwareGuide: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'cpp_firmware' | 'platformio' | 'mobile_bindings' | 'pinouts'>('cpp_firmware');
  const [copiedCode, setCopiedCode] = useState(false);

  const cppFirmwareCode = `/**
 * =========================================================================
 * LoRaMesh Tactical Node - Firmware C++ para ESP32 + Semtech SX1262
 * Suporte a BLE UART Bridge, Protocolo Mesh Descentralizado e Codec2 Voice
 * =========================================================================
 */

#include <Arduino.h>
#include <SPI.h>
#include <RadioLib.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Definições de pinos para TTGO T-Beam v1.2 / Heltec WiFi LoRa 32 V3
#define LORA_CS    18
#define LORA_DIO1  26
#define LORA_RST   23
#define LORA_BUSY  32

// UUIDs padrão do serviço Nordic UART (NUS) para ponte com Smartphone
#define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
#define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

// Instância do rádio SX1262 via RadioLib
SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;

// Ring buffer para deduplicação de pacotes (Managed Flooding)
#define CACHE_SIZE 64
uint32_t packetCache[CACHE_SIZE];
uint8_t cacheIndex = 0;

bool isPacketDuplicate(uint32_t packetId) {
  for (int i = 0; i < CACHE_SIZE; i++) {
    if (packetCache[i] == packetId) return true;
  }
  packetCache[cacheIndex] = packetId;
  cacheIndex = (cacheIndex + 1) % CACHE_SIZE;
  return false;
}

// Estrutura de Pacote Mesh LoRa
struct __attribute__((packed)) MeshPacketHeader {
  uint32_t packetId;
  uint32_t fromNode;
  uint32_t toNode;
  uint8_t  hopLimit;
  uint8_t  hopStart;
  uint8_t  payloadType; // 0x01: TEXT, 0x02: VOICE_CODEC2, 0x03: SOS
  uint8_t  payloadLen;
};

// Callbacks do Servidor BLE
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("[BLE] Smartphone conectado!");
    };
    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("[BLE] Smartphone desconectado.");
      pServer->getAdvertising()->start();
    }
};

// Receção de dados vindos do smartphone via BLE
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        Serial.printf("[BLE->LORA] Transmitindo %d bytes via rádio...\\n", rxValue.length());
        
        // Transmite no ar usando o rádio Semtech SX1262
        int state = radio.transmit((uint8_t*)rxValue.c_str(), rxValue.length());
        if (state == RADIOLIB_ERR_NONE) {
          Serial.println("[LORA] Pacote irradiado com sucesso!");
        } else {
          Serial.printf("[LORA-ERR] Falha de transmissão: %d\\n", state);
        }
        
        // Retorna ao modo de escuta contínua RX
        radio.startReceive();
      }
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("[BOOT] Inicializando Nó LoRa Mesh...");

  // Inicialização do rádio SX1262 (868.125MHz, SF9, BW125kHz, CR4/7, 20dBm)
  int state = radio.begin(868.125, 125.0, 9, 7, 0x34, 20, 8);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("[SX1262] Rádio LoRa configurado com sucesso!");
  } else {
    Serial.printf("[SX1262-ERR] Código de erro: %d\\n", state);
    while (true);
  }

  // Inicialização do Bluetooth Low Energy (BLE)
  BLEDevice::init("LORA-TBEAM-NODE");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                           CHARACTERISTIC_UUID_RX,
                                           BLECharacteristic::PROPERTY_WRITE
                                         );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("[BLE] Aguardando conexão do aplicativo móvel...");

  // Inicia escuta LoRa em segundo plano
  radio.startReceive();
}

void loop() {
  // Verificação de pacotes LoRa recebidos no ar
  if (radio.getPacketLength() > 0) {
    uint8_t rxBuffer[256];
    int len = radio.readData(rxBuffer, sizeof(rxBuffer));

    if (len > 0) {
      float rssi = radio.getRSSI();
      float snr = radio.getSNR();
      Serial.printf("[LORA->BLE] Pacote recebido: %d bytes (RSSI: %.1f dBm, SNR: %.1f dB)\\n", len, rssi, snr);

      // Encaminha imediatamente para o aplicativo do telemóvel via BLE
      if (deviceConnected && pTxCharacteristic) {
        pTxCharacteristic->setValue(rxBuffer, len);
        pTxCharacteristic->notify();
      }

      // Lógica de Retransmissão Mesh (Managed Flooding)
      if (len >= sizeof(MeshPacketHeader)) {
        MeshPacketHeader* header = (MeshPacketHeader*)rxBuffer;
        if (!isPacketDuplicate(header->packetId) && header->hopLimit > 1) {
          header->hopLimit--;
          delay(random(100, 350)); // Backoff aleatório para evitar colisão CSMA
          radio.transmit(rxBuffer, len);
          Serial.printf("[MESH] Pacote %08X retransmitido! Hops restantes: %d\\n", header->packetId, header->hopLimit);
        }
      }

      radio.startReceive();
    }
  }

  delay(10);
}`;

  const platformIoIni = `[env:ttgo-t-beam]
platform = espressif32
board = ttgo-t-beam
framework = arduino
monitor_speed = 115200

lib_deps =
    jgromes/RadioLib @ ^6.4.2
    nkolban/ESP32 BLE Arduino @ ^2.0.0
    mikalhart/TinyGPSPlus @ ^1.0.3
    lewisxhe/AXP202X_Library @ ^1.1.3
    adafruit/Adafruit SSD1306 @ ^2.5.9

build_flags =
    -D RADIOLIB_EXCLUDE_SX127X=0
    -D LORA_FREQUENCY=868.125
`;

  const flutterBindingsSnippet = `// Exemplo em Flutter (Dart) conectando via BLE ao nó LoRa
// Dependências em pubspec.yaml: flutter_blue_plus, record, flutter_sound

import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class LoRaBleManager {
  BluetoothDevice? device;
  BluetoothCharacteristic? rxChar;
  BluetoothCharacteristic? txChar;

  Future<void> connectToNode() async {
    // 1. Escanear por dispositivos LoRa
    await FlutterBluePlus.startScan(timeout: const Duration(seconds: 4));
    FlutterBluePlus.scanResults.listen((results) async {
      for (ScanResult r in results) {
        if (r.device.platformName.contains("LORA-TBEAM")) {
          device = r.device;
          await FlutterBluePlus.stopScan();
          await device!.connect();
          await discoverServices();
          break;
        }
      }
    });
  }

  Future<void> discoverServices() async {
    List<BluetoothService> services = await device!.discoverServices();
    for (var s in services) {
      if (s.uuid.toString() == "6e400001-b5a3-f393-e0a9-e50e24dcca9e") {
        for (var c in s.characteristics) {
          if (c.uuid.toString() == "6e400002-b5a3-f393-e0a9-e50e24dcca9e") rxChar = c;
          if (c.uuid.toString() == "6e400003-b5a3-f393-e0a9-e50e24dcca9e") {
            txChar = c;
            await txChar!.setNotifyValue(true);
            txChar!.onValueReceived.listen((data) {
              // Recebe pacote LoRa e decodifica Codec2 ou texto
              print("Pacote LoRa recebido: \${data.length} bytes");
            });
          }
        }
      }
    }
  }

  Future<void> sendPacket(List<int> bytes) async {
    if (rxChar != null) {
      await rxChar!.write(bytes, withoutResponse: false);
    }
  }
}`;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">
              Firmware C++ & Arquitetura de Implementação
            </h2>
            <p className="text-xs text-slate-400">
              Código-fonte pronto para gravar no ESP32 (PlatformIO/Arduino IDE) e bindings para Flutter / Android NDK
            </p>
          </div>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('cpp_firmware')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'cpp_firmware'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Firmware C++ (ESP32 + RadioLib)
        </button>

        <button
          onClick={() => setActiveSubTab('platformio')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'platformio'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          platformio.ini
        </button>

        <button
          onClick={() => setActiveSubTab('mobile_bindings')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'mobile_bindings'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Bindings Flutter / Android FFI
        </button>

        <button
          onClick={() => setActiveSubTab('pinouts')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeSubTab === 'pinouts'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pinouts de Hardware
        </button>
      </div>

      {/* Code Viewer Panel */}
      {activeSubTab === 'cpp_firmware' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400">src/main.cpp</span>
            <button
              onClick={() => handleCopy(cppFirmwareCode)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copiado!' : 'Copiar Código C++'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed border border-slate-800 select-text">
            {cppFirmwareCode}
          </pre>
        </div>
      )}

      {activeSubTab === 'platformio' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400">platformio.ini</span>
            <button
              onClick={() => handleCopy(platformIoIni)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copiado!' : 'Copiar Configuração'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed border border-slate-800 select-text">
            {platformIoIni}
          </pre>
        </div>
      )}

      {activeSubTab === 'mobile_bindings' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-mono text-emerald-400">lib/lora_ble_manager.dart (Flutter)</span>
            <button
              onClick={() => handleCopy(flutterBindingsSnippet)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copiado!' : 'Copiar Código Dart'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed border border-slate-800 select-text">
            {flutterBindingsSnippet}
          </pre>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <h4 className="font-bold text-slate-200 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Compilação do libcodec2 em C/C++ Nativo
            </h4>
            <p className="text-slate-400 leading-relaxed">
              No Android (NDK) e iOS (Objective-C++), a biblioteca <code className="text-emerald-400">libcodec2</code> deve ser adicionada via CMake/Cocoapods:
            </p>
            <div className="p-2.5 bg-slate-900 rounded font-mono text-[11px] text-slate-300">
              # No CMakeLists.txt do Android NDK:<br />
              add_subdirectory(codec2)<br />
              target_link_libraries(native-audio-lib codec2)
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'pinouts' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-slate-100 pb-2 border-b border-slate-800">
            Mapeamento de Pinos (Pinouts) dos Módulos Recomendados
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-emerald-400 font-sans text-sm">TTGO T-Beam v1.1 / v1.2</span>
              <ul className="space-y-1 text-slate-300">
                <li>• SX1262 CS: <span className="text-slate-100">GPIO 18</span></li>
                <li>• SX1262 DIO1: <span className="text-slate-100">GPIO 26</span></li>
                <li>• SX1262 RST: <span className="text-slate-100">GPIO 23</span></li>
                <li>• SX1262 BUSY: <span className="text-slate-100">GPIO 32</span></li>
                <li>• GPS NEO-6M TX/RX: <span className="text-slate-100">GPIO 34 / 12</span></li>
                <li>• I2C OLED (SDA/SCL): <span className="text-slate-100">GPIO 21 / 22</span></li>
                <li>• Gestão de Bateria: <span className="text-slate-100">AXP192 / AXP2101</span></li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-sky-400 font-sans text-sm">Heltec WiFi LoRa 32 V3</span>
              <ul className="space-y-1 text-slate-300">
                <li>• SX1262 CS: <span className="text-slate-100">GPIO 8</span></li>
                <li>• SX1262 DIO1: <span className="text-slate-100">GPIO 14</span></li>
                <li>• SX1262 RST: <span className="text-slate-100">GPIO 12</span></li>
                <li>• SX1262 BUSY: <span className="text-slate-100">GPIO 13</span></li>
                <li>• OLED Embutido (SDA/SCL): <span className="text-slate-100">GPIO 17 / 18</span></li>
                <li>• VExt Power Switch: <span className="text-slate-100">GPIO 36</span></li>
                <li>• Leitura de Bateria ADC: <span className="text-slate-100">GPIO 1</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
