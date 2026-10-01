import type { Approach, Measurement, QualityIssue, QualityStatus, TrafficObservation } from "@/domain/types";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
import { parseQuantity } from "@/normalization/parse";

/**
 * DATA QUALITY — validação. Nenhuma regra altera o dado; apenas registra o diagnóstico.
 */

let seq = 0;
const issue = (i: Omit<QualityIssue, "id">): QualityIssue => ({ id: `Q${String(++seq).padStart(3, "0")}`, ...i });

export function validateMeasurements(ms: Measurement[]): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const m of ms) {
    const target = { kind: "measurement" as const, id: m.id };
    if (!m.value) {
      out.push(issue({ status: "INVALIDO", rule: "VALOR_NAO_INTERPRETAVEL", target, message: "Texto da célula não pôde ser interpretado como quantidade.", evidence: m.raw }));
      continue;
    }
    if (m.value.min > m.value.max) {
      out.push(issue({ status: "INVALIDO", rule: "FAIXA_INVERTIDA", target, message: "Mínimo maior que máximo.", evidence: m.raw }));
    }
    if (m.value.min <= 0) {
      out.push(issue({ status: "SUSPEITO", rule: "VALOR_NAO_POSITIVO", target, message: "Volume zero ou negativo.", evidence: m.raw }));
    }
    if (m.rawUnit && /^veg/i.test(m.rawUnit)) {
      out.push(issue({ status: "SUSPEITO", rule: "UNIDADE_GRAFIA", target, message: "Unidade grafada 'veg' em vez de 'veíc'. Interpretada como veículos — validar.", evidence: m.raw }));
    }
    if (m.metric.startsWith("PICO") && m.windows.length === 0) {
      out.push(issue({ status: "INCOMPLETO", rule: "JANELA_AUSENTE", target, message: "Pico sem janela horária.", evidence: m.raw }));
    }
  }
  return out;
}

export function validateApproaches(as: Approach[], ms: Measurement[]): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const a of as) {
    const target = { kind: "approach" as const, id: a.id };
    if (!/\d/.test(a.speedRecordRaw)) {
      out.push(issue({ status: "AUSENTE", rule: "VELOCIDADE_AUSENTE", target, message: "Nenhum valor de velocidade na fonte.", evidence: a.speedRecordRaw }));
    }
    if (a.laneCount == null) {
      out.push(issue({ status: "AUSENTE", rule: "FAIXAS_NAO_QUANTIFICADAS", target, message: "Número de faixas não explícito.", evidence: a.lanesRaw }));
    }
    const vdm = ms.find((m) => m.approachId === a.id && m.metric === "VDM_DIAS_UTEIS");
    const fds = ms.find((m) => m.approachId === a.id && m.metric === "VOLUME_FIM_DE_SEMANA");
    if (vdm?.qualifier === "Central" && /Central e Lateral/i.test(a.directionRaw)) {
      out.push(issue({ status: "SUSPEITO", rule: "ESCOPO_DIVERGENTE", target, message: "Linha cobre pista central e lateral, mas o VDM é qualificado como '(Central)'. Escopo do fim de semana não é qualificado.", evidence: `${a.directionRaw} | ${vdm.raw}` }));
    }
    if (vdm?.qualifier === "por sentido" && /\se\s/i.test(a.directionRaw)) {
      out.push(issue({ status: "SUSPEITO", rule: "ESCOPO_DIVERGENTE", target, message: "Linha agrupa dois sentidos; VDM declarado 'por sentido'. Não se sabe a qual sentido o volume se refere.", evidence: `${a.directionRaw} | ${vdm.raw}` }));
    }
    if (vdm?.value && fds?.value) {
      const chk = weekendDropCheck(vdm.value, fds.value);
      if (!chk.compatible) {
        out.push(issue({ status: "SUSPEITO", rule: "QUEDA_FDS_FORA_DA_REGRA", target, message: `Faixas da matriz implicam queda de ${pct(chk.drop.min)} a ${pct(chk.drop.max)}, incompatível com 25–50% (Seção 2.B).`, evidence: `${vdm.raw} | ${fds.raw}` }));
      } else if (chk.drop.min < 0) {
        out.push(issue({ status: "SUSPEITO", rule: "FAIXAS_SOBREPOSTAS", target, message: `Faixa de fim de semana sobrepõe a de dias úteis: o intervalo de queda inclui valores negativos (${pct(chk.drop.min)} a ${pct(chk.drop.max)}). Compatível com 25–50%, mas pouco informativo.`, evidence: `${vdm.raw} | ${fds.raw}` }));
      }
    }
  }
  return out;
}

/** Divergências entre texto da Seção 2 e a matriz da Seção 1. */
export function validateCrossSection(ms: Measurement[]): QualityIssue[] {
  const out: QualityIssue[] = [];
  const central = ms.find((m) => m.id === "av-americas-2000--r2--VDM_DIAS_UTEIS");
  const textMatch = /~[\d.]+ a [\d.]+ veíc\/dia/.exec(RAW_SECTION2.variacaoSemanal);
  const textQ = textMatch ? parseQuantity(textMatch[0].replace(" a ", " – ")) : null;
  if (central?.value && textQ && (central.value.min !== textQ.value.min || central.value.max !== textQ.value.max)) {
    out.push(issue({
      status: "SUSPEITO",
      rule: "DIVERGENCIA_TEXTO_TABELA",
      target: { kind: "measurement", id: central.id },
      message: `Seção 2.B cita ~${textQ.value.min.toLocaleString("pt-BR")} a ${textQ.value.max.toLocaleString("pt-BR")} veíc/dia para as pistas centrais da Av. das Américas; a matriz traz ${central.raw}.`,
      evidence: "Seção 2.B × Seção 1, linha 2",
    }));
  }
  out.push(issue({
    status: "SUSPEITO",
    rule: "DOCUMENTO_SECUNDARIO",
    target: { kind: "document", id: "DOC-PARAMETROS" },
    message: "Documento é uma síntese (conteúdo duplicado, marcadores 'PDF+ n', frase truncada 'qui está a análise…'). Valores devem ser conferidos nos relatórios primários.",
    evidence: "Estrutura do arquivo .docx",
  }));
  return out;
}

export function validateObservation(o: TrafficObservation): QualityStatus {
  if (o.vehicleCount == null) return "AUSENTE";
  if (!Number.isFinite(o.vehicleCount) || o.vehicleCount < 0) return "INVALIDO";
  if (Date.parse(o.intervalEnd) <= Date.parse(o.intervalStart)) return "INVALIDO";
  if (o.averageSpeedKmh != null && (!Number.isFinite(o.averageSpeedKmh) || o.averageSpeedKmh < 0)) return "INVALIDO";
  return "VALIDO";
}

/** Interpreta valores brutos de planilha (ex.: "#NUM!", "", "0"). */
export function classifyRawCell(raw: string | number | null | undefined): { status: QualityStatus; value: number | null } {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return { status: "AUSENTE", value: null };
  if (typeof raw === "string" && /^#(NUM|DIV\/0|VALUE|REF|N\/A|NAME)[!?]?/i.test(raw.trim())) return { status: "INVALIDO", value: null };
  const n = typeof raw === "number" ? raw : Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { status: "INVALIDO", value: null };
  if (n === 0) return { status: "SUSPEITO", value: 0 };
  if (n < 0) return { status: "INVALIDO", value: n };
  return { status: "VALIDO", value: n };
}

export function resetQualitySeq() {
  seq = 0;
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
