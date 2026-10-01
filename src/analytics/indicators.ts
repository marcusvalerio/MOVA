import type { Indicator, Measurement, MeasurementMetric, RoadSegment, Series, TraceStep, TrafficObservation } from "@/domain/types";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
import { aggregateHourly, classifyCondition, overnightRatio, partialVolume, peakHour, peakVsWindows } from "@/engine/series";
import { CONDITION_CONFIG } from "@/methodology/condition-config";
import { getMethodology } from "@/methodology/registry";
import { formatRange } from "@/normalization/parse";

/**
 * ANALYTICS — indicadores com trilha Indicador → Variáveis → Entradas → Fórmula → Intermediário → Resultado → Interpretação.
 */

const META: Record<MeasurementMetric, { key: string; name: string; methodologyId: string; period: string }> = {
  VDM_DIAS_UTEIS: { key: "vdm", name: "VDM — dias úteis (matriz)", methodologyId: "M-VDM", period: "Dias úteis (período não especificado)" },
  VOLUME_FIM_DE_SEMANA: { key: "vol-fds", name: "Volume diário — fins de semana (matriz)", methodologyId: "M-MATRIZ", period: "Sábados e domingos (período não especificado)" },
  PICO_MANHA: { key: "pico-manha", name: "Pico da manhã (matriz)", methodologyId: "M-PICO", period: "Manhã" },
  PICO_TARDE_NOITE: { key: "pico-tarde", name: "Pico da tarde/noite (matriz)", methodologyId: "M-PICO", period: "Tarde/noite" },
};

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const hh = (h: number) => `${String(h).padStart(2, "0")}h`;
const vars = (id: string) => getMethodology(id).variables.map((v) => `${v.symbol}: ${v.meaning} [${v.unit}]`);
const srcLine = (m: Measurement) => `${m.source.documentId} · ${m.source.section} · ${m.source.locator}`;

function transcribed(m: Measurement): Indicator {
  const meta = META[m.metric];
  const meth = getMethodology(meta.methodologyId);
  const windows = m.windows.map((w) => `${w.start}–${w.end}`).join(" e ");
  const display = formatRange(m.value, m.unit) + (windows ? ` · ${windows}` : "");
  return {
    id: m.id, key: meta.key, name: meta.name, segmentId: m.segmentId, origin: "OBSERVADO", value: m.value, unit: m.unit, display,
    period: meta.period, methodologyId: meth.id, sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: meta.name, lines: [meth.description, "Camada: OBSERVADO (transcrição da fonte, sem cálculo)."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(meth.id).length ? vars(meth.id) : ["Valor reportado (faixa mín–máx)."] },
      { kind: "ENTRADA", title: "Dado de entrada (texto literal)", lines: [`"${m.raw}"`, srcLine(m)] },
      { kind: "FORMULA", title: "Fórmula", lines: ["A fonte não apresenta fórmula para este valor.", "Procedimento: transcrição + normalização (separador de milhar, '~', mínimo–máximo)."] },
      { kind: "INTERMEDIARIO", title: "Normalização", lines: [`mín = ${m.value?.min ?? "—"} · máx = ${m.value?.max ?? "—"} · aproximado = ${m.value?.approximate ? "sim" : "não"}`, `unidade na fonte "${m.rawUnit ?? "—"}" → ${m.unit ?? "—"}`, ...(windows ? [`janela(s): ${windows}`] : []), ...(m.qualifier ? [`qualificador: "${m.qualifier}"`] : [])] },
      { kind: "RESULTADO", title: "Resultado", lines: [display] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [meth.purpose, "Observação do estudo — não é limite universal.", `Status metodológico: ${meth.status}.`] },
    ],
  };
}

function weekendDrop(s: RoadSegment, vdm: Measurement, fds: Measurement): Indicator | null {
  if (!vdm.value || !fds.value) return null;
  const c = weekendDropCheck(vdm.value, fds.value);
  const meth = getMethodology("M-QUEDA-FDS");
  const display = `${pct(c.drop.min)} a ${pct(c.drop.max)}`;
  return {
    id: `${s.id}--QUEDA_FDS`, key: "queda-fds", name: "Queda fim de semana × dias úteis", segmentId: s.id, origin: "CALCULADO",
    value: { min: c.drop.min * 100, max: c.drop.max * 100, approximate: true }, unit: "%", display, period: "Fim de semana vs. dias úteis",
    methodologyId: meth.id, sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: "Queda do volume nos fins de semana", lines: [meth.description, "Camada: CALCULADO a partir de dois valores observados."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(meth.id) },
      { kind: "ENTRADA", title: "Dados de entrada", lines: [`VDM: "${vdm.raw}" (${srcLine(vdm)})`, `Fim de semana: "${fds.raw}" (${srcLine(fds)})`, `Regra: "${RAW_SECTION2.variacaoSemanal}"`] },
      { kind: "FORMULA", title: "Fórmula", lines: ["A fonte não apresenta fórmula; apresenta a observação '25% a 50%'.", `Implementação (${meth.status}): ${meth.implementation}`] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`queda_mín = 1 − ${fds.value.max} / ${vdm.value.min} = ${pct(c.drop.min)}`, `queda_máx = 1 − ${fds.value.min} / ${vdm.value.max} = ${pct(c.drop.max)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`Queda compatível com as faixas: ${display}`, `Intersecta 25–50%? ${c.compatible ? "SIM" : "NÃO"}`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [c.compatible ? "Faixas da matriz compatíveis com a observação da §2.B." : "Faixas NÃO compatíveis com a §2.B — inconsistência a validar.", ...(c.drop.min < 0 ? ["Intervalo inclui valores negativos (faixas sobrepostas): verificação pouco conclusiva."] : [])] },
    ],
  };
}

function unavailable(s: RoadSegment, key: string, name: string, methodologyId: string, inputs: string[]): Indicator {
  const meth = getMethodology(methodologyId);
  return {
    id: `${s.id}--${key.toUpperCase()}`, key, name, segmentId: s.id, origin: "INDISPONIVEL", value: null, unit: meth.unit, display: "Sem dado",
    period: "—", methodologyId, sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: name, lines: [meth.description, "Camada: INDISPONÍVEL."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(methodologyId).length ? vars(methodologyId) : ["—"] },
      { kind: "ENTRADA", title: "Dados de entrada", lines: inputs },
      { kind: "FORMULA", title: "Fórmula", lines: [meth.implementation ?? "Não documentada na fonte.", ...(meth.externalSource ? [meth.externalSource] : [])] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: ["Não executado."] },
      { kind: "RESULTADO", title: "Resultado", lines: ["Sem dado"] },
      { kind: "INTERPRETACAO", title: "Lacunas — pendente de validação com o professor", lines: meth.gaps },
    ],
  };
}

/** Citações qualitativas da §2 aplicáveis ao segmento (por linha da matriz). */
export function qualitativeAssessments(s: RoadSegment): string[] {
  const row = Number(/linha (\d+)/.exec(s.source.locator ?? "")?.[1]);
  const map: Record<number, (keyof typeof RAW_SECTION2)[]> = {
    2: ["americasCentrais", "picoTardeUteis"],
    3: ["brt"],
    4: ["americasCentrais", "picoManhaUteis"],
    5: ["picoTardeUteis"],
    6: ["jardimBotanico"],
    7: ["linhaVermelha", "picoManhaUteis"],
  };
  return (map[row] ?? []).map((k) => RAW_SECTION2[k]);
}

/** Indicadores calculados a partir de uma série horária observada. */
export function seriesIndicators(s: Series, obs: TrafficObservation[], seg: RoadSegment, ms: Measurement[]): Indicator[] {
  const hourly = aggregateHourly(obs);
  const values = hourly.filter((h) => h.flow != null).map((h) => `${hh(h.hour)}–${hh(h.hour + 1)}: ${n(h.flow as number)}`);
  const srcLines = [`${s.sourceRef?.documentId} · ${s.sourceRef?.section} · ${s.sourceRef?.locator}`, `Valores (veíc/h): ${values.join(" · ")}`];
  const dayLabel = s.dayType === "DESCONHECIDO" ? "tipo de dia desconhecido" : s.dayType === "DIA_UTIL" ? "dia útil" : s.dayType.toLowerCase();
  const period = `${s.label} · ${dayLabel}`;
  const out: Indicator[] = [];

  const pk = peakVsWindows(hourly, s.dayType);
  if (pk) {
    const meth = getMethodology("M-PICO");
    const matrixRanges = ms.filter((m) => m.segmentId === seg.id && m.metric.startsWith("PICO") && m.value);
    const winLines = pk.windows.map((w) => {
      const p = peakHour(hourly, w);
      return `${w.label} (${hh(w.startHour)}–${hh(w.endHour)}, M-JANELAS-PICO): ${p ? `${n(p.flow as number)} veíc/h às ${hh(p.hour)}` : "sem dados"}`;
    });
    out.push({
      id: `${s.id}--PICO`, key: "pico-serie", name: "Fluxo horário máximo observado", segmentId: seg.id, origin: "CALCULADO",
      value: { min: pk.peak.flow as number, max: pk.peak.flow as number, approximate: false }, unit: "veic/h",
      display: `${n(pk.peak.flow as number)} veíc/h · ${hh(pk.peak.hour)}–${hh(pk.peak.hour + 1)}`, period, methodologyId: meth.id, sourceKind: "HISTORICO",
      trace: [
        { kind: "INDICADOR", title: "Fluxo horário máximo da série", lines: [meth.description, "Camada: CALCULADO (máximo de valores observados)."] },
        { kind: "VARIAVEIS", title: "Variáveis", lines: vars(meth.id) },
        { kind: "ENTRADA", title: "Dados de entrada", lines: [...srcLines, `Horas disponíveis: ${values.length} de 24.`] },
        { kind: "FORMULA", title: "Fórmula", lines: [`Implementação (${meth.status}): ${meth.implementation}`] },
        { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`max(q_h) = ${n(pk.peak.flow as number)} às ${hh(pk.peak.hour)}`, ...winLines] },
        { kind: "RESULTADO", title: "Resultado", lines: [`${n(pk.peak.flow as number)} veíc/h (${hh(pk.peak.hour)}–${hh(pk.peak.hour + 1)})`] },
        {
          kind: "INTERPRETACAO", title: "Interpretação",
          lines: [
            pk.insideWindow == null ? "Tipo de dia desconhecido: não é possível posicionar o pico em relação às janelas da §2.A." : pk.insideWindow ? "O pico do dia está dentro de uma janela de pico da §2.A." : "O pico do dia está FORA das janelas de pico da §2.A para este tipo de dia.",
            ...(values.length < 24 ? ["Série incompleta: o máximo refere-se apenas às horas disponíveis."] : []),
            ...matrixRanges.map((m) => `Referência da matriz (${META[m.metric].name}): ${m.raw}.`),
          ],
        },
      ],
    });
  }

  const pv = partialVolume(hourly);
  const methV = getMethodology("M-VDM");
  out.push({
    id: `${s.id}--VOLUME`, key: "volume-serie", name: pv.hours === 24 ? "Volume diário" : "Volume parcial do dia (incompleto)", segmentId: seg.id, origin: "CALCULADO",
    value: { min: pv.total, max: pv.total, approximate: false }, unit: "veic", display: `${n(pv.total)} veíc · ${pv.hours}/24 h`, period, methodologyId: methV.id, sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: "Volume do dia", lines: ["Soma dos fluxos horários disponíveis.", "Camada: CALCULADO."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: ["q_h: fluxo na hora h [veíc/h]"] },
      { kind: "ENTRADA", title: "Dados de entrada", lines: srcLines },
      { kind: "FORMULA", title: "Fórmula", lines: ["V = Σ q_h (horas disponíveis). VDM só é calculado com 24 h completas (M-VDM)."] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`Σ de ${pv.hours} horas = ${n(pv.total)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${n(pv.total)} veículos em ${pv.hours} horas`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [pv.hours === 24 ? "Dia completo." : `INCOMPLETO: faltam ${24 - pv.hours} horas. Não é volume diário nem entra no VDM.`] },
    ],
  });

  const on = overnightRatio(hourly);
  const methM = getMethodology("M-MADRUGADA");
  out.push(
    on
      ? {
          id: `${s.id}--MADRUGADA`, key: "madrugada", name: "Madrugada / pico", segmentId: seg.id, origin: "CALCULADO",
          value: { min: on.ratio * 100, max: on.ratio * 100, approximate: false }, unit: "%", display: pct(on.ratio), period, methodologyId: methM.id, sourceKind: "HISTORICO",
          trace: [
            { kind: "INDICADOR", title: "Fluxo de madrugada em relação ao pico", lines: [methM.description, "Camada: CALCULADO."] },
            { kind: "VARIAVEIS", title: "Variáveis", lines: ["q_h madrugada: maior fluxo entre 01h e 05h", "q_pico: maior fluxo horário do dia"] },
            { kind: "ENTRADA", title: "Dados de entrada", lines: [...srcLines, `Regra: "${RAW_SECTION2.variacaoHoraria}"`] },
            { kind: "FORMULA", title: "Fórmula", lines: [`Implementação (${methM.status}): ${methM.implementation}`] },
            { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`${n(on.nightFlow)} (${hh(on.nightHour)}) / ${n(on.peakFlow)} (${hh(on.peakHour)}) = ${pct(on.ratio)}`] },
            { kind: "RESULTADO", title: "Resultado", lines: [pct(on.ratio)] },
            { kind: "INTERPRETACAO", title: "Interpretação", lines: [on.belowRule ? "Abaixo de 5%: consistente com a observação da §2.B." : "Acima de 5%: diverge da observação da §2.B ('geralmente abaixo de 5%'). Registrado na qualidade de dados; não corrigido.", ...(pv.hours < 24 ? ["Pico calculado sobre série incompleta."] : [])] },
          ],
        }
      : { ...unavailable(seg, `madrugada-${s.id}`, "Madrugada / pico", "M-MADRUGADA", [...srcLines, "Série não contém as 4 horas entre 01h e 05h."]), id: `${s.id}--MADRUGADA`, key: "madrugada", period },
  );
  return out;
}

export function segmentIndicators(s: RoadSegment, ms: Measurement[]): Indicator[] {
  const own = ms.filter((m) => m.segmentId === s.id);
  const out = own.map(transcribed);
  const vdm = own.find((m) => m.metric === "VDM_DIAS_UTEIS");
  const fds = own.find((m) => m.metric === "VOLUME_FIM_DE_SEMANA");
  if (vdm && fds) { const d = weekendDrop(s, vdm, fds); if (d) out.push(d); }
  out.push(unavailable(s, "velocidade", "Velocidade média", "M-VELOCIDADE-MEDIA", [`Registro na matriz: "${s.speedRecordRaw}"`, "Relatório de velocidades (DOC-VELOCIDADES) não incorporado."]));
  out.push(unavailable(s, "v85", "Velocidade do 85º percentil", "M-V85", ["Relatório de velocidades (DOC-VELOCIDADES) não incorporado."]));
  out.push(unavailable(s, "saturacao", "Grau de saturação (v/c)", "M-SATURACAO", ["Capacidade (c) não definida na fonte.", `Faixas: "${s.lanesMonitoredRaw}"`]));
  const cond = unavailable(s, "condicao", "Condição operacional", "M-CONDICAO", [
    `Indicador-base: ${CONDITION_CONFIG.baseIndicator ?? "não definido"}`,
    CONDITION_CONFIG.note,
    ...qualitativeAssessments(s).map((t) => `Avaliação qualitativa da fonte (citação, não cálculo): "${t}"`),
  ]);
  cond.display = classifyCondition(null, CONDITION_CONFIG.thresholds);
  out.push(cond);
  return out;
}

export type { TraceStep };
