import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { METHODOLOGY } from "@/methodology/registry";

describe("documentação sincronizada", () => {
  const cat = readFileSync("docs/METHODOLOGY_CATALOG.md", "utf8");
  it("todo item do registro está no catálogo com o status atual (rode `npm run docs`)", () => {
    for (const m of METHODOLOGY) expect(cat).toContain(`| ${m.id} | ${m.name} | ${m.category} | ${m.status} |`);
  });
});
