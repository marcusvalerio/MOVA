import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { METHODOLOGY } from "@/methodology/registry";
import { SOURCE_DOCUMENTS } from "@/data/sources";
it("gen", () => {
  const src = (id: string) => SOURCE_DOCUMENTS.find((d) => d.id === id)?.title ?? id;
  const cats = [["DADO", "Dados"], ["INDICADOR", "Indicadores"], ["FORMULA", "Fórmulas"], ["REGRA", "Regras"], ["INTERPRETACAO", "Interpretações"], ["HIPOTESE", "Hipóteses"]];
  let md = "# Methodology Catalog\n\n> Gerado a partir de `src/methodology/registry.ts` (fonte da verdade). O teste `tests/docs.test.ts` falha se algum item do registro não estiver aqui.\n\nStatus: **CONFIRMADO** = explícito numa fonte · **INFERIDO** = implícito, dedução explicada · **EXPERIMENTAL** = escolha do sistema · **PENDENTE** = pendente de validação com o professor.\n\n**Nenhuma fonte disponível contém fórmula matemática explícita.** A coluna \"Implementação\" descreve o que o sistema faz, não o que a fonte define.\n\n| ID | Nome | Categoria | Status |\n|---|---|---|---|\n";
  for (const m of METHODOLOGY) md += `| ${m.id} | ${m.name} | ${m.category} | ${m.status} |\n`;
  for (const [c, t] of cats) {
    md += `\n## ${t}\n`;
    for (const m of METHODOLOGY.filter((x) => x.category === c)) {
      md += `\n### ${m.id} — ${m.name}\n\n- **Status:** ${m.status} · v${m.version}\n- **O que é:** ${m.description}\n- **Fórmula na fonte:** ${m.formula ?? "não documentada"}\n- **Implementação:** ${m.implementation ? "`" + m.implementation + "`" : "não implementado"}\n`;
      if (m.variables.length) md += `- **Variáveis:** ${m.variables.map((v) => `\`${v.symbol}\` ${v.meaning} [${v.unit}]`).join("; ")}\n`;
      md += `- **Unidade:** ${m.unit ?? "—"}\n- **Por que existe:** ${m.purpose}\n- **Fontes:** ${m.sources.map((s) => `${src(s.documentId)} — ${s.section}`).join("; ") || "nenhuma fonte documental"}\n`;
      if (m.externalSource) md += `- **Fonte externa:** ${m.externalSource}\n`;
      if (m.gaps.length) md += `- **Lacunas:**\n${m.gaps.map((g) => `  - ${g}`).join("\n")}\n`;
    }
  }
  writeFileSync("docs/METHODOLOGY_CATALOG.md", md);
});
