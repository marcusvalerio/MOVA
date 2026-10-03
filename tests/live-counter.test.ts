import { describe, expect, it } from "vitest";
import { CameraObservationSchema, processCameraObservation } from "@/adapters/camera";
import { crossing, side } from "@/live/geometry";
import { Tracker, trackClass } from "@/live/tracker";
import { cropAroundLines, decodeYolo, letterbox, nms, rgbaToChw, type Detection } from "@/live/yolo";
import {
  aggregateIntervals, compareCheck, LineCounter, maxGap, positiveNormal, toCameraObservation, toSaoPauloIso, type CountLine,
} from "@/live/counter";

const H = [[0, 10], [100, 10]] as const;
const V = [[50, 0], [50, 100]] as const;

describe("geometria — mesma regra de cv/mova_cv/geometry.py", () => {
  it("horizontal: descer = +1, subir = −1", () => {
    expect(crossing(H[0], H[1], [20, 5], [20, 15])).toBe(1);
    expect(crossing(H[0], H[1], [20, 15], [20, 5])).toBe(-1);
  });
  it("fora do segmento ou sem cruzar não conta", () => {
    expect(crossing(H[0], H[1], [120, 5], [120, 15])).toBe(0);
    expect(crossing(H[0], H[1], [20, 2], [20, 8])).toBe(0);
  });
  it("vertical: para a esquerda = +1, para a direita = −1", () => {
    expect(crossing(V[0], V[1], [60, 50], [40, 50])).toBe(1);
    expect(crossing(V[0], V[1], [40, 50], [60, 50])).toBe(-1);
  });
  it("a seta azul desenhada (positiveNormal) aponta para o lado +1", () => {
    for (const [p1, p2] of [[[0.1, 0.5], [0.9, 0.6]], [[0.7, 0.2], [0.3, 0.9]], [[0.5, 0.1], [0.5, 0.9]]] as const) {
      const l: CountLine = { id: "a", label: "a", p1, p2, positive: "+", negative: "−" };
      const [nx, ny] = positiveNormal(l, 1920, 1080);
      const m: [number, number] = [((p1[0] + p2[0]) / 2) * 1920, ((p1[1] + p2[1]) / 2) * 1080];
      const P1: [number, number] = [p1[0] * 1920, p1[1] * 1080], P2: [number, number] = [p2[0] * 1920, p2[1] * 1080];
      expect(Math.sign(side(P1, P2, [m[0] + nx, m[1] + ny]))).toBe(1);
      expect(crossing(P1, P2, [m[0] - 5 * nx, m[1] - 5 * ny], [m[0] + 5 * nx, m[1] + 5 * ny])).toBe(1);
    }
  });
});

describe("pós-processamento YOLO", () => {
  it("letterbox igual ao do Ultralytics (1280×720 → 640×360, borda 140)", () => {
    expect(letterbox(1280, 720, 640)).toMatchObject({ w: 640, h: 360, padX: 0, padY: 140 });
  });
  it("RGBA → CHW normalizado", () => {
    const t = rgbaToChw(new Uint8Array([255, 0, 51, 255, 0, 255, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]), 2);
    expect(Array.from(t.slice(0, 2))).toEqual([1, 0]);
    expect(Array.from(t.slice(4, 6))).toEqual([0, 1]);
    expect(t[8]).toBeCloseTo(0.2);
  });
  it("decodifica caixa, classe veicular e volta às coordenadas do quadro (com recorte)", () => {
    const N = 3, out = new Float32Array(84 * N);
    const put = (a: number, cx: number, cy: number, w: number, h: number, cls: number, p: number) => {
      out[a] = cx; out[N + a] = cy; out[2 * N + a] = w; out[3 * N + a] = h; out[(4 + cls) * N + a] = p;
    };
    put(0, 320, 320, 64, 32, 2, 0.9);  // carro
    put(1, 100, 300, 20, 20, 0, 0.99); // pessoa: ignorada
    put(2, 400, 330, 40, 40, 7, 0.1);  // caminhão abaixo da confiança
    const crop = { x: 100, y: 50, w: 1280, h: 720 }, lb = letterbox(crop.w, crop.h, 640);
    const d = decodeYolo(out, N, lb, crop, { conf: 0.25, iou: 0.6 });
    expect(d).toHaveLength(1);
    expect(d[0].cls).toBe("carro");
    // centro (320,320) no letterbox → (640, 360) no recorte → (740, 410) no quadro
    expect((d[0].x1 + d[0].x2) / 2).toBeCloseTo(740);
    expect((d[0].y1 + d[0].y2) / 2).toBeCloseTo(410);
    expect(d[0].x2 - d[0].x1).toBeCloseTo(128);
  });
  it("NMS sem classe: carro e caminhão sobre o mesmo veículo viram uma detecção", () => {
    const a: Detection = { x1: 0, y1: 0, x2: 10, y2: 10, cls: "carro", conf: 0.8 };
    const b: Detection = { x1: 1, y1: 0, x2: 11, y2: 10, cls: "caminhao", conf: 0.5 };
    const c: Detection = { x1: 50, y1: 50, x2: 60, y2: 60, cls: "carro", conf: 0.4 };
    expect(nms([b, a, c], 0.6)).toEqual([a, c]);
  });
  it("recorte em volta das linhas: contém as linhas, respeita o quadro e o tamanho mínimo", () => {
    const r = cropAroundLines([{ p1: [0.4, 0.8], p2: [0.6, 0.8] }], 1920, 1080);
    expect(r.x).toBeLessThan(0.4 * 1920); expect(r.x + r.w).toBeGreaterThan(0.6 * 1920);
    expect(r.y + r.h).toBeLessThanOrEqual(1080); expect(r.h).toBeGreaterThanOrEqual(320);
    expect(cropAroundLines([], 640, 480)).toEqual({ x: 0, y: 0, w: 640, h: 480 });
  });
});

const car = (cx: number, cy: number, conf = 0.8, cls: Detection["cls"] = "carro"): Detection => ({ x1: cx - 20, y1: cy - 10, x2: cx + 20, y2: cy + 10, cls, conf });

describe("rastreamento", () => {
  it("mantém o ID de um veículo que anda entre quadros e separa veículos distintos", () => {
    const tr = new Tracker();
    for (let i = 0; i < 10; i++) tr.update([car(100, 50 + 15 * i), car(400, 400 - 15 * i)], i / 10);
    expect(tr.tracks.map((t) => t.id)).toEqual([1, 2]);
    expect(tr.tracks[0].hits).toBe(10);
  });
  it("com poucos quadros/s (sem sobreposição) associa pela previsão de movimento", () => {
    const tr = new Tracker();
    for (let i = 0; i < 6; i++) tr.update([car(100 + 45 * i, 200)], i / 3); // desloca mais que a largura (40 px)
    expect(tr.tracks).toHaveLength(1);
  });
  it("detecção fraca continua um rastro, mas não cria rastro novo", () => {
    const tr = new Tracker();
    tr.update([car(100, 100)], 0);
    tr.update([car(100, 110, 0.2), car(500, 500, 0.2)], 0.1);
    expect(tr.tracks).toHaveLength(1);
    expect(tr.tracks[0].hits).toBe(2);
  });
  it("rastro some após maxAgeS sem associação", () => {
    const tr = new Tracker();
    tr.update([car(100, 100)], 0);
    tr.update([], 2);
    expect(tr.tracks).toHaveLength(0);
  });
  it("classe do rastro = maior soma de confiança", () => {
    const tr = new Tracker();
    tr.update([car(100, 100, 0.5, "caminhao")], 0);
    tr.update([car(100, 105, 0.6, "carro")], 0.1);
    tr.update([car(100, 110, 0.7, "carro")], 0.2);
    expect(trackClass(tr.tracks[0])).toBe("carro");
  });
});

const LINE: CountLine = { id: "L1", label: "Centrais", p1: [0, 0.5], p2: [1, 0.5], positive: "Sul", negative: "Norte" };

describe("contagem por linha", () => {
  it("conta uma vez por veículo e linha, com o sentido certo", () => {
    const tr = new Tracker(), c = new LineCounter([LINE], 1000, 1000);
    // A desce (Sul, +1) e oscila sobre a linha; B sobe (Norte, −1)
    const ya = [440, 470, 497, 503, 498, 520, 560], yb = [600, 570, 540, 510, 480, 450, 420];
    for (let i = 0; i < ya.length; i++) c.update(tr.update([car(200, ya[i]), car(700, yb[i])], i / 10), i / 10);
    expect(c.events.map((e) => [e.track, e.dir])).toEqual([[1, 1], [2, -1]]);
  });
  it("veículo parado antes da linha não conta", () => {
    const tr = new Tracker(), c = new LineCounter([LINE], 1000, 1000);
    for (let i = 0; i < 20; i++) c.update(tr.update([car(200, 480)], i / 10), i / 10);
    expect(c.events).toHaveLength(0);
  });
});

const ev = (t: number, dir: 1 | -1, cls: Detection["cls"] = "carro", track = Math.round(t * 100)) => ({ t, track, line: "L1", dir, cls, conf: 0.6 });

describe("agregação por intervalo e CameraObservation", () => {
  const coverage = Array.from({ length: 1300 }, (_, i) => i * 0.1); // 0–130 s a 10 q/s
  it("só intervalos encerrados; lacuna > 2 s → incompleto", () => {
    const events = [ev(5, 1), ev(30, 1, "moto"), ev(59.9, -1), ev(61, 1), ev(125, 1)];
    const rows = aggregateIntervals(events, [LINE], coverage, 60, 130);
    expect(rows.map((r) => [r.index, r.dir, r.count])).toEqual([[0, 1, 2], [0, -1, 1], [1, 1, 1], [1, -1, 0]]);
    expect(rows[0].byClass).toEqual({ carro: 1, moto: 1 });
    expect(rows.every((r) => r.complete)).toBe(true);
    const gappy = coverage.filter((t) => t < 70 || t > 75);
    expect(aggregateIntervals(events, [LINE], gappy, 60, 130).filter((r) => !r.complete).map((r) => r.index)).toEqual([1, 1]);
    expect(maxGap(gappy, 60, 120)).toBeCloseTo(5.2, 5);
  });
  it("intervalo vira CameraObservation válida e o motor calcula q = n · 60 / Δt", () => {
    const rows = aggregateIntervals([ev(5, 1), ev(30, 1, "moto")], [LINE], coverage, 60, 130);
    const start = Date.UTC(2026, 9, 3, 17, 30, 0); // 14:30 em São Paulo
    const o = toCameraObservation(rows[0], "BR101", start, "teste");
    expect(CameraObservationSchema.safeParse(o).success).toBe(true);
    expect(o).toMatchObject({ cameraId: "BR101:L1", timestamp: "2026-10-03T14:30:00-03:00", intervalSeconds: 60, vehicleCount: 2, direction: "Sul", vehicleTypes: { carro: 1, moto: 1 } });
    const p = processCameraObservation(o);
    expect(p.calculado.equivalentHourlyFlow).toBe(120);
    expect(p.trafficObservation.dayType).toBe("SABADO");
    expect(p.interpretado.condition).toBe("INDETERMINADO");
  });
  it("arquivo sem horário: timestamp null (não inventado); intervalo sem veículos tem confiança 0", () => {
    const rows = aggregateIntervals([], [LINE], coverage, 60, 61);
    const o = toCameraObservation(rows[0], "ARQ", null, "teste");
    expect(o.timestamp).toBeNull();
    expect(o.confidence).toBe(0);
    expect(CameraObservationSchema.safeParse(o).success).toBe(true);
  });
  it("hora de São Paulo com fuso explícito", () => {
    expect(toSaoPauloIso(Date.UTC(2026, 0, 1, 2, 5, 9))).toBe("2025-12-31T23:05:09-03:00");
  });
});

describe("conferência manual (M-CV-CONFERENCIA)", () => {
  it("compara na mesma janela e não deixa erros opostos se anularem no erro absoluto", () => {
    const events = [ev(5, 1), ev(12, 1), ev(15, 1), ev(16, -1), ev(40, 1)];
    const r = compareCheck({ startS: 10, endS: 30, manual: { "L1|1": 1, "L1|-1": 2 } }, events, [LINE]);
    expect(r.rows.map((x) => [x.manual, x.auto, x.diff])).toEqual([[1, 2, 1], [2, 1, -1]]);
    expect(r.total).toMatchObject({ manual: 3, auto: 3, diff: 0, relError: 0 });
    expect(r.total.absRelError).toBeCloseTo(2 / 3);
    expect(r.durationS).toBe(20);
  });
  it("sem contagem manual o erro é indefinido", () => {
    const r = compareCheck({ startS: 0, endS: 10, manual: {} }, [ev(5, 1)], [LINE]);
    expect(r.rows[0].relError).toBeNull();
    expect(r.total.relError).toBeNull();
  });
});
