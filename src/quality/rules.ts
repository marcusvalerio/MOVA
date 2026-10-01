import type { Measurement, QualityIssue, QualityStatus, RoadSegment, Series, TrafficObservation } from "@/domain/types";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
import { aggregateHourly, overnightRatio } from "@/engine/series";
import { parseQuantity } from "@/normalization/parse";

export { classifyRawCell } from "./cells";

/**
 * DATA QUALITY — validação. Nenhuma regra altera o dado; apenas registra o diagnóstico.
 */

export class IssueLog {
  private seq = 0;
  readonly issues: QualityIssue[] = [];
  add(i: Omit<QualityIssue, "id">) {
    this.issues.push({ id: `Q${String(++this.seq).padStart(3, "0")}`, ...i });
  }
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;

export function validateMeasurements(log: IssueLog, ms: Measurement[]) {
  for (const m of ms) {
    const target = { kind: "measurement" as const, id: m.id };
    if (!m.value) {
      log.add({ status: "INVALIDO", rule: "VALOR_NAO_INTERPRETAVEL", target, message: "Texto da célula não pôde ser interpretado como quantidade.", evidence: m.raw });
      continue;
    }
    if (m.value.min > m.value.max) log.add({ status: "INVALIDO", rule: "FAIXA_INVERTIDA", target, message: "Mínimo maior que máximo.", evidence: m.raw });
    if (m.value.min <= 0) log.add({ status: "SUSPEITO", rule: "VALOR_NAO_POSITIVO", target, message: "Volume zero ou negativo.", evidence: m.raw });
    if (m.rawUnit && /^veg/i.test(m.rawUnit)) log.add({ status: "SUSPEITO", rule: "UNIDADE_GRAFIA", target, message: "Unidade grafada 'veg' em vez de 'veíc'. Interpretada como veículos — validar.", evidence: m.raw });
    if (m.metric.startsWith("PICO") && m.windows.length === 0) log.add({ status: "INCOMPLETO", rule: "JANELA_AUSENTE", target, message: "Pico sem janela horária.", evidence: m.raw });
  }
}

export function validateSegments(log: IssueLog, segs: RoadSegment[], ms: Measurement[], seriesBySegment: Record<string, number>) {
  for (const s of segs) {
    const target = { kind: "segment" as const, id: s.id };
    if (!/\d/.test(s.speedRecordRaw)) log.add({ status: "AUSENTE", rule: "VELOCIDADE_AUSENTE", target, message: "Nenhum valor de velocidade disponível (relatório de velocidades não incorporado).", evidence: s.speedRecordRaw });
    if (s.laneCount == null) log.add({ status: "AUSENTE", rule: "FAIXAS_NAO_QUANTIFICADAS", target, message: "Número de faixas não explícito.", evidence: s.lanesMonitoredRaw });
    if (s.structureNote) log.add({ status: "SUSPEITO", rule: "AGRUPAMENTO_NA_MATRIZ", target, message: s.structureNote, evidence: s.directionRaw });
    if (!seriesBySegment[s.id]) log.add({ status: "AUSENTE", rule: "SERIE_HORARIA_AUSENTE", target, message: "Nenhuma série horária incorporada para este segmento (dados existem no PDF de fluxos, segundo a especificação, ou não foram identificados).", evidence: "—" });
    const vdm = ms.find((m) => m.segmentId === s.id && m.metric === "VDM_DIAS_UTEIS");
    const fds = ms.find((m) => m.segmentId === s.id && m.metric === "VOLUME_FIM_DE_SEMANA");
    if (vdm?.value && fds?.value) {
      const chk = weekendDropCheck(vdm.value, fds.value);
      if (!chk.compatible) log.add({ status: "SUSPEITO", rule: "QUEDA_FDS_FORA_DA_REGRA", target, message: `Faixas implicam queda de ${pct(chk.drop.min)} a ${pct(chk.drop.max)}, incompatível com 25–50% (§2.B).`, evidence: `${vdm.raw} | ${fds.raw}` });
      else if (chk.drop.min < 0) log.add({ status: "SUSPEITO", rule: "FAIXAS_SOBREPOSTAS", target, message: `Faixa de fim de semana sobrepõe a de dias úteis (queda possível ${pct(chk.drop.min)} a ${pct(chk.drop.max)}). Compatível com 25–50%, mas pouco informativo.`, evidence: `${vdm.raw} | ${fds.raw}` });
    }
  }
}

export function validateCrossSection(log: IssueLog, ms: Measurement[], centralSegmentId: string) {
  const central = ms.find((m) => m.id === `${centralSegmentId}--VDM_DIAS_UTEIS`);
  const t = /~[\d.]+ a [\d.]+ veíc\/dia/.exec(RAW_SECTION2.variacaoSemanal);
  const q = t ? parseQuantity(t[0].replace(" a ", " – ")) : null;
  if (central?.value && q && (central.value.min !== q.value.min || central.value.max !== q.value.max)) {
    log.add({
      status: "SUSPEITO",
      rule: "DIVERGENCIA_TEXTO_TABELA",
      target: { kind: "measurement", id: central.id },
      message: `§2.B cita ~${q.value.min.toLocaleString("pt-BR")} a ${q.value.max.toLocaleString("pt-BR")} veíc/dia nas pistas centrais da Av. das Américas; a matriz traz ${central.raw}.`,
      evidence: "DOC-PARAMETROS §2.B × §1 linha 2",
    });
  }
  log.add({ status: "SUSPEITO", rule: "DOCUMENTO_SECUNDARIO", target: { kind: "document", id: "DOC-PARAMETROS" }, message: "Documento é uma síntese (conteúdo duplicado, marcadores 'PDF+ n', frase truncada). Conferir com os relatórios primários.", evidence: "Estrutura do .docx" });
  log.add({ status: "SUSPEITO", rule: "FONTE_INTERMEDIARIA", target: { kind: "document", id: "DOC-ESPECIFICACAO" }, message: "Séries horárias transcritas pelo autor da especificação, não extraídas diretamente do PDF. Conferir valores com 'Fluxos UFRJ-Revisado (1).pdf'.", evidence: "docs/fontes/ESPECIFICACAO_MOVA_trechos.md" });
}

/**
 * Heurística de qualidade (NÃO metodologia de tráfego), parâmetros do sistema, EXPERIMENTAL:
 * sinaliza ≥ ALT_MIN_FLIPS inversões consecutivas de sentido da variação horária,
 * cada uma com |Δ| ≥ ALT_MIN_REL do valor anterior. Pode indicar transposição de valores.
 */
export const ALTERNATION_PARAMS = { ALT_MIN_FLIPS: 3, ALT_MIN_REL: 0.2 } as const;

export function alternationRun(values: (number | null)[]): { start: number; end: number } | null {
  const { ALT_MIN_FLIPS, ALT_MIN_REL } = ALTERNATION_PARAMS;
  let best: { start: number; end: number } | null = null;
  let runStart = -1, flips = 0, prevSign = 0;
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1], b = values[i];
    if (a == null || b == null || a === 0) { runStart = -1; flips = 0; prevSign = 0; continue; }
    const d = b - a;
    const sign = Math.abs(d) / a >= ALT_MIN_REL ? Math.sign(d) : 0;
    if (sign !== 0 && prevSign !== 0 && sign === -prevSign) {
      if (runStart < 0) runStart = i - 2;
      flips++;
      if (flips >= ALT_MIN_FLIPS && (!best || i - runStart > best.end - best.start)) best = { start: runStart, end: i };
    } else if (sign !== 0) {
      runStart = -1; flips = 0;
    } else {
      runStart = -1; flips = 0;
    }
    prevSign = sign;
  }
  return best;
}

export function validateSeries(log: IssueLog, series: Series[], obs: TrafficObservation[]) {
  for (const s of series) {
    const so = obs.filter((o) => o.seriesId === s.id);
    const target = { kind: "series" as const, id: s.id };
    for (const o of so) {
      if (o.quality !== "VALIDO") log.add({ status: o.quality, rule: "OBSERVACAO_" + o.quality, target: { kind: "observation", id: o.id }, message: `Intervalo ${o.startTime} sem valor numérico utilizável.`, evidence: o.raw ?? "—" });
    }
    if (!s.date) log.add({ status: "INCOMPLETO", rule: "DATA_NAO_INFORMADA", target, message: "Série sem dia informado: dia da semana e tipo de dia desconhecidos; não entra em comparações por tipo de dia.", evidence: s.sourceRef?.locator ?? "" });
    const hourly = aggregateHourly(so);
    const missingHours = hourly.filter((h) => h.flow == null).map((h) => h.hour);
    if (missingHours.length) log.add({ status: "INCOMPLETO", rule: "DIA_INCOMPLETO", target, message: `${24 - missingHours.length} de 24 horas disponíveis; volume diário não calculado. Horas ausentes: ${missingHours.map((h) => `${String(h).padStart(2, "0")}h`).join(", ")}.`, evidence: "—" });
    const run = alternationRun(hourly.map((h) => h.flow));
    if (run) log.add({ status: "SUSPEITO", rule: "PADRAO_ALTERNADO", target, message: `Variação horária alterna de sentido repetidamente entre ${String(run.start).padStart(2, "0")}h e ${String(run.end + 1).padStart(2, "0")}h (heurística do sistema, M-QA-ALTERNANCIA). Conferir transcrição com o PDF.`, evidence: hourly.slice(run.start, run.end + 1).map((h) => `${String(h.hour).padStart(2, "0")}h=${h.flow}`).join(" · ") });
    const on = overnightRatio(hourly);
    if (on && !on.belowRule) log.add({ status: "SUSPEITO", rule: "DIVERGENCIA_REGRA_MADRUGADA", target, message: `Maior fluxo 01–05h (${String(on.nightHour).padStart(2, "0")}h: ${on.nightFlow}) equivale a ${pct(on.ratio)} do pico (${on.peakFlow}). §2.B diz 'geralmente abaixo de 5%' — divergência registrada, não corrigida.`, evidence: RAW_SECTION2.variacaoHoraria });
  }
}

export function validateObservation(o: Pick<TrafficObservation, "vehicleCount" | "durationMinutes" | "averageSpeedKmh">): QualityStatus {
  if (o.vehicleCount == null) return "AUSENTE";
  if (!Number.isFinite(o.vehicleCount) || o.vehicleCount < 0) return "INVALIDO";
  if (!(o.durationMinutes > 0)) return "INVALIDO";
  if (o.averageSpeedKmh != null && (!Number.isFinite(o.averageSpeedKmh) || o.averageSpeedKmh < 0)) return "INVALIDO";
  return "VALIDO";
}
