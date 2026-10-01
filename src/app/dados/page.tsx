import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { SchematicMap, type MapPoint } from "@/components/SchematicMap";
import { QualityBadge } from "@/components/badges";
import type { QualityStatus } from "@/domain/types";

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const month = (p: string) => {
  const [y, m] = p.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1]}/${y}`;
};

export default function DataPage() {
  const r = repo();
  const segs = r.segments().filter((s) => r.periods(s.id).length);
  const points: MapPoint[] = r.corridors().flatMap((c) => {
    const locs = r.locations(c.id).filter((l) => l.coordinates);
    if (!locs.length) return [];
    const lat = locs.reduce((s, l) => s + l.coordinates!.lat, 0) / locs.length;
    const lng = locs.reduce((s, l) => s + l.coordinates!.lng, 0) / locs.length;
    const n = r.locations(c.id).reduce((s, l) => s + l.segmentIds.filter((id) => r.periods(id).length).length, 0);
    return [{ id: c.id, label: c.name, sub: `${n} trecho(s)`, lat, lng, href: `/corredores/${c.id}` }];
  });
  const issues = r.qualityIssues();
  const qc = (["SUSPEITO", "INCOMPLETO", "AUSENTE", "INVALIDO"] as QualityStatus[]).map((s) => [s, issues.filter((i) => i.status === s).length] as const);
  const matrixRows = r.measurements().filter((m) => m.metric === "VDM_DIAS_UTEIS");
  const completeDays = segs.reduce((s, x) => s + r.periods(x.id).reduce((a, p) => a + p.days.filter((d) => d.complete).length, 0), 0);
  return (
    <>
      <Topbar title="Dados dos corredores" sub="Relatórios de fiscalização eletrônica · fluxo e velocidade por hora" source="HISTORICO" />
      <div className="content">
        <div className="grid-2">
          <section className="panel">
            <h2>Corredores</h2>
            <SchematicMap points={points} />
          </section>
          <section className="panel">
            <h2>Base de dados</h2>
            <table>
              <tbody>
                <tr><td className="muted">Trechos (sentido · pista)</td><td className="num">{segs.length}</td></tr>
                <tr><td className="muted">Dias com dados horários</td><td className="num">{fmt(r.series().length)}</td></tr>
                <tr><td className="muted">Dias completos (24 h válidas)</td><td className="num">{fmt(completeDays)}</td></tr>
                <tr><td className="muted">Períodos</td><td className="small">mar/2019 · mai/2019 · mar/2022 · mai/2022 · mar/2023</td></tr>
                <tr>
                  <td className="muted">Qualidade</td>
                  <td>
                    <div className="row">
                      {qc.filter(([, n]) => n).map(([s, n]) => (
                        <span key={s} className="row" style={{ gap: 4 }}><QualityBadge status={s} /><span className="mono small">{n}</span></span>
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 10 }}>
              Nenhum valor é corrigido ou preenchido. Feriados e datas atípicas ficam fora das médias de dias úteis. <Link className="link" href="/qualidade">Ver registros</Link>.
            </p>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head"><h2>Trechos monitorados</h2><span className="small muted">período mais recente de cada trecho · clique para detalhar</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Corredor · local</th><th>Sentido · pista</th><th>Período</th><th>VDM dias úteis</th><th>Pico típico</th><th>Velocidade média</th><th>Dias completos</th></tr></thead>
              <tbody>
                {segs.map((s) => {
                  const p = r.periods(s.id)[0];
                  const loc = r.location(s.locationId)!;
                  return (
                    <tr key={s.id}>
                      <td><Link className="link" href={`/segmentos/${encodeURIComponent(s.id)}`}>{loc.address}</Link></td>
                      <td className="small">{s.label.replace(/^Sentido /, "")}</td>
                      <td className="small">{month(p.period)}</td>
                      <td className="num">{p.vdm ? fmt(Math.round(p.vdm.mean)) : "—"}</td>
                      <td className="num">{p.typicalPeakHour ? `${String(p.typicalPeakHour.hour).padStart(2, "0")}h` : "—"}</td>
                      <td className="num">{p.speedWeekday != null ? `${fmt(p.speedWeekday)} km/h` : "—"}</td>
                      <td className="num">{p.days.filter((d) => d.complete).length}/{p.days.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Matriz do estudo (.docx) × dados dos radares</h2><span className="small muted">VDM em dias úteis</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Linha da matriz</th><th>Matriz (.docx)</th><th>Radares — trechos correspondentes</th></tr></thead>
              <tbody>
                {matrixRows.map((m) => {
                  const seg = r.segment(m.segmentId)!;
                  const loc = r.location(seg.locationId)!;
                  const grouped = seg.carriageway === "CENTRAL_E_LATERAL" || seg.direction.includes(" e ");
                  const related = segs.filter((x) => x.locationId === seg.locationId && (x.id === seg.id || grouped));
                  const text = related
                    .flatMap((x) => r.periods(x.id).filter((p) => p.vdm).map((p) => `${x.label.replace(/^Sentido /, "")} ${month(p.period)}: ${fmt(Math.round(p.vdm!.mean))}`))
                    .join(" · ");
                  return (
                    <tr key={m.id}>
                      <td className="small">{loc.address}<br /><span className="muted">{seg.label.replace(/^Sentido /, "")}</span></td>
                      <td className="num">{m.raw}</td>
                      <td className="small">{text || <span className="muted">sem dia útil completo</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>A matriz é uma síntese em faixas aproximadas, sem indicar o ano. Os valores dos radares são médias de dias úteis completos, sem feriados.</p>
        </section>
      </div>
    </>
  );
}
