import { LoRaPhyConfig, SpreadingFactor, LoRaBandwidth, CodingRate } from '../types/mesh';

export interface AirtimeResult {
  symbolTimeMs: number;
  preambleDurationMs: number;
  payloadSymbols: number;
  payloadDurationMs: number;
  totalAirtimeMs: number;
  nominalBitrateBps: number;
  effectiveBitrateBps: number;
  lowDataRateOpt: boolean;
  sensitivityDbm: number;
  linkBudgetDb: number;
  estimatedRangeKm: number;
}

export const DEFAULT_LORA_CONFIG: LoRaPhyConfig = {
  frequency: '868MHz',
  spreadingFactor: 9,
  bandwidth: 125,
  codingRate: '4/7',
  txPowerDbm: 20,
  preambleLength: 8,
  syncWord: '0x34',
  crcEnabled: true,
};

/**
 * Calculates theoretical Semtech SX1262 LoRa Airtime based on Semtech AN1200.13
 */
export function calculateAirtime(payloadBytes: number, config: LoRaPhyConfig): AirtimeResult {
  const sf = config.spreadingFactor;
  const bwHz = config.bandwidth * 1000;

  // Symbol Duration in seconds: Tsym = 2^SF / BW
  const symbolTimeSec = Math.pow(2, sf) / bwHz;
  const symbolTimeMs = symbolTimeSec * 1000;

  // Low Data Rate Optimization is mandated when symbol time > 16.38ms (typically SF11 & SF12 @ 125kHz)
  const lowDataRateOpt = symbolTimeMs > 16.0;
  const de = lowDataRateOpt ? 1 : 0;

  // CR multiplier: 4/5 -> 1, 4/6 -> 2, 4/7 -> 3, 4/8 -> 4
  const crMap: Record<CodingRate, number> = {
    '4/5': 1,
    '4/6': 2,
    '4/7': 3,
    '4/8': 4,
  };
  const crVal = crMap[config.codingRate];

  // Preamble Duration
  const preambleSymbols = config.preambleLength + 4.25;
  const preambleDurationMs = preambleSymbols * symbolTimeMs;

  // Payload symbols calculation
  const pl = Math.max(1, payloadBytes);
  const crc = config.crcEnabled ? 1 : 0;
  const ih = 0; // Explicit header mode (standard in LoRa Mesh)

  const numerator = 8 * pl - 4 * sf + 28 + 16 * crc - 20 * ih;
  const denominator = 4 * (sf - 2 * de);
  const ceilTerm = Math.ceil(numerator / denominator);
  const payloadSymbols = 8 + Math.max(ceilTerm * (crVal + 4), 0);

  const payloadDurationMs = payloadSymbols * symbolTimeMs;
  const totalAirtimeMs = preambleDurationMs + payloadDurationMs;

  // Nominal raw bitrate: Rb = SF * (BW / 2^SF) * (4 / (4 + CR))
  const nominalBitrateBps = (sf * (bwHz / Math.pow(2, sf)) * (4 / (4 + crVal)));
  const effectiveBitrateBps = (payloadBytes * 8) / (totalAirtimeMs / 1000);

  // Semtech SX1262 sensitivity approximation
  // Base sensitivity ~ -137 dBm at SF12/125k to -117 dBm at SF7/500k
  const baseSensTable: Record<SpreadingFactor, number> = {
    7: -123,
    8: -126,
    9: -129,
    10: -132,
    11: -134.5,
    12: -137,
  };
  // Adjust for bandwidth: -10 * log10(BW / 125kHz)
  const bwFactor = 10 * Math.log10(config.bandwidth / 125);
  const sensitivityDbm = baseSensTable[sf] + bwFactor;

  // Link budget = TxPower + TxAntennaGain - Sensitivity
  const linkBudgetDb = config.txPowerDbm + 2.15 - sensitivityDbm;

  // Rough line of sight estimation with Free Space Path Loss at 868MHz
  // FSPL (dB) = 20log10(d_km) + 20log10(f_MHz) + 32.44
  const freqMHz = config.frequency === '433MHz' ? 433 : config.frequency === '915MHz' ? 915 : 868;
  const maxLoss = linkBudgetDb - 10; // 10dB fade margin
  const logDist = (maxLoss - 32.44 - 20 * Math.log10(freqMHz)) / 20;
  const estimatedRangeKm = Math.min(45, Math.max(0.5, Math.pow(10, logDist)));

  return {
    symbolTimeMs,
    preambleDurationMs,
    payloadSymbols,
    payloadDurationMs,
    totalAirtimeMs,
    nominalBitrateBps,
    effectiveBitrateBps,
    lowDataRateOpt,
    sensitivityDbm,
    linkBudgetDb,
    estimatedRangeKm: parseFloat(estimatedRangeKm.toFixed(1)),
  };
}

/**
 * Track EU 868MHz 1% hourly duty cycle (36,000 ms allowed per 1-hour window)
 */
export class DutyCycleMonitor {
  private airtimes: { timestamp: number; durationMs: number }[] = [];
  private readonly maxAirtimeMsPerHour = 36000; // 1% of 3600 seconds

  recordTransmission(airtimeMs: number): void {
    const now = Date.now();
    this.airtimes.push({ timestamp: now, durationMs: airtimeMs });
    this.cleanOldRecords();
  }

  private cleanOldRecords(): void {
    const oneHourAgo = Date.now() - 3600 * 1000;
    this.airtimes = this.airtimes.filter((entry) => entry.timestamp >= oneHourAgo);
  }

  getUsedAirtimeMs(): number {
    this.cleanOldRecords();
    return this.airtimes.reduce((acc, curr) => acc + curr.durationMs, 0);
  }

  getUsagePercent(): number {
    return (this.getUsedAirtimeMs() / this.maxAirtimeMsPerHour) * 100;
  }

  canTransmit(packetAirtimeMs: number): boolean {
    return this.getUsedAirtimeMs() + packetAirtimeMs <= this.maxAirtimeMsPerHour;
  }
}
