import type { DayType, Series, TrafficObservation } from "@/domain/types";
import { aggregateHourly, type HourlyFlow } from "./series";

/**
 * TRAFFIC ENGINE — agregação de dias observados em estatísticas de período (um mês de relatório).
 * Dia "completo" = 24 horas com contagem VÁLIDA (sem célula vazia nem zero suspeito). Só dias completos
 * entram em totais diários e médias; dias incompletos são contados e expostos, nunca preenchidos.
 */
export interface DaySummary {
  series: Series;
  hourly: HourlyFlow[];
  complete: boolean;
  validHours: number;
  total: number | null;
  peak: { hour: number; flow: number } | null;
}

export function summarizeDay(series: Series, obs: TrafficObservation[]): DaySummary {
  const hourly = aggregateHourly(obs);
  const validHours = hourly.filter((h) => h.flow != null).length;
  const complete = validHours === 24 && obs.every((o) => o.quality === "VALIDO");
  let peak: DaySummary["peak"] = null;
  for (const h of hourly) if (h.flow != null && (!peak || h.flow > peak.flow)) peak = { hour: h.hour, flow: h.flow };
  return { series, hourly, complete, validHours, total: complete ? hourly.reduce((s, h) => s + (h.flow as number), 0) : null, peak };
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export interface Profile {
  hour: number;
  n: number;
  flow: number | null;
  speed: number | null;
}

/** Perfil médio por hora (fluxo: média aritmética; velocidade: média ponderada pelo fluxo — M-VELOCIDADE-MEDIA). */
export function meanProfileOf(days: DaySummary[]): Profile[] {
  return Array.from({ length: 24 }, (_, h) => {
    const hs = days.map((d) => d.hourly[h]).filter((x) => x.flow != null);
    const sp = hs.filter((x) => x.speed != null);
    const w = sp.reduce((s, x) => s + (x.flow as number), 0);
    return {
      hour: h,
      n: hs.length,
      flow: mean(hs.map((x) => x.flow as number)),
      speed: w > 0 ? sp.reduce((s, x) => s + (x.speed as number) * (x.flow as number), 0) / w : null,
    };
  });
}

export interface PeriodStats {
  period: string;
  days: DaySummary[];
  byType: Record<DayType, DaySummary[]>;
  completeWeekdays: DaySummary[];
  completeWeekend: DaySummary[];
  vdm: { mean: number; min: number; max: number; n: number } | null;
  weekend: { mean: number; min: number; max: number; n: number } | null;
  weekendDrop: number | null;
  typicalPeakHour: { hour: number; count: number; n: number } | null;
  maxHour: { flow: number; hour: number; date: string } | null;
  maxSpeed: number | null;
  weekdayProfile: Profile[];
  speedWeekday: number | null;
  v85: { median: number; min: number; max: number; n: number; constant: boolean } | null;
  overnight: { ratio: number; nightHour: number; peakHour: number } | null;
}

const stats = (xs: number[]) => (xs.length ? { mean: mean(xs) as number, min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null);

export function periodStats(period: string, days: DaySummary[]): PeriodStats {
  const byType = { DIA_UTIL: [], SABADO: [], DOMINGO: [], FERIADO: [], DESCONHECIDO: [] } as Record<DayType, DaySummary[]>;
  for (const d of days) byType[d.series.dayType].push(d);
  const completeWeekdays = byType.DIA_UTIL.filter((d) => d.complete);
  const completeWeekend = [...byType.SABADO, ...byType.DOMINGO].filter((d) => d.complete);
  const vdm = stats(completeWeekdays.map((d) => d.total as number));
  const weekend = stats(completeWeekend.map((d) => d.total as number));
  const peaks = new Map<number, number>();
  for (const d of completeWeekdays) if (d.peak) peaks.set(d.peak.hour, (peaks.get(d.peak.hour) ?? 0) + 1);
  const top = [...peaks.entries()].sort((a, b) => b[1] - a[1])[0];
  let maxHour: PeriodStats["maxHour"] = null;
  let maxSpeed: number | null = null;
  for (const d of days)
    for (const h of d.hourly) {
      if (h.flow != null && (!maxHour || h.flow > maxHour.flow)) maxHour = { flow: h.flow, hour: h.hour, date: d.series.date as string };
      if (h.speed != null && (maxSpeed == null || h.speed > maxSpeed)) maxSpeed = h.speed;
    }
  const weekdayProfile = meanProfileOf(completeWeekdays);
  const speedPts = weekdayProfile.filter((p) => p.speed != null && p.flow != null);
  const w = speedPts.reduce((s, p) => s + (p.flow as number), 0);
  const v85s = days.map((d) => d.series.reportedV85).filter((v): v is number => v != null && v > 0);
  const pf = weekdayProfile.filter((p) => p.flow != null);
  let overnight: PeriodStats["overnight"] = null;
  if (pf.length === 24) {
    const peak = pf.reduce((a, b) => ((b.flow as number) > (a.flow as number) ? b : a));
    const night = pf.filter((p) => p.hour >= 1 && p.hour < 5).reduce((a, b) => ((b.flow as number) > (a.flow as number) ? b : a));
    overnight = { ratio: (night.flow as number) / (peak.flow as number), nightHour: night.hour, peakHour: peak.hour };
  }
  return {
    period, days, byType, completeWeekdays, completeWeekend, vdm, weekend,
    weekendDrop: vdm && weekend ? 1 - weekend.mean / vdm.mean : null,
    typicalPeakHour: top ? { hour: top[0], count: top[1], n: completeWeekdays.length } : null,
    maxHour, maxSpeed, weekdayProfile,
    speedWeekday: w > 0 ? speedPts.reduce((s, p) => s + (p.speed as number) * (p.flow as number), 0) / w : null,
    v85: v85s.length ? { median: median(v85s) as number, min: Math.min(...v85s), max: Math.max(...v85s), n: v85s.length, constant: new Set(v85s).size === 1 } : null,
    overnight,
  };
}
