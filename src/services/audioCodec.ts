import { Codec2Mode, AudioVoiceBurst } from '../types/mesh';

export interface Codec2Frame {
  voiced: boolean;
  pitchHz: number; // Fundamental frequency F0 (approx 80-350 Hz)
  energy: number; // 0.0 - 1.0 (quantized)
  formant1Hz: number; // Vocal tract resonance F1 (300 - 900 Hz)
  formant2Hz: number; // Vocal tract resonance F2 (800 - 2500 Hz)
}

export interface CompressionComparison {
  rawPcmBytes: number;
  opusBytes: number;
  codec2_1200Bytes: number;
  codec2_700Bytes: number;
  ttsPayloadBytes: number;
}

export function calculateCompressionStats(durationSec: number, textLength: number = 20): CompressionComparison {
  const d = Math.max(0.5, durationSec);
  return {
    rawPcmBytes: Math.round(d * 8000 * 2), // 8kHz 16-bit mono = 16,000 bytes/sec
    opusBytes: Math.round(d * (16000 / 8)), // Opus @ 16kbps = 2000 bytes/sec
    codec2_1200Bytes: Math.round(d * 150), // Codec2 1200bps = 150 bytes/sec
    codec2_700Bytes: Math.round(d * 87.5), // Codec2 700bps = 87.5 bytes/sec
    ttsPayloadBytes: Math.max(8, textLength), // TTS tokenized text ~ 20-40 bytes
  };
}

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Request microphone and start recording
   */
  async startRecording(onWaveformData?: (data: Uint8Array) => void): Promise<boolean> {
    try {
      this.recordedChunks = [];
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(this.mediaStream);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      if (onWaveformData) {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const updateWaveform = () => {
          if (this.analyser && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.analyser.getByteTimeDomainData(dataArray);
            onWaveformData(dataArray);
            this.animationFrameId = requestAnimationFrame(updateWaveform);
          }
        };
        this.animationFrameId = requestAnimationFrame(updateWaveform);
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // 100ms slice
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return false;
    }
  }

  /**
   * Stop recording and process into compressed voice burst
   */
  async stopRecording(codecMode: Codec2Mode = '1200bps'): Promise<AudioVoiceBurst | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.cleanupStream();

        const ctx = this.getAudioContext();
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        let audioBuffer: AudioBuffer | null = null;
        try {
          audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        } catch {
          // If decoding webm fails, create a fallback dummy buffer
          audioBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        }

        const duration = audioBuffer.duration;
        const rawPcmBytes = Math.round(duration * 8000 * 2);
        
        // Compute compressed byte size based on selected Codec2 bitrate
        const bytesPerSecMap: Record<Codec2Mode, number> = {
          '700bps': 87.5,
          '1200bps': 150,
          '2400bps': 300,
          '3200bps': 400,
        };
        const compressedSize = Math.max(30, Math.round(duration * bytesPerSecMap[codecMode]));

        // Generate downsampled waveform preview points for UI
        const channelData = audioBuffer.getChannelData(0);
        const sampleCount = 40;
        const blockSize = Math.floor(channelData.length / sampleCount);
        const waveformSamples: number[] = [];
        for (let i = 0; i < sampleCount; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j] || 0);
          }
          waveformSamples.push(Math.min(1, (sum / blockSize) * 3));
        }

        // Pack simulated Codec2 bitstream frames
        const bitstreamBase64 = this.generateBitstream(duration, codecMode, waveformSamples);

        const reader = new FileReader();
        reader.onloadend = () => {
          const audioBlobUrl = (reader.result as string) || URL.createObjectURL(audioBlob);

          const burst: AudioVoiceBurst = {
            id: 'vb_' + Math.random().toString(36).substring(2, 9),
            durationSeconds: parseFloat(duration.toFixed(1)),
            sampleRate: 8000,
            rawByteSize: rawPcmBytes,
            compressedByteSize: compressedSize,
            codecMode,
            audioBlobUrl,
            bitstreamBase64,
            waveformSamples,
            createdAt: Date.now(),
          };

          resolve(burst);
        };
        reader.readAsDataURL(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanupStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * Generates a compact mock binary bitstream representing quantized Codec2 frames
   */
  private generateBitstream(durationSec: number, mode: Codec2Mode, samples: number[]): string {
    const frameCount = Math.max(1, Math.round(durationSec * 50)); // 20ms frames
    const bytesPerFrame = mode === '700bps' ? 2 : mode === '1200bps' ? 3 : 6;
    const totalBytes = frameCount * bytesPerFrame;
    const buffer = new Uint8Array(totalBytes);

    for (let i = 0; i < frameCount; i++) {
      const sampleIdx = Math.floor((i / frameCount) * samples.length);
      const amp = Math.floor((samples[sampleIdx] || 0.1) * 255);
      const pitchQuant = 60 + (i % 30); // ~100-150Hz quantized pitch

      buffer[i * bytesPerFrame] = pitchQuant; // Pitch F0
      buffer[i * bytesPerFrame + 1] = amp; // Energy
      if (bytesPerFrame > 2) {
        buffer[i * bytesPerFrame + 2] = (i * 7) % 256; // Formant LPC
      }
    }

    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  /**
   * Plays radio squelch static sound burst ("ksshhk")
   */
  playRadioSquelch(type: 'intro' | 'outro' = 'intro'): void {
    try {
      const ctx = this.getAudioContext();
      const duration = type === 'intro' ? 0.08 : 0.12;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate bandpass filtered noise for radio squelch
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.7));
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 1.8;

      const gain = ctx.createGain();
      gain.gain.value = 0.15;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();
    } catch (e) {
      console.warn('Audio squelch error:', e);
    }
  }

  /**
   * Play audio voice burst with tactical digital vocoder filter effect
   */
  async playVoiceBurst(burst: AudioVoiceBurst, simulatedVocoder: boolean = true): Promise<void> {
    this.playRadioSquelch('intro');

    if (!simulatedVocoder && burst.audioBlobUrl) {
      const audio = new Audio(burst.audioBlobUrl);
      audio.onended = () => this.playRadioSquelch('outro');
      await audio.play();
      return;
    }

    // Play with digital military radio vocoder synthesis (LPC / formant distortion + bandpass)
    const ctx = this.getAudioContext();
    let audioBuffer: AudioBuffer | null = null;

    if (burst.audioBlobUrl) {
      try {
        const resp = await fetch(burst.audioBlobUrl);
        const arrayBuf = await resp.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuf);
      } catch {
        audioBuffer = null;
      }
    }

    if (!audioBuffer) {
      // Synthesize synthetic Codec2 voice waveform from bitstream
      audioBuffer = this.synthesizeFromBitstream(ctx, burst);
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Narrowband speech bandpass (300Hz - 3100Hz like real military VHF/LoRa)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 320;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2800;

    // Subtle bit-crush / digital quantization effect for ultra-low bitrate realism
    const waveshaper = ctx.createWaveShaper();
    waveshaper.curve = this.makeDistortionCurve(18) as any;

    const gain = ctx.createGain();
    gain.gain.value = 0.8;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(waveshaper);
    waveshaper.connect(gain);
    gain.connect(ctx.destination);

    source.onended = () => {
      this.playRadioSquelch('outro');
    };

    source.start();
  }

  private synthesizeFromBitstream(ctx: AudioContext, burst: AudioVoiceBurst): AudioBuffer {
    const duration = burst.durationSeconds || 2.5;
    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    const samples = burst.waveformSamples.length > 0 ? burst.waveformSamples : [0.3, 0.6, 0.8, 0.5, 0.4, 0.2];
    
    // Robotic harmonic excitation synthesis modeling human vocal cords at ~130Hz
    const f0 = 135; // Base pitch
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const sampleIdx = Math.floor(progress * samples.length);
      const env = samples[Math.min(sampleIdx, samples.length - 1)] || 0.3;

      // Harmonic sum (fundamental + 3 formants)
      const harmonic1 = Math.sin(2 * Math.PI * f0 * t);
      const harmonic2 = 0.5 * Math.sin(2 * Math.PI * 2 * f0 * t);
      const harmonic3 = 0.25 * Math.sin(2 * Math.PI * 3 * f0 * t);
      const formantResonance = 0.3 * Math.sin(2 * Math.PI * 750 * t); // F1
      const noise = (Math.random() * 2 - 1) * 0.08;

      data[i] = (harmonic1 + harmonic2 + harmonic3 + formantResonance + noise) * env * 0.4;
    }

    return buffer;
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 10;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Fallback / alternative text-to-speech reading of received message
   */
  speakText(text: string): void {
    if ('speechSynthesis' in window) {
      this.playRadioSquelch('intro');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.85; // Lower pitch for radio operator sound
      utterance.rate = 1.05;
      utterance.onend = () => {
        this.playRadioSquelch('outro');
      };
      window.speechSynthesis.speak(utterance);
    }
  }
}

export const audioEngine = new AudioEngine();
