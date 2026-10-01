import type { Indicator, Measurement, MeasurementMetric, NumericRange, RoadSegment, TraceStep } from "@/domain/types";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
import { classifyCondition, PEAK_WINDOWS } from "@/engine/series";
import type { DaySummary, PeriodStats } from "@/engine/aggregate";
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
const n = (x: number, d = 1) => x.toLocaleString("pt-BR", { maximumFractionDigits: d });
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
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

const ptMonth = (p: string) => { const [y, m] = p.split("-"); return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1]}/${y}`; };
const brDate = (d: string) => d.split("-").reverse().join("/");

/** Indicadores de um período (mês de relatório) calculados a partir dos dias observados nos PDFs. */
export function periodIndicators(seg: RoadSegment, ps: PeriodStats, ms: Measurement[]): Indicator[] {
  const out: Indicator[] = [];
  const src = ps.days[0]?.series.sourceRef;
  const srcLine = src ? `${src.documentId} · "${src.section}" · ${src.locator}` : "—";
  const per = ptMonth(ps.period);
  const dayList = (ds: DaySummary[]) => ds.map((d) => `${brDate(d.series.date as string)}: ${n(d.total as number)}`).join(" · ");
  const excluded = ps.days.filter((d) => !d.complete || d.series.dayType === "FERIADO");
  const exclLine = `Excluídos: ${ps.days.filter((d) => !d.complete).length} dia(s) incompleto(s) ou com zero suspeito; ${ps.byType.FERIADO.length} feriado(s)/data(s) atípica(s)${ps.byType.FERIADO.length ? ` (${ps.byType.FERIADO.map((d) => `${brDate(d.series.date as string)} — ${d.series.dayNote}`).join("; ")})` : ""}.`;
  const mk = (key: string, name: string, methodologyId: string, origin: Indicator["origin"], value: NumericRange | null, unit: Indicator["unit"], display: string, trace: TraceStep[]): Indicator => ({
    id: `${seg.id}--${ps.period}--${key.toUpperCase()}`, key, name, segmentId: seg.id, origin, value, unit, display, period: per, methodologyId, sourceKind: "HISTORICO", trace,
  });
  const meth = (id: string) => getMethodology(id);

  if (ps.vdm) {
    const m = meth("M-VDM");
    const ref = ms.find((x) => x.segmentId === seg.id && x.metric === "VDM_DIAS_UTEIS");
    out.push(mk("vdm", "VDM — dias úteis", m.id, "CALCULADO", { min: ps.vdm.mean, max: ps.vdm.mean, approximate: false }, "veic/dia", `${n(Math.round(ps.vdm.mean))} veíc/dia`, [
      { kind: "INDICADOR", title: "Volume Diário Médio em dias úteis", lines: [m.description, "Camada: CALCULADO a partir dos totais diários observados no relatório."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(m.id) },
      { kind: "ENTRADA", title: `Dados de entrada — ${ps.vdm.n} dias úteis completos`, lines: [srcLine, dayList(ps.completeWeekdays), exclLine] },
      { kind: "FORMULA", title: "Fórmula", lines: ["A fonte não define o procedimento; média aritmética inferida do nome (Volume Diário MÉDIO).", `Implementação (${m.status}): ${m.implementation}`] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`VDM = (${ps.completeWeekdays.map((d) => d.total).join(" + ")}) / ${ps.vdm.n}`, `= ${n(Math.round(ps.vdm.mean))} · mín ${n(ps.vdm.min)} · máx ${n(ps.vdm.max)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${n(Math.round(ps.vdm.mean))} veíc/dia (${ps.vdm.n} dias, ${per})`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [m.purpose, ...(ref ? [`Referência da matriz (.docx): ${ref.raw}.`] : []), "Totais diários conferem com o total impresso no relatório em 100% dos dias completos (ver docs/AVALIACAO_DOCUMENTOS.md)."] },
    ]));
  }
  if (ps.weekend && ps.vdm && ps.weekendDrop != null) {
    const m = meth("M-QUEDA-FDS");
    const ok = ps.weekendDrop >= 0.25 && ps.weekendDrop <= 0.5;
    out.push(mk("queda-fds", "Queda no fim de semana", m.id, "CALCULADO", { min: ps.weekendDrop * 100, max: ps.weekendDrop * 100, approximate: false }, "%", pct(ps.weekendDrop), [
      { kind: "INDICADOR", title: "Queda do volume diário nos fins de semana", lines: [m.description, "Camada: CALCULADO."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: ["VDM: média dos dias úteis completos [veíc/dia]", "V_fds: média dos sábados e domingos completos [veíc/dia]"] },
      { kind: "ENTRADA", title: "Dados de entrada", lines: [srcLine, `Fim de semana (${ps.weekend.n} dias): ${dayList(ps.completeWeekend)}`, `VDM: ${n(Math.round(ps.vdm.mean))}`, `Regra: "${RAW_SECTION2.variacaoSemanal}"`] },
      { kind: "FORMULA", title: "Fórmula", lines: ["A fonte apresenta a observação '25% a 50%', não a fórmula.", "queda = 1 − V_fds / VDM (sistema)"] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`1 − ${n(Math.round(ps.weekend.mean))} / ${n(Math.round(ps.vdm.mean))} = ${pct(ps.weekendDrop)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [pct(ps.weekendDrop)] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [ok ? "Dentro da faixa 25–50% citada pelo estudo." : "Fora da faixa 25–50% citada pelo estudo — divergência entre dados e síntese, registrada."] },
    ]));
  }
  if (ps.typicalPeakHour) {
    const m = meth("M-PICO");
    const t = ps.typicalPeakHour;
    const daily = ps.completeWeekdays.map((d) => `${brDate(d.series.date as string)}: ${hh(d.peak!.hour)} (${n(d.peak!.flow)})`).join(" · ");
    const mx = mean(ps.completeWeekdays.map((d) => d.peak!.flow)) as number;
    const inWin = PEAK_WINDOWS.DIA_UTIL.some((w) => t.hour >= w.startHour && t.hour < w.endHour);
    out.push(mk("pico", "Hora de pico típica (dias úteis)", m.id, "CALCULADO", { min: mx, max: mx, approximate: false }, "veic/h", `${hh(t.hour)}–${hh(t.hour + 1)} · ${n(Math.round(mx))} veíc/h`, [
      { kind: "INDICADOR", title: "Hora de pico típica", lines: ["Hora de maior fluxo mais frequente entre os dias úteis completos, e média dos picos diários.", "Camada: CALCULADO."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(m.id) },
      { kind: "ENTRADA", title: "Pico de cada dia útil completo", lines: [srcLine, daily] },
      { kind: "FORMULA", title: "Fórmula", lines: [`Implementação (${m.status}): hora modal de argmax(q_h); média de max(q_h) por dia.`] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`${hh(t.hour)} foi o pico em ${t.count} de ${t.n} dias`, `média dos picos diários = ${n(Math.round(mx))} veíc/h`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${hh(t.hour)}–${hh(t.hour + 1)} · ${n(Math.round(mx))} veíc/h`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [inWin ? "Dentro das janelas de pico de dias úteis do estudo (07–09h, 17–19h)." : "Fora das janelas de pico de dias úteis do estudo (07–09h, 17–19h) — o comportamento observado deste segmento difere da síntese."] },
    ]));
  }
  if (ps.maxHour) {
    const m = meth("M-FLUXO-HORARIO");
    out.push(mk("fluxo-max", "Maior fluxo horário do período", m.id, "OBSERVADO", { min: ps.maxHour.flow, max: ps.maxHour.flow, approximate: false }, "veic/h", `${n(ps.maxHour.flow)} veíc/h`, [
      { kind: "INDICADOR", title: "Maior fluxo horário registrado no período", lines: ["Maior valor horário válido entre todos os dias do mês (inclui dias incompletos e fins de semana).", "Camada: OBSERVADO (valor do relatório, apenas selecionado)."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(m.id) },
      { kind: "ENTRADA", title: "Dado de entrada", lines: [srcLine, `${brDate(ps.maxHour.date)}, ${hh(ps.maxHour.hour)}–${hh(ps.maxHour.hour + 1)}`] },
      { kind: "FORMULA", title: "Fórmula", lines: ["max(q_h) sobre todas as horas válidas do período."] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`${ps.days.reduce((s, d) => s + d.validHours, 0)} horas válidas consideradas`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${n(ps.maxHour.flow)} veíc/h`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: ["Usado como régua da barra de intensidade do painel (fluxo ÷ maior fluxo histórico do segmento). Não é capacidade da via."] },
    ]));
  }
  if (ps.speedWeekday != null) {
    const m = meth("M-VELOCIDADE-MEDIA");
    out.push(mk("velocidade", "Velocidade média (dias úteis)", m.id, "CALCULADO", { min: ps.speedWeekday, max: ps.speedWeekday, approximate: false }, "km/h", `${n(ps.speedWeekday, 1)} km/h`, [
      { kind: "INDICADOR", title: "Velocidade média em dias úteis", lines: [m.description, "Camada: CALCULADO a partir das velocidades médias horárias do relatório."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(m.id) },
      { kind: "ENTRADA", title: "Dados de entrada", lines: [srcLine.replace("DOC-FLUXOS-UFRJ", "DOC-FLUXOS-UFRJ + DOC-VELOCIDADES"), `Perfil médio (dias úteis completos): ${ps.weekdayProfile.filter((p) => p.speed != null).map((p) => `${hh(p.hour)} ${n(p.speed as number, 0)}`).join(" · ")}`] },
      { kind: "FORMULA", title: "Fórmula", lines: [`Implementação (${m.status}): ${m.implementation}`] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: ["Σ(q_h · v̄_h) / Σ q_h sobre o perfil médio de dias úteis"] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${n(ps.speedWeekday, 1)} km/h`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: ["A média diária impressa no relatório coincide com a média aritmética das horas em ~86% dos dias; a ponderação pelo fluxo é escolha do sistema — pendente de validação."] },
    ]));
  }
  if (ps.v85) {
    const m = meth("M-V85");
    out.push(mk("v85", "Velocidade do 85º percentil (reportada)", m.id, "OBSERVADO", { min: ps.v85.min, max: ps.v85.max, approximate: false }, "km/h", ps.v85.constant ? `${ps.v85.median} km/h (constante)` : `${n(ps.v85.median, 0)} km/h (mediana)`, [
      { kind: "INDICADOR", title: "85º percentil da velocidade", lines: [m.description, "Camada: OBSERVADO (valor impresso por dia; não recalculado)."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: vars(m.id) },
      { kind: "ENTRADA", title: `${ps.v85.n} dias com V85 impresso`, lines: [srcLine.replace("DOC-FLUXOS-UFRJ", "DOC-VELOCIDADES"), `mín ${ps.v85.min} · máx ${ps.v85.max} km/h`] },
      { kind: "FORMULA", title: "Fórmula", lines: ["Mediana dos valores diários impressos (resumo do sistema)."] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`mediana = ${n(ps.v85.median, 1)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [`${n(ps.v85.median, 1)} km/h`] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [ps.v85.constant ? "O mesmo valor em todos os dias do mês: provavelmente um valor mensal repetido — validar." : "Valor varia por dia.", ...(ps.speedWeekday != null && ps.v85.median < ps.speedWeekday ? ["ATENÇÃO: V85 menor que a velocidade média — impossível por definição; dado da fonte suspeito."] : [])] },
    ]));
  }
  if (ps.overnight) {
    const m = meth("M-MADRUGADA");
    out.push(mk("madrugada", "Madrugada / pico (perfil médio)", m.id, "CALCULADO", { min: ps.overnight.ratio * 100, max: ps.overnight.ratio * 100, approximate: false }, "%", pct(ps.overnight.ratio), [
      { kind: "INDICADOR", title: "Fluxo de madrugada em relação ao pico", lines: [m.description, "Camada: CALCULADO sobre o perfil médio dos dias úteis completos."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: ["q̄_h: fluxo médio na hora h (dias úteis completos)"] },
      { kind: "ENTRADA", title: "Dados de entrada", lines: [srcLine, `Regra: "${RAW_SECTION2.variacaoHoraria}"`] },
      { kind: "FORMULA", title: "Fórmula", lines: [`Implementação (${m.status}): max(q̄_h, 01–05h) / max(q̄_h)`] },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: [`${hh(ps.overnight.nightHour)} ÷ ${hh(ps.overnight.peakHour)} = ${pct(ps.overnight.ratio)}`] },
      { kind: "RESULTADO", title: "Resultado", lines: [pct(ps.overnight.ratio)] },
      { kind: "INTERPRETACAO", title: "Interpretação", lines: [ps.overnight.ratio < 0.05 ? "Abaixo de 5%: consistente com o estudo." : "Acima de 5%: diverge da observação do estudo ('geralmente abaixo de 5%')."] },
    ]));
  }
  void excluded;
  return out;
}

export function segmentIndicators(s: RoadSegment, ms: Measurement[], hasPdfData = false): Indicator[] {
  const own = ms.filter((m) => m.segmentId === s.id);
  const out = own.map(transcribed);
  const vdm = own.find((m) => m.metric === "VDM_DIAS_UTEIS");
  const fds = own.find((m) => m.metric === "VOLUME_FIM_DE_SEMANA");
  if (vdm && fds) { const d = weekendDrop(s, vdm, fds); if (d) out.push(d); }
  if (!hasPdfData) {
    out.push(unavailable(s, "velocidade", "Velocidade média", "M-VELOCIDADE-MEDIA", [`Registro na matriz: "${s.speedRecordRaw}"`, "Este agrupamento da matriz não existe nos relatórios; ver os segmentos separados por sentido/pista."]));
  }
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
