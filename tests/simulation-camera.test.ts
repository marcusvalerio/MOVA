import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/repository";
import { runSimulation } from "@/simulation/run";
import { SCENARIOS, simulateDay, type ScenarioId } from "@/simulation/generator";
import { CameraObservationSchema, processCameraObservation, toTrafficObservation } from "@/adapters/camera";

const r = createInMemoryRepository();
const lv = r.segments().find((s) => s.corridorId === "linha-vermelha")!;

describe("simulação", () => {
  const input = { segment: lv, measurements: r.measurements(lv.id), seed: 7, scenario: "fluxo-alto" as ScenarioId, dayType: "DIA_UTIL" as const };
  it("determinística por semente", () => expect(simulateDay(input).observations).toEqual(simulateDay(input).observations));
  it("marcada como SIMULACAO, sem data", () => {
    const o = simulateDay(input).observations;
    expect(o.every((x) => x.source === "SIMULACAO" && x.date === null)).toBe(true);
  });
  it("passa pelo motor; madrugada < 5% e pico em janela de dia útil", () => {
    const res = runSimulation(r, lv.id, 42)!;
    expect(res.hourly.every((h) => h.flow != null)).toBe(true);
    expect(res.overnight!.belowRule).toBe(true);
    expect(res.peakWindows!.insideWindow).toBe(true);
  });
  it("sábado concentra pico em 11–15h; domingo em 16–19h (§2.A)", () => {
    expect(runSimulation(r, lv.id, 3, "fluxo-alto", "SABADO")!.peakWindows!.insideWindow).toBe(true);
    const dom = runSimulation(r, lv.id, 3, "fluxo-alto", "DOMINGO")!;
    expect(dom.peak!.hour).toBeGreaterThanOrEqual(16);
    expect(dom.peak!.hour).toBeLessThan(19);
  });
  it("fim de semana tem pico menor que dia útil (mesma semente)", () => {
    expect(runSimulation(r, lv.id, 5, "fluxo-alto", "DOMINGO")!.peakFlowTarget).toBeLessThan(runSimulation(r, lv.id, 5, "fluxo-alto", "DIA_UTIL")!.peakFlowTarget);
  });
  it("cenários: fluxo baixo < alto; velocidade baixa < alta; fila crescente cresce", () => {
    const f = (s: ScenarioId) => runSimulation(r, lv.id, 9, s)!;
    expect(f("fluxo-baixo").daily!).toBeLessThan(f("fluxo-alto").daily!);
    expect(f("velocidade-baixa").meanSpeed!).toBeLessThan(f("velocidade-alta").meanSpeed!);
    const q = f("fila-crescente").hourly.map((h) => h.queue ?? 0);
    expect(q[7]).toBeGreaterThan(q[6]); // janela 06–08h da Linha Vermelha
    expect(q[6]).toBeGreaterThan(0);
    expect(f("fluxo-alto").hourly.every((h) => h.queue == null)).toBe(true);
  });
  it("7 cenários disponíveis", () => expect(Object.keys(SCENARIOS)).toHaveLength(7));
  it("segmento inexistente → null", () => expect(runSimulation(r, "x", 1)).toBeNull());
});

describe("câmera de teste", () => {
  const payload = { cameraId: "C1", timestamp: "2026-03-04T07:30:00-03:00", intervalSeconds: 300, vehicleCount: 127, averageSpeed: 18, queueLength: 60, direction: "Centro", confidence: 0.82, source: "teste" };
  it("valida e rejeita", () => {
    expect(CameraObservationSchema.safeParse(payload).success).toBe(true);
    expect(CameraObservationSchema.safeParse({ ...payload, vehicleCount: -1 }).success).toBe(false);
    expect(CameraObservationSchema.safeParse({ ...payload, confidence: 1.2 }).success).toBe(false);
    expect(CameraObservationSchema.safeParse({ ...payload, timestamp: "ontem" }).success).toBe(false);
  });
  it("converte com data/hora local e tipo de dia", () => {
    const o = toTrafficObservation(CameraObservationSchema.parse(payload), "s");
    expect(o).toMatchObject({ source: "CAMERA_TESTE", date: "2026-03-04", startTime: "07:30", durationMinutes: 5, dayType: "DIA_UTIL", quality: "VALIDO" });
  });
  it("separa observado (127) → calculado (1.524 veíc/h) → interpretado (sem limites)", () => {
    const p = processCameraObservation(CameraObservationSchema.parse(payload));
    expect(p.observado.vehicleCount).toBe(127);
    expect(p.calculado.equivalentHourlyFlow).toBe(1524);
    expect(p.calculado.status).toBe("INFERIDO");
    expect(p.interpretado.condition).toBe("INDETERMINADO");
    expect(p.segmentId).toBeNull();
  });
});
