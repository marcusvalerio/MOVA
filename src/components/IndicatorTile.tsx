import Link from "next/link";
import type { Indicator } from "@/domain/types";
import { getMethodology } from "@/methodology/registry";
import { MethodBadge, OriginBadge } from "./badges";

export function IndicatorTile({ ind }: { ind: Indicator }) {
  const m = getMethodology(ind.methodologyId);
  return (
    <Link href={`/rastreio/${encodeURIComponent(ind.id)}`} className="ind" title="Ver de onde veio este número">
      <div className="ind-name">{ind.name}</div>
      <div className={`ind-val${ind.origin === "INDISPONIVEL" ? " muted" : ""}`}>{ind.display}</div>
      <div className="row">
        <OriginBadge origin={ind.origin} />
        <MethodBadge status={m.status} />
      </div>
    </Link>
  );
}
