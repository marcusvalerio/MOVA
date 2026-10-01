import type { ConditionThresholds } from "@/domain/types";

/**
 * Configuração da condição operacional.
 * Limites aguardando validação metodológica: NÃO preencher sem fonte.
 */
export const CONDITION_CONFIG: {
  baseIndicator: string | null;
  thresholds: ConditionThresholds | null;
  status: "AGUARDANDO_VALIDACAO" | "VALIDADO";
  note: string;
} = {
  baseIndicator: null,
  thresholds: null,
  status: "AGUARDANDO_VALIDACAO",
  note: "Limites aguardando validação metodológica. Os documentos não definem indicador-base nem limites para NORMAL / ATENÇÃO / CRÍTICO / CONGESTIONADO.",
};
