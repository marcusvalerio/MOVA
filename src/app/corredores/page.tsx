import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";

export default function CorridorsPage() {
  const r = repo();
  return (
    <>
      <Topbar title="Corredores" sub="Corredor → Local → Sentido → Pista → Faixas" source="HISTORICO" />
      <div className="content">
        {r.corridors().map((c) => (
          <section key={c.id} className="panel">
            <div className="panel-head">
              <h3><Link href={`/corredores/${c.id}`}>{c.name}</Link></h3>
              <span className="small muted">{c.locationIds.length} local(is) · {r.locations(c.id).reduce((n, l) => n + l.segmentIds.length, 0)} segmento(s)</span>
            </div>
            <div className="seg-list">
              {r.locations(c.id).flatMap((l) =>
                r.segments(l.id).map((s) => (
                  <Link key={s.id} className="seg" href={`/segmentos/${encodeURIComponent(s.id)}`}>
                    <div>
                      <div>{l.address}</div>
                      <div className="small muted">{s.label} · {s.lanesMonitoredRaw}</div>
                    </div>
                    <span className="small muted">{r.series(s.id).length ? `${r.series(s.id).length} série(s) horária(s)` : "sem série horária"}</span>
                  </Link>
                )),
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
