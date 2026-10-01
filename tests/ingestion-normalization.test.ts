import { describe, expect, it } from "vitest";
import { parseLaneCount, parseQualifier, parseQuantity, parseWindows } from "@/normalization/parse";
import { normalizeMatrix } from "@/normalization/normalize-matrix";
import { dayTypeOf, normalizeUfrj, parseInterval } from "@/normalization/normalize-series";
import { RAW_MATRIX } from "@/data/raw/parametros-matriz";

describe("parse da matriz", () => {
  it("faixa aproximada com milhar e 'veg'", () => {
    expect(parseQuantity("~22.000 – 32.000 veg/dia")).toEqual({ value: { min: 22000, max: 32000, approximate: true }, unit: "veic/dia", rawUnit: "veg/dia" });
  });
  it("veíc/h sem espaços", () => expect(parseQuantity("07h–09h (~15–22 veíc/h)")?.value).toEqual({ min: 15, max: 22, approximate: true }));
  it("texto sem quantidade → null", () => expect(parseQuantity("Não discriminada no relatório de fluxo.")).toBeNull());
  it("múltiplas janelas", () => expect(parseWindows("08h–09h / 11h–12h (~1.500–2.000 veg/h)")).toHaveLength(2));
  it("qualificador", () => expect(parseQualifier("~35.000 – 45.000 veg/dia (Central)")).toBe("Central"));
  it("faixas explícitas", () => {
    expect(parseLaneCount("Via Expressa (4 Faixas)")).toBe(4);
    expect(parseLaneCount("Faixas Mistas e BRT")).toBeNull();
  });
});

describe("hierarquia Corredor → Local → Segmento", () => {
  const mx = normalizeMatrix();
  it("4 corredores, 5 locais, 7 segmentos, 28 medidas", () => {
    expect(mx.corridors.map((c) => c.id)).toEqual(["av-americas", "av-abelardo-bueno", "rua-jardim-botanico", "linha-vermelha"]);
    expect(mx.locations).toHaveLength(5);
    expect(mx.segments).toHaveLength(7);
    expect(mx.measurements).toHaveLength(28);
  });
  it("Av. das Américas tem dois locais (2000 e 2603) e distingue pistas e BRT", () => {
    const am = mx.corridors.find((c) => c.id === "av-americas")!;
    expect(am.locationIds).toEqual(["av-americas--2000", "av-americas--2603"]);
    const s2000 = mx.segments.filter((s) => s.locationId === "av-americas--2000");
    expect(s2000.map((s) => [s.carriageway, s.laneType])).toEqual([["LATERAL", "MISTA"], ["CENTRAL", "MISTA"], ["EXCLUSIVA_BRT", "BRT"]]);
  });
  it("texto literal preservado", () => {
    for (const r of RAW_MATRIX) {
      const ms = mx.measurements.filter((m) => m.segmentId === mx.segmentIdByRow[r.row]);
      expect(ms.map((m) => m.raw)).toEqual([r.vdmDiasUteis, r.volumeFimDeSemana, r.picoManha, r.picoTardeNoite]);
    }
  });
  it("linhas agrupadas carregam nota estrutural", () => {
    expect(mx.segments.filter((s) => s.structureNote).length).toBe(4);
  });
});

describe("séries UFRJ", () => {
  const mx = normalizeMatrix();
  const { series, observations } = normalizeUfrj(mx.segmentIdByRow);
  it("intervalos nos dois formatos", () => {
    expect(parseInterval("07:00–08:00")).toEqual({ startTime: "07:00", durationMinutes: 60 });
    expect(parseInterval("22–23")).toEqual({ startTime: "22:00", durationMinutes: 60 });
    expect(parseInterval("08–07")).toBeNull();
  });
  it("tipo de dia", () => {
    expect(dayTypeOf("2023-03-01")).toEqual({ weekday: 3, dayType: "DIA_UTIL" });
    expect(dayTypeOf("2023-03-04").dayType).toBe("SABADO");
    expect(dayTypeOf("2023-03-05").dayType).toBe("DOMINGO");
    expect(dayTypeOf(null)).toEqual({ weekday: null, dayType: "DESCONHECIDO" });
  });
  it("duas séries no segmento Américas 2000 · Santa Cruz · Central", () => {
    expect(series.map((s) => s.segmentId)).toEqual([mx.segmentIdByRow[2], mx.segmentIdByRow[2]]);
  });
  it("2019: 12 horas, data desconhecida (nunca inventada)", () => {
    const s = series.find((x) => x.month === "2019-03")!;
    expect(s.date).toBeNull();
    expect(s.dayType).toBe("DESCONHECIDO");
    const o = observations.filter((x) => x.seriesId === s.id);
    expect(o).toHaveLength(12);
    expect(o[0]).toMatchObject({ startTime: "07:00", vehicleCount: 1113 });
    expect(o[11]).toMatchObject({ startTime: "18:00", vehicleCount: 1892 });
  });
  it("2023: 22 horas válidas e 22–24h AUSENTES (não preenchidas)", () => {
    const o = observations.filter((x) => x.seriesId === "ufrj-2023-03-01-americas-2000-central");
    expect(o).toHaveLength(24);
    expect(o.filter((x) => x.quality === "VALIDO")).toHaveLength(22);
    expect(o.slice(22).map((x) => [x.quality, x.vehicleCount])).toEqual([["AUSENTE", null], ["AUSENTE", null]]);
    expect(o.find((x) => x.startTime === "17:00")!.vehicleCount).toBe(2961);
  });
});
