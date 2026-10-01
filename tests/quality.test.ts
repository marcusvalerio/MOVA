import { describe, expect, it } from "vitest";
import { classifyRawCell, validateObservation } from "@/quality/rules";
import { createInMemoryRepository } from "@/repository";

describe("data quality — células brutas", () => {
  it.each([
    ["", "AUSENTE"],
    [null, "AUSENTE"],
    ["#NUM!", "INVALIDO"],
    ["#DIV/0!", "INVALIDO"],
    ["abc", "INVALIDO"],
    ["0", "SUSPEITO"],
    ["-3", "INVALIDO"],
    ["1.250", "VALIDO"],
  ] as const)("%s → %s", (raw, status) => {
    expect(classifyRawCell(raw).status).toBe(status);
  });
});

describe("data quality — observações", () => {
  const base = { id: "x", approachId: "a", source: "CAMERA" as const, intervalStart: "2026-01-01T07:00:00Z", intervalEnd: "2026-01-01T07:15:00Z", vehicleCount: 10, averageSpeedKmh: 40, quality: "VALIDO" as const };
  it("válida", () => expect(validateObservation(base)).toBe("VALIDO"));
  it("contagem ausente", () => expect(validateObservation({ ...base, vehicleCount: null })).toBe("AUSENTE"));
  it("contagem negativa", () => expect(validateObservation({ ...base, vehicleCount: -1 })).toBe("INVALIDO"));
  it("NaN", () => expect(validateObservation({ ...base, vehicleCount: NaN })).toBe("INVALIDO"));
  it("intervalo invertido", () => expect(validateObservation({ ...base, intervalEnd: "2026-01-01T06:00:00Z" })).toBe("INVALIDO"));
});

describe("data quality — histórico", () => {
  const r = createInMemoryRepository();
  const issues = r.qualityIssues();
  const byRule = (rule: string) => issues.filter((i) => i.rule === rule);
  it("registra grafia 'veg' em 24 células (todas exceto BRT)", () => {
    expect(byRule("UNIDADE_GRAFIA")).toHaveLength(24);
  });
  it("registra velocidade ausente nas 7 linhas", () => {
    expect(byRule("VELOCIDADE_AUSENTE")).toHaveLength(7);
  });
  it("registra escopo divergente nas linhas 4 e 5", () => {
    expect(byRule("ESCOPO_DIVERGENTE").map((i) => i.target.id).sort()).toEqual(["av-abelardo-bueno-980--r5", "av-americas-2603--r4"]);
  });
  it("registra divergência texto × tabela (40.000 vs 38.000)", () => {
    expect(byRule("DIVERGENCIA_TEXTO_TABELA")).toHaveLength(1);
  });
  it("não registra nenhuma célula inválida", () => {
    expect(issues.filter((i) => i.status === "INVALIDO")).toHaveLength(0);
  });
  it("não altera os dados", () => {
    expect(r.measurements().find((m) => m.id === "av-americas-2000--r2--VDM_DIAS_UTEIS")?.value).toEqual({ min: 38000, max: 44000, approximate: true });
  });
});
