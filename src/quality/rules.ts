import type { Measurement, QualityIssue, QualityStatus, RoadSegment, TrafficObservation } from "@/domain/types";
import type { PeriodStats } from "@/engine/aggregate";
import type { PdfIssue } from "@/normalization/normalize-pdf";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
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
    if (!seriesBySegment[s.id]) log.add({ status: "AUSENTE", rule: "SEM_DADOS_HORARIOS", target, message: "Segmento só existe na matriz (.docx): os PDFs registram estes trechos separados por sentido/pista.", evidence: s.directionRaw });
    if (s.laneCount == null && s.source.documentId === "DOC-PARAMETROS") log.add({ status: "AUSENTE", rule: "FAIXAS_NAO_QUANTIFICADAS", target, message: "Número de faixas não explícito.", evidence: s.lanesMonitoredRaw });
    if (s.structureNote) log.add({ status: "SUSPEITO", rule: "AGRUPAMENTO_NA_MATRIZ", target, message: s.structureNote, evidence: s.directionRaw });
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
  log.add({ status: "SUSPEITO", rule: "ATRIBUICAO_INCORRETA", target: { kind: "document", id: "DOC-ESPECIFICACAO" }, message: "A série 'de março de 2019' citada na especificação como pista central é, no PDF, da pista LATERAL em 01/03/2019. O sistema usa o PDF.", evidence: "DOC-FLUXOS-UFRJ p. 1 × especificação §3" });
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

const br = (d: string) => d.split("-").reverse().join("/");

/** Qualidade dos dados dos PDFs, agregada por segmento e mês (um registro por regra). */
export function validatePdf(log: IssueLog, pdfIssues: PdfIssue[], periods: [string, PeriodStats[]][]) {
  for (const p of pdfIssues) log.add({ status: p.status, rule: p.rule, target: { kind: p.target.startsWith("pdf-") ? "series" : "document", id: p.target }, message: p.message, evidence: p.evidence });
  for (const [segId, list] of periods) {
    for (const ps of list) {
      const target = { kind: "segment" as const, id: `${segId}@${ps.period}` };
      const cells = ps.days.flatMap((d) => d.hourly.map((h, i) => ({ d, h, i })));
      const missing = ps.days.reduce((s, d) => s + d.hourly.filter((h) => h.statuses.includes("AUSENTE")).length, 0);
      const zeros = ps.days.reduce((s, d) => s + d.hourly.filter((h) => h.statuses.includes("SUSPEITO")).length, 0);
      void cells;
      if (missing) log.add({ status: "AUSENTE", rule: "HORAS_SEM_VALOR", target, message: `${missing} hora(s) sem valor no relatório; não preenchidas.`, evidence: ps.days.filter((d) => d.hourly.some((h) => h.statuses.includes("AUSENTE"))).map((d) => br(d.series.date as string)).join(", ") });
      if (zeros) log.add({ status: "SUSPEITO", rule: "HORAS_ZERADAS", target, message: `${zeros} hora(s) com zero — padrão típico de equipamento parado; excluídas das médias.`, evidence: ps.days.filter((d) => d.hourly.some((h) => h.statuses.includes("SUSPEITO"))).map((d) => br(d.series.date as string)).join(", ") });
      const inc = ps.days.filter((d) => !d.complete);
      if (inc.length) log.add({ status: "INCOMPLETO", rule: "DIAS_INCOMPLETOS", target, message: `${inc.length} de ${ps.days.length} dia(s) sem as 24 horas válidas: fora de VDM e perfis médios.`, evidence: inc.map((d) => `${br(d.series.date as string)} (${d.validHours}h)`).join(", ") });
      const tot = ps.days.filter((d) => d.complete && d.series.reportedDailyTotal != null && d.series.reportedDailyTotal !== d.total);
      if (tot.length) log.add({ status: "SUSPEITO", rule: "TOTAL_DIVERGENTE", target, message: "Soma das horas difere do total impresso.", evidence: tot.map((d) => `${br(d.series.date as string)}: ${d.total} × ${d.series.reportedDailyTotal}`).join(", ") });
      const alt = ps.days.filter((d) => alternationRun(d.hourly.map((h) => h.flow)));
      if (alt.length) log.add({ status: "SUSPEITO", rule: "PADRAO_ALTERNADO", target, message: `${alt.length} dia(s) com variação horária alternada (heurística M-QA-ALTERNANCIA): conferir operação do equipamento.`, evidence: alt.map((d) => br(d.series.date as string)).join(", ") });
      if (ps.v85?.constant && ps.v85.n > 3) log.add({ status: "SUSPEITO", rule: "V85_CONSTANTE", target, message: `V85 impresso idêntico (${ps.v85.median} km/h) em ${ps.v85.n} dias: provável valor mensal repetido.`, evidence: "Relatório 06" });
      const low = ps.days.filter((d) => d.series.reportedV85 != null && d.series.reportedDailyMeanSpeed != null && (d.series.reportedV85 as number) < (d.series.reportedDailyMeanSpeed as number));
      if (low.length) log.add({ status: "SUSPEITO", rule: "V85_MENOR_QUE_MEDIA", target, message: `${low.length} dia(s) com V85 impresso menor que a velocidade média do dia — impossível por definição.`, evidence: low.slice(0, 6).map((d) => `${br(d.series.date as string)}: V85 ${d.series.reportedV85} < média ${d.series.reportedDailyMeanSpeed}`).join(", ") });
      if (ps.overnight && ps.overnight.ratio >= 0.05) log.add({ status: "SUSPEITO", rule: "DIVERGENCIA_REGRA_MADRUGADA", target, message: `No perfil médio de dias úteis, a madrugada chega a ${(ps.overnight.ratio * 100).toFixed(1).replace(".", ",")}% do pico; §2.B diz 'geralmente abaixo de 5%'. Registrado, não corrigido.`, evidence: RAW_SECTION2.variacaoHoraria });
    }
  }
}

export function validateObservation(o: Pick<TrafficObservation, "vehicleCount" | "durationMinutes" | "averageSpeedKmh">): QualityStatus {
  if (o.vehicleCount == null) return "AUSENTE";
  if (!Number.isFinite(o.vehicleCount) || o.vehicleCount < 0) return "INVALIDO";
  if (!(o.durationMinutes > 0)) return "INVALIDO";
  if (o.averageSpeedKmh != null && (!Number.isFinite(o.averageSpeedKmh) || o.averageSpeedKmh < 0)) return "INVALIDO";
  return "VALIDO";
}
