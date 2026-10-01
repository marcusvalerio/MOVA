import { aggregateHourly, dailyVolume, overnightRatio, peakHour, weightedMeanSpeed } from "@/engine/series";
import type { TrafficRepository } from "@/repository";
import { simulateDay } from "./generator";

/** Executa a simulação e passa as observações pelo MESMO motor usado por câmera/histórico. */
export function runSimulation(r: TrafficRepository, approachId: string, seed: number) {
  const a = r.approach(approachId);
  if (!a) return null;
  const ms = r.measurements(approachId);
  const sim = simulateDay(a, ms, seed);
  const hourly = aggregateHourly(sim.observations);
  const vdm = ms.find((m) => m.metric === "VDM_DIAS_UTEIS")?.value ?? null;
  const daily = dailyVolume(hourly);
  return {
    approach: a,
    seed,
    date: sim.date,
    targetPeakFlow: sim.targetPeakFlow,
    observationCount: sim.observations.length,
    hourly,
    daily,
    peak: peakHour(hourly),
    meanSpeed: weightedMeanSpeed(hourly),
    overnight: overnightRatio(hourly),
    /** Comparação com a faixa da fonte — verificação da própria simulação. */
    dailyWithinSourceVdm: vdm && daily != null ? daily >= vdm.min && daily <= vdm.max : null,
    sourceVdm: vdm,
  };
}
