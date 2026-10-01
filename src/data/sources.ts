import type { SourceDocument } from "@/domain/types";

/**
 * Inventário de documentos-fonte.
 * O documento "PARAMETROS" é uma síntese secundária que cita dois PDFs
 * (relatórios de fiscalização eletrônica da Cidade do Rio de Janeiro e estudo técnico UFRJ).
 * Esses PDFs ainda não foram incorporados ao repositório.
 */
export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: "DOC-PARAMETROS",
    title: "Parâmetros do Fluxo de Tráfego",
    fileName: "docs/fontes/PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx",
    kind: "SECUNDARIA",
    availableInRepo: true,
    description:
      "Matriz comparativa de 7 corredores/sentidos (seção 1) e relatório qualitativo de variações de tráfego e capacidade (seção 2). Valores em faixas aproximadas. Não contém fórmulas. O conteúdo aparece duplicado no arquivo; a segunda cópia traz marcadores de citação \"PDF\"/\"PDF+ n\" apontando para os PDFs originais.",
  },
  {
    id: "DOC-FISCALIZACAO-RJ",
    title: "Relatórios de fiscalização eletrônica — Cidade do Rio de Janeiro",
    fileName: null,
    kind: "PRIMARIA",
    availableInRepo: false,
    description:
      "Citado pela síntese como fonte dos fluxos. Não disponível no repositório (arquivo extenso não enviado). Necessário para obter séries horárias, velocidades e metodologia de contagem.",
  },
  {
    id: "DOC-UFRJ",
    title: "Estudo técnico UFRJ",
    fileName: null,
    kind: "PRIMARIA",
    availableInRepo: false,
    description:
      "Citado pela síntese. Não disponível no repositório. Provável fonte de definições metodológicas (capacidade, nível de serviço) — a confirmar.",
  },
];
