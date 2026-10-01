import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { MethodBadge, OriginBadge } from "@/components/badges";
import { segmentTitle } from "@/components/viewmodels";
import { getMethodology } from "@/methodology/registry";

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const ind = r.indicator(decodeURIComponent(id));
  if (!ind) notFound();
  const t = segmentTitle(r, ind.segmentId);
  const m = getMethodology(ind.methodologyId);
  return (
    <>
      <Topbar title={`${ind.name}: ${ind.display}`} sub={`${t.full} · ${ind.period}`} source={ind.sourceKind} />
      <div className="content" style={{ maxWidth: 900 }}>
        <div className="row">
          <OriginBadge origin={ind.origin} />
          <MethodBadge status={m.status} />
          <Link className="link small" href={`/metodologia#${m.id}`}>{m.id} · {m.name}</Link>
        </div>
        <section className="panel">
          <h2>De onde veio este número</h2>
          <div className="trace">
            {ind.trace.map((s, i) => (
              <div key={s.kind} className="trace-step">
                <div className="trace-rail"><span className="trace-dot" />{i < ind.trace.length - 1 && <span className="trace-line" />}</div>
                <div className="trace-body">
                  <div className="trace-kind">{i + 1}. {s.kind}</div>
                  <h3>{s.title}</h3>
                  <ul>{s.lines.map((l, j) => <li key={j} className={s.kind === "FORMULA" || s.kind === "INTERMEDIARIO" ? "formula" : undefined}>{l}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        </section>
        <Link className="link small" href={`/segmentos/${encodeURIComponent(ind.segmentId)}`}>← voltar para o segmento</Link>
      </div>
    </>
  );
}
