import { describe, expect, it } from "vitest";
import { relativeDropInterval, weekendDropCheck } from "@/engine/intervals";
import { aggregateHourly, classifyCondition, dailyVolume, equivalentHourlyFlow, meanDailyVolume, overnightRatio, partialVolume, peakHour, peakVsWindows, saturation, weightedMeanSpeed } from "@/engine/series";
import { comparability, meanProfile } from "@/engine/compare";
import { hourlyObs, obs } from "./helpers";

const MAR2023 = [520, 668, 365, 93, 89, 322, 1178, 2257, 2390, 2473, 2758, 2886, 2033, 2896, 1853, 2940, 2432, 2961, 2076, 2469, 2733, 1935, null, null];

describe("queda fim de semana (intervalos)", () => {
  it("valores conhecidos — linha 2", () => {
    const d = relativeDropInterval({ min: 38000, max: 44000, approximate: true }, { min: 20000, max: 35000, approximate: true });
    expect(d.min).toBeCloseTo(1 - 35000 / 38000);
    expect(d.max).toBeCloseTo(1 - 20000 / 44000);
  });
  it("incompatível quando sempre < 25%", () => {
    expect(weekendDropCheck({ min: 100, max: 100, approximate: false }, { min: 90, max: 95, approximate: false }).compatible).toBe(false);
  });
});

describe("agregação horária", () => {
  it("4 × 15 min → hora; velocidade ponderada", () => {
    const h = aggregateHourly([obs(7, 0, 100, { averageSpeedKmh: 40 }), obs(7, 15, 200, { averageSpeedKmh: 30 }), obs(7, 30, 300, { averageSpeedKmh: 20 }), obs(7, 45, 400, { averageSpeedKmh: 10 })]);
    expect(h[7].flow).toBe(1000);
    expect(h[7].speed).toBeCloseTo(20000 / 1000);
  });
  it("hora incompleta não gera fluxo (ausente não vira zero)", () => {
    const h = aggregateHourly([obs(7, 0, 100), obs(7, 15, null), obs(7, 30, 300), obs(7, 45, 400)]);
    expect(h[7].flow).toBeNull();
    expect(h[7].coverageMinutes).toBe(45);
  });
  it("inválidos são ignorados", () => {
    expect(aggregateHourly([obs(8, 0, -5, { quality: "INVALIDO" }), obs(8, 15, 1), obs(8, 30, 1), obs(8, 45, 1)])[8].flow).toBeNull();
  });
  it("V85 reportado só é exposto em intervalo de 60 min (sem agregação)", () => {
    expect(aggregateHourly([obs(9, 0, 10, { durationMinutes: 60, p85SpeedKmh: 72 })])[9].p85).toBe(72);
    expect(aggregateHourly([obs(9, 0, 10, { p85SpeedKmh: 70 }), obs(9, 15, 10, { p85SpeedKmh: 74 }), obs(9, 30, 10), obs(9, 45, 10)])[9].p85).toBeNull();
  });
});

describe("série real 01/03/2023 (Américas 2000 · Santa Cruz · Central)", () => {
  const h = aggregateHourly(hourlyObs(MAR2023));
  it("volume diário não calculado (22/24 h); parcial = 40.327", () => {
    expect(dailyVolume(h)).toBeNull();
    expect(partialVolume(h)).toEqual({ total: 40327, hours: 22 });
  });
  it("pico às 17h = 2.961; pico na janela da manhã = 2.390 às 08h", () => {
    expect(peakHour(h)).toMatchObject({ hour: 17, flow: 2961 });
    expect(peakHour(h, { startHour: 7, endHour: 9 })).toMatchObject({ hour: 8, flow: 2390 });
  });
  it("pico dentro das janelas de dia útil (§2.A)", () => {
    expect(peakVsWindows(h, "DIA_UTIL")?.insideWindow).toBe(true);
    expect(peakVsWindows(h, "DESCONHECIDO")?.insideWindow).toBeNull();
  });
  it("madrugada/pico = 668/2961 ≈ 22,6% — diverge de '< 5%'", () => {
    const r = overnightRatio(h)!;
    expect(r.nightHour).toBe(1);
    expect(r.ratio).toBeCloseTo(668 / 2961);
    expect(r.belowRule).toBe(false);
  });
});

describe("série real 03/2019 (07–19h)", () => {
  const vals = [null, null, null, null, null, null, null, 1113, 1590, 1842, 2057, 2092, 2285, 2356, 2397, 2328, 2138, 1988, 1892, null, null, null, null, null];
  const h = aggregateHourly(hourlyObs(vals));
  it("pico 2.397 às 14h; madrugada não verificável", () => {
    expect(peakHour(h)).toMatchObject({ hour: 14, flow: 2397 });
    expect(overnightRatio(h)).toBeNull();
  });
  it("pico fora das janelas de dia útil, se fosse dia útil", () => {
    expect(peakVsWindows(h, "DIA_UTIL")?.insideWindow).toBe(false);
  });
});

describe("fluxo equivalente (M-FLUXO-EQUIVALENTE, inferido)", () => {
  it("exemplo da especificação: 127 veículos em 5 min → 1.524 veíc/h", () => expect(equivalentHourlyFlow(127, 5)).toBe(1524));
  it("60 min é identidade", () => expect(equivalentHourlyFlow(900, 60)).toBe(900));
  it("rejeita duração ≤ 0 e contagem negativa", () => {
    expect(() => equivalentHourlyFlow(1, 0)).toThrow();
    expect(() => equivalentHourlyFlow(-1, 5)).toThrow();
  });
});

describe("outros cálculos", () => {
  it("média diária ignora dias incompletos", () => expect(meanDailyVolume([100, null, 200])).toBe(150));
  it("velocidade sem dados → null", () => expect(weightedMeanSpeed(aggregateHourly(hourlyObs([10])))).toBeNull());
  it("saturação sem capacidade → null", () => {
    expect(saturation(1000, null)).toBeNull();
    expect(saturation(1000, 2000)).toBe(0.5);
  });
  it("condição sem limites → INDETERMINADO; com limites classifica", () => {
    expect(classifyCondition(0.9, null)).toBe("INDETERMINADO");
    const t = { atencao: 10, critico: 20, congestionado: 30 };
    expect([5, 10, 25, 30].map((v) => classifyCondition(v, t))).toEqual(["NORMAL", "ATENCAO", "CRITICO", "CONGESTIONADO"]);
    expect(() => classifyCondition(1, { atencao: 3, critico: 2, congestionado: 4 })).toThrow();
  });
});

describe("comparabilidade (M-COMPARACAO)", () => {
  const a = { id: "a", segmentId: "s", dayType: "DIA_UTIL" as const, label: "A" };
  it("mesmo segmento e tipo de dia → comparável", () => expect(comparability(a, { ...a, id: "b", label: "B" }).comparable).toBe(true));
  it("dia útil × sábado → ressalva", () => expect(comparability(a, { ...a, dayType: "SABADO", label: "B" }).warnings[0]).toMatch(/Tipos de dia diferentes/));
  it("tipo desconhecido → não verificável", () => expect(comparability(a, { ...a, dayType: "DESCONHECIDO", label: "B" }).warnings[0]).toMatch(/não verificável/));
  it("segmentos diferentes → ressalva", () => expect(comparability(a, { ...a, segmentId: "t", label: "B" }).comparable).toBe(false));
  it("perfil médio usa só o tipo de dia pedido e expõe n", () => {
    const p = meanProfile([hourlyObs([100]), hourlyObs([300]), hourlyObs([1000], { dayType: "SABADO" })], "DIA_UTIL");
    expect(p[0]).toEqual({ hour: 0, n: 2, mean: 200 });
    expect(p[1]).toEqual({ hour: 1, n: 0, mean: null });
  });
});
