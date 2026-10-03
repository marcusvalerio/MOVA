import type { CameraObservation } from "@/adapters/camera";
import { crossing, type Pt } from "./geometry";
import { trackClass, trackConfidence, type Track } from "./tracker";
import type { VehicleClass } from "./yolo";

/** Linha virtual em coordenadas normalizadas do quadro (0–1), com o rótulo de cada sentido. */
export type CountLine = { id: string; label: string; p1: Pt; p2: Pt; positive: string; negative: string };

export type CrossingEvent = {
  /** Segundos desde o início da contagem (relógio da sessão ou tempo do vídeo). */
  t: number;
  track: number;
  line: string;
  dir: 1 | -1;
  cls: VehicleClass;
  conf: number;
};

/** Vetor unitário que aponta para o lado positivo da linha (para onde vai quem conta como +1), em pixels. */
export function positiveNormal(l: CountLine, w: number, h: number): [number, number] {
  const dx = (l.p2[0] - l.p1[0]) * w, dy = (l.p2[1] - l.p1[1]) * h, n = Math.hypot(dx, dy) || 1;
  return [-dy / n, dx / n];
}

export const dirLabel = (l: CountLine, dir: 1 | -1) => (dir === 1 ? l.positive : l.negative);

/** Conta cada (rastro, linha) no máximo uma vez, quando o centro do rastro cruza a linha (M-CV-CONTAGEM). */
export class LineCounter {
  events: CrossingEvent[] = [];
  private counted = new Set<string>();
  constructor(public lines: CountLine[], private frameW: number, private frameH: number) {}

  update(tracks: Track[], t: number): CrossingEvent[] {
    const out: CrossingEvent[] = [];
    for (const tr of tracks) {
      if (!tr.prev) continue;
      const a: Pt = [tr.prev[0] / this.frameW, tr.prev[1] / this.frameH], b: Pt = [tr.cur[0] / this.frameW, tr.cur[1] / this.frameH];
      for (const l of this.lines) {
        const key = `${tr.id}|${l.id}`;
        if (this.counted.has(key)) continue;
        const dir = crossing(l.p1, l.p2, a, b);
        if (!dir) continue;
        this.counted.add(key);
        const e: CrossingEvent = { t, track: tr.id, line: l.id, dir, cls: trackClass(tr), conf: +trackConfidence(tr).toFixed(3) };
        this.events.push(e); out.push(e);
      }
    }
    return out;
  }
}

/** Instantes (s) em que quadros foram efetivamente analisados — para detectar lacunas de processamento. */
export type Coverage = number[];

/** Uma lacuna maior que isso (s) entre quadros analisados torna o intervalo incompleto. */
export const MAX_GAP_S = 2;

export type IntervalRow = {
  index: number;
  startS: number;
  endS: number;
  line: CountLine;
  dir: 1 | -1;
  count: number;
  byClass: Partial<Record<VehicleClass, number>>;
  meanConf: number | null;
  /** Maior intervalo sem quadro analisado dentro do intervalo, em s. */
  maxGapS: number;
  complete: boolean;
};

export function maxGap(coverage: Coverage, startS: number, endS: number): number {
  let last = startS, gap = 0;
  for (const t of coverage) {
    if (t < startS) continue;
    if (t >= endS) break;
    gap = Math.max(gap, t - last); last = t;
  }
  return Math.max(gap, endS - last);
}

/**
 * Agrega os cruzamentos em intervalos fixos de `intervalS` segundos, por linha e sentido.
 * Só entram intervalos já encerrados (endS ≤ nowS). Intervalos com lacuna > MAX_GAP_S ficam marcados como incompletos.
 */
export function aggregateIntervals(events: CrossingEvent[], lines: CountLine[], coverage: Coverage, intervalS: number, nowS: number): IntervalRow[] {
  const rows: IntervalRow[] = [];
  const n = Math.floor(nowS / intervalS);
  for (let i = 0; i < n; i++) {
    const startS = i * intervalS, endS = startS + intervalS;
    const gap = maxGap(coverage, startS, endS);
    for (const line of lines) {
      for (const dir of [1, -1] as const) {
        const ev = events.filter((e) => e.line === line.id && e.dir === dir && e.t >= startS && e.t < endS);
        const byClass: Partial<Record<VehicleClass, number>> = {};
        for (const e of ev) byClass[e.cls] = (byClass[e.cls] ?? 0) + 1;
        rows.push({
          index: i, startS, endS, line, dir, count: ev.length, byClass,
          meanConf: ev.length ? ev.reduce((s, e) => s + e.conf, 0) / ev.length : null,
          maxGapS: gap, complete: gap <= MAX_GAP_S,
        });
      }
    }
  }
  return rows;
}

/** Data/hora em America/Sao_Paulo (UTC−3, sem horário de verão desde 2019), ISO 8601 com fuso. */
export function toSaoPauloIso(ms: number): string {
  return new Date(ms - 3 * 3600000).toISOString().slice(0, 19) + "-03:00";
}

/**
 * Intervalo completo → CameraObservation (contrato de src/adapters/camera.ts).
 * `startedAtMs` = relógio do computador no início da contagem; null quando a hora real é desconhecida (arquivo de vídeo).
 */
export function toCameraObservation(r: IntervalRow, cameraId: string, startedAtMs: number | null, source: string): CameraObservation {
  return {
    cameraId: `${cameraId}:${r.line.id}`,
    timestamp: startedAtMs == null ? null : toSaoPauloIso(startedAtMs + r.startS * 1000),
    intervalSeconds: r.endS - r.startS,
    vehicleCount: r.count,
    vehicleTypes: r.byClass as Record<string, number>,
    averageSpeed: null,
    queueLength: null,
    direction: dirLabel(r.line, r.dir),
    occupancy: null,
    confidence: r.meanConf == null ? 0 : +r.meanConf.toFixed(3),
    source,
  };
}

/** Conferência: contagem manual × automática numa mesma janela de tempo. */
export type ManualCheck = {
  startS: number;
  endS: number;
  /** chave `${lineId}|${dir}` → contagem manual */
  manual: Record<string, number>;
};

export type CheckRow = { key: string; line: CountLine; dir: 1 | -1; manual: number; auto: number; diff: number; relError: number | null };

export function compareCheck(check: ManualCheck, events: CrossingEvent[], lines: CountLine[]) {
  const rows: CheckRow[] = [];
  for (const line of lines) {
    for (const dir of [1, -1] as const) {
      const key = `${line.id}|${dir}`;
      const manual = check.manual[key] ?? 0;
      const auto = events.filter((e) => e.line === line.id && e.dir === dir && e.t >= check.startS && e.t < check.endS).length;
      rows.push({ key, line, dir, manual, auto, diff: auto - manual, relError: manual > 0 ? (auto - manual) / manual : null });
    }
  }
  const manual = rows.reduce((s, r) => s + r.manual, 0), auto = rows.reduce((s, r) => s + r.auto, 0);
  /** Soma dos erros absolutos por linha/sentido: não deixa erros de sinais opostos se cancelarem. */
  const absErr = rows.reduce((s, r) => s + Math.abs(r.diff), 0);
  return {
    rows,
    total: { manual, auto, diff: auto - manual, relError: manual > 0 ? (auto - manual) / manual : null, absRelError: manual > 0 ? absErr / manual : null },
    durationS: check.endS - check.startS,
  };
}
