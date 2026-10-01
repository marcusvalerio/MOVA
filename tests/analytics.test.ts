import { describe, expect, it } from "vitest";
import { createInMemoryRepository } from "@/repository";
import { METHODOLOGY } from "@/methodology/registry";

const r = createInMemoryRepository();
const central = r.series()[0].segmentId;

describe("indicadores e rastreabilidade", () => {
  it("toda trilha tem 7 passos na ordem", () => {
    for (const i of r.indicators()) expect(i.trace.map((t) => t.kind)).toEqual(["INDICADOR", "VARIAVEIS", "ENTRADA", "FORMULA", "INTERMEDIARIO", "RESULTADO", "INTERPRETACAO"]);
  });
  it("metodologias referenciadas existem", () => {
    const ids = new Set(METHODOLOGY.map((m) => m.id));
    for (const i of r.indicators()) expect(ids.has(i.methodologyId)).toBe(true);
  });
  it("9 indicadores de matriz por segmento + 3 por série", () => {
    for (const s of r.segments()) expect(r.indicators(s.id)).toHaveLength(9 + 3 * r.series(s.id).length);
  });
  it("pico observado 01/03/2023 = 2.961 às 17h, com entradas rastreáveis", () => {
    const i = r.indicator("ufrj-2023-03-01-americas-2000-central--PICO")!;
    expect(i.origin).toBe("CALCULADO");
    expect(i.value!.max).toBe(2961);
    expect(i.trace[2].lines.join(" ")).toContain("DOC-ESPECIFICACAO");
    expect(i.trace[2].lines.join(" ")).toContain("17h–18h: 2.961");
  });
  it("volume parcial marcado como incompleto", () => {
    const i = r.indicator("ufrj-2023-03-01-americas-2000-central--VOLUME")!;
    expect(i.name).toMatch(/incompleto/);
    expect(i.display).toBe("40.327 veíc · 22/24 h");
  });
  it("2019: madrugada indisponível; pico fora de janela não afirmado (tipo de dia desconhecido)", () => {
    expect(r.indicator("ufrj-2019-03-americas-2000-central--MADRUGADA")!.origin).toBe("INDISPONIVEL");
    expect(r.indicator("ufrj-2019-03-americas-2000-central--PICO")!.trace[6].lines[0]).toMatch(/desconhecido/);
  });
  it("valores da matriz preservados", () => {
    const lv = r.segments().find((s) => s.corridorId === "linha-vermelha")!;
    expect(r.indicator(`${lv.id}--PICO_MANHA`)!.display).toBe("~3.500–4.100 veíc/h · 06:00–08:00");
  });
  it("velocidade, V85, saturação: indisponíveis; condição: INDETERMINADO", () => {
    const i = r.indicators(central);
    expect(i.filter((x) => ["velocidade", "v85", "saturacao"].includes(x.key)).every((x) => x.origin === "INDISPONIVEL")).toBe(true);
    expect(i.find((x) => x.key === "condicao")!.display).toBe("INDETERMINADO");
  });
  it("nenhum indicador histórico é SIMULADO ou INTERPRETADO sem metodologia", () => {
    expect(r.indicators().some((i) => i.origin === "SIMULADO" || i.origin === "INTERPRETADO")).toBe(false);
  });
});

describe("catálogo de metodologia", () => {
  it("todo item CONFIRMADO tem fonte documental", () => {
    for (const m of METHODOLOGY) if (m.status === "CONFIRMADO") expect(m.sources.length).toBeGreaterThan(0);
  });
  it("nenhuma fórmula é atribuída à fonte (nenhuma fonte contém fórmula)", () => {
    expect(METHODOLOGY.every((m) => m.formula === null)).toBe(true);
  });
  it("itens com fonte externa nunca são CONFIRMADOS", () => {
    for (const m of METHODOLOGY) if (m.externalSource) expect(m.status).not.toBe("CONFIRMADO");
  });
  it("condição operacional permanece PENDENTE", () => expect(METHODOLOGY.find((m) => m.id === "M-CONDICAO")!.status).toBe("PENDENTE"));
});
