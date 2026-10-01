import { describe, expect, it } from "vitest";
import { alternationRun, classifyRawCell, validateObservation } from "@/quality/rules";
import { createInMemoryRepository } from "@/repository";

describe("células brutas", () => {
  it.each([
    ["", "AUSENTE"], [null, "AUSENTE"], ["continuar conforme fonte", "AUSENTE"], ["#NUM!", "INVALIDO"], ["#DIV/0!", "INVALIDO"],
    ["1,2,3", "INVALIDO"], ["0", "SUSPEITO"], ["-3", "INVALIDO"], ["1.250", "VALIDO"],
  ] as const)("%s → %s", (raw, status) => expect(classifyRawCell(raw).status).toBe(status));
  it("'1.113' → 1113", () => expect(classifyRawCell("1.113").value).toBe(1113));
});

describe("observações", () => {
  const base = { vehicleCount: 10, durationMinutes: 15, averageSpeedKmh: 40 };
  it("válida", () => expect(validateObservation(base)).toBe("VALIDO"));
  it("ausente", () => expect(validateObservation({ ...base, vehicleCount: null })).toBe("AUSENTE"));
  it("negativa / NaN / duração 0 / velocidade negativa", () => {
    expect(validateObservation({ ...base, vehicleCount: -1 })).toBe("INVALIDO");
    expect(validateObservation({ ...base, vehicleCount: NaN })).toBe("INVALIDO");
    expect(validateObservation({ ...base, durationMinutes: 0 })).toBe("INVALIDO");
    expect(validateObservation({ ...base, averageSpeedKmh: -2 })).toBe("INVALIDO");
  });
});

describe("heurística de alternância (EXPERIMENTAL)", () => {
  it("detecta trecho 11h–15h da série de 01/03/2023", () => {
    const v = [520, 668, 365, 93, 89, 322, 1178, 2257, 2390, 2473, 2758, 2886, 2033, 2896, 1853, 2940, 2432, 2961, 2076, 2469, 2733, 1935, null, null];
    expect(alternationRun(v)).toEqual({ start: 11, end: 15 });
  });
  it("série monotônica não é sinalizada", () => expect(alternationRun([100, 200, 300, 400, 500, 600])).toBeNull());
});

describe("histórico — registros", () => {
  const r = createInMemoryRepository();
  const issues = r.qualityIssues();
  const by = (rule: string) => issues.filter((i) => i.rule === rule);
  it("'veg' em 24 células", () => expect(by("UNIDADE_GRAFIA")).toHaveLength(24));
  it("velocidade ausente nos 7 segmentos", () => expect(by("VELOCIDADE_AUSENTE")).toHaveLength(7));
  it("série de 2019 sem data → INCOMPLETO", () => expect(by("DATA_NAO_INFORMADA").map((i) => i.target.id)).toEqual(["ufrj-2019-03-americas-2000-central"]));
  it("dias incompletos registrados nas duas séries", () => expect(by("DIA_INCOMPLETO")).toHaveLength(2));
  it("22–23h e 23–24h de 2023 ausentes", () => expect(by("OBSERVACAO_AUSENTE")).toHaveLength(2));
  it("divergência da regra de madrugada registrada", () => expect(by("DIVERGENCIA_REGRA_MADRUGADA")).toHaveLength(1));
  it("padrão alternado registrado", () => expect(by("PADRAO_ALTERNADO")).toHaveLength(1));
  it("texto × tabela (40.000 vs 38.000)", () => expect(by("DIVERGENCIA_TEXTO_TABELA")).toHaveLength(1));
  it("6 segmentos sem série horária", () => expect(by("SERIE_HORARIA_AUSENTE")).toHaveLength(6));
  it("dados não são alterados", () => {
    const s = r.series().find((x) => x.date === "2023-03-01")!;
    expect(r.observations(s.id).map((o) => o.vehicleCount).slice(0, 3)).toEqual([520, 668, 365]);
  });
});
