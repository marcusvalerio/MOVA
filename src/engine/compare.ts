import type { DayType, TrafficObservation } from "@/domain/types";
import { aggregateHourly, type HourlyFlow } from "./series";

/**
 * Comparação temporal (especificação §31): "Não comparar períodos incompatíveis sem deixar isso explícito".
 * Regra do sistema: duas séries são comparáveis quando têm o mesmo segmento e o mesmo tipo de dia conhecido.
 */
export interface Comparability {
  comparable: boolean;
  warnings: string[];
}

export interface SeriesMeta {
  id: string;
  segmentId: string;
  dayType: DayType;
  label: string;
}

export function comparability(a: SeriesMeta, b: SeriesMeta): Comparability {
  const w: string[] = [];
  if (a.segmentId !== b.segmentId) w.push("Segmentos diferentes (local/sentido/pista).");
  if (a.dayType === "DESCONHECIDO" || b.dayType === "DESCONHECIDO") w.push(`Tipo de dia desconhecido em ${[a, b].filter((x) => x.dayType === "DESCONHECIDO").map((x) => x.label).join(" e ")}: compatibilidade não verificável.`);
  else if (a.dayType !== b.dayType) w.push(`Tipos de dia diferentes (${a.dayType} × ${b.dayType}).`);
  return { comparable: w.length === 0, warnings: w };
}

/** Horas presentes nas duas séries. */
export function commonHours(a: HourlyFlow[], b: HourlyFlow[]) {
  return a.filter((h) => h.flow != null && b[h.hour].flow != null).map((h) => h.hour);
}

/**
 * Perfil médio por hora sobre várias séries do mesmo tipo de dia (base para "média semanal/mensal"
 * e "mesmo dia da semana"). Retorna n por hora para deixar explícita a amostra.
 */
export function meanProfile(seriesObs: TrafficObservation[][], dayType: DayType) {
  const sel = seriesObs.filter((s) => s.length && s[0].dayType === dayType);
  const hourly = sel.map(aggregateHourly);
  return Array.from({ length: 24 }, (_, h) => {
    const vals = hourly.map((x) => x[h].flow).filter((v): v is number => v != null);
    return { hour: h, n: vals.length, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
}
