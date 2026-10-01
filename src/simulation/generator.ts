import type { Approach, Measurement, TrafficObservation } from "@/domain/types";
import { validateObservation } from "@/quality/rules";

/**
 * SIMULAÇÃO — gera observações sintéticas de 15 min para testar o motor.
 *
 * NÃO é dado real. Fontes de cada escolha:
 *  - janelas de pico e faixa de fluxo de pico: matriz da fonte (Seção 1), por aproximação;
 *  - madrugada baixa e crescimento abrupto a partir das 06:00: regra descritiva da Seção 2.B;
 *  - todos os demais parâmetros (formato da curva, nível do entrepico, ruído, velocidades)
 *    são ARBITRÁRIOS e servem apenas para exercitar o sistema.
 */

export const SIMULATION_PARAMS = {
  intervalMinutes: 15,
  /** Fração do pico no entrepico (arbitrário). */
  offPeakShare: 0.6,
  /** Fração do pico na madrugada (arbitrário, escolhido < 5% para respeitar a Seção 2.B). */
  overnightShare: 0.03,
  /** Ruído multiplicativo ± (arbitrário). */
  noise: 0.08,
  /** Velocidade de fluxo livre sintética, km/h (arbitrário — sem base documental). */
  syntheticFreeSpeedKmh: 60,
  /** Redução máxima sintética de velocidade no pico (arbitrário). */
  syntheticSpeedDrop: 0.55,
} as const;

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2));

/** Perfil relativo (0..1) por hora, derivado das janelas de pico da aproximação. */
export function hourlyShape(peaks: Measurement[]): number[] {
  const p = SIMULATION_PARAMS;
  const shape = Array.from({ length: 24 }, (_, h) => {
    if (h >= 1 && h < 5) return p.overnightShare;
    if (h === 0 || h === 5) return p.overnightShare * 2;
    if (h >= 22) return p.offPeakShare * 0.5;
    return p.offPeakShare;
  });
  for (const m of peaks) {
    if (!m.value) continue;
    const maxPeak = Math.max(...peaks.map((x) => x.value?.max ?? 0));
    const rel = m.value.max / maxPeak;
    for (const w of m.windows) {
      for (let h = hourOf(w.start); h < hourOf(w.end); h++) shape[h] = Math.max(shape[h], rel);
    }
  }
  return shape;
}

export interface SimulationResult {
  approachId: string;
  seed: number;
  date: string;
  targetPeakFlow: number;
  observations: TrafficObservation[];
}

export function simulateDay(approach: Approach, measurements: Measurement[], seed: number, date = "2026-01-05"): SimulationResult {
  const rand = mulberry32(seed);
  const p = SIMULATION_PARAMS;
  const peaks = measurements.filter((m) => m.approachId === approach.id && m.metric.startsWith("PICO") && m.value);
  if (!peaks.length) throw new Error(`Aproximação sem pico na fonte: ${approach.id}`);
  const peakRange = peaks.reduce((a, b) => ((b.value!.max > a.value!.max) ? b : a)).value!;
  const targetPeakFlow = peakRange.min + rand() * (peakRange.max - peakRange.min);
  const shape = hourlyShape(peaks);
  const perInterval = 60 / p.intervalMinutes;

  const observations: TrafficObservation[] = [];
  for (let h = 0; h < 24; h++) {
    for (let k = 0; k < perInterval; k++) {
      const start = new Date(`${date}T00:00:00Z`);
      start.setUTCMinutes(h * 60 + k * p.intervalMinutes);
      const end = new Date(start.getTime() + p.intervalMinutes * 60000);
      const noise = 1 + (rand() * 2 - 1) * p.noise;
      const count = Math.max(0, Math.round((targetPeakFlow * shape[h] * noise) / perInterval));
      const speed = p.syntheticFreeSpeedKmh * (1 - p.syntheticSpeedDrop * shape[h] ** 2) * (1 + (rand() * 2 - 1) * 0.04);
      const o: TrafficObservation = {
        id: `sim-${seed}-${approach.id}-${h}-${k}`,
        approachId: approach.id,
        source: "SIMULACAO",
        intervalStart: start.toISOString(),
        intervalEnd: end.toISOString(),
        vehicleCount: count,
        averageSpeedKmh: Math.round(speed * 10) / 10,
        quality: "VALIDO",
      };
      o.quality = validateObservation(o);
      observations.push(o);
    }
  }
  return { approachId: approach.id, seed, date, targetPeakFlow, observations };
}
