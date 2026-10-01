import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/repository";
import { METHODOLOGY } from "@/methodology/registry";

const r = createInMemoryRepository();
const CENTRAL = "av-americas--2000--santa-cruz--pista-central";
const LATERAL = "av-americas--2000--santa-cruz--pista-lateral";

describe("dados dos PDFs no sistema", () => {
  it("22 trechos, 1.046 dias", () => {
    expect(r.segments()).toHaveLength(22);
    expect(r.series()).toHaveLength(1046);
  });
  it("série 'de 2019' da especificação está na pista LATERAL, 01/03/2019", () => {
    const d = r.day(`pdf-${LATERAL}-2019-03-01`)!;
    expect(d.hourly.slice(7, 19).map((h) => h.flow)).toEqual([1113, 1590, 1842, 2057, 2092, 2285, 2356, 2397, 2328, 2138, 1988, 1892]);
    expect(d.series.weekday).toBe(5);
  });
  it("01/03/2023 central: total = impresso (42.741)", () => {
    const d = r.day(`pdf-${CENTRAL}-2023-03-01`)!;
    expect(d.total).toBe(42741);
    expect(d.series.reportedDailyTotal).toBe(42741);
  });
  it("Carnaval 2019 é FERIADO e fica fora do VDM", () => {
    const ps = r.periods(LATERAL).find((p) => p.period === "2019-03")!;
    expect(r.day(`pdf-${LATERAL}-2019-03-05`)!.series.dayType).toBe("FERIADO");
    expect(ps.completeWeekdays.some((d) => d.series.date === "2019-03-05")).toBe(false);
  });
  it("VDM = média dos totais dos dias úteis completos", () => {
    const ps = r.periods(CENTRAL).find((p) => p.period === "2023-03")!;
    const tot = ps.completeWeekdays.map((d) => d.total as number);
    expect(ps.vdm!.mean).toBeCloseTo(tot.reduce((a, b) => a + b, 0) / tot.length);
    expect(ps.completeWeekdays.every((d) => d.hourly.every((h) => h.flow != null))).toBe(true);
  });
});

describe("indicadores e rastreabilidade", () => {
  it("toda trilha tem 7 passos na ordem", () => {
    for (const i of r.indicators()) expect(i.trace.map((t) => t.kind)).toEqual(["INDICADOR", "VARIAVEIS", "ENTRADA", "FORMULA", "INTERMEDIARIO", "RESULTADO", "INTERPRETACAO"]);
  });
  it("metodologias referenciadas existem", () => {
    const ids = new Set(METHODOLOGY.map((m) => m.id));
    for (const i of r.indicators()) expect(ids.has(i.methodologyId)).toBe(true);
  });
  it("VDM do período cita o documento e os dias usados", () => {
    const i = r.indicator(`${CENTRAL}--2023-03--VDM`)!;
    expect(i.origin).toBe("CALCULADO");
    expect(i.trace[2].lines.join(" ")).toContain("DOC-FLUXOS-UFRJ");
  });
  it("condição nunca classificada; saturação indisponível", () => {
    const i = r.indicators(CENTRAL);
    expect(i.find((x) => x.key === "condicao")!.display).toBe("INDETERMINADO");
    expect(i.find((x) => x.key === "saturacao")!.origin).toBe("INDISPONIVEL");
  });
  it("valores da matriz preservados", () => {
    const lv = r.segments().find((s) => s.id.startsWith("linha-vermelha--km-5-5--ilha"))!;
    expect(r.indicator(`${lv.id}--PICO_MANHA`)!.display).toBe("~3.500–4.100 veíc/h · 06:00–08:00");
  });
});

describe("catálogo de metodologia", () => {
  it("CONFIRMADO tem fonte documental", () => {
    for (const m of METHODOLOGY) if (m.status === "CONFIRMADO") expect(m.sources.length).toBeGreaterThan(0);
  });
  it("nenhuma fórmula atribuída à fonte", () => expect(METHODOLOGY.every((m) => m.formula === null)).toBe(true));
  it("fonte externa nunca é CONFIRMADA", () => {
    for (const m of METHODOLOGY) if (m.externalSource) expect(m.status).not.toBe("CONFIRMADO");
  });
});
