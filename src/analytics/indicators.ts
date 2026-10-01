import type { Approach, Indicator, Measurement, MeasurementMetric, TraceStep } from "@/domain/types";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";
import { weekendDropCheck } from "@/engine/intervals";
import { classifyCondition } from "@/engine/series";
import { CONDITION_CONFIG } from "@/methodology/condition-config";
import { getMethodology } from "@/methodology/registry";
import { formatRange } from "@/normalization/parse";
import { metricColumn } from "@/normalization/normalize-matrix";

/**
 * ANALYTICS — indicadores derivados por aproximação, cada um com sua trilha
 * Indicador → Variáveis → Entradas → Fórmula → Intermediário → Resultado → Interpretação.
 */

const METRIC_INFO: Record<MeasurementMetric, { key: string; name: string; methodologyId: string; period: string }> = {
  VDM_DIAS_UTEIS: { key: "vdm", name: "VDM — dias úteis", methodologyId: "M-VDM", period: "Dias úteis (período não especificado na fonte)" },
  VOLUME_FIM_DE_SEMANA: { key: "vol-fds", name: "Volume diário — fins de semana", methodologyId: "M-VOL-FDS", period: "Sábados e domingos (período não especificado)" },
  PICO_MANHA: { key: "pico-manha", name: "Pico da manhã", methodologyId: "M-PICO", period: "Manhã" },
  PICO_TARDE_NOITE: { key: "pico-tarde", name: "Pico da tarde/noite", methodologyId: "M-PICO", period: "Tarde/noite" },
};

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;

function sourceLine(m: Measurement) {
  return `${m.source.documentId} · ${m.source.section} · ${m.source.locator}`;
}

function transcribed(m: Measurement): Indicator {
  const info = METRIC_INFO[m.metric];
  const meth = getMethodology(info.methodologyId);
  const windows = m.windows.map((w) => `${w.start}–${w.end}`).join(" e ");
  const display = formatRange(m.value, m.unit);
  const trace: TraceStep[] = [
    { kind: "INDICADOR", title: info.name, lines: [meth.description, `Origem do valor: OBSERVADO NA FONTE (transcrição, sem cálculo).`] },
    { kind: "VARIAVEIS", title: "Variáveis", lines: meth.variables.map((v) => `${v.symbol}: ${v.meaning} [${v.unit}]`) },
    { kind: "ENTRADA", title: "Dado de entrada (texto literal)", lines: [`"${m.raw}"`, sourceLine(m)] },
    { kind: "FORMULA", title: "Fórmula", lines: ["A fonte não apresenta fórmula para este valor.", "Procedimento do sistema: transcrição + normalização (remoção do separador de milhar, leitura de '~' e de mínimo–máximo)."] },
    {
      kind: "INTERMEDIARIO",
      title: "Normalização",
      lines: [
        `mín = ${m.value?.min ?? "—"} · máx = ${m.value?.max ?? "—"} · aproximado = ${m.value?.approximate ? "sim" : "não"}`,
        `unidade na fonte = "${m.rawUnit ?? "—"}" → unidade normalizada = ${m.unit ?? "—"}`,
        ...(windows ? [`janela(s) horária(s) = ${windows}`] : []),
        ...(m.qualifier ? [`qualificador na fonte = "${m.qualifier}"`] : []),
      ],
    },
    { kind: "RESULTADO", title: "Resultado", lines: [display + (windows ? ` · ${windows}` : "")] },
    { kind: "INTERPRETACAO", title: "Interpretação", lines: [meth.purpose, `Status metodológico: ${meth.status}.`] },
  ];
  return {
    id: m.id,
    key: info.key,
    name: info.name,
    approachId: m.approachId,
    origin: "OBSERVADO_NA_FONTE",
    value: m.value,
    unit: m.unit,
    display: display + (windows ? ` · ${windows}` : ""),
    period: info.period,
    methodologyId: info.methodologyId,
    sourceKind: "HISTORICO",
    trace,
  };
}

function weekendDrop(a: Approach, vdm: Measurement, fds: Measurement): Indicator | null {
  if (!vdm.value || !fds.value) return null;
  const chk = weekendDropCheck(vdm.value, fds.value);
  const meth = getMethodology("M-QUEDA-FDS");
  const display = `${pct(chk.drop.min)} a ${pct(chk.drop.max)}`;
  return {
    id: `${a.id}--QUEDA_FDS`,
    key: "queda-fds",
    name: "Queda fim de semana × dias úteis",
    approachId: a.id,
    origin: "CALCULADO",
    value: { min: chk.drop.min * 100, max: chk.drop.max * 100, approximate: true },
    unit: "%",
    display,
    period: "Fim de semana vs. dias úteis",
    methodologyId: meth.id,
    sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: "Queda do volume nos fins de semana", lines: [meth.description, "Origem do valor: CALCULADO pelo sistema a partir de dois valores observados na fonte."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: meth.variables.map((v) => `${v.symbol}: ${v.meaning} [${v.unit}]`) },
      { kind: "ENTRADA", title: "Dados de entrada", lines: [`VDM: "${vdm.raw}" (${sourceLine(vdm)})`, `Fim de semana: "${fds.raw}" (${sourceLine(fds)})`, `Regra: "${RAW_SECTION2.variacaoSemanal}"`] },
      { kind: "FORMULA", title: "Fórmula", lines: ["A fonte não apresenta fórmula; apresenta a regra '25% a 50%'.", `Implementação do sistema (${meth.status}): ${meth.implementation}`] },
      {
        kind: "INTERMEDIARIO",
        title: "Cálculo",
        lines: [
          `queda_mín = 1 − ${fds.value.max} / ${vdm.value.min} = ${pct(chk.drop.min)}`,
          `queda_máx = 1 − ${fds.value.min} / ${vdm.value.max} = ${pct(chk.drop.max)}`,
        ],
      },
      { kind: "RESULTADO", title: "Resultado", lines: [`Queda compatível com as faixas: ${display}`, `Intersecta 25–50%? ${chk.compatible ? "SIM" : "NÃO"}`] },
      {
        kind: "INTERPRETACAO",
        title: "Interpretação",
        lines: [
          chk.compatible
            ? "As faixas da matriz são compatíveis com a regra de variação semanal da Seção 2.B."
            : "As faixas da matriz NÃO são compatíveis com a regra da Seção 2.B — registrar como inconsistência a validar.",
          chk.drop.min < 0 ? "O intervalo inclui valores negativos porque as faixas de dias úteis e de fim de semana se sobrepõem; a verificação é pouco conclusiva." : "",
        ].filter(Boolean),
      },
    ],
  };
}

function unavailable(a: Approach, key: string, name: string, methodologyId: string, reason: string[]): Indicator {
  const meth = getMethodology(methodologyId);
  return {
    id: `${a.id}--${key.toUpperCase()}`,
    key,
    name,
    approachId: a.id,
    origin: "INDISPONIVEL",
    value: null,
    unit: meth.unit,
    display: "Sem dado",
    period: "—",
    methodologyId,
    sourceKind: "HISTORICO",
    trace: [
      { kind: "INDICADOR", title: name, lines: [meth.description, "Origem do valor: INDISPONÍVEL."] },
      { kind: "VARIAVEIS", title: "Variáveis", lines: meth.variables.map((v) => `${v.symbol}: ${v.meaning} [${v.unit}]`) },
      { kind: "ENTRADA", title: "Dados de entrada", lines: reason },
      { kind: "FORMULA", title: "Fórmula", lines: [meth.formula ?? "Não documentada na fonte.", meth.externalSource ?? ""].filter(Boolean) },
      { kind: "INTERMEDIARIO", title: "Cálculo", lines: ["Não executado."] },
      { kind: "RESULTADO", title: "Resultado", lines: ["Sem dado"] },
      { kind: "INTERPRETACAO", title: "Lacunas", lines: meth.gaps },
    ],
  };
}

export function qualitativeAssessments(a: Approach): string[] {
  const row = Number(a.id.split("--r")[1]);
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

export function buildIndicators(approaches: Approach[], measurements: Measurement[]): Indicator[] {
  const out: Indicator[] = [];
  for (const a of approaches) {
    const ms = measurements.filter((m) => m.approachId === a.id);
    ms.forEach((m) => out.push(transcribed(m)));
    const vdm = ms.find((m) => m.metric === "VDM_DIAS_UTEIS");
    const fds = ms.find((m) => m.metric === "VOLUME_FIM_DE_SEMANA");
    if (vdm && fds) {
      const d = weekendDrop(a, vdm, fds);
      if (d) out.push(d);
    }
    out.push(
      unavailable(a, "velocidade", "Velocidade média", "M-VELOCIDADE", [`Registro de velocidades na fonte: "${a.speedRecordRaw}"`, "Nenhum valor numérico disponível."]),
    );
    out.push(
      unavailable(a, "saturacao", "Grau de saturação (v/c)", "M-SATURACAO", ["Capacidade (c) não definida na fonte para esta aproximação.", `Faixas: "${a.lanesRaw}"`]),
    );
    const level = classifyCondition(null, CONDITION_CONFIG.thresholds);
    const cond = unavailable(a, "condicao", "Condição operacional", "M-CONDICAO", [
      `Indicador-base: ${CONDITION_CONFIG.baseIndicator ?? "não definido"}`,
      CONDITION_CONFIG.note,
      ...qualitativeAssessments(a).map((t) => `Avaliação qualitativa da fonte (não calculada): "${t}"`),
    ]);
    cond.display = level;
    out.push(cond);
  }
  return out;
}

export { metricColumn };
