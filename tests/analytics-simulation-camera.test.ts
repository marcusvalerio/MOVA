import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/repository";
import { METHODOLOGY } from "@/methodology/registry";
import { runSimulation } from "@/simulation/run";
import { simulateDay } from "@/simulation/generator";
import { CameraObservationSchema, toTrafficObservation } from "@/adapters/camera";

const r = createInMemoryRepository();

describe("indicadores e rastreabilidade", () => {
  it("cada aproximação tem 8 indicadores", () => {
    for (const a of r.approaches()) expect(r.indicators(a.id)).toHaveLength(8);
  });
  it("toda trilha tem os 7 passos na ordem", () => {
    for (const i of r.indicators()) {
      expect(i.trace.map((t) => t.kind)).toEqual(["INDICADOR", "VARIAVEIS", "ENTRADA", "FORMULA", "INTERMEDIARIO", "RESULTADO", "INTERPRETACAO"]);
    }
  });
  it("toda metodologia referenciada existe", () => {
    const ids = new Set(METHODOLOGY.map((m) => m.id));
    for (const i of r.indicators()) expect(ids.has(i.methodologyId)).toBe(true);
  });
  it("nenhum indicador histórico é SIMULADO", () => {
    expect(r.indicators().some((i) => i.origin === "SIMULADO")).toBe(false);
  });
  it("valores transcritos não são alterados", () => {
    expect(r.indicator("linha-vermelha-km-5-5--r7--PICO_MANHA")?.display).toBe("~3.500–4.100 veíc/h · 06:00–08:00");
  });
  it("condição operacional permanece INDETERMINADO", () => {
    expect(r.indicators().filter((i) => i.key === "condicao").every((i) => i.display === "INDETERMINADO")).toBe(true);
  });
  it("velocidade indisponível em todo o histórico", () => {
    expect(r.indicators().filter((i) => i.key === "velocidade").every((i) => i.origin === "INDISPONIVEL")).toBe(true);
  });
  it("queda fds — valor conhecido linha 2", () => {
    const q = r.indicator("av-americas-2000--r2--QUEDA_FDS")!;
    expect(q.value!.min).toBeCloseTo((1 - 35000 / 38000) * 100);
    expect(q.value!.max).toBeCloseTo((1 - 20000 / 44000) * 100);
  });
  it("nenhuma metodologia sem fonte é CONFIRMADA", () => {
    for (const m of METHODOLOGY) if (m.status === "CONFIRMADO") expect(m.sources.length).toBeGreaterThan(0);
  });
});

describe("simulação", () => {
  const a = r.approach("linha-vermelha-km-5-5--r7")!;
  it("é determinística por semente", () => {
    expect(simulateDay(a, r.measurements(a.id), 7).observations).toEqual(simulateDay(a, r.measurements(a.id), 7).observations);
  });
  it("todas as observações são marcadas SIMULACAO", () => {
    expect(simulateDay(a, r.measurements(a.id), 1).observations.every((o) => o.source === "SIMULACAO")).toBe(true);
  });
  it("passa pelo motor e respeita a regra de madrugada (< 5%)", () => {
    const res = runSimulation(r, a.id, 42)!;
    expect(res.hourly.every((h) => h.flow != null)).toBe(true);
    expect(res.daily).toBeGreaterThan(0);
    expect(res.overnight!.belowRule).toBe(true);
    expect(res.peak!.hour).toBeGreaterThanOrEqual(6);
  });
  it("aproximação inexistente → null", () => {
    expect(runSimulation(r, "nao-existe", 1)).toBeNull();
  });
});

describe("adaptador de câmera", () => {
  const payload = { cameraId: "CAM-1", timestamp: "2026-01-05T07:00:00-03:00", intervalSeconds: 900, vehicleCount: 120, vehicleTypes: { car: 100, bus: 20 }, averageSpeed: 35.5, queueLength: null, direction: "Santa Cruz", occupancy: 0.4, confidence: 0.9, source: "teste" };
  it("valida payload correto", () => expect(CameraObservationSchema.safeParse(payload).success).toBe(true));
  it("rejeita contagem negativa e confiança > 1", () => {
    expect(CameraObservationSchema.safeParse({ ...payload, vehicleCount: -1 }).success).toBe(false);
    expect(CameraObservationSchema.safeParse({ ...payload, confidence: 1.5 }).success).toBe(false);
  });
  it("converte para TrafficObservation de 15 min", () => {
    const o = toTrafficObservation(CameraObservationSchema.parse(payload), "x");
    expect(o.source).toBe("CAMERA");
    expect(Date.parse(o.intervalEnd) - Date.parse(o.intervalStart)).toBe(900000);
    expect(o.quality).toBe("VALIDO");
  });
});
