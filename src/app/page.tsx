import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { ConditionScale } from "@/components/ConditionScale";
import { SchematicMap } from "@/components/SchematicMap";
import { RangeChart, type RangeRow } from "@/components/charts";
import { QualityBadge } from "@/components/badges";
import { METHODOLOGY } from "@/methodology/registry";
import { CONDITION_CONFIG } from "@/methodology/condition-config";
import { formatRange } from "@/normalization/parse";
import type { Measurement, QualityStatus } from "@/domain/types";

export default function Dashboard() {
  const r = repo();
  const corridors = r.corridors();
  const approaches = r.approaches();
  const ms = r.measurements();
  const issues = r.qualityIssues();

  const by = (metric: Measurement["metric"]) => ms.filter((m) => m.metric === metric && m.value);
  const topBy = (metric: Measurement["metric"]) => by(metric).reduce((a, b) => (b.value!.max > a.value!.max ? b : a));
  const topVdm = topBy("VDM_DIAS_UTEIS");
  const peaks = [...by("PICO_MANHA"), ...by("PICO_TARDE_NOITE")];
  const topPeak = peaks.reduce((a, b) => (b.value!.max > a.value!.max ? b : a));
  const nameOf = (approachId: string) => {
    const a = r.approach(approachId)!;
    return `${r.corridor(a.corridorId)!.name} · ${a.label}`;
  };
  const statusCount = (s: string) => METHODOLOGY.filter((m) => m.status === s).length;

  const peakByCorridor: Record<string, string> = {};
  for (const c of corridors) {
    const p = peaks.filter((m) => c.approachIds.includes(m.approachId));
    if (p.length) peakByCorridor[c.id] = `até ~${Math.max(...p.map((m) => m.value!.max)).toLocaleString("pt-BR")} veíc/h`;
  }

  // Aproximações BRT ficam em gráfico próprio: escala ~100× menor que as faixas mistas.
  const isBrt = (id: string) => /BRT/i.test(r.approach(id)!.lanesRaw) && r.approach(id)!.laneCount === 1;
  const rows: RangeRow[] = approaches.map((a) => ({
    id: a.id,
    label: r.corridor(a.corridorId)!.name,
    sub: a.label,
    series: (["PICO_MANHA", "PICO_TARDE_NOITE"] as const).flatMap((metric) => {
      const m = ms.find((x) => x.approachId === a.id && x.metric === metric);
      return m?.value ? [{ key: metric, min: m.value.min, max: m.value.max, window: m.windows.map((w) => `${w.start}–${w.end}`).join(" / ") }] : [];
    }),
  }));
  const qualityCounts = (["VALIDO", "SUSPEITO", "AUSENTE", "INCOMPLETO", "INVALIDO"] as QualityStatus[]).map((s) => [s, issues.filter((i) => i.status === s).length] as const);
  const cellsWithIssues = new Set(issues.filter((i) => i.target.kind === "measurement").map((i) => i.target.id)).size;

  return (
    <>
      <Topbar title="Painel operacional" sub="Corredores do Rio de Janeiro · valores reportados em faixas aproximadas" source="HISTORICO" />
      <div className="content">
        <section className="kpis" aria-label="Indicadores principais">
          <div className="kpi">
            <div className="kpi-label">Corredores</div>
            <div className="kpi-value">{corridors.length}</div>
            <div className="kpi-note">{approaches.length} sentidos/pistas na matriz</div>
          </div>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(topVdm.id)}`}>
            <div className="kpi-label">Maior VDM reportado</div>
            <div className="kpi-value">{formatRange(topVdm.value, null)}</div>
            <div className="kpi-note">veíc/dia · {r.corridor(r.approach(topVdm.approachId)!.corridorId)!.name}</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(topPeak.id)}`}>
            <div className="kpi-label">Maior pico reportado</div>
            <div className="kpi-value">{formatRange(topPeak.value, null)}</div>
            <div className="kpi-note">veíc/h · {topPeak.windows.map((w) => `${w.start}–${w.end}`).join(" / ")}</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(`${approaches[0].id}--VELOCIDADE`)}`}>
            <div className="kpi-label">Velocidade média</div>
            <div className="kpi-value muted">Sem dado</div>
            <div className="kpi-note">não discriminada na fonte</div>
          </Link>
          <Link className="kpi" href="/metodologia">
            <div className="kpi-label">Metodologias</div>
            <div className="kpi-value">{METHODOLOGY.length}</div>
            <div className="kpi-note">{statusCount("CONFIRMADO")} confirmada · {statusCount("EXPERIMENTAL")} exp. · {statusCount("PENDENTE")} pend.</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(`${approaches[0].id}--CONDICAO`)}`}>
            <div className="kpi-label">Condição operacional</div>
            <div className="kpi-value muted">Indeterminada</div>
            <div className="kpi-note">limites não definidos</div>
          </Link>
        </section>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Corredores</h2>
              <span className="small muted">clique para detalhar</span>
            </div>
            <SchematicMap corridors={corridors} peakByCorridor={peakByCorridor} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Condição operacional</h2>
              <Link className="link small" href="/metodologia#M-CONDICAO">metodologia</Link>
            </div>
            <ConditionScale thresholds={CONDITION_CONFIG.thresholds} active="INDETERMINADO" />
            <p className="small" style={{ marginTop: 16, color: "var(--text-2)" }}>
              A fonte traz apenas avaliações qualitativas (ex.: Linha Vermelha &ldquo;frequentemente atingindo o Nível de Serviço E/F nos gargalos de acesso&rdquo;).
              Elas aparecem na página de cada corredor como citação, sem serem convertidas em nível da escala.
            </p>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
              <div className="panel-head" style={{ marginBottom: 8 }}>
                <h2>Qualidade de dados</h2>
                <Link className="link small" href="/qualidade">ver registros</Link>
              </div>
              <div className="row">
                {qualityCounts.filter(([, n]) => n > 0).map(([s, n]) => (
                  <span key={s} className="row" style={{ gap: 6, marginRight: 10 }}>
                    <QualityBadge status={s} /> <span className="mono">{n}</span>
                  </span>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>{cellsWithIssues} de {ms.length} células numéricas têm ao menos um registro. Nenhum valor foi corrigido.</p>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Fluxo de pico reportado — tráfego misto</h2>
            <span className="small muted">faixa mín–máx da fonte · veíc/h · passe o cursor para ver a janela</span>
          </div>
          <RangeChart rows={rows.filter((x) => !isBrt(x.id))} unit="veíc/h" seriesLabels={{ PICO_MANHA: "Pico manhã", PICO_TARDE_NOITE: "Pico tarde/noite" }} />
        </section>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Fluxo de pico reportado — BRT</h2>
              <span className="small muted">escala própria (≈100× menor)</span>
            </div>
            <RangeChart rows={rows.filter((x) => isBrt(x.id))} unit="veíc/h" seriesLabels={{ PICO_MANHA: "Pico manhã", PICO_TARDE_NOITE: "Pico tarde/noite" }} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Séries horárias e velocidade</h2>
            </div>
            <p style={{ color: "var(--text-2)" }}>
              A fonte disponível não contém séries hora a hora nem valores de velocidade — apenas janelas de pico e faixas. Os gráficos de fluxo e velocidade por hora
              ficam disponíveis no <Link className="link" href="/simulacao">modo Simulação</Link> (claramente identificado) até que os relatórios primários sejam incorporados.
            </p>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Matriz de corredores</h2>
            <span className="small muted">valores literais da fonte (Seção 1)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Corredor</th>
                  <th>Sentido / pista</th>
                  <th>VDM dias úteis</th>
                  <th>Fim de semana</th>
                  <th>Pico manhã</th>
                  <th>Pico tarde/noite</th>
                </tr>
              </thead>
              <tbody>
                {approaches.map((a) => {
                  const cell = (metric: Measurement["metric"]) => {
                    const m = ms.find((x) => x.approachId === a.id && x.metric === metric)!;
                    return (
                      <td className="num">
                        <Link className="link" href={`/rastreio/${encodeURIComponent(m.id)}`}>{m.raw}</Link>
                      </td>
                    );
                  };
                  return (
                    <tr key={a.id}>
                      <td><Link className="link" href={`/corredores/${a.corridorId}`}>{r.corridor(a.corridorId)!.name}</Link></td>
                      <td>{a.label}</td>
                      {cell("VDM_DIAS_UTEIS")}
                      {cell("VOLUME_FIM_DE_SEMANA")}
                      {cell("PICO_MANHA")}
                      {cell("PICO_TARDE_NOITE")}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>&ldquo;veg&rdquo; reproduzido como na fonte; interpretado como veículos (registro de qualidade UNIDADE_GRAFIA). Maior VDM: {nameOf(topVdm.approachId)}.</p>
        </section>
      </div>
    </>
  );
}
