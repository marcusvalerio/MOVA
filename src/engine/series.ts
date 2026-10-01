import type { ConditionThresholds, DayType, OperationalLevel, TrafficObservation } from "@/domain/types";

/**
 * TRAFFIC ENGINE — cálculos sobre observações em intervalos.
 * Independente da fonte (HISTÓRICO, SIMULAÇÃO, CÂMERA): recebe TrafficObservation.
 * Cada função referencia sua entrada no registro de metodologia (src/methodology/registry.ts).
 */

export interface HourlyFlow {
  hour: number;
  /** veíc/h; null se a hora não tem 60 min de cobertura válida. */
  flow: number | null;
  coverageMinutes: number;
  speed: number | null;
  p85: number | null;
  queue: number | null;
  /** Status de qualidade das observações que compõem a hora. */
  statuses: string[];
}

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2));

/**
 * M-FLUXO-HORARIO: soma das contagens válidas contidas na hora; exige 60 min válidos.
 * M-VELOCIDADE (séries): média ponderada pela contagem.
 * Espera observações de UMA série (um dia).
 */
export function aggregateHourly(obs: TrafficObservation[]): HourlyFlow[] {
  const b = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, cov: 0, sN: 0, sD: 0, p85: [] as number[], queue: null as number | null, st: [] as string[] }));
  for (const o of obs) {
    // Sem hora conhecida, a observação não pode ser alocada numa hora do dia.
    if (o.startTime == null) continue;
    const x = b[hourOf(o.startTime)];
    x.st.push(o.quality);
    if (o.quality !== "VALIDO" || o.vehicleCount == null) continue;
    x.count += o.vehicleCount;
    x.cov += o.durationMinutes;
    if (o.averageSpeedKmh != null && o.vehicleCount > 0) {
      x.sN += o.averageSpeedKmh * o.vehicleCount;
      x.sD += o.vehicleCount;
    }
    if (o.p85SpeedKmh != null) x.p85.push(o.p85SpeedKmh);
    if (o.queueLengthM != null) x.queue = o.queueLengthM;
  }
  return b.map((x) => {
    const full = x.cov >= 60;
    return {
      hour: x.hour,
      coverageMinutes: x.cov,
      flow: full ? x.count : null,
      speed: full && x.sD > 0 ? x.sN / x.sD : null,
      // P85 por intervalo é dado reportado; agregá-lo exigiria as velocidades individuais.
      // Só é exposto quando a hora tem exatamente um valor reportado (intervalo de 60 min).
      p85: full && x.p85.length === 1 ? x.p85[0] : null,
      queue: full ? x.queue : null,
      statuses: x.st,
    };
  });
}

export function coveredHours(h: HourlyFlow[]) {
  return h.filter((x) => x.flow != null).map((x) => x.hour);
}

/** Volume diário: exige 24 h completas. */
export function dailyVolume(hourly: HourlyFlow[]): number | null {
  if (hourly.length !== 24 || hourly.some((h) => h.flow == null)) return null;
  return hourly.reduce((s, h) => s + (h.flow as number), 0);
}

/** Soma parcial das horas disponíveis — sempre exibida como INCOMPLETA. */
export function partialVolume(hourly: HourlyFlow[]): { total: number; hours: number } {
  const v = hourly.filter((h) => h.flow != null);
  return { total: v.reduce((s, h) => s + (h.flow as number), 0), hours: v.length };
}

/** M-VDM (séries): média aritmética de volumes diários completos — inferido do nome do indicador. */
export function meanDailyVolume(volumes: (number | null)[]): number | null {
  const v = volumes.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** M-PICO (séries): hora de maior fluxo, opcionalmente dentro de [startHour, endHour). */
export function peakHour(hourly: HourlyFlow[], window?: { startHour: number; endHour: number }) {
  const c = hourly.filter((h) => h.flow != null && (!window || (h.hour >= window.startHour && h.hour < window.endHour)));
  if (!c.length) return null;
  return c.reduce((a, b) => ((b.flow as number) > (a.flow as number) ? b : a));
}

export function weightedMeanSpeed(hourly: HourlyFlow[]): number | null {
  let n = 0, d = 0;
  for (const h of hourly) if (h.speed != null && h.flow != null) { n += h.speed * h.flow; d += h.flow; }
  return d > 0 ? n / d : null;
}

/** M-MADRUGADA: maior fluxo 01–05h ÷ pico do dia. Exige as 4 horas da madrugada. */
export function overnightRatio(hourly: HourlyFlow[]) {
  const night = hourly.filter((h) => h.hour >= 1 && h.hour < 5);
  if (night.some((h) => h.flow == null)) return null;
  const peak = peakHour(hourly);
  const nMax = peakHour(hourly, { startHour: 1, endHour: 5 });
  if (!peak?.flow || !nMax) return null;
  const ratio = (nMax.flow as number) / peak.flow;
  return { ratio, nightHour: nMax.hour, nightFlow: nMax.flow as number, peakHour: peak.hour, peakFlow: peak.flow, belowRule: ratio < 0.05 };
}

/** M-FLUXO-EQUIVALENTE (INFERIDO do exemplo 127 → 1.524 veíc/h): q = n · 60 / Δt[min]. */
export function equivalentHourlyFlow(count: number, durationMinutes: number): number {
  if (!(durationMinutes > 0)) throw new RangeError("Duração deve ser positiva");
  if (count < 0) throw new RangeError("Contagem não pode ser negativa");
  return (count * 60) / durationMinutes;
}

/** M-SATURACAO: x = q/c (FONTE EXTERNA — PENDENTE). Sem capacidade → null. */
export function saturation(flow: number | null, capacity: number | null): number | null {
  if (flow == null || capacity == null || capacity <= 0) return null;
  return flow / capacity;
}

/** M-CONDICAO: limites configuráveis; sem limites → INDETERMINADO. */
export function classifyCondition(value: number | null, t: ConditionThresholds | null): OperationalLevel | "INDETERMINADO" {
  if (value == null || !t) return "INDETERMINADO";
  if (!(t.atencao < t.critico && t.critico < t.congestionado)) throw new RangeError("Limites devem ser estritamente crescentes: atenção < crítico < congestionado");
  if (value >= t.congestionado) return "CONGESTIONADO";
  if (value >= t.critico) return "CRITICO";
  if (value >= t.atencao) return "ATENCAO";
  return "NORMAL";
}

/** Janelas de pico por tipo de dia — DOC-PARAMETROS §2.A (CONFIRMADO). */
export const PEAK_WINDOWS: Record<Exclude<DayType, "DESCONHECIDO">, { label: string; startHour: number; endHour: number }[]> = {
  DIA_UTIL: [
    { label: "Pico da manhã", startHour: 7, endHour: 9 },
    { label: "Pico da tarde/noite", startHour: 17, endHour: 19 },
  ],
  SABADO: [{ label: "Concentração de sábado", startHour: 11, endHour: 15 }],
  DOMINGO: [{ label: "Pico de domingo", startHour: 16, endHour: 19 }],
};

/** Posição do pico observado em relação às janelas da fonte para o tipo de dia. */
export function peakVsWindows(hourly: HourlyFlow[], dayType: DayType) {
  const peak = peakHour(hourly);
  if (!peak) return null;
  if (dayType === "DESCONHECIDO") return { peak, windows: [], insideWindow: null as boolean | null };
  const windows = PEAK_WINDOWS[dayType];
  return { peak, windows, insideWindow: windows.some((w) => peak.hour >= w.startHour && peak.hour < w.endHour) };
}
