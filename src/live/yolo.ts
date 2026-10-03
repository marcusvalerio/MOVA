/**
 * Pré e pós-processamento do YOLO11 exportado para ONNX (saída [1, 4 + 80, N], caixas cx, cy, w, h
 * no espaço da entrada letterbox). Sem dependências: roda no navegador e nos testes.
 */

/** Classes COCO usadas na contagem (mesmo mapeamento de cv/demo/config.json). */
export const VEHICLE_CLASSES: Record<number, VehicleClass> = { 2: "carro", 3: "moto", 5: "onibus", 7: "caminhao" };
export type VehicleClass = "carro" | "moto" | "onibus" | "caminhao";
export const VEHICLE_CLASS_LABEL: Record<VehicleClass, string> = { carro: "carro", moto: "moto", onibus: "ônibus", caminhao: "caminhão" };

export type Box = { x1: number; y1: number; x2: number; y2: number };
export type Detection = Box & { cls: VehicleClass; conf: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Redimensiona mantendo a proporção e centraliza com bordas (como o letterbox do Ultralytics). */
export function letterbox(srcW: number, srcH: number, size: number) {
  const scale = Math.min(size / srcW, size / srcH);
  const w = Math.round(srcW * scale), h = Math.round(srcH * scale);
  const padX = Math.max(0, Math.round((size - w) / 2 - 0.1)), padY = Math.max(0, Math.round((size - h) / 2 - 0.1));
  return { scale, w, h, padX, padY, size };
}
export type Letterbox = ReturnType<typeof letterbox>;

/** RGBA (ImageData do quadro letterbox) → tensor float32 CHW normalizado em [0, 1]. */
export function rgbaToChw(rgba: Uint8ClampedArray | Uint8Array, size: number, out: Float32Array<ArrayBuffer> = new Float32Array(3 * size * size)): Float32Array<ArrayBuffer> {
  const n = size * size;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = rgba[j] / 255;
    out[n + i] = rgba[j + 1] / 255;
    out[2 * n + i] = rgba[j + 2] / 255;
  }
  return out;
}

export function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const u = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return u > 0 ? inter / u : 0;
}

/** NMS sem distinção de classe: um veículo não pode ser "carro" e "caminhão" ao mesmo tempo. */
export function nms(dets: Detection[], iouThr: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.conf - a.conf);
  const keep: Detection[] = [];
  for (const d of sorted) if (keep.every((k) => iou(k, d) < iouThr)) keep.push(d);
  return keep;
}

/**
 * Decodifica a saída do YOLO em caixas no sistema de coordenadas do quadro original.
 * `crop` é a região do quadro que foi enviada ao modelo (recorte em torno das linhas).
 */
export function decodeYolo(
  out: Float32Array,
  numAnchors: number,
  lb: Letterbox,
  crop: Rect,
  opts: { conf: number; iou: number; classes?: Record<number, VehicleClass> },
): Detection[] {
  const classes = opts.classes ?? VEHICLE_CLASSES;
  const ids = Object.keys(classes).map(Number);
  const dets: Detection[] = [];
  for (let a = 0; a < numAnchors; a++) {
    let best = -1, bestConf = opts.conf;
    for (const c of ids) {
      const s = out[(4 + c) * numAnchors + a];
      if (s >= bestConf) { bestConf = s; best = c; }
    }
    if (best < 0) continue;
    const cx = out[a], cy = out[numAnchors + a], w = out[2 * numAnchors + a], h = out[3 * numAnchors + a];
    const toX = (x: number) => Math.min(crop.w, Math.max(0, (x - lb.padX) / lb.scale)) + crop.x;
    const toY = (y: number) => Math.min(crop.h, Math.max(0, (y - lb.padY) / lb.scale)) + crop.y;
    dets.push({ x1: toX(cx - w / 2), y1: toY(cy - h / 2), x2: toX(cx + w / 2), y2: toY(cy + h / 2), cls: classes[best], conf: bestConf });
  }
  return nms(dets, opts.iou);
}

/**
 * Região analisada: retângulo que envolve as linhas, ampliado por uma margem, com tamanho mínimo.
 * Mandar só essa região ao modelo aumenta a resolução efetiva dos veículos perto das linhas.
 */
export function cropAroundLines(lines: { p1: readonly [number, number]; p2: readonly [number, number] }[], frameW: number, frameH: number, margin = 0.6, minSide = 320): Rect {
  if (!lines.length) return { x: 0, y: 0, w: frameW, h: frameH };
  const xs = lines.flatMap((l) => [l.p1[0] * frameW, l.p2[0] * frameW]);
  const ys = lines.flatMap((l) => [l.p1[1] * frameH, l.p2[1] * frameH]);
  let x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const side = Math.max(x2 - x1, y2 - y1, minSide);
  const mx = Math.max(margin * side, (minSide - (x2 - x1)) / 2), my = Math.max(margin * side, (minSide - (y2 - y1)) / 2);
  x1 = Math.max(0, Math.floor(x1 - mx)); x2 = Math.min(frameW, Math.ceil(x2 + mx));
  y1 = Math.max(0, Math.floor(y1 - my)); y2 = Math.min(frameH, Math.ceil(y2 + my));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
