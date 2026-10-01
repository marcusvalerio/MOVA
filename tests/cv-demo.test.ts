import { describe, expect, it } from "vitest";
import { cvDemo } from "@/adapters/cv-demo";
import { CameraObservationSchema, toTrafficObservation } from "@/adapters/camera";
import { aggregateHourly } from "@/engine/series";

describe("demonstração de visão computacional", () => {
  const d = cvDemo();
  it("todas as observações respeitam o contrato CameraObservation", () => {
    for (const o of d.observations) expect(CameraObservationSchema.safeParse(o).success).toBe(true);
  });
  it("contagens por linha+sentido batem com os cruzamentos auditáveis", () => {
    for (const o of d.observations) {
      const [, line] = o.cameraId.split(":");
      expect(o.vehicleCount).toBe(d.events.filter((e) => e.linha === line && e.sentido === o.direction).length);
    }
    expect(d.events.length).toBe(d.run.crossings);
  });
  it("fluxo equivalente = n · 60 / Δt com Δt do clipe", () => {
    for (const p of d.processed) {
      const min = d.run.durationSeconds / 60;
      if (p.observado.vehicleCount > 0) expect(p.calculado.equivalentHourlyFlow).toBeCloseTo((p.observado.vehicleCount * 60) / min, 6);
    }
  });
  it("condição nunca é classificada (limites pendentes)", () => {
    expect(d.processed.every((p) => p.interpretado.condition === "INDETERMINADO")).toBe(true);
  });
  it("data desconhecida não é inventada", () => {
    expect(d.processed.every((p) => p.trafficObservation.date === null && p.trafficObservation.dayType === "DESCONHECIDO")).toBe(true);
  });
  it("cada (rastro, linha) é contado no máximo uma vez", () => {
    const keys = d.events.map((e) => `${e.track}|${e.linha}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("adaptador — observação sem data/hora", () => {
  const base = { cameraId: "X", timestamp: null, intervalSeconds: 7.5, vehicleCount: 3, direction: "N", confidence: 0.5, source: "t" };
  it("aceita timestamp null e intervalo fracionário", () => expect(CameraObservationSchema.safeParse(base).success).toBe(true));
  it("não aloca em hora do dia", () => {
    const o = toTrafficObservation(CameraObservationSchema.parse(base), "s");
    expect(o.startTime).toBeNull();
    expect(aggregateHourly([o]).every((h) => h.coverageMinutes === 0)).toBe(true);
  });
});
