import { iou, type Box, type Detection, type VehicleClass } from "./yolo";

/**
 * Rastreador simplificado (inspirado no ByteTrack): associa primeiro as detecções de alta confiança e
 * depois as de baixa confiança aos rastros existentes. Custo = IoU com a caixa prevista (posição + velocidade);
 * se não houver sobreposição — comum com poucos quadros por segundo — usa a distância entre centros,
 * limitada a uma fração do tamanho do veículo.
 */
export type Track = {
  id: number;
  box: Box;
  /** Centro na associação anterior e na atual (pixels do quadro). */
  prev: [number, number] | null;
  cur: [number, number];
  /** Velocidade do centro em pixels por segundo. */
  v: [number, number];
  lastT: number;
  hits: number;
  misses: number;
  votes: Partial<Record<VehicleClass, number>>;
  confSum: number;
};

export type TrackerOptions = {
  highConf: number;
  /** Detecções abaixo de highConf só continuam rastros; não criam novos. */
  minIou: number;
  /** Distância máxima entre centros, em múltiplos do maior lado da caixa. */
  maxDistFactor: number;
  /** Rastro sem associação por mais que isso (s) é encerrado. */
  maxAgeS: number;
};

export const DEFAULT_TRACKER: TrackerOptions = { highConf: 0.4, minIou: 0.1, maxDistFactor: 1.2, maxAgeS: 1.5 };

const center = (b: Box): [number, number] => [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];

export class Tracker {
  tracks: Track[] = [];
  private nextId = 1;
  constructor(readonly opts: TrackerOptions = DEFAULT_TRACKER) {}

  /** Atualiza com as detecções do quadro no instante t (s). Retorna os rastros associados neste quadro. */
  update(dets: Detection[], t: number): Track[] {
    const o = this.opts;
    this.tracks = this.tracks.filter((tr) => t - tr.lastT <= o.maxAgeS);
    const high = dets.filter((d) => d.conf >= o.highConf), low = dets.filter((d) => d.conf < o.highConf);
    const free = new Set(this.tracks);
    const updated: Track[] = [];

    for (const group of [high, low]) {
      const pairs: { tr: Track; d: Detection; cost: number }[] = [];
      for (const tr of free) {
        const dt = t - tr.lastT;
        const dx = tr.v[0] * dt, dy = tr.v[1] * dt;
        const pred: Box = { x1: tr.box.x1 + dx, y1: tr.box.y1 + dy, x2: tr.box.x2 + dx, y2: tr.box.y2 + dy };
        const pc = center(pred), size = Math.max(pred.x2 - pred.x1, pred.y2 - pred.y1, 1);
        for (const d of group) {
          const ov = iou(pred, d);
          if (ov >= o.minIou) { pairs.push({ tr, d, cost: 1 - ov }); continue; }
          const dc = center(d), dist = Math.hypot(dc[0] - pc[0], dc[1] - pc[1]);
          if (dist <= o.maxDistFactor * size) pairs.push({ tr, d, cost: 1 + dist / size });
        }
      }
      pairs.sort((a, b) => a.cost - b.cost);
      const usedD = new Set<Detection>();
      for (const { tr, d } of pairs) {
        if (!free.has(tr) || usedD.has(d)) continue;
        free.delete(tr); usedD.add(d);
        const c = center(d), dt = Math.max(t - tr.lastT, 1e-3);
        const nv: [number, number] = [(c[0] - tr.cur[0]) / dt, (c[1] - tr.cur[1]) / dt];
        tr.v = tr.hits === 1 ? nv : [0.6 * tr.v[0] + 0.4 * nv[0], 0.6 * tr.v[1] + 0.4 * nv[1]];
        tr.prev = tr.cur; tr.cur = c; tr.box = { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 };
        tr.lastT = t; tr.hits++; tr.misses = 0;
        tr.votes[d.cls] = (tr.votes[d.cls] ?? 0) + d.conf; tr.confSum += d.conf;
        updated.push(tr);
      }
      if (group === high) {
        for (const d of high) {
          if (usedD.has(d)) continue;
          const tr: Track = { id: this.nextId++, box: { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 }, prev: null, cur: center(d), v: [0, 0], lastT: t, hits: 1, misses: 0, votes: { [d.cls]: d.conf }, confSum: d.conf };
          this.tracks.push(tr);
          updated.push(tr);
        }
      }
    }
    for (const tr of free) tr.misses++;
    return updated;
  }
}

/** Classe do rastro = classe com maior soma de confiança ao longo do rastro. */
export function trackClass(tr: Track): VehicleClass {
  let best: VehicleClass = "carro", s = -1;
  for (const [k, v] of Object.entries(tr.votes) as [VehicleClass, number][]) if (v > s) { s = v; best = k; }
  return best;
}

export const trackConfidence = (tr: Track) => tr.confSum / tr.hits;
