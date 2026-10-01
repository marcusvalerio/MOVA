import type { ConditionThresholds, OperationalLevel } from "@/domain/types";

const LEVELS: { key: OperationalLevel; label: string; color: string }[] = [
  { key: "NORMAL", label: "Normal", color: "var(--ok)" },
  { key: "ATENCAO", label: "Atenção", color: "var(--warn)" },
  { key: "CRITICO", label: "Crítico", color: "var(--serious)" },
  { key: "CONGESTIONADO", label: "Congestionado", color: "var(--critical)" },
];

export function ConditionScale({
  thresholds,
  active,
  unit,
}: {
  thresholds: ConditionThresholds | null;
  active?: OperationalLevel | "INDETERMINADO";
  unit?: string;
}) {
  const limits = thresholds
    ? [`< ${thresholds.atencao}`, `${thresholds.atencao}–${thresholds.critico}`, `${thresholds.critico}–${thresholds.congestionado}`, `≥ ${thresholds.congestionado}`]
    : ["limite ?", "limite ?", "limite ?", "limite ?"];
  return (
    <div>
      <div className="scale" role="list" aria-label="Escala de condição operacional">
        {LEVELS.map((l, i) => (
          <div key={l.key} role="listitem" className={`scale-step${active === l.key ? " active" : ""}`} aria-current={active === l.key}>
            <i style={{ background: l.color, opacity: thresholds ? 1 : 0.35 }} />
            {l.label.toUpperCase()}
            <span>
              {limits[i]}
              {thresholds && unit ? ` ${unit}` : ""}
            </span>
          </div>
        ))}
      </div>
      {!thresholds && <p className="small muted" style={{ marginTop: 10 }}>Limites aguardando validação metodológica.</p>}
    </div>
  );
}
