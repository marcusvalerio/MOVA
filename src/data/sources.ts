import type { SourceDocument } from "@/domain/types";

/** Inventário de documentos-fonte (ver docs/DATA_SOURCES.md). */
export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: "DOC-FLUXOS-UFRJ",
    title: "Fiscalização Eletrônica — Relatório 05 (Fluxos UFRJ-Revisado)",
    fileName: "docs/fontes/FLUXOS_UFRJ_REVISADO.pdf",
    kind: "PRIMARIA",
    availableInRepo: true,
    description:
      "Fluxo veicular por hora, por dia, por mês e por endereço (199 p.). Extraído para data/extraido/fluxos.json (1.046 dias; totais conferidos com o impresso em 100% dos dias completos). Fonte principal de dados do MOVA.",
  },
  {
    id: "DOC-VELOCIDADES",
    title: "Fiscalização Eletrônica — Relatório 06 (Velocidade UFRJ)",
    fileName: "docs/fontes/VELOCIDADE_UFRJ.pdf",
    kind: "PRIMARIA",
    availableInRepo: true,
    description:
      "Velocidade média por hora e 85º percentil por dia (234 p.). Extraído para data/extraido/velocidade.json. Tabelas por faixa (lane) disponíveis em parte dos locais; esta versão usa o total das faixas.",
  },
  {
    id: "DOC-PARAMETROS",
    title: "Parâmetros do Fluxo de Tráfego",
    fileName: "docs/fontes/PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx",
    kind: "SECUNDARIA",
    availableInRepo: true,
    description:
      "Síntese: matriz comparativa (§1) e relatório qualitativo (§2). Faixas aproximadas, sem fórmulas, sem indicar o ano de cada valor. Usada como referência qualitativa e confrontada com os PDFs.",
  },
  {
    id: "DOC-ESPECIFICACAO",
    title: "Especificação MOVA (síntese do autor)",
    fileName: "docs/fontes/ESPECIFICACAO_MOVA_trechos.md",
    kind: "ESPECIFICACAO",
    availableInRepo: true,
    description:
      "Especificação do projeto. Suas amostras de séries foram conferidas com o PDF: a de 01/03/2023 confere; a de 03/2019 é da pista lateral (não central). Não é usada como fonte de dados.",
  },
];
