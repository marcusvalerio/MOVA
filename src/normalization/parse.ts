import type { NumericRange, TimeWindow, Unit } from "@/domain/types";

/**
 * NORMALIZATION — conversão de texto bruto em estruturas tipadas.
 * Regras de parsing (todas determinísticas, sem inferência de valores):
 *  - separador de milhar pt-BR "." é removido ("22.000" → 22000);
 *  - "~" indica valor aproximado;
 *  - "–" ou "-" separa mínimo e máximo;
 *  - "veg/" é tratado como grafia de "veíc/" (ver regra de qualidade UNIDADE_GRAFIA).
 */

const NUM = String.raw`\d{1,3}(?:\.\d{3})*|\d+`;
const RANGE_RE = new RegExp(String.raw`(~)?\s*(${NUM})\s*(?:[–-]\s*(${NUM}))?\s*(ve[ií]c|veg)\s*\/\s*(dia|h)`, "i");

export interface ParsedQuantity {
  value: NumericRange;
  unit: Unit;
  rawUnit: string;
}

export function parsePtNumber(s: string): number {
  return Number(s.replace(/\./g, ""));
}

export function parseQuantity(text: string): ParsedQuantity | null {
  const m = RANGE_RE.exec(text);
  if (!m) return null;
  const min = parsePtNumber(m[2]);
  const max = m[3] ? parsePtNumber(m[3]) : min;
  const rawUnit = `${m[4]}/${m[5]}`;
  return {
    value: { min, max, approximate: Boolean(m[1]) },
    unit: m[5].toLowerCase() === "dia" ? "veic/dia" : "veic/h",
    rawUnit,
  };
}

/** "08h–09h / 11h–12h (...)" → [{08:00-09:00},{11:00-12:00}] */
export function parseWindows(text: string): TimeWindow[] {
  const re = /(\d{1,2})h\s*[–-]\s*(\d{1,2})h/g;
  const out: TimeWindow[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: `${m[1].padStart(2, "0")}:00`, end: `${m[2].padStart(2, "0")}:00` });
  }
  return out;
}

/** Qualificador textual entre parênteses que não contém a quantidade. Ex.: "(Central)". */
export function parseQualifier(text: string): string | null {
  const groups = [...text.matchAll(/\(([^)]*)\)/g)].map((g) => g[1].trim());
  const q = groups.find((g) => !RANGE_RE.test(g));
  return q ?? null;
}

/** Extrai número de faixas apenas quando explícito ("3 Faixas", "(4 Faixas)"). */
export function parseLaneCount(text: string): number | null {
  const m = /(\d+)\s*Faixas?\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function formatRange(r: NumericRange | null, unit: Unit | null): string {
  if (!r) return "—";
  const f = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const body = r.min === r.max ? f(r.min) : `${f(r.min)}–${f(r.max)}`;
  return `${r.approximate ? "~" : ""}${body}${unit ? ` ${unitLabel(unit)}` : ""}`;
}

export function unitLabel(u: Unit): string {
  return (
    { "veic/dia": "veíc/dia", "veic/h": "veíc/h", veic: "veíc", "km/h": "km/h", "%": "%", m: "m", adimensional: "" } as const
  )[u];
}
