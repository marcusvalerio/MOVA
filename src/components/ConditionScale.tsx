import type { ConditionThresholds, OperationalLevel } from "@/domain/types";

const LEVELS: { key: OperationalLevel; label: string; color: string; fill: number }[] = [
  { key: "NORMAL", label: "Normal", color: "var(--ok)", fill: 30 },
  { key: "ATENCAO", label: "Atenção", color: "var(--warn)", fill: 55 },
  { key: "CRITICO", label: "Crítico", color: "var(--serious)", fill: 80 },
  { key: "CONGESTIONADO", label: "Congestionado", color: "var(--critical)", fill: 100 },
];

/**
 * Barra de condição operacional. Cores de estado só aparecem quando há limites definidos
 * (especificação §29); sem limites, a estrutura é exibida em neutro.
 */
export function ConditionScale({ thresholds, active, unit, experimental }: { thresholds: ConditionThresholds | null; active?: OperationalLevel | "INDETERMINADO"; unit?: string; experimental?: boolean }) {
  const limits = thresholds
    ? [`< ${thresholds.atencao}`, `${thresholds.atencao}–${thresholds.critico}`, `${thresholds.critico}–${thresholds.congestionado}`, `≥ ${thresholds.congestionado}`]
    : ["limite pendente", "limite pendente", "limite pendente", "limite pendente"];
  return (
    <div>
      <div className="scale" role="list" aria-label="Escala de condição operacional">
        {LEVELS.map((l, i) => (
          <div key={l.key} role="listitem" className={`scale-step${active === l.key ? " active" : ""}${thresholds ? "" : " off"}`} aria-current={active === l.key}>
            <i style={{ background: `linear-gradient(90deg, ${l.color} ${l.fill}%, var(--border) ${l.fill}%)` }} />
            {l.label.toUpperCase()}
            <span>{limits[i]}{thresholds && unit ? ` ${unit}` : ""}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        {thresholds ? (experimental ? "Limites EXPERIMENTAIS informados pelo usuário — não validados." : "") : "Limites aguardando validação metodológica — condição não classificada."}
      </p>
    </div>
  );
}
