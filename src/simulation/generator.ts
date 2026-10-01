import type { DayType, Measurement, RoadSegment, TrafficObservation } from "@/domain/types";
import { PEAK_WINDOWS } from "@/engine/series";
import { validateObservation } from "@/quality/rules";

/**
 * SIMULAÇÃO — observações sintéticas de 15 min para testar o motor. NÃO é dado real.
 *
 * Vem das fontes:
 *  - janelas de pico por tipo de dia (DOC-PARAMETROS §2.A);
 *  - faixa de fluxo de pico do segmento (DOC-PARAMETROS §1);
 *  - madrugada baixa (§2.B).
 * Todo o resto (formato, ruído, multiplicadores dos cenários, velocidades, filas) é ARBITRÁRIO.
 */

export const SIMULATION_PARAMS = {
  intervalMinutes: 15,
  offPeakShare: 0.6,
  overnightShare: 0.03,
  noise: 0.08,
  syntheticFreeSpeedKmh: 60,
  syntheticSpeedDrop: 0.55,
} as const;

export type ScenarioId = "fluxo-baixo" | "fluxo-moderado" | "fluxo-alto" | "velocidade-alta" | "velocidade-baixa" | "fila-crescente" | "fila-estavel";

export const SCENARIOS: Record<ScenarioId, { label: string; flowFactor: number; speedFactor: number; queue: "nenhuma" | "crescente" | "estavel"; note: string }> = {
  "fluxo-baixo": { label: "Fluxo baixo", flowFactor: 0.4, speedFactor: 1, queue: "nenhuma", note: "pico = 40% do sorteado na faixa da fonte" },
  "fluxo-moderado": { label: "Fluxo moderado", flowFactor: 0.75, speedFactor: 1, queue: "nenhuma", note: "pico = 75%" },
  "fluxo-alto": { label: "Fluxo alto", flowFactor: 1, speedFactor: 1, queue: "nenhuma", note: "pico dentro da faixa da fonte" },
  "velocidade-alta": { label: "Velocidade alta", flowFactor: 0.75, speedFactor: 1.25, queue: "nenhuma", note: "velocidades ×1,25" },
  "velocidade-baixa": { label: "Velocidade baixa", flowFactor: 1, speedFactor: 0.45, queue: "nenhuma", note: "velocidades ×0,45" },
  "fila-crescente": { label: "Fila crescente", flowFactor: 1, speedFactor: 0.6, queue: "crescente", note: "fila cresce 15 m a cada intervalo nas janelas de pico do segmento" },
  "fila-estavel": { label: "Fila estável", flowFactor: 1, speedFactor: 0.75, queue: "estavel", note: "fila constante de 120 m nas janelas de pico" },
};

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

/** Perfil relativo (0..1) por hora a partir das janelas da §2.A do tipo de dia. */
export function hourlyShape(dayType: Exclude<DayType, "DESCONHECIDO" | "FERIADO">, segmentPeaks: Measurement[]): number[] {
  const p = SIMULATION_PARAMS;
  const shape = Array.from({ length: 24 }, (_, h) => (h >= 1 && h < 5 ? p.overnightShare : h === 0 || h === 5 ? p.overnightShare * 2 : h >= 22 ? p.offPeakShare * 0.5 : p.offPeakShare));
  if (dayType === "DIA_UTIL" && segmentPeaks.length) {
    // Dias úteis: janelas do próprio segmento (matriz), relativas ao maior pico.
    const maxPeak = Math.max(...segmentPeaks.map((x) => x.value!.max));
    for (const m of segmentPeaks)
      for (const w of m.windows) for (let h = Number(w.start.slice(0, 2)); h < Number(w.end.slice(0, 2)); h++) shape[h] = Math.max(shape[h], m.value!.max / maxPeak);
  } else {
    for (const w of PEAK_WINDOWS[dayType]) for (let h = w.startHour; h < w.endHour; h++) shape[h] = 1;
  }
  return shape;
}

export interface SimulationInput {
  segment: RoadSegment;
  measurements: Measurement[];
  seed: number;
  scenario: ScenarioId;
  dayType: Exclude<DayType, "DESCONHECIDO" | "FERIADO">;
}

export function simulateDay({ segment, measurements, seed, scenario, dayType }: SimulationInput) {
  const rand = mulberry32(seed);
  const p = SIMULATION_PARAMS;
  const sc = SCENARIOS[scenario];
  const peaks = measurements.filter((m) => m.segmentId === segment.id && m.metric.startsWith("PICO") && m.value);
  if (!peaks.length) throw new Error(`Segmento sem pico na fonte: ${segment.id}`);
  const range = peaks.reduce((a, b) => (b.value!.max > a.value!.max ? b : a)).value!;
  let peakFlow = range.min + rand() * (range.max - range.min);
  // Fins de semana: §2.B indica queda de 25–50% do VDM; aplicada aqui ao pico (hipótese do simulador).
  const weekendFactor = dayType === "DIA_UTIL" ? 1 : 1 - (0.25 + rand() * 0.25);
  peakFlow *= weekendFactor * sc.flowFactor;
  const shape = hourlyShape(dayType, peaks);
  const peakHours = new Set<number>();
  if (dayType === "DIA_UTIL") for (const m of peaks) for (const w of m.windows) for (let h = Number(w.start.slice(0, 2)); h < Number(w.end.slice(0, 2)); h++) peakHours.add(h);
  else for (const w of PEAK_WINDOWS[dayType]) for (let h = w.startHour; h < w.endHour; h++) peakHours.add(h);
  const per = 60 / p.intervalMinutes;
  const seriesId = `sim-${segment.id}-${scenario}-${dayType}-${seed}`;
  const obs: TrafficObservation[] = [];
  let queue = 0;
  for (let h = 0; h < 24; h++) {
    for (let k = 0; k < per; k++) {
      const noise = 1 + (rand() * 2 - 1) * p.noise;
      const count = Math.max(0, Math.round((peakFlow * shape[h] * noise) / per));
      const speed = p.syntheticFreeSpeedKmh * sc.speedFactor * (1 - p.syntheticSpeedDrop * shape[h] ** 2) * (1 + (rand() * 2 - 1) * 0.04);
      const inPeak = peakHours.has(h);
      if (sc.queue === "crescente") queue = inPeak ? queue + 15 : Math.max(0, queue - 30);
      if (sc.queue === "estavel") queue = inPeak ? 120 : 0;
      const o: TrafficObservation = {
        id: `${seriesId}-${h}-${k}`, segmentId: segment.id, source: "SIMULACAO", seriesId, date: null, month: null, weekday: null, dayType,
        startTime: `${String(h).padStart(2, "0")}:${String(k * p.intervalMinutes).padStart(2, "0")}`, durationMinutes: p.intervalMinutes,
        vehicleCount: count, averageSpeedKmh: Math.round(speed * 10) / 10, p85SpeedKmh: null,
        queueLengthM: sc.queue === "nenhuma" ? null : queue, quality: "VALIDO", sourceRef: null, raw: null,
      };
      o.quality = validateObservation(o);
      obs.push(o);
    }
  }
  return { seriesId, peakFlowTarget: peakFlow, weekendFactor, observations: obs };
}
