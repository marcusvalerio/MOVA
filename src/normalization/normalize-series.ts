import type { DayType, Series, TrafficObservation } from "@/domain/types";
import { RAW_UFRJ_SERIES, type RawHourlySeries } from "@/data/raw/ufrj-series";
import { classifyRawCell } from "@/quality/cells";
import { ATYPICAL_DATES } from "@/data/calendario";

/**
 * NORMALIZATION — séries horárias.
 *  - "07:00–08:00" e "07–08" → startTime "07:00", 60 min;
 *  - número pt-BR "1.113" → 1113;
 *  - texto não numérico ("continuar conforme fonte") → AUSENTE, valor null (nunca preenchido);
 *  - data desconhecida permanece null; dia da semana e tipo de dia ficam DESCONHECIDO.
 */

export function parseInterval(s: string): { startTime: string; durationMinutes: number } | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
  const b = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (b <= a) return null;
  return { startTime: `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`, durationMinutes: b - a };
}

/** M-TIPO-DIA: seg–sex = DIA_UTIL; sáb; dom; datas do calendário (src/data/calendario.ts) = FERIADO. */
export function dayTypeOf(date: string | null): { weekday: number | null; dayType: DayType; note: string | null } {
  if (!date) return { weekday: null, dayType: "DESCONHECIDO", note: null };
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  const note = ATYPICAL_DATES[date] ?? null;
  if (note) return { weekday: wd, dayType: "FERIADO", note };
  return { weekday: wd, dayType: wd === 0 ? "DOMINGO" : wd === 6 ? "SABADO" : "DIA_UTIL", note: null };
}

export function normalizeSeries(raw: RawHourlySeries[], segmentIdByRow: Record<number, string>) {
  const series: Series[] = [];
  const observations: TrafficObservation[] = [];
  for (const s of raw) {
    const segmentId = segmentIdByRow[s.matrixRow];
    const { weekday, dayType } = dayTypeOf(s.date);
    const sourceRef = { documentId: "DOC-ESPECIFICACAO", section: s.section, locator: `${s.descriptionRaw} · ${s.dateRaw}` };
    const ids: string[] = [];
    for (const v of s.values) {
      const iv = parseInterval(v.interval);
      if (!iv) throw new Error(`Intervalo inválido: ${v.interval}`);
      const cell = classifyRawCell(v.raw);
      const id = `${s.id}--${iv.startTime}`;
      ids.push(id);
      observations.push({
        id,
        segmentId,
        source: "HISTORICO",
        seriesId: s.id,
        date: s.date,
        month: s.month,
        weekday,
        dayType,
        startTime: iv.startTime,
        durationMinutes: iv.durationMinutes,
        vehicleCount: cell.value,
        averageSpeedKmh: null,
        p85SpeedKmh: null,
        queueLengthM: null,
        quality: cell.status,
        sourceRef: { ...sourceRef, locator: `${sourceRef.locator} · ${v.interval}` },
        raw: v.raw,
      });
    }
    series.push({
      id: s.id,
      segmentId,
      source: "HISTORICO",
      label: s.date ? `${s.date.split("-").reverse().join("/")}` : `${s.month.split("-").reverse().join("/")} (dia não informado)`,
      date: s.date,
      month: s.month,
      weekday,
      dayType,
      sourceRef,
      observationIds: ids,
    });
  }
  return { series, observations };
}

export const normalizeUfrj = (segmentIdByRow: Record<number, string>) => normalizeSeries(RAW_UFRJ_SERIES, segmentIdByRow);
