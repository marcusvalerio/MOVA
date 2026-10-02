/**
 * Adaptador da base pública "Logradouros" (Data.Rio / IPP — cadastro oficial de trechos de logradouro).
 * FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS: usada só para localizar o endereço digitado e descrever a via
 * (hierarquia, mão, velocidade regulamentada). Não fornece fluxo, velocidade medida nem capacidade.
 * Serviço aberto, sem autenticação.
 */

export const LOGRADOUROS_URL = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/CadLog/Trechos_Logradouros/MapServer/0/query";
export const LOGRADOUROS_SOURCE = {
  name: "Data.Rio — Logradouros (Trechos_Logradouros, IPP/Prefeitura do Rio)",
  url: "https://datariov2-pcrj.hub.arcgis.com/",
  provenance: "FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS",
} as const;

/** Palavras que não identificam o logradouro (tipo e preposições). */
const STOP = new Set([
  "AV", "AVENIDA", "R", "RUA", "ESTR", "ESTRADA", "PCA", "PRACA", "TV", "TRAVESSA", "AL", "ALAMEDA", "ROD", "RODOVIA",
  "LGO", "LARGO", "VD", "VIADUTO", "TUN", "TUNEL", "PROX", "PROXIMO", "AO", "NUMERO", "NO", "N",
  "DA", "DAS", "DE", "DO", "DOS", "E",
]);

export interface ParsedAddress {
  /** Palavras do nome, sem acento, maiúsculas, só letras/dígitos. */
  tokens: string[];
  number: number | null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** "Av. das Américas, 2000" → { tokens: ["AMERICAS"], number: 2000 }. */
export function parseAddress(input: string): ParsedAddress {
  const words = fold(input).replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  let number: number | null = null;
  const tokens: string[] = [];
  for (const w of words) {
    if (/^\d+$/.test(w)) {
      if (number == null && w.length <= 6) number = Number(w);
      else tokens.push(w);
    } else if (!STOP.has(w)) tokens.push(w);
  }
  return { tokens, number };
}

/**
 * Padrão LIKE insensível a acento: vogais e C viram "_" (qualquer caractere), pois a base grava "Américas".
 * Só entram [A-Z0-9] (já sanitizado em parseAddress), sem risco de injeção na cláusula where.
 */
export function accentPattern(token: string) {
  return `%${token.replace(/[^A-Z0-9]/g, "").replace(/[AEIOUC]/g, "_")}%`;
}

export function buildWhere(p: ParsedAddress): string | null {
  const tokens = p.tokens.filter((t) => t.length >= 3 || /^\d+$/.test(t));
  if (!tokens.length) return null;
  const name = tokens.map((t) => `UPPER(completo) LIKE '${accentPattern(t)}'`).join(" AND ");
  if (p.number == null) return name;
  const n = Math.trunc(p.number);
  const [a, b] = sideFields(n);
  // A base grava faixas nos dois sentidos (ex.: 746→710), então aceita início ≤ n ≤ fim ou fim ≤ n ≤ início.
  return `${name} AND ((${a} <= ${n} AND ${b} >= ${n}) OR (${a} >= ${n} AND ${b} <= ${n}))`;
}

const sideFields = (n: number) => (n % 2 === 0 ? ["np_ini_par", "np_fin_par"] : ["np_ini_imp", "np_fin_imp"]) as [string, string];

/** Distância numérica entre n e a faixa [a, b] (qualquer ordem); 0 se dentro. */
export function rangeGap(n: number, r: [number, number] | null) {
  if (!r) return Infinity;
  const [lo, hi] = r[0] <= r[1] ? r : [r[1], r[0]];
  return n < lo ? lo - n : n > hi ? n - hi : 0;
}

/** Códigos do campo "oneway" da base. Apenas FT/TF/B têm significado conhecido; o resto é exibido como veio. */
export function onewayLabel(code: string | null): string {
  if (code === "FT" || code === "TF") return "mão única";
  if (code === "B") return "mão dupla";
  return code ? `código "${code}" (sem descrição na base)` : "não informado";
}

export interface Trecho {
  codTrecho: number;
  logradouro: string;
  bairro: string | null;
  hierarquia: string | null;
  mao: string;
  maoRaw: string | null;
  velocidadeRegulamentadaKmh: number | null;
  tipoTrecho: string | null;
  numeracao: { par: [number, number] | null; impar: [number, number] | null };
  /** Traçado em graus decimais (WGS84), [lng, lat]. */
  path: [number, number][];
}

type RawFeature = { attributes: Record<string, unknown>; geometry?: { paths?: number[][][] } };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const range = (a: unknown, b: unknown): [number, number] | null => (num(a) != null && num(b) != null ? [num(a)!, num(b)!] : null);

export function toTrecho(f: RawFeature): Trecho {
  const a = f.attributes;
  const maoRaw = str(a.oneway);
  return {
    codTrecho: num(a.cod_trecho) ?? -1,
    logradouro: str(a.completo) ?? "?",
    bairro: str(a.bairro),
    hierarquia: str(a.hierarquia),
    mao: onewayLabel(maoRaw),
    maoRaw,
    velocidadeRegulamentadaKmh: num(a.velocidade_regulamentada),
    tipoTrecho: str(a.tipo_trecho),
    numeracao: { par: range(a.np_ini_par, a.np_fin_par), impar: range(a.np_ini_imp, a.np_fin_imp) },
    path: (f.geometry?.paths ?? []).flat().map((pt) => [pt[0], pt[1]] as [number, number]),
  };
}

const OUT_FIELDS = "cod_trecho,completo,bairro,hierarquia,oneway,velocidade_regulamentada,tipo_trecho,np_ini_par,np_fin_par,np_ini_imp,np_fin_imp";

export type SearchResult =
  | { kind: "trechos"; parsed: ParsedAddress; trechos: Trecho[]; aproximado: string | null }
  | { kind: "logradouros"; parsed: ParsedAddress; logradouros: { logradouro: string; bairro: string | null }[] }
  | { kind: "vazio"; parsed: ParsedAddress; motivo: string };

/** Consulta a base. Com número → trechos que contêm o número; sem número → lista de logradouros para escolher. */
export async function searchLogradouros(input: string, fetchImpl: typeof fetch = fetch): Promise<SearchResult> {
  const parsed = parseAddress(input);
  const where = buildWhere(parsed);
  if (!where) return { kind: "vazio", parsed, motivo: "Digite o nome do logradouro (ex.: Av. das Américas 2000)." };
  const params = new URLSearchParams({ where, f: "json", outFields: parsed.number == null ? "completo,bairro" : OUT_FIELDS });
  if (parsed.number == null) {
    params.set("returnDistinctValues", "true");
    params.set("returnGeometry", "false");
  } else {
    params.set("outSR", "4326");
    params.set("resultRecordCount", "10");
  }
  const feats = await query(params, fetchImpl);
  if (parsed.number == null) {
    if (!feats.length) return { kind: "vazio", parsed, motivo: "Nenhum logradouro encontrado com esse nome." };
    return { kind: "logradouros", parsed, logradouros: feats.slice(0, 20).map((f) => ({ logradouro: str(f.attributes.completo) ?? "?", bairro: str(f.attributes.bairro) })) };
  }
  if (feats.length) return { kind: "trechos", parsed, trechos: feats.map(toTrecho), aproximado: null };

  // Nenhuma faixa contém o número: mostra o trecho do mesmo lado (par/ímpar) com a numeração mais próxima, avisando.
  const n = parsed.number;
  const [a] = sideFields(n);
  const name = buildWhere({ tokens: parsed.tokens, number: null })!;
  const all = await query(new URLSearchParams({ where: `${name} AND ${a} IS NOT NULL`, f: "json", outFields: OUT_FIELDS, outSR: "4326" }), fetchImpl);
  const side = (t: Trecho) => (n % 2 === 0 ? t.numeracao.par : t.numeracao.impar);
  const best = all.map(toTrecho).map((t) => ({ t, gap: rangeGap(n, side(t)) })).sort((x, y) => x.gap - y.gap)[0];
  if (!best || !Number.isFinite(best.gap)) {
    return { kind: "vazio", parsed, motivo: `Nenhum trecho numerado encontrado para o nº ${n} nesse logradouro. Vias sem numeração (ex.: Linha Vermelha) não são localizáveis por número.` };
  }
  const r = side(best.t)!;
  return { kind: "trechos", parsed, trechos: [best.t], aproximado: `O nº ${n} não está em nenhuma faixa cadastrada; mostrando o trecho com numeração mais próxima (${r[0]}–${r[1]}).` };
}

async function query(params: URLSearchParams, fetchImpl: typeof fetch): Promise<RawFeature[]> {
  const res = await fetchImpl(`${LOGRADOUROS_URL}?${params}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Logradouros respondeu ${res.status}`);
  const j = (await res.json()) as { features?: RawFeature[]; error?: { message?: string } };
  if (j.error) throw new Error(`Logradouros: ${j.error.message ?? "erro"}`);
  return j.features ?? [];
}

/** Distância geodésica (haversine), em metros. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Menor distância de um ponto ao traçado (aprox. plana local, suficiente para centenas de metros). */
export function distanceToPathM(p: { lat: number; lng: number }, path: [number, number][]) {
  if (!path.length) return Infinity;
  if (path.length === 1) return haversineM(p, { lng: path[0][0], lat: path[0][1] });
  const k = Math.cos((p.lat * Math.PI) / 180), m = 111320;
  const xy = ([lng, lat]: [number, number]) => [(lng - p.lng) * k * m, (lat - p.lat) * m];
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = xy(path[i - 1]), [bx, by] = xy(path[i]);
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
