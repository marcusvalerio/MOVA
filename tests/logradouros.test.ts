import { describe, expect, it } from "vitest";
import { accentPattern, rangeGap, buildWhere, distanceToPathM, haversineM, onewayLabel, parseAddress, searchLogradouros, toTrecho } from "@/adapters/logradouros";

const fakeFetch = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("Logradouros (fonte externa)", () => {
  it("separa nome e número, ignorando tipo, preposição e acento", () => {
    expect(parseAddress("Av. das Américas, 2000")).toEqual({ tokens: ["AMERICAS"], number: 2000 });
    expect(parseAddress("Rua Jardim Botânico nº 746")).toEqual({ tokens: ["JARDIM", "BOTANICO"], number: 746 });
  });
  it("monta where insensível a acento, com lado par/ímpar e sem injeção", () => {
    expect(accentPattern("AMERICAS")).toBe("%_M_R___S%");
    expect(buildWhere(parseAddress("americas 2000"))).toBe(
      "UPPER(completo) LIKE '%_M_R___S%' AND ((np_ini_par <= 2000 AND np_fin_par >= 2000) OR (np_ini_par >= 2000 AND np_fin_par <= 2000))",
    );
    expect(buildWhere(parseAddress("americas 2603"))).toContain("np_ini_imp <= 2603");
    const w = buildWhere(parseAddress("x' OR 1=1 -- americas'; drop"))!;
    expect(w).not.toMatch(/1=1|--|;|DROP/);
    expect(w.match(/'/g)!.length % 2).toBe(0);
    expect(buildWhere(parseAddress("av. de"))).toBe(null);
  });
  it("só traduz os códigos de mão conhecidos", () => {
    expect(onewayLabel("FT")).toBe("mão única");
    expect(onewayLabel("B")).toBe("mão dupla");
    expect(onewayLabel("N")).toContain("sem descrição");
    expect(onewayLabel(null)).toBe("não informado");
  });
  it("converte a feição e mede distância ao traçado", async () => {
    const feat = {
      attributes: { cod_trecho: 1, completo: "Avenida das Américas", bairro: "Barra da Tijuca", hierarquia: "Estrutural", oneway: "FT", velocidade_regulamentada: 70, np_ini_par: 1750, np_fin_par: 2600 },
      geometry: { paths: [[[-43.3324, -23.0004], [-43.3333, -23.0004]]] },
    };
    const t = toTrecho(feat);
    expect(t).toMatchObject({ logradouro: "Avenida das Américas", mao: "mão única", velocidadeRegulamentadaKmh: 70, numeracao: { par: [1750, 2600], impar: null } });
    // Ponto ~111 m ao norte do traçado.
    expect(distanceToPathM({ lat: -22.9994, lng: -43.333 }, t.path)).toBeCloseTo(111, -1);
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -2);
    const r = await searchLogradouros("americas 2000", fakeFetch({ features: [feat] }));
    expect(r.kind).toBe("trechos");
  });
  it("sem número devolve lista de logradouros; sem resultado explica", async () => {
    const r = await searchLogradouros("americas", fakeFetch({ features: [{ attributes: { completo: "Avenida das Américas", bairro: "Barra da Tijuca" } }] }));
    expect(r).toMatchObject({ kind: "logradouros", logradouros: [{ logradouro: "Avenida das Américas" }] });
    expect((await searchLogradouros("americas 99999", fakeFetch({ features: [] }))).kind).toBe("vazio");
    expect(rangeGap(730, [746, 710])).toBe(0);
    expect(rangeGap(800, [746, 710])).toBe(54);
    await expect(searchLogradouros("americas 1", fakeFetch({ error: { message: "x" } }))).rejects.toThrow();
  });
});
