import type { DayType } from "@/domain/types";
import { aggregateHourly, dailyVolume, overnightRatio, peakHour, peakVsWindows, weightedMeanSpeed } from "@/engine/series";
import type { TrafficRepository } from "@/repository";
import { SCENARIOS, simulateDay, type ScenarioId } from "./generator";

/** Executa a simulação e passa as observações pelo MESMO motor usado por histórico e câmera. */
export function runSimulation(r: TrafficRepository, segmentId: string, seed: number, scenario: ScenarioId = "fluxo-alto", dayType: Exclude<DayType, "DESCONHECIDO" | "FERIADO"> = "DIA_UTIL") {
  const segment = r.segment(segmentId);
  if (!segment || !SCENARIOS[scenario]) return null;
  const sim = simulateDay({ segment, measurements: r.measurements(segmentId), seed, scenario, dayType });
  const hourly = aggregateHourly(sim.observations);
  return {
    segment, seed, scenario, dayType,
    peakFlowTarget: sim.peakFlowTarget,
    weekendFactor: sim.weekendFactor,
    observationCount: sim.observations.length,
    hourly,
    daily: dailyVolume(hourly),
    peak: peakHour(hourly),
    peakWindows: peakVsWindows(hourly, dayType),
    meanSpeed: weightedMeanSpeed(hourly),
    overnight: overnightRatio(hourly),
  };
}
