import type { DataSourceKind } from "@/domain/types";
import { SourceBadge } from "./badges";

export function Topbar({ title, sub, source }: { title: string; sub?: string; source?: DataSourceKind }) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {source && (
        <div className="row">
          <span className="small muted">Fonte de dados</span>
          <SourceBadge kind={source} />
        </div>
      )}
    </header>
  );
}
