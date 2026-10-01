import type { Series, TrafficObservation } from "@/domain/types";
import rawFlows from "../../data/extraido/fluxos.json";
import rawSpeeds from "../../data/extraido/velocidade.json";
import { ruleFor } from "@/data/raw/pdf-locais";
import { classifyRawCell } from "@/quality/cells";
import { dayTypeOf } from "./normalize-series";
import type { StructureBuilder } from "./structure";

/**
 * NORMALIZATION — tabelas extraídas dos relatórios de fiscalização (scripts/extracao → data/extraido).
 * Regras:
 *  - um registro por (segmento, data); no relatório de velocidade, a primeira tabela do dia é a do total
 *    das faixas (as seguintes são por faixa e ficam fora desta versão);
 *  - célula vazia → AUSENTE; zero → SUSPEITO (blocos de zero indicam equipamento parado); nada é preenchido;
 *  - velocidade vazia ou zero → null;
 *  - data validada pelo dia da semana impresso (weekdayChecked).
 */
export interface RawPdfDay {
  doc: string;
  page: number;
  loc: string;
  obs?: string[] | null;
  date: string | null;
  dateRaw: string;
  weekdayChecked: boolean;
  values: (string | null)[];
  nrows: number;
  summary: string | null;
  p85: string | null;
  cet?: string | null;
  equip?: string | null;
}

export interface PdfIssue {
  rule: string;
  status: "SUSPEITO" | "AUSENTE" | "INCOMPLETO";
  target: string;
  message: string;
  evidence: string;
}

const num = (s: string | null | undefined) => (s == null ? null : Number(s.replace(/\./g, "")));

export function normalizePdf(builder: StructureBuilder, flows = rawFlows as RawPdfDay[], speeds = rawSpeeds as RawPdfDay[]) {
  const issues: PdfIssue[] = [];
  const unmatched = new Set<string>();
  const speedBy = new Map<string, RawPdfDay>();
  for (const s of speeds) {
    const r = ruleFor(s.loc);
    if (!r || !s.date) { if (!r) unmatched.add(s.loc); continue; }
    const seg = builder.ensure({ ...r, source: { documentId: "DOC-FLUXOS-UFRJ", section: s.loc } });
    const key = `${seg.id}|${s.date}`;
    if (!speedBy.has(key)) speedBy.set(key, s);
  }
  const series: Series[] = [];
  const observations: TrafficObservation[] = [];
  const seen = new Set<string>();
  for (const f of flows) {
    const r = ruleFor(f.loc);
    if (!r) { unmatched.add(f.loc); continue; }
    if (!f.date) continue;
    const seg = builder.ensure({
      ...r,
      lanesMonitoredRaw: f.obs?.find((o) => /faixas/i.test(o)) ?? "não informado no relatório",
      speedRecordRaw: "Relatório 06: velocidade média por hora e 85º percentil",
      structureNote: r.note ?? null,
      source: { documentId: "DOC-FLUXOS-UFRJ", section: f.loc, locator: `p. ${f.page}` },
    });
    const key = `${seg.id}|${f.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sp = speedBy.get(key);
    const { weekday, dayType, note } = dayTypeOf(f.date);
    const seriesId = `pdf-${seg.id}-${f.date}`;
    const sourceRef = { documentId: "DOC-FLUXOS-UFRJ", section: f.loc, locator: `p. ${f.page}${sp ? ` · velocidade: DOC-VELOCIDADES p. ${sp.page}` : ""}` };
    const parts = f.dateRaw.split("/").map(Number);
    const ambiguous = parts.length === 3 && parts[0] <= 12 && parts[1] <= 12 && parts[0] !== parts[1];
    if (!f.weekdayChecked && ambiguous) issues.push({ rule: "DATA_NAO_CONFIRMADA", status: "SUSPEITO", target: seriesId, message: "Dia da semana impresso não confirmou a data interpretada.", evidence: `${f.dateRaw} (p. ${f.page})` });
    const ids: string[] = [];
    for (let h = 0; h < 24; h++) {
      const raw = h < f.values.length ? f.values[h] : null;
      const cell = classifyRawCell(raw);
      const vs = sp && h < sp.values.length ? num(sp.values[h]) : null;
      const id = `${seriesId}--${String(h).padStart(2, "0")}`;
      ids.push(id);
      observations.push({
        id, segmentId: seg.id, source: "HISTORICO", seriesId, date: f.date, month: f.date.slice(0, 7), weekday, dayType,
        startTime: `${String(h).padStart(2, "0")}:00`, durationMinutes: 60,
        vehicleCount: cell.value, averageSpeedKmh: vs && vs > 0 ? vs : null, p85SpeedKmh: null, queueLengthM: null,
        quality: cell.status, sourceRef, raw: raw,
      });
    }
    series.push({
      id: seriesId, segmentId: seg.id, source: "HISTORICO", label: f.date.split("-").reverse().join("/"),
      date: f.date, month: f.date.slice(0, 7), weekday, dayType, dayNote: note, sourceRef, observationIds: ids,
      reportedDailyTotal: num(f.summary), reportedDailyMeanSpeed: sp ? num(sp.summary) : null, reportedV85: sp ? num(sp.p85) : null,
    });
  }
  for (const u of unmatched) issues.push({ rule: "LOCAL_NAO_MAPEADO", status: "SUSPEITO", target: "DOC-FLUXOS-UFRJ", message: "Título de local sem regra de mapeamento.", evidence: u });
  return { series, observations, issues };
}
