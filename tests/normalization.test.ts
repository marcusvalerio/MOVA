import { describe, expect, it } from "vitest";
import { parseLaneCount, parseQualifier, parseQuantity, parseWindows } from "@/normalization/parse";
import { normalizeMatrix, slug } from "@/normalization/normalize-matrix";
import { RAW_MATRIX } from "@/data/raw/parametros-matriz";

describe("parse", () => {
  it("lê faixa aproximada com separador de milhar e grafia 'veg'", () => {
    expect(parseQuantity("~22.000 – 32.000 veg/dia")).toEqual({ value: { min: 22000, max: 32000, approximate: true }, unit: "veic/dia", rawUnit: "veg/dia" });
  });
  it("lê veíc/h sem espaços em torno do traço", () => {
    expect(parseQuantity("07h–09h (~15–22 veíc/h)")?.value).toEqual({ min: 15, max: 22, approximate: true });
  });
  it("lê valor pontual sem '~'", () => {
    expect(parseQuantity("1.500 veíc/h")?.value).toEqual({ min: 1500, max: 1500, approximate: false });
  });
  it("retorna null para texto sem quantidade", () => {
    expect(parseQuantity("Não discriminada no relatório de fluxo.")).toBeNull();
  });
  it("extrai múltiplas janelas", () => {
    expect(parseWindows("08h–09h / 11h–12h (~1.500–2.000 veg/h)")).toEqual([
      { start: "08:00", end: "09:00" },
      { start: "11:00", end: "12:00" },
    ]);
  });
  it("extrai qualificador sem confundir com a quantidade", () => {
    expect(parseQualifier("~35.000 – 45.000 veg/dia (Central)")).toBe("Central");
    expect(parseQualifier("07h–09h (~2.700–3.100 veg/h)")).toBeNull();
  });
  it("só quantifica faixas quando explícito", () => {
    expect(parseLaneCount("Via Expressa (4 Faixas)")).toBe(4);
    expect(parseLaneCount("1 Faixa BRT (Faixa 1)")).toBe(1);
    expect(parseLaneCount("Faixas Mistas e BRT")).toBeNull();
  });
});

describe("normalizeMatrix (ingestão do histórico)", () => {
  const ds = normalizeMatrix();
  it("preserva as 7 linhas e agrupa 5 corredores", () => {
    expect(ds.approaches).toHaveLength(7);
    expect(ds.corridors.map((c) => c.id)).toEqual([
      "av-americas-2000",
      "av-americas-2603",
      "av-abelardo-bueno-980",
      "rua-jardim-botanico-746",
      "linha-vermelha-km-5-5",
    ]);
    expect(ds.measurements).toHaveLength(28);
  });
  it("guarda o texto bruto literal de cada célula", () => {
    for (const r of RAW_MATRIX) {
      const ms = ds.measurements.filter((m) => m.approachId.endsWith(`--r${r.row}`));
      expect(ms.map((m) => m.raw)).toEqual([r.vdmDiasUteis, r.volumeFimDeSemana, r.picoManha, r.picoTardeNoite]);
    }
  });
  it("todas as células numéricas são interpretadas", () => {
    expect(ds.measurements.every((m) => m.value !== null)).toBe(true);
  });
  it("valores conhecidos — Linha Vermelha", () => {
    const lv = ds.measurements.filter((m) => m.approachId === "linha-vermelha-km-5-5--r7");
    expect(lv.find((m) => m.metric === "VDM_DIAS_UTEIS")?.value).toEqual({ min: 51000, max: 65000, approximate: true });
    expect(lv.find((m) => m.metric === "PICO_TARDE_NOITE")?.windows).toEqual([{ start: "16:00", end: "19:00" }]);
  });
  it("coordenadas são marcadas como fonte externa", () => {
    expect(ds.corridors.every((c) => c.coordinates?.provenance === "APROXIMADO_FONTE_EXTERNA")).toBe(true);
  });
  it("slug é estável", () => {
    expect(slug("Av. Embaixador Abelardo Bueno, 980")).toBe("av-abelardo-bueno-980");
  });
});
