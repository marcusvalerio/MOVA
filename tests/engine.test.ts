import { describe, expect, it } from "vitest";
import { relativeDropInterval, weekendDropCheck } from "@/engine/intervals";
import { aggregateHourly, classifyCondition, dailyVolume, meanDailyVolume, overnightRatio, peakHour, saturation, weightedMeanSpeed } from "@/engine/series";
import type { TrafficObservation } from "@/domain/types";

const obs = (h: number, m: number, count: number | null, speed: number | null = null, quality: TrafficObservation["quality"] = "VALIDO"): TrafficObservation => {
  const s = new Date(Date.UTC(2026, 0, 5, h, m));
  return { id: `${h}-${m}`, approachId: "a", source: "SIMULACAO", intervalStart: s.toISOString(), intervalEnd: new Date(s.getTime() + 15 * 60000).toISOString(), vehicleCount: count, averageSpeedKmh: speed, quality };
};

describe("queda fim de semana (aritmética de intervalos)", () => {
  it("valores conhecidos — Av. das Américas, Pista Central (linha 2)", () => {
    const d = relativeDropInterval({ min: 38000, max: 44000, approximate: true }, { min: 20000, max: 35000, approximate: true });
    expect(d.min).toBeCloseTo(1 - 35000 / 38000, 10); // 7,9%
    expect(d.max).toBeCloseTo(1 - 20000 / 44000, 10); // 54,5%
  });
  it("compatível quando intersecta 25–50%", () => {
    expect(weekendDropCheck({ min: 38000, max: 44000, approximate: true }, { min: 20000, max: 35000, approximate: true }).compatible).toBe(true);
  });
  it("incompatível quando a queda é sempre menor que 25%", () => {
    expect(weekendDropCheck({ min: 100, max: 100, approximate: false }, { min: 90, max: 95, approximate: false }).compatible).toBe(false);
  });
  it("rejeita referência não positiva", () => {
    expect(() => relativeDropInterval({ min: 0, max: 10, approximate: false }, { min: 1, max: 2, approximate: false })).toThrow();
  });
});

describe("séries", () => {
  it("soma 4 intervalos de 15 min em fluxo horário", () => {
    const h = aggregateHourly([obs(7, 0, 100, 40), obs(7, 15, 200, 30), obs(7, 30, 300, 20), obs(7, 45, 400, 10)]);
    expect(h[7].flow).toBe(1000);
    expect(h[7].speed).toBeCloseTo((100 * 40 + 200 * 30 + 300 * 20 + 400 * 10) / 1000);
  });
  it("hora incompleta (dado ausente) não gera fluxo", () => {
    const h = aggregateHourly([obs(7, 0, 100), obs(7, 15, null, null, "AUSENTE"), obs(7, 30, 300), obs(7, 45, 400)]);
    expect(h[7].flow).toBeNull();
    expect(h[7].coverageMinutes).toBe(45);
  });
  it("ignora observações inválidas", () => {
    const h = aggregateHourly([obs(8, 0, -5, null, "INVALIDO"), obs(8, 15, 1), obs(8, 30, 1), obs(8, 45, 1)]);
    expect(h[8].flow).toBeNull();
  });
  it("volume diário exige 24 h completas", () => {
    const all = Array.from({ length: 24 }, (_, h) => [0, 15, 30, 45].map((m) => obs(h, m, 10))).flat();
    expect(dailyVolume(aggregateHourly(all))).toBe(960);
    expect(dailyVolume(aggregateHourly(all.slice(1)))).toBeNull();
  });
  it("média diária ignora dias incompletos", () => {
    expect(meanDailyVolume([100, null, 200])).toBe(150);
    expect(meanDailyVolume([null])).toBeNull();
  });
  it("pico na janela e razão de madrugada", () => {
    const all = Array.from({ length: 24 }, (_, h) => [0, 15, 30, 45].map((m) => obs(h, m, h === 8 ? 500 : h >= 1 && h < 5 ? 10 : 100))).flat();
    const hourly = aggregateHourly(all);
    expect(peakHour(hourly)?.hour).toBe(8);
    expect(peakHour(hourly, { startHour: 17, endHour: 19 })?.flow).toBe(400);
    const r = overnightRatio(hourly)!;
    expect(r.ratio).toBeCloseTo(40 / 2000);
    expect(r.belowRule).toBe(true);
  });
  it("velocidade média ponderada retorna null sem velocidades", () => {
    expect(weightedMeanSpeed(aggregateHourly([obs(7, 0, 1), obs(7, 15, 1), obs(7, 30, 1), obs(7, 45, 1)]))).toBeNull();
  });
});

describe("saturação e condição operacional", () => {
  it("saturação indisponível sem capacidade", () => {
    expect(saturation(1000, null)).toBeNull();
    expect(saturation(1000, 2000)).toBe(0.5);
  });
  it("condição INDETERMINADO sem limites (situação atual)", () => {
    expect(classifyCondition(0.9, null)).toBe("INDETERMINADO");
  });
  it("classifica com limites configurados", () => {
    const t = { atencao: 10, critico: 20, congestionado: 30 };
    expect(classifyCondition(5, t)).toBe("NORMAL");
    expect(classifyCondition(10, t)).toBe("ATENCAO");
    expect(classifyCondition(25, t)).toBe("CRITICO");
    expect(classifyCondition(30, t)).toBe("CONGESTIONADO");
  });
  it("rejeita limites não crescentes", () => {
    expect(() => classifyCondition(1, { atencao: 3, critico: 2, congestionado: 4 })).toThrow();
  });
});
