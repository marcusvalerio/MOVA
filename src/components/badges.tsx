import type { DataSourceKind, DayType, MethodStatus, QualityStatus, ValueOrigin } from "@/domain/types";

export function SourceBadge({ kind }: { kind: DataSourceKind }) {
  const map = { HISTORICO: ["Histórico", "b-hist"], SIMULACAO: ["Simulação", "b-sim"], CAMERA_TESTE: ["Câmera de teste", "b-cam"] } as const;
  const [label, cls] = map[kind];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function MethodBadge({ status }: { status: MethodStatus }) {
  const label = { CONFIRMADO: "Confirmado", INFERIDO: "Inferência", EXPERIMENTAL: "Experimental", PENDENTE: "Pendente de validação" }[status];
  return <span className={`badge b-${status.toLowerCase()}`}>{label}</span>;
}

export function QualityBadge({ status }: { status: QualityStatus }) {
  const label = { VALIDO: "Válido", AUSENTE: "Ausente", INVALIDO: "Inválido", SUSPEITO: "Suspeito", INCOMPLETO: "Incompleto" }[status];
  return <span className={`badge b-${status.toLowerCase()}`}>{label}</span>;
}

export function OriginBadge({ origin }: { origin: ValueOrigin }) {
  const map = {
    OBSERVADO: ["Observado", "b-obs"],
    CALCULADO: ["Calculado", "b-calc"],
    INTERPRETADO: ["Interpretado", "b-interp"],
    SIMULADO: ["Simulado", "b-sim"],
    INDISPONIVEL: ["Indisponível", "b-ind"],
  } as const;
  const [label, cls] = map[origin];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const DAY_TYPE_LABEL: Record<DayType, string> = { DIA_UTIL: "Dia útil", SABADO: "Sábado", DOMINGO: "Domingo", FERIADO: "Feriado / atípico", DESCONHECIDO: "Tipo de dia desconhecido" };
export const WEEKDAY = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
