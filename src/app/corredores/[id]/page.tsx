import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { IndicatorTile } from "@/components/IndicatorTile";
import { QualityBadge } from "@/components/badges";
import { qualitativeAssessments } from "@/analytics/indicators";

export function generateStaticParams() {
  return repo().corridors().map((c) => ({ id: c.id }));
}

export default async function CorridorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const c = r.corridor(id);
  if (!c) notFound();
  const issues = r.qualityIssues();
  return (
    <>
      <Topbar title={c.name} sub={[c.reference, c.roadClassRaw].filter(Boolean).join(" · ") || "Corredor"} source="HISTORICO" />
      <div className="content">
        {c.coordinates && (
          <div className="banner small">
            Coordenada exibida ({c.coordinates.lat.toFixed(4)}, {c.coordinates.lng.toFixed(4)}): <strong>aproximada — fonte externa</strong>. {c.coordinates.note}
          </div>
        )}
        {r.approaches(c.id).map((a) => {
          const aIssues = issues.filter((i) => i.target.id === a.id || i.target.id.startsWith(`${a.id}--`));
          const qual = qualitativeAssessments(a);
          return (
            <section key={a.id} className="panel">
              <div className="panel-head">
                <div>
                  <h3>{a.label}</h3>
                  <div className="small muted">Faixas: {a.lanesRaw}{a.laneCount != null ? ` (${a.laneCount})` : ""} · {a.source.documentId} · {a.source.section} · {a.source.locator}</div>
                </div>
                <Link className="link small" href={`/simulacao?approach=${encodeURIComponent(a.id)}`}>simular esta aproximação →</Link>
              </div>
              <div className="ind-list">
                {r.indicators(a.id).map((i) => <IndicatorTile key={i.id} ind={i} />)}
              </div>
              <div className="grid-2" style={{ marginTop: 16 }}>
                <div>
                  <h2>Observações da fonte</h2>
                  <p>&ldquo;{a.notesRaw}&rdquo;</p>
                  <p className="small muted">Registro de velocidades: &ldquo;{a.speedRecordRaw}&rdquo;</p>
                  {qual.length > 0 && (
                    <>
                      <h2 style={{ marginTop: 14 }}>Avaliação qualitativa (Seção 2) — citação, não cálculo</h2>
                      {qual.map((q) => <blockquote key={q} style={{ margin: "0 0 8px", paddingLeft: 12, borderLeft: "2px solid var(--border-strong)", color: "var(--text-2)" }}>{q}</blockquote>)}
                    </>
                  )}
                </div>
                <div>
                  <h2>Qualidade de dados</h2>
                  {aIssues.length === 0 ? <p className="muted">Sem registros.</p> : (
                    <table>
                      <tbody>
                        {aIssues.map((i) => (
                          <tr key={i.id}>
                            <td style={{ width: 110 }}><QualityBadge status={i.status} /></td>
                            <td><div className="mono small muted">{i.rule}</div>{i.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
