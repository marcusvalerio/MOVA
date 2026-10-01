import type { DataSourceKind, MethodStatus, QualityStatus, ValueOrigin } from "@/domain/types";

export function SourceBadge({ kind }: { kind: DataSourceKind }) {
  const map = { HISTORICO: ["Histórico", "b-hist"], SIMULACAO: ["Simulação", "b-sim"], CAMERA: ["Câmera — não conectada", "b-cam"] } as const;
  const [label, cls] = map[kind];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function MethodBadge({ status }: { status: MethodStatus }) {
  const label = { CONFIRMADO: "Confirmado", PENDENTE: "Pendente de validação", EXPERIMENTAL: "Experimental" }[status];
  return <span className={`badge b-${status.toLowerCase()}`}>{label}</span>;
}

export function QualityBadge({ status }: { status: QualityStatus }) {
  const label = { VALIDO: "Válido", AUSENTE: "Ausente", INVALIDO: "Inválido", SUSPEITO: "Suspeito", INCOMPLETO: "Incompleto" }[status];
  return <span className={`badge b-${status.toLowerCase()}`}>{label}</span>;
}

export function OriginBadge({ origin }: { origin: ValueOrigin }) {
  const map = {
    OBSERVADO_NA_FONTE: ["Observado na fonte", "b-obs"],
    CALCULADO: ["Calculado pelo sistema", "b-calc"],
    SIMULADO: ["Simulado", "b-sim"],
    INDISPONIVEL: ["Indisponível", "b-ind"],
  } as const;
  const [label, cls] = map[origin];
  return <span className={`badge ${cls}`}>{label}</span>;
}
