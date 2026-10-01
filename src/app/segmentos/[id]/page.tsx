import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { IndicatorTile } from "@/components/IndicatorTile";
import { HourlyChart } from "@/components/charts";
import { DAY_TYPE_LABEL, QualityBadge, WEEKDAY } from "@/components/badges";
import { SERIES_COLORS, segmentTitle, seriesValues } from "@/components/viewmodels";
import { qualitativeAssessments } from "@/analytics/indicators";
import { comparability, commonHours } from "@/engine/compare";
import { aggregateHourly, PEAK_WINDOWS } from "@/engine/series";
import { getMethodology } from "@/methodology/registry";

export function generateStaticParams() {
  return repo().segments().map((s) => ({ id: s.id }));
}

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const seg = r.segment(decodeURIComponent(id));
  if (!seg) notFound();
  const t = segmentTitle(r, seg.id);
  const series = r.series(seg.id).sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  const inds = r.indicators(seg.id);
  const matrixInds = inds.filter((i) => !series.some((s) => i.id.startsWith(s.id)));
  const issues = r.qualityIssues().filter((i) => i.target.id === seg.id || i.target.id.startsWith(`${seg.id}--`) || series.some((s) => i.target.id.startsWith(s.id)));
  const qual = qualitativeAssessments(seg);
  const comp = series.length > 1 ? comparability(series[0], series[1]) : null;
  const methods = [...new Set(inds.map((i) => i.methodologyId))].map(getMethodology);
  const hourly = series.map((s) => aggregateHourly(r.observations(s.id)));

  return (
    <>
      <Topbar title={t.location} sub={seg.label} source="HISTORICO" />
      <div className="content">
        <nav className="crumbs">
          <Link href="/corredores">Corredores</Link> / <Link href={`/corredores/${seg.corridorId}`}>{t.corridor}</Link> / <Link href={`/corredores/${seg.corridorId}#${seg.locationId}`}>{t.location}</Link> / <span>{seg.label}</span>
        </nav>
        <div className="banner small">
          <strong>Faixas monitoradas:</strong> {seg.lanesMonitoredRaw}{seg.laneCount != null ? ` (${seg.laneCount})` : ""} · <strong>Tipo:</strong> {seg.laneType} · <strong>Fonte estrutural:</strong> {seg.source.documentId}, {seg.source.locator}
          {seg.structureNote && <> · <span style={{ color: "var(--serious)" }}>{seg.structureNote}</span></>}
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Fluxo por hora — histórico</h2>
            <span className="small muted">veíc/h · observado</span>
          </div>
          {series.length ? (
            <>
              <HourlyChart
                unit="veíc/h"
                label="Fluxo horário observado"
                windows={PEAK_WINDOWS.DIA_UTIL}
                series={series.slice(0, 2).map((s, i) => ({ label: `${s.label} · ${DAY_TYPE_LABEL[s.dayType]}`, values: seriesValues(r, s), color: SERIES_COLORS[i], dashed: i === 1 }))}
              />
              {comp && (
                <p className="small" style={{ marginTop: 8, color: comp.comparable ? "var(--text-2)" : "var(--serious)" }}>
                  {comp.comparable ? "Séries comparáveis (mesmo segmento e tipo de dia)." : `Comparação com ressalva (M-COMPARACAO): ${comp.warnings.join(" ")}`} Horas em comum: {commonHours(hourly[0], hourly[1]).length}.
                </p>
              )}
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead><tr><th>Série</th><th>Data</th><th>Dia</th><th>Tipo de dia</th><th>Horas</th><th>Fonte</th></tr></thead>
                  <tbody>
                    {series.map((s, i) => (
                      <tr key={s.id}>
                        <td className="mono small">{s.id}</td>
                        <td className="num">{s.date ?? `${s.month} (dia ?)`}</td>
                        <td>{s.weekday != null ? WEEKDAY[s.weekday] : "—"}</td>
                        <td>{DAY_TYPE_LABEL[s.dayType]}</td>
                        <td className="num">{hourly[i].filter((h) => h.flow != null).length}/24</td>
                        <td className="small muted">{s.sourceRef?.documentId} · {s.sourceRef?.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>Média semanal, mensal e &ldquo;mesmo dia da semana&rdquo; exigem várias séries do mesmo tipo de dia — disponíveis quando o PDF de fluxos for incorporado (motor em src/engine/compare.ts).</p>
            </>
          ) : (
            <p className="muted">Nenhuma série horária incorporada para este segmento. {seg.carriageway === "LATERAL" || seg.carriageway === "EXCLUSIVA_BRT" ? "A especificação indica que o PDF de fluxos contém registros deste segmento." : ""}</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Velocidade por hora</h2></div>
          <p className="muted">Sem dados (relatório de velocidades não incorporado). Registro na matriz: &ldquo;{seg.speedRecordRaw}&rdquo;</p>
        </section>

        <section className="panel">
          <h2>Indicadores — clique para rastrear</h2>
          {series.map((s) => (
            <div key={s.id} style={{ marginBottom: 16 }}>
              <div className="small muted" style={{ marginBottom: 6 }}>Série {s.label}</div>
              <div className="ind-list">{inds.filter((i) => i.id.startsWith(s.id)).map((i) => <IndicatorTile key={i.id} ind={i} />)}</div>
            </div>
          ))}
          <div className="small muted" style={{ marginBottom: 6 }}>Matriz comparativa (DOC-PARAMETROS §1)</div>
          <div className="ind-list">{matrixInds.map((i) => <IndicatorTile key={i.id} ind={i} />)}</div>
        </section>

        <div className="grid-2">
          <section className="panel">
            <h2>Observações operacionais da fonte</h2>
            <p>&ldquo;{seg.notesRaw}&rdquo;</p>
            {qual.map((q) => <blockquote key={q} style={{ margin: "0 0 8px", paddingLeft: 12, borderLeft: "2px solid var(--border-strong)", color: "var(--text-2)" }}>{q}</blockquote>)}
            <p className="small muted">Citações — não convertidas em indicador ou nível.</p>
          </section>
          <section className="panel">
            <h2>Qualidade de dados</h2>
            <table><tbody>
              {issues.map((i) => (
                <tr key={i.id}><td style={{ width: 110 }}><QualityBadge status={i.status} /></td><td><div className="mono small muted">{i.rule}</div>{i.message}</td></tr>
              ))}
            </tbody></table>
          </section>
        </div>

        <section className="panel">
          <h2>Metodologia utilizada neste segmento</h2>
          <ul className="small">{methods.map((m) => <li key={m.id}><Link className="link" href={`/metodologia#${m.id}`}>{m.id}</Link> — {m.name} · {m.status}</li>)}</ul>
        </section>
      </div>
    </>
  );
}
