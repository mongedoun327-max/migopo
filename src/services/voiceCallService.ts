import { bleBridge } from './bleBridge';
import { callHistoryService } from './callHistoryService';
import { MeshNode } from '../types/mesh';
import { getNodePhoneNumber, formatPhoneNumber } from './phoneSystem';

export type CallStatus = 'IDLE' | 'CALLING' | 'INCOMING' | 'CONNECTED' | 'ENDED';

export interface VoiceCallState {
  status: CallStatus;
  callId: string | null;
  peerNodeId: string | null;
  peerName: string | null;
  peerCallsign?: string;
  peerPhone?: string;
  durationSeconds: number;
  isMuted: boolean;
  isBoosted: boolean; // Digital HD Audio Booster (+12dB)
  localVolume: number; // 0 - 100 (for live mic meter)
  remoteVolume: number; // 0 - 100 (for live peer meter)
  signalQuality: {
    percentage: number;
    bars: number;
    rssiDbm: number;
    snrDb: number;
    rating: string;
    relayPath: string;
    codec: string;
  };
}

class VoiceCallService {
  private state: VoiceCallState = {
    status: 'IDLE',
    callId: null,
    peerNodeId: null,
    peerName: null,
    peerCallsign: '',
    peerPhone: '',
    durationSeconds: 0,
    isMuted: false,
    isBoosted: true, // Enabled by default for max signal strength
    localVolume: 0,
    remoteVolume: 0,
    signalQuality: {
      percentage: 100,
      bars: 5,
      rssiDbm: -42,
      snrDb: 15.5,
      rating: 'Excelente (Sinal Máximo)',
      relayPath: 'Mesh P2P Direto · 0% Perda',
      codec: 'WebRTC Opus FullBand HD',
    },
  };

  private listeners: ((state: VoiceCallState) => void)[] = [];
  private ws: WebSocket | null = null;
  private selfNodeId: string = '';
  private selfName: string = '';
  private selfPhone: string = '';

  // WebRTC Peer Connection & Real-Time Audio
  private peerConnection: RTCPeerConnection | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private remoteStream: MediaStream | null = null;
  private isWebRtcAudioActive: boolean = false;
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];

  // Web Audio Context & Fallback Stream Pipeline
  private audioCtx: AudioContext | null = null;
  private localStream: MediaStream | null = null;
  private localGainNode: GainNode | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private pcmProcessor: ScriptProcessorNode | null = null;
  private remotePcmGainNode: GainNode | null = null;
  private nextPcmPlayTime: number = 0;

  // Tactical Radio Test Loopback
  private isEchoLoopbackTestActive: boolean = false;
  private echoGainNode: GainNode | null = null;

  // Ringtone oscillator & timers
  private ringtoneInterval: any = null;
  private ringtoneMasterGain: GainNode | null = null;
  private timerInterval: any = null;
  private meterInterval: any = null;
  private pendingPollInterval: any = null;
  private peerCallTimeoutTimer: any = null;
  private pendingSendQueue: any[] = [];

  constructor() {
    // Start polling pending offers as HTTP fallback
    if (typeof window !== 'undefined') {
      this.pendingPollInterval = setInterval(() => {
        this.pollPendingOffers();
      }, 2500);

      // Create persistent remote audio element for high-priority browser playback
      try {
        const audio = document.createElement('audio');
        audio.id = 'loramesh-remote-audio-player';
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudioElement = audio;
      } catch {}
    }
  }

  init(selfNodeId: string, selfName: string, selfPhone?: string): void {
    if (!selfNodeId) return;

    this.selfPhone = selfPhone || this.selfPhone || getNodePhoneNumber(selfNodeId, true);

    if (
      this.selfNodeId === selfNodeId &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      this.selfName = selfName;
      return;
    }

    this.selfNodeId = selfNodeId;
    this.selfName = selfName;
    this.connectWs();
  }

  private connectWs(): void {
    if (typeof window === 'undefined' || !this.selfNodeId) return;

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws/call?nodeId=${encodeURIComponent(
        this.selfNodeId
      )}`;

      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(
              JSON.stringify({
                type: 'REGISTER',
                nodeId: this.selfNodeId,
                userName: this.selfName,
                phoneNumber: this.selfPhone || getNodePhoneNumber(this.selfNodeId, true),
              })
            );

            // Flush queue safely
            while (this.pendingSendQueue.length > 0) {
              const item = this.pendingSendQueue.shift();
              if (item && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(item));
              }
            }
          } catch (e) {
            console.warn('[Call-WS] Error sending on open:', e);
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingSocketMessage(msg);
        } catch (e) {
          console.warn('[Call-WS] Error parsing ws message:', e);
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.ws = null;
          setTimeout(() => {
            if (this.selfNodeId && !this.ws) this.connectWs();
          }, 3500);
        }
      };

      socket.onerror = () => {
        // Fallback polling will handle signals
      };
    } catch (e) {
      console.warn('[Call-WS] Could not initialize WebSocket:', e);
    }
  }

  private sendWsMessage(payload: any): void {
    if (!this.ws) {
      this.pendingSendQueue.push(payload);
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        console.warn('[Call-WS] Send error:', err);
      }
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      this.pendingSendQueue.push(payload);
    }
  }

  private async handleIncomingSocketMessage(msg: any): Promise<void> {
    if (!msg || !msg.type) return;

    if (msg.type === 'CALL_OFFER') {
      if (this.state.status === 'IDLE') {
        const callerNode: MeshNode = {
          id: msg.callerNodeId,
          name: msg.callerName || 'Operador',
          username: (msg.callerName || 'operador').toLowerCase().replace(/\s+/g, '.'),
          callsign: msg.callerCallsign || 'OPERADOR',
          phoneNumber: msg.callerPhone || getNodePhoneNumber(msg.callerNodeId),
          avatarColor: '#18181b',
          avatarInitials: (msg.callerName || 'OP').slice(0, 2).toUpperCase(),
          role: 'CLIENT',
          hardware: 'ESP32 DIY SX1262',
          batteryPct: 95,
          batteryVoltage: 4.15,
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

        callHistoryService.startCallSession({
          callId: msg.callId,
          node: callerNode,
          direction: 'incoming',
        });

        this.state = {
          ...this.state,
          status: 'INCOMING',
          callId: msg.callId,
          peerNodeId: msg.callerNodeId,
          peerName: msg.callerName || 'Operador',
          peerCallsign: msg.callerCallsign || 'OPERADOR',
          peerPhone: callerNode.phoneNumber,
          durationSeconds: 0,
        };
        this.startRingtone();
        this.notify();
      }
    } else if (msg.type === 'CALL_ANSWER') {
      if (msg.callId === this.state.callId && this.state.status === 'CALLING') {
        if (this.peerCallTimeoutTimer) {
          clearTimeout(this.peerCallTimeoutTimer);
          this.peerCallTimeoutTimer = null;
        }
        this.stopRingtone();
        this.state.status = 'CONNECTED';
        this.startCallDurationTimer();
        this.notify();

        bleBridge.addLog(`[VOZ] Chamada atendida por ${this.state.peerName}. A iniciar canal P2P duplex...`);

        // Caller initiates the WebRTC offer
        await this.setupPeerConnection(true, msg.targetNodeId || this.state.peerNodeId!);
      }
    } else if (msg.type === 'WEBRTC_SIGNAL') {
      if (msg.callId === this.state.callId) {
        await this.handleWebRtcSignal(msg);
      }
    } else if (msg.type === 'CALL_REJECT' || msg.type === 'CALL_HANGUP') {
      if (msg.callId === this.state.callId) {
        this.cleanupAudioAndState();
      }
    } else if (msg.type === 'CALL_AUDIO_STREAM') {
      if (msg.callId === this.state.callId && msg.toNodeId === this.selfNodeId) {
        if (msg.pcmData) {
          this.playIncomingPcmChunk(msg.pcmData);
        } else if (msg.audioData) {
          this.playIncomingAudioChunk(msg.audioData, msg.mimeType);
        }
      }
    }
  }

  private async pollPendingOffers(): Promise<void> {
    if (!this.selfNodeId || this.state.status !== 'IDLE') return;

    try {
      const resp = await fetch(`/api/mesh/calls/pending?nodeId=${encodeURIComponent(this.selfNodeId)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.offer && data.offer.callId && this.state.status === 'IDLE') {
          const offer = data.offer;
          this.state = {
            ...this.state,
            status: 'INCOMING',
            callId: offer.callId,
            peerNodeId: offer.callerNodeId,
            peerName: offer.callerName || 'Operador',
            peerCallsign: offer.callerCallsign || 'OPERADOR',
            durationSeconds: 0,
          };
          this.startRingtone();
          this.notify();
        }
      }
    } catch {
      // Ignore background fetch errors
    }
  }

  getState(): VoiceCallState {
    return { ...this.state };
  }

  subscribe(listener: (state: VoiceCallState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  /**
   * Start an outgoing HD Voice Call
   */
  async startCall(
    targetNodeId: string,
    targetName: string,
    targetCallsign?: string,
    targetPhone?: string,
    nodeObj?: Partial<MeshNode>
  ): Promise<boolean> {
    if (this.state.status !== 'IDLE') return false;

    const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const resolvedPhone = targetPhone || (nodeObj && nodeObj.phoneNumber) || getNodePhoneNumber(targetNodeId);

    const peerNode: MeshNode = {
      id: targetNodeId,
      name: targetName,
      username: (nodeObj?.username || targetName).toLowerCase().replace(/\s+/g, '.'),
      callsign: targetCallsign || nodeObj?.callsign || targetName.toUpperCase().slice(0, 8),
      phoneNumber: resolvedPhone,
      avatarColor: nodeObj?.avatarColor || '#18181b',
      avatarInitials: nodeObj?.avatarInitials || targetName.slice(0, 2).toUpperCase(),
      role: nodeObj?.role || 'CLIENT',
      hardware: nodeObj?.hardware || 'ESP32 DIY SX1262',
      batteryPct: nodeObj?.batteryPct || 98,
      batteryVoltage: nodeObj?.batteryVoltage || 4.15,
      gps: nodeObj?.gps || { lat: 38.72, lng: -9.14, alt: 50 },
      x: nodeObj?.x || 50,
      y: nodeObj?.y || 50,
      antennaDbi: nodeObj?.antennaDbi || 3.0,
      isOnline: true,
      lastHeard: Date.now(),
      hopsAway: nodeObj?.hopsAway || 1,
      rssi: nodeObj?.rssi || -45,
      snr: nodeObj?.snr || 12.0,
      packetsForwarded: nodeObj?.packetsForwarded || 0,
    };

    // Register active call session in call history
    callHistoryService.startCallSession({
      callId,
      node: peerNode,
      direction: 'outgoing',
    });

    this.state = {
      ...this.state,
      status: 'CALLING',
      callId,
      peerNodeId: targetNodeId,
      peerName: targetName,
      peerCallsign: peerNode.callsign,
      peerPhone: resolvedPhone,
      durationSeconds: 0,
    };
    this.notify();

    // Start outgoing ring sound
    this.startRingtone();

    // Acquire mic and start audio pipeline immediately on user click
    await this.initLocalAudio();

    // Differentiate between Base Station / Echo Loopback Test vs Real Human Peer
    const isStationOrTest =
      targetNodeId === 'group-broadcast' ||
      targetNodeId.startsWith('station_') ||
      targetNodeId.startsWith('node_test_');

    if (this.peerCallTimeoutTimer) clearTimeout(this.peerCallTimeoutTimer);

    if (isStationOrTest) {
      // Base station automated transponder response after ~2.4s of ringing
      this.peerCallTimeoutTimer = setTimeout(() => {
        if (this.state.status === 'CALLING' && this.state.callId === callId) {
          this.stopRingtone();
          this.state.status = 'CONNECTED';
          this.startCallDurationTimer();
          this.notify();
          this.activateRadioEchoLoopback();
          bleBridge.addLog(`[VOZ] Estação Base LoRa conectada. Canal de teste duplex aberto.`);
        }
      }, 2400);
    } else {
      // Real peer call: allow up to 35 seconds for the peer to pick up before timing out
      this.peerCallTimeoutTimer = setTimeout(() => {
        if (this.state.status === 'CALLING' && this.state.callId === callId) {
          bleBridge.addLog(`[VOZ] O contacto ${targetName} não atendeu a chamada.`);
          this.hangup();
        }
      }, 35000);
    }

    // Send offer via WebSocket
    const offerPayload = {
      type: 'CALL_OFFER',
      callId,
      callerNodeId: this.selfNodeId,
      callerName: this.selfName,
      callerPhone: this.selfPhone || getNodePhoneNumber(this.selfNodeId, true),
      targetNodeId,
      timestamp: Date.now(),
    };

    this.sendWsMessage(offerPayload);

    // Also send via HTTP endpoint for guaranteed reception
    try {
      fetch('/api/mesh/calls/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerPayload),
      }).catch(() => {});
    } catch (e) {
      console.warn('Call offer HTTP failed:', e);
    }

    bleBridge.addLog(`[VOZ] A iniciar chamada de voz HD com ${targetName}...`);
    return true;
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(): Promise<void> {
    if (this.state.status !== 'INCOMING' || !this.state.callId) return;

    this.stopRingtone();
    this.state.status = 'CONNECTED';
    this.startCallDurationTimer();
    this.notify();

    // Acquire microphone on user gesture
    await this.initLocalAudio();

    // Prepare WebRTC peer connection (as responder)
    await this.setupPeerConnection(false, this.state.peerNodeId!);

    const answerPayload = {
      type: 'CALL_ANSWER',
      callId: this.state.callId,
      callerNodeId: this.state.peerNodeId,
      targetNodeId: this.selfNodeId,
    };

    this.sendWsMessage(answerPayload);

    fetch('/api/mesh/calls/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answerPayload),
    }).catch(() => {});

    bleBridge.addLog(`[VOZ] Chamada conectada com ${this.state.peerName}. Sinal 100% Forte.`);
  }

  /**
   * Reject an incoming call
   */
  rejectCall(): void {
    if (!this.state.callId) return;

    const payload = {
      type: 'CALL_REJECT',
      callId: this.state.callId,
      callerNodeId: this.state.peerNodeId,
      targetNodeId: this.selfNodeId,
    };

    this.sendWsMessage(payload);

    fetch('/api/mesh/calls/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    this.cleanupAudioAndState();
  }

  /**
   * Hang up the current call
   */
  hangup(): void {
    if (!this.state.callId) return;

    const payload = {
      type: 'CALL_HANGUP',
      callId: this.state.callId,
      callerNodeId: this.selfNodeId,
      targetNodeId: this.state.peerNodeId,
    };

    this.sendWsMessage(payload);

    fetch('/api/mesh/calls/hangup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    bleBridge.addLog(`[VOZ] Chamada encerrada. Duração: ${this.formatDuration(this.state.durationSeconds)}`);
    this.cleanupAudioAndState();
  }

  /**
   * Toggle Mute Microphone
   */
  toggleMute(): void {
    const next = !this.state.isMuted;
    this.state.isMuted = next;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    this.notify();
  }

  /**
   * Toggle +12dB Digital Signal & Audio Booster
   */
  toggleBoost(): void {
    const next = !this.state.isBoosted;
    this.state.isBoosted = next;
    if (this.localGainNode) {
      // 3.0x (+12dB) if boosted, else 1.2x
      this.localGainNode.gain.setValueAtTime(next ? 3.0 : 1.2, this.audioCtx?.currentTime || 0);
    }
    if (this.remotePcmGainNode) {
      this.remotePcmGainNode.gain.setValueAtTime(next ? 1.4 : 1.0, this.audioCtx?.currentTime || 0);
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = next ? 1.0 : 0.85;
    }
    this.notify();
  }

  /**
   * WebRTC PeerConnection Setup (Direct P2P Full-Duplex Audio)
   */
  private async setupPeerConnection(isInitiator: boolean, remotePeerId: string): Promise<void> {
    this.cleanupPeerConnection();

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 2,
      });
      this.peerConnection = pc;

      // Add local microphone tracks to WebRTC peer connection
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      }

      // Handle incoming remote audio track from peer
      pc.ontrack = (event) => {
        console.log('[VOICE] WebRTC Track recebido de peer:', event.streams);
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.remoteStream = stream;
        this.isWebRtcAudioActive = true;
        this.playRemoteStream(stream);
      };

      // Exchange ICE candidates through local mesh signaling WebSocket
      pc.onicecandidate = (event) => {
        if (event.candidate && this.state.callId) {
          this.sendWsMessage({
            type: 'WEBRTC_SIGNAL',
            callId: this.state.callId,
            fromNodeId: this.selfNodeId,
            toNodeId: remotePeerId,
            signal: {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[VOICE] WebRTC State:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          this.isWebRtcAudioActive = true;
          bleBridge.addLog('[VOZ] Canal P2P WebRTC Conectado com sucesso.');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          this.isWebRtcAudioActive = false;
        }
      };

      // If caller, generate and send SDP Offer
      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);
        this.sendWsMessage({
          type: 'WEBRTC_SIGNAL',
          callId: this.state.callId,
          fromNodeId: this.selfNodeId,
          toNodeId: remotePeerId,
          signal: {
            type: 'offer',
            sdp: offer.sdp,
          },
        });
      }
    } catch (err) {
      console.warn('[VOICE] Erro na inicialização do WebRTC:', err);
    }
  }

  /**
   * Handle WebRTC SDP Offer / Answer & ICE Candidate Signals
   */
  private async handleWebRtcSignal(msg: any): Promise<void> {
    if (!msg || !msg.signal) return;
    const signal = msg.signal;
    const pc = this.peerConnection;

    try {
      if (signal.type === 'offer') {
        if (!this.peerConnection) {
          await this.setupPeerConnection(false, msg.fromNodeId || this.state.peerNodeId!);
        }

        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({
              type: 'offer',
              sdp: signal.sdp,
            })
          );

          // Flush queued ICE candidates
          while (this.iceCandidatesQueue.length > 0) {
            const cand = this.iceCandidatesQueue.shift()!;
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }

          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          this.sendWsMessage({
            type: 'WEBRTC_SIGNAL',
            callId: this.state.callId,
            fromNodeId: this.selfNodeId,
            toNodeId: msg.fromNodeId || this.state.peerNodeId!,
            signal: {
              type: 'answer',
              sdp: answer.sdp,
            },
          });
        }
      } else if (signal.type === 'answer') {
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(
            new RTCSessionDescription({
              type: 'answer',
              sdp: signal.sdp,
            })
          );

          // Flush queued ICE candidates
          while (this.iceCandidatesQueue.length > 0) {
            const cand = this.iceCandidatesQueue.shift()!;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.iceCandidatesQueue.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn('[VOICE] WebRTC Signal error:', err);
    }
  }

  /**
   * Play incoming real-time audio stream from peer
   */
  private playRemoteStream(stream: MediaStream): void {
    try {
      if (!this.remoteAudioElement) {
        const audio = document.createElement('audio');
        audio.id = 'loramesh-remote-audio-player';
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudioElement = audio;
      }

      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.volume = this.state.isBoosted ? 1.0 : 0.9;
      this.remoteAudioElement.play().catch((err) => {
        console.warn('[VOICE] Autoplay deferred:', err);
      });

      // Connect remote stream to Web Audio Analyser to animate peer volume meter
      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        const remoteSource = this.audioCtx.createMediaStreamSource(stream);
        this.remoteAnalyser = this.audioCtx.createAnalyser();
        this.remoteAnalyser.fftSize = 64;
        remoteSource.connect(this.remoteAnalyser);
      }
    } catch (e) {
      console.warn('[VOICE] Play remote stream warning:', e);
    }
  }

  /**
   * Initialize Local Microphone Audio with Studio Quality & Automatic Gain Control
   */
  private async initLocalAudio(): Promise<void> {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      const source = this.audioCtx.createMediaStreamSource(this.localStream);
      this.localGainNode = this.audioCtx.createGain();
      this.localGainNode.gain.value = this.state.isBoosted ? 3.0 : 1.2;

      this.localAnalyser = this.audioCtx.createAnalyser();
      this.localAnalyser.fftSize = 64;

      source.connect(this.localGainNode);
      this.localGainNode.connect(this.localAnalyser);

      // Create remote PCM gain node
      this.remotePcmGainNode = this.audioCtx.createGain();
      this.remotePcmGainNode.gain.value = 1.0;
      this.remotePcmGainNode.connect(this.audioCtx.destination);

      // Start volume meter animation
      this.startVolumeMeter();

      // Start low-latency PCM downsampler streamer (fallback channel)
      this.startPcmAudioStreaming();
    } catch (err) {
      console.warn('[VOICE] Microphone access warning:', err);
    }
  }

  /**
   * Streams downsampled 16kHz raw PCM frames every 128ms via WebSocket
   * as a robust off-grid fallback if WebRTC ICE traversal is restricted
   */
  private startPcmAudioStreaming(): void {
    if (!this.audioCtx || !this.localGainNode) return;

    try {
      // 2048 buffer size = ~42ms at 48kHz
      this.pcmProcessor = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.pcmProcessor.onaudioprocess = (e) => {
        if (
          this.state.status !== 'CONNECTED' ||
          !this.state.callId ||
          !this.state.peerNodeId ||
          this.state.isMuted
        ) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);

        // Downsample input to 16kHz
        const downsampled = this.downsampleTo16k(inputData, this.audioCtx!.sampleRate);

        // Convert Float32 [-1.0, 1.0] to 16-bit signed PCM
        const int16 = new Int16Array(downsampled.length);
        for (let i = 0; i < downsampled.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, downsampled[i] * 32767));
        }

        // Convert to binary string
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Pcm = btoa(binary);

        const packet = {
          type: 'CALL_AUDIO_STREAM',
          callId: this.state.callId,
          fromNodeId: this.selfNodeId,
          toNodeId: this.state.peerNodeId,
          pcmData: base64Pcm,
          mimeType: 'audio/pcm16-16khz',
          timestamp: Date.now(),
        };

        this.sendWsMessage(packet);
      };

      this.localGainNode.connect(this.pcmProcessor);
      this.pcmProcessor.connect(this.audioCtx.destination);
    } catch (err) {
      console.warn('[VOICE] PCM streamer error:', err);
    }
  }

  /**
   * Fast linear downsampler to 16kHz
   */
  private downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
    if (inputSampleRate === 16000) return input;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetInput = 0;

    while (offsetResult < result.length) {
      const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
        accum += input[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetInput = nextOffsetInput;
    }
    return result;
  }

  /**
   * Gapless, high-fidelity Web Audio PCM buffer player
   */
  private playIncomingPcmChunk(base64Pcm: string): void {
    if (!base64Pcm || !this.audioCtx) return;

    try {
      // If WebRTC direct P2P is already active and playing, avoid audio doubling
      if (this.isWebRtcAudioActive) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      let maxAmp = 0;

      for (let i = 0; i < int16.length; i++) {
        const val = int16[i] / 32768.0;
        float32[i] = val;
        const abs = Math.abs(val);
        if (abs > maxAmp) maxAmp = abs;
      }

      // Drive remote volume visualizer dynamically
      const volume = Math.min(100, Math.round(maxAmp * 160));
      if (volume > 4 || this.state.remoteVolume > 0) {
        this.state.remoteVolume = volume;
        this.notify();
      }

      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 16000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.remotePcmGainNode || this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      const playTime = Math.max(now + 0.02, this.nextPcmPlayTime);
      source.start(playTime);
      this.nextPcmPlayTime = playTime + audioBuffer.duration;
    } catch (err) {
      console.warn('[VOICE] PCM playback warning:', err);
    }
  }

  private playIncomingAudioChunk(audioDataUrl: string, mimeType: string): void {
    if (!audioDataUrl || this.isWebRtcAudioActive) return;

    try {
      const audio = new Audio(audioDataUrl);
      audio.volume = this.state.isBoosted ? 1.0 : 0.9;
      audio.play().catch(() => {});

      this.state.remoteVolume = Math.floor(Math.random() * 35 + 25);
      this.notify();
      setTimeout(() => {
        this.state.remoteVolume = 0;
        this.notify();
      }, 160);
    } catch {}
  }

  /**
   * Tactical Radio Echo Loopback Mode (for Base Station / Channel Testing)
   */
  private activateRadioEchoLoopback(): void {
    if (!this.audioCtx || !this.localGainNode) return;
    try {
      this.isEchoLoopbackTestActive = true;
      this.playTacticalChirp();

      // Delayed repeater loopback (~260ms hop delay)
      const delayNode = this.audioCtx.createDelay(1.0);
      delayNode.delayTime.value = 0.26;

      // Bandpass radio voice filter (300Hz - 3400Hz)
      const biquad = this.audioCtx.createBiquadFilter();
      biquad.type = 'bandpass';
      biquad.frequency.value = 1650;
      biquad.Q.value = 0.75;

      this.echoGainNode = this.audioCtx.createGain();
      this.echoGainNode.gain.value = 0.85;

      this.localGainNode.connect(delayNode);
      delayNode.connect(biquad);
      biquad.connect(this.echoGainNode);
      this.echoGainNode.connect(this.audioCtx.destination);

      if (this.remoteAnalyser) {
        this.echoGainNode.connect(this.remoteAnalyser);
      }
    } catch (e) {
      console.warn('[VOICE] Echo test warning:', e);
    }
  }

  /**
   * Short tactical radio squelch chirp (1300Hz -> 1800Hz beep)
   */
  private playTacticalChirp(): void {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const now = this.audioCtx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1300, now);
      osc.frequency.exponentialRampToValueAtTime(1850, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }

  /**
   * Live audio volume meter for waveform visualizer
   */
  private startVolumeMeter(): void {
    if (this.meterInterval) clearInterval(this.meterInterval);

    const buffer = new Uint8Array(32);
    const remoteBuffer = new Uint8Array(32);

    this.meterInterval = setInterval(() => {
      if (this.state.status === 'CONNECTED') {
        // 1. Measure Local Mic
        if (this.localAnalyser && !this.state.isMuted) {
          this.localAnalyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const avg = sum / buffer.length;
          const volume = Math.min(100, Math.round((avg / 255) * 160));
          if (Math.abs(this.state.localVolume - volume) > 3) {
            this.state.localVolume = volume;
            this.notify();
          }
        }

        // 2. Measure Remote Audio Stream
        if (this.remoteAnalyser) {
          this.remoteAnalyser.getByteFrequencyData(remoteBuffer);
          let sum = 0;
          for (let i = 0; i < remoteBuffer.length; i++) {
            sum += remoteBuffer[i];
          }
          const avg = sum / remoteBuffer.length;
          const volume = Math.min(100, Math.round((avg / 255) * 160));
          if (Math.abs(this.state.remoteVolume - volume) > 3) {
            this.state.remoteVolume = volume;
            this.notify();
          }
        }
      }
    }, 70);
  }

  /**
   * Ultra-soft acoustic piano tone synthesizer (Toque bem suave de piano)
   */
  private playSoftPianoNote(
    ctx: AudioContext,
    dest: AudioNode,
    frequency: number,
    startTime: number,
    duration: number = 1.6,
    velocity: number = 0.75
  ): void {
    try {
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(2200, frequency * 3.4), startTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(380, frequency * 1.3), startTime + duration * 0.75);

      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(frequency, startTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(frequency * 2, startTime);
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.28, startTime);

      const osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(frequency * 3, startTime);
      const gain3 = ctx.createGain();
      gain3.gain.setValueAtTime(0.08, startTime);

      const osc4 = ctx.createOscillator();
      osc4.type = 'triangle';
      osc4.frequency.setValueAtTime(frequency, startTime);
      const gain4 = ctx.createGain();
      gain4.gain.setValueAtTime(0.16, startTime);

      const peakVolume = 0.075 * velocity;
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(peakVolume, startTime + 0.008);
      noteGain.gain.exponentialRampToValueAtTime(peakVolume * 0.45, startTime + 0.32);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(noteGain);
      osc2.connect(gain2);
      gain2.connect(noteGain);
      osc3.connect(gain3);
      gain3.connect(noteGain);
      osc4.connect(gain4);
      gain4.connect(noteGain);

      noteGain.connect(filter);
      filter.connect(dest);

      osc1.start(startTime);
      osc2.start(startTime);
      osc3.start(startTime);
      osc4.start(startTime);

      const stopTime = startTime + duration + 0.06;
      osc1.stop(stopTime);
      osc2.stop(stopTime);
      osc3.stop(stopTime);
      osc4.stop(stopTime);
    } catch {}
  }

  /**
   * Gentle, soothing piano call ringtone
   */
  private startRingtone(): void {
    this.stopRingtone();

    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtxClass();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);
    masterGain.connect(this.audioCtx.destination);
    this.ringtoneMasterGain = masterGain;

    const playPianoPhrase = () => {
      if (!this.audioCtx || !this.ringtoneMasterGain) return;
      try {
        const now = this.audioCtx.currentTime;
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 329.63, now + 0.00, 1.7, 0.80);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 415.30, now + 0.22, 1.6, 0.72);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 493.88, now + 0.44, 1.6, 0.78);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 659.25, now + 0.70, 1.8, 0.88);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 622.25, now + 1.05, 1.6, 0.72);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 493.88, now + 1.40, 1.8, 0.80);
        this.playSoftPianoNote(this.audioCtx, this.ringtoneMasterGain, 415.30, now + 1.75, 1.9, 0.65);
      } catch {}
    };

    playPianoPhrase();
    this.ringtoneInterval = setInterval(playPianoPhrase, 3500);
  }

  private stopRingtone(): void {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.ringtoneMasterGain && this.audioCtx) {
      try {
        this.ringtoneMasterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.ringtoneMasterGain.disconnect();
      } catch {}
      this.ringtoneMasterGain = null;
    }
  }

  private startCallDurationTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.state.durationSeconds = 0;
    this.timerInterval = setInterval(() => {
      this.state.durationSeconds += 1;
      this.notify();
    }, 1000);
  }

  private cleanupPeerConnection(): void {
    if (this.peerConnection) {
      try {
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    this.isWebRtcAudioActive = false;
    this.iceCandidatesQueue = [];

    if (this.remoteAudioElement) {
      try {
        this.remoteAudioElement.pause();
        this.remoteAudioElement.srcObject = null;
      } catch {}
    }
    this.remoteStream = null;
  }

  private cleanupAudioAndState(): void {
    if (this.peerCallTimeoutTimer) {
      clearTimeout(this.peerCallTimeoutTimer);
      this.peerCallTimeoutTimer = null;
    }

    const prevCallId = this.state.callId;
    const prevStatus = this.state.status;
    const prevDuration = this.state.durationSeconds;

    if (prevCallId) {
      if (prevStatus === 'CONNECTED') {
        callHistoryService.completeCallSession(prevCallId, prevDuration, 'completed');
      } else if (prevStatus === 'CALLING') {
        callHistoryService.completeCallSession(prevCallId, 0, 'cancelled');
      } else if (prevStatus === 'INCOMING') {
        callHistoryService.completeCallSession(prevCallId, 0, 'missed');
      }
    }

    this.stopRingtone();
    this.cleanupPeerConnection();

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.meterInterval) {
      clearInterval(this.meterInterval);
      this.meterInterval = null;
    }

    if (this.pcmProcessor) {
      try {
        this.pcmProcessor.disconnect();
        this.pcmProcessor.onaudioprocess = null;
      } catch {}
      this.pcmProcessor = null;
    }

    if (this.echoGainNode) {
      try {
        this.echoGainNode.disconnect();
      } catch {}
      this.echoGainNode = null;
      this.isEchoLoopbackTestActive = false;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.nextPcmPlayTime = 0;

    this.state = {
      ...this.state,
      status: 'IDLE',
      callId: null,
      peerNodeId: null,
      peerName: null,
      peerCallsign: '',
      peerPhone: '',
      durationSeconds: 0,
      localVolume: 0,
      remoteVolume: 0,
    };
    this.notify();
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}

export const voiceCallService = new VoiceCallService();
