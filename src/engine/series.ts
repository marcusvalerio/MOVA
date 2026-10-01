import type { ConditionThresholds, OperationalLevel, TrafficObservation } from "@/domain/types";

/**
 * TRAFFIC ENGINE — cálculos sobre séries de observações em intervalos.
 * Independente da fonte (HISTÓRICO, SIMULAÇÃO ou CÂMERA): recebe TrafficObservation.
 * Cada função referencia sua entrada no registro de metodologia.
 */

export interface HourlyFlow {
  hour: number; // 0..23 (hora local da observação)
  flow: number | null; // veíc/h; null se incompleta
  coverageMinutes: number;
  speed: number | null;
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60000;

/** M-FLUXO-HORARIO + M-VELOCIDADE (ponderada por contagem). */
export function aggregateHourly(obs: TrafficObservation[]): HourlyFlow[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, cov: 0, speedNum: 0, speedDen: 0 }));
  for (const o of obs) {
    if (o.quality !== "VALIDO" || o.vehicleCount == null) continue;
    const h = new Date(o.intervalStart).getUTCHours();
    const b = buckets[h];
    b.count += o.vehicleCount;
    b.cov += minutesBetween(o.intervalStart, o.intervalEnd);
    if (o.averageSpeedKmh != null && o.vehicleCount > 0) {
      b.speedNum += o.averageSpeedKmh * o.vehicleCount;
      b.speedDen += o.vehicleCount;
    }
  }
  return buckets.map((b) => ({
    hour: b.hour,
    coverageMinutes: b.cov,
    flow: b.cov >= 60 ? b.count : null,
    speed: b.cov >= 60 && b.speedDen > 0 ? b.speedNum / b.speedDen : null,
  }));
}

/** Volume diário: somente com as 24 horas completas (M-VDM, base para média). */
export function dailyVolume(hourly: HourlyFlow[]): number | null {
  if (hourly.length !== 24 || hourly.some((h) => h.flow == null)) return null;
  return hourly.reduce((s, h) => s + (h.flow as number), 0);
}

/** M-VDM (séries): média aritmética de volumes diários completos — PENDENTE. */
export function meanDailyVolume(volumes: (number | null)[]): number | null {
  const v = volumes.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** M-PICO (séries): hora de maior fluxo, opcionalmente restrita a janela [startHour, endHour). */
export function peakHour(hourly: HourlyFlow[], window?: { startHour: number; endHour: number }) {
  const cand = hourly.filter((h) => h.flow != null && (!window || (h.hour >= window.startHour && h.hour < window.endHour)));
  if (!cand.length) return null;
  return cand.reduce((a, b) => ((b.flow as number) > (a.flow as number) ? b : a));
}

/** M-VELOCIDADE: média ponderada pela contagem. */
export function weightedMeanSpeed(hourly: HourlyFlow[]): number | null {
  let num = 0;
  let den = 0;
  for (const h of hourly) {
    if (h.speed != null && h.flow != null) {
      num += h.speed * h.flow;
      den += h.flow;
    }
  }
  return den > 0 ? num / den : null;
}

/** M-MADRUGADA: razão entre maior fluxo 01–05h e o pico do dia. */
export function overnightRatio(hourly: HourlyFlow[]) {
  const peak = peakHour(hourly);
  const night = peakHour(hourly, { startHour: 1, endHour: 5 });
  if (!peak || !night || !peak.flow) return null;
  const ratio = (night.flow as number) / peak.flow;
  return { ratio, nightFlow: night.flow as number, peakFlow: peak.flow, belowRule: ratio < 0.05 };
}

/** M-SATURACAO: x = q/c (FONTE EXTERNA — PENDENTE). Retorna null sem capacidade. */
export function saturation(flow: number | null, capacity: number | null): number | null {
  if (flow == null || capacity == null || capacity <= 0) return null;
  return flow / capacity;
}

/** M-CONDICAO: classificação por limites configuráveis. Sem limites → INDETERMINADO. */
export function classifyCondition(
  value: number | null,
  t: ConditionThresholds | null,
): OperationalLevel | "INDETERMINADO" {
  if (value == null || !t) return "INDETERMINADO";
  if (!(t.atencao < t.critico && t.critico < t.congestionado)) {
    throw new RangeError("Limites devem ser estritamente crescentes: atenção < crítico < congestionado");
  }
  if (value >= t.congestionado) return "CONGESTIONADO";
  if (value >= t.critico) return "CRITICO";
  if (value >= t.atencao) return "ATENCAO";
  return "NORMAL";
}
