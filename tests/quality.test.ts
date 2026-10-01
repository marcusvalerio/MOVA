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
  it("'veg' em 24 células da matriz", () => expect(by("UNIDADE_GRAFIA")).toHaveLength(24));
  it("atribuição incorreta da especificação registrada", () => expect(by("ATRIBUICAO_INCORRETA")).toHaveLength(1));
  it("todos os títulos de local dos PDFs foram mapeados", () => expect(by("LOCAL_NAO_MAPEADO")).toHaveLength(0));
  it("dias incompletos, zeros e vazios registrados (não corrigidos)", () => {
    expect(by("DIAS_INCOMPLETOS").length).toBeGreaterThan(0);
    expect(by("HORAS_ZERADAS").length).toBeGreaterThan(0);
  });
  it("totais diários conferem com o impresso", () => expect(by("TOTAL_DIVERGENTE")).toHaveLength(0));
  it("V85 menor que a média sinalizado (Linha Vermelha 2022)", () => expect(by("V85_MENOR_QUE_MEDIA").some((i) => i.target.id.startsWith("linha-vermelha"))).toBe(true));
  it("dados não são alterados: 01/03/2023 central confere com o PDF", () => {
    const o = r.observations("pdf-av-americas--2000--santa-cruz--pista-central-2023-03-01");
    expect(o.map((x) => x.vehicleCount).slice(0, 3)).toEqual([520, 668, 365]);
    expect(o[22].vehicleCount).toBe(1467);
    expect(o[23].vehicleCount).toBe(947);
  });
});
