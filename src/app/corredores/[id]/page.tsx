import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";

export function generateStaticParams() {
  return repo().corridors().map((c) => ({ id: c.id }));
}

const LANE = { MISTA: "Faixa mista", BRT: "Faixa exclusiva BRT", MISTA_E_BRT: "Mista e BRT (agrupadas)", NAO_ESPECIFICADO: "Tipo de faixa não especificado" } as const;

export default async function CorridorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const c = r.corridor(id);
  if (!c) notFound();
  return (
    <>
      <Topbar title={c.name} sub="Selecione local, sentido e pista" source="HISTORICO" />
      <div className="content">
        <nav className="crumbs"><Link href="/dados">Dados</Link> / <span>{c.name}</span></nav>
        {r.locations(c.id).map((l) => (
          <section key={l.id} id={l.id} className="panel">
            <div className="panel-head">
              <div>
                <h3>{l.address}</h3>
                <div className="small muted">
                  {[l.reference, l.roadClassRaw].filter(Boolean).join(" · ")}
                  {l.coordinates && ` · coordenada do relatório: ${l.coordinates.raw ?? `${l.coordinates.lat.toFixed(5)}, ${l.coordinates.lng.toFixed(5)}`}`}
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Sentido</th><th>Pista</th><th>Faixas monitoradas</th><th>Tipo de faixa</th><th>Meses com dados</th><th /></tr></thead>
                <tbody>
                  {r.segments(l.id).map((s) => (
                    <tr key={s.id}>
                      <td>{s.direction}</td>
                      <td>{s.label.split("·")[1]?.trim()}</td>
                      <td>{s.lanesMonitoredRaw}{s.laneCount != null ? ` (${s.laneCount})` : ""}</td>
                      <td>{LANE[s.laneType]}</td>
                      <td className="small">{r.periods(s.id).map((p) => p.period.split("-").reverse().join("/")).join(" · ") || <span className="muted">só na matriz</span>}</td>
                      <td><Link className="link" href={`/segmentos/${encodeURIComponent(s.id)}`}>abrir →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
