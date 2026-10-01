import type { SourceDocument } from "@/domain/types";

/** Inventário de documentos-fonte (ver docs/DATA_SOURCES.md). */
export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: "DOC-FLUXOS-UFRJ",
    title: "Fluxos UFRJ-Revisado (1).pdf",
    fileName: null,
    kind: "PRIMARIA",
    availableInRepo: false,
    description:
      "Relatórios de fluxo veicular diário por faixa horária, por mês e por endereço (logradouro, sentido, pista, faixa, coordenada, data, dia da semana, horário, fluxo, resumo diário). Dados de 2019 e 2023. Não anexado (tamanho). Trechos transcritos via DOC-ESPECIFICACAO.",
  },
  {
    id: "DOC-VELOCIDADES",
    title: "Relatório de velocidades",
    fileName: null,
    kind: "PRIMARIA",
    availableInRepo: false,
    description:
      "Velocidade média por data/dia da semana/horário e informações de 85º percentil. Não anexado; nenhum valor disponível no sistema.",
  },
  {
    id: "DOC-PARAMETROS",
    title: "Parâmetros do Fluxo de Tráfego",
    fileName: "docs/fontes/PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx",
    kind: "SECUNDARIA",
    availableInRepo: true,
    description:
      "Matriz comparativa de 7 corredores/sentidos (seção 1) e relatório qualitativo (seção 2). Valores em faixas aproximadas; sem fórmulas. Conteúdo duplicado, com marcadores 'PDF+ n' — síntese dos PDFs primários.",
  },
  {
    id: "DOC-ESPECIFICACAO",
    title: "Especificação MOVA (síntese do autor)",
    fileName: "docs/fontes/ESPECIFICACAO_MOVA_trechos.md",
    kind: "ESPECIFICACAO",
    availableInRepo: true,
    description:
      "Especificação do projeto contendo amostras de séries horárias transcritas do PDF de fluxos. Fonte intermediária: valores devem ser conferidos com o PDF original.",
  },
];
