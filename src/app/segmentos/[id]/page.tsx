import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { IndicatorTile } from "@/components/IndicatorTile";
import { HourlyChart } from "@/components/charts";
import { DAY_TYPE_LABEL, QualityBadge, WEEKDAY } from "@/components/badges";
import { segmentTitle } from "@/components/viewmodels";
import { qualitativeAssessments } from "@/analytics/indicators";
import { meanProfileOf } from "@/engine/aggregate";
import { PEAK_WINDOWS } from "@/engine/series";
import { getMethodology } from "@/methodology/registry";

export function generateStaticParams() {
  return repo().segments().map((s) => ({ id: s.id }));
}

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const month = (p: string) => {
  const [y, m] = p.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1]}/${y}`;
};
const LANE = { MISTA: "faixa mista", BRT: "faixa exclusiva BRT", MISTA_E_BRT: "mista e BRT (agrupadas)", NAO_ESPECIFICADO: "tipo não especificado" } as const;

export default async function SegmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period } = await searchParams;
  const r = repo();
  const seg = r.segment(decodeURIComponent(id));
  if (!seg) notFound();
  const t = segmentTitle(r, seg.id);
  const periods = r.periods(seg.id);
  const ps = periods.find((p) => p.period === period) ?? periods[0];
  const inds = r.indicators(seg.id);
  const periodInds = ps ? inds.filter((i) => i.id.includes(`--${ps.period}--`)) : [];
  const otherInds = inds.filter((i) => !/--\d{4}-\d{2}--/.test(i.id));
  const issues = r.qualityIssues().filter((i) => i.target.id === seg.id || i.target.id.startsWith(`${seg.id}--`) || (ps && i.target.id === `${seg.id}@${ps.period}`));
  const qual = qualitativeAssessments(seg);
  const methods = [...new Set(inds.map((i) => i.methodologyId))].map(getMethodology);
  const satDays = ps ? ps.byType.SABADO.filter((d) => d.complete) : [];
  const sunDays = ps ? ps.byType.DOMINGO.filter((d) => d.complete) : [];
  const sat = meanProfileOf(satDays);
  const sun = meanProfileOf(sunDays);
  const round = (v: number | null) => (v == null ? null : Math.round(v));

  return (
    <>
      <Topbar title={t.location} sub={seg.label} source="HISTORICO" />
      <div className="content">
        <nav className="crumbs">
          <Link href="/dados">Dados</Link> / <Link href={`/corredores/${seg.corridorId}`}>{t.corridor}</Link> / <span>{seg.label.replace(/^Sentido /, "")}</span>
        </nav>
        <div className="banner small">
          <strong>Tipo:</strong> {LANE[seg.laneType]} · <strong>Faixas:</strong> {seg.lanesMonitoredRaw} · <strong>Fonte:</strong> {seg.source.documentId}
          {seg.source.documentId === "DOC-FLUXOS-UFRJ" ? ` — “${seg.source.section}”` : `, ${seg.source.locator}`}
          {seg.structureNote && <> · <span style={{ color: "var(--serious)" }}>{seg.structureNote}</span></>}
        </div>

        {ps ? (
          <>
            <div className="row">
              {periods.map((p) => (
                <Link key={p.period} href={`/segmentos/${encodeURIComponent(seg.id)}?period=${p.period}`} className={`badge ${p.period === ps.period ? "b-hist" : ""}`} style={{ padding: "7px 12px" }}>
                  {month(p.period)}
                </Link>
              ))}
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>Fluxo médio por hora — {month(ps.period)}</h2>
                <span className="small muted">veíc/h · média dos dias completos (sem feriados)</span>
              </div>
              <HourlyChart
                unit="veíc/h"
                label="Perfil médio de fluxo por tipo de dia"
                windows={PEAK_WINDOWS.DIA_UTIL}
                series={[
                  { label: `Dias úteis (n=${ps.completeWeekdays.length})`, values: ps.weekdayProfile.map((p) => round(p.flow)), color: "var(--accent)" },
                  ...(satDays.length ? [{ label: `Sábados (n=${satDays.length})`, values: sat.map((p) => round(p.flow)), color: "var(--accent-2)", dashed: true }] : []),
                  ...(sunDays.length ? [{ label: `Domingos (n=${sunDays.length})`, values: sun.map((p) => round(p.flow)), color: "var(--text-3)", dashed: true }] : []),
                ]}
              />
            </section>

            <div className="grid-2">
              <section className="panel">
                <div className="panel-head"><h2>Velocidade média por hora (dias úteis)</h2><span className="small muted">km/h · ponderada pelo fluxo</span></div>
                {ps.weekdayProfile.some((p) => p.speed != null) ? (
                  <HourlyChart unit="km/h" label="Velocidade média por hora" series={[{ label: "Velocidade", values: ps.weekdayProfile.map((p) => round(p.speed)), color: "var(--accent)" }]} />
                ) : (
                  <p className="muted">Sem velocidade nos dias úteis completos.</p>
                )}
                <p className="small muted" style={{ marginTop: 6 }}>Fluxo e velocidade em gráficos separados (sem eixo duplo). A relação entre os dois é só visual: a fonte não define regra de diagnóstico.</p>
              </section>
              <section className="panel">
                <h2>Dias do período</h2>
                <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
                  <table>
                    <thead><tr><th>Data</th><th>Dia</th><th>Tipo</th><th>Total</th><th>Horas válidas</th></tr></thead>
                    <tbody>
                      {ps.days.map((d) => (
                        <tr key={d.series.id}>
                          <td className="num">{(d.series.date as string).split("-").reverse().join("/")}</td>
                          <td className="small">{d.series.weekday != null ? WEEKDAY[d.series.weekday] : "—"}</td>
                          <td className="small">{DAY_TYPE_LABEL[d.series.dayType]}{d.series.dayNote ? <div className="muted">{d.series.dayNote}</div> : null}</td>
                          <td className="num">{d.total != null ? fmt(d.total) : <span className="muted">—</span>}</td>
                          <td className="num">{d.validHours}/24</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <section className="panel">
              <h2>Indicadores — {month(ps.period)} · clique para ver de onde veio o número</h2>
              <div className="ind-list">{periodInds.map((i) => <IndicatorTile key={i.id} ind={i} />)}</div>
            </section>
          </>
        ) : (
          <div className="banner">
            Este trecho aparece só na matriz do .docx (agrupando sentidos ou pistas). Os radares registram estes trechos separadamente — veja <Link className="link" href={`/corredores/${seg.corridorId}`}>{t.corridor}</Link>.
          </div>
        )}

        {otherInds.length > 0 && (
          <section className="panel">
            <h2>Matriz do estudo e indicadores pendentes</h2>
            <div className="ind-list">{otherInds.map((i) => <IndicatorTile key={i.id} ind={i} />)}</div>
          </section>
        )}

        <div className="grid-2">
          <section className="panel">
            <h2>Observações do estudo</h2>
            {seg.notesRaw && <p>&ldquo;{seg.notesRaw}&rdquo;</p>}
            {qual.map((q) => (
              <blockquote key={q} style={{ margin: "0 0 8px", paddingLeft: 12, borderLeft: "2px solid var(--border-strong)", color: "var(--text-2)" }}>{q}</blockquote>
            ))}
            {!seg.notesRaw && !qual.length && <p className="muted">Sem observação qualitativa específica no .docx.</p>}
            <p className="small muted">Citações — não convertidas em indicador ou nível.</p>
          </section>
          <section className="panel">
            <h2>Qualidade de dados</h2>
            {issues.length ? (
              <table>
                <tbody>
                  {issues.map((i) => (
                    <tr key={i.id}>
                      <td style={{ width: 110 }}><QualityBadge status={i.status} /></td>
                      <td><div className="mono small muted">{i.rule}</div>{i.message}<div className="small muted" style={{ overflowWrap: "anywhere" }}>{i.evidence}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">Sem registros.</p>
            )}
          </section>
        </div>

        <section className="panel">
          <h2>Metodologia utilizada neste trecho</h2>
          <ul className="small">{methods.map((m) => <li key={m.id}><Link className="link" href={`/metodologia#${m.id}`}>{m.id}</Link> — {m.name} · {m.status}</li>)}</ul>
        </section>
      </div>
    </>
  );
}
