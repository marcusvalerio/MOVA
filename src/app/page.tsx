import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { ConditionScale } from "@/components/ConditionScale";
import { SchematicMap } from "@/components/SchematicMap";
import { HourlyChart, RangeChart, type RangeRow } from "@/components/charts";
import { DAY_TYPE_LABEL, QualityBadge } from "@/components/badges";
import { SERIES_COLORS, segmentTitle, seriesValues } from "@/components/viewmodels";
import { CONDITION_CONFIG } from "@/methodology/condition-config";
import { comparability } from "@/engine/compare";
import { PEAK_WINDOWS } from "@/engine/series";
import { formatRange } from "@/normalization/parse";
import type { Measurement, QualityStatus } from "@/domain/types";

export default function Dashboard() {
  const r = repo();
  const segments = r.segments();
  const ms = r.measurements();
  const issues = r.qualityIssues();
  const series = r.series();
  const inds = r.indicators();

  const by = (metric: Measurement["metric"]) => ms.filter((m) => m.metric === metric && m.value);
  const topVdm = by("VDM_DIAS_UTEIS").reduce((a, b) => (b.value!.max > a.value!.max ? b : a));
  const peaks = [...by("PICO_MANHA"), ...by("PICO_TARDE_NOITE")];
  const topPeak = peaks.reduce((a, b) => (b.value!.max > a.value!.max ? b : a));
  const seriesPeaks = inds.filter((i) => i.key === "pico-serie");
  const topObserved = seriesPeaks.reduce((a, b) => (b.value!.max > a.value!.max ? b : a), seriesPeaks[0]);
  const origins = (o: string) => inds.filter((i) => i.origin === o).length;

  const peakByLocation: Record<string, string> = {};
  for (const l of r.locations()) {
    const p = peaks.filter((m) => l.segmentIds.includes(m.segmentId));
    if (p.length) peakByLocation[l.id] = `pico até ~${Math.max(...p.map((m) => m.value!.max)).toLocaleString("pt-BR")} veíc/h`;
  }

  const rows: RangeRow[] = segments.map((s) => ({
    id: s.id,
    label: r.location(s.locationId)!.address,
    sub: s.label,
    series: (["PICO_MANHA", "PICO_TARDE_NOITE"] as const).flatMap((metric) => {
      const m = ms.find((x) => x.segmentId === s.id && x.metric === metric);
      return m?.value ? [{ key: metric, min: m.value.min, max: m.value.max, window: m.windows.map((w) => `${w.start}–${w.end}`).join(" / ") }] : [];
    }),
  }));
  const isBrt = (id: string) => r.segment(id)!.laneType === "BRT";

  const featured = series.filter((s) => s.segmentId === series[0]?.segmentId).sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
  const comp = featured.length > 1 ? comparability({ ...featured[0], label: featured[0].label }, { ...featured[1], label: featured[1].label }) : null;
  const qualityCounts = (["SUSPEITO", "INCOMPLETO", "AUSENTE", "INVALIDO"] as QualityStatus[]).map((s) => [s, issues.filter((i) => i.status === s).length] as const);

  return (
    <>
      <Topbar title="Painel operacional" sub="Corredores do Rio de Janeiro · dados do estudo (UFRJ / Parâmetros do Fluxo de Tráfego)" source="HISTORICO" />
      <div className="content">
        <section className="kpis" aria-label="Indicadores principais">
          {topObserved && (
            <Link className="kpi" href={`/rastreio/${encodeURIComponent(topObserved.id)}`}>
              <div className="kpi-label">Fluxo horário máx. observado</div>
              <div className="kpi-value">{topObserved.value!.max.toLocaleString("pt-BR")}</div>
              <div className="kpi-note">veíc/h · {topObserved.display.split("·")[1]?.trim()} · {topObserved.period.split("·")[0]}</div>
            </Link>
          )}
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(`${segments[0].id}--VELOCIDADE`)}`}>
            <div className="kpi-label">Velocidade média</div>
            <div className="kpi-value muted">Sem dado</div>
            <div className="kpi-note">relatório de velocidades não incorporado</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(topVdm.id)}`}>
            <div className="kpi-label">Maior VDM reportado</div>
            <div className="kpi-value">{formatRange(topVdm.value, null)}</div>
            <div className="kpi-note">veíc/dia · {segmentTitle(r, topVdm.segmentId).corridor} (matriz)</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(topPeak.id)}`}>
            <div className="kpi-label">Maior pico reportado</div>
            <div className="kpi-value">{formatRange(topPeak.value, null)}</div>
            <div className="kpi-note">veíc/h · {topPeak.windows.map((w) => `${w.start}–${w.end}`).join(" / ")} · {segmentTitle(r, topPeak.segmentId).corridor}</div>
          </Link>
          <Link className="kpi" href="/metodologia">
            <div className="kpi-label">Indicadores</div>
            <div className="kpi-value">{inds.length}</div>
            <div className="kpi-note">{origins("OBSERVADO")} observados · {origins("CALCULADO")} calculados · {origins("INDISPONIVEL")} sem dado</div>
          </Link>
          <Link className="kpi" href={`/rastreio/${encodeURIComponent(`${segments[0].id}--CONDICAO`)}`}>
            <div className="kpi-label">Condição operacional</div>
            <div className="kpi-value muted">Não classificada</div>
            <div className="kpi-note">limites pendentes de validação</div>
          </Link>
        </section>

        {featured.length > 0 && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Fluxo por hora — séries observadas</h2>
                <div className="small muted">{segmentTitle(r, featured[0].segmentId).full}</div>
              </div>
              <Link className="link small" href={`/segmentos/${encodeURIComponent(featured[0].segmentId)}`}>abrir segmento →</Link>
            </div>
            <HourlyChart
              unit="veíc/h"
              label="Fluxo horário observado"
              windows={PEAK_WINDOWS.DIA_UTIL.map((w) => ({ ...w, label: w.label }))}
              series={featured.slice(0, 2).map((s, i) => ({ label: `${s.label} · ${DAY_TYPE_LABEL[s.dayType]}`, values: seriesValues(r, s), color: SERIES_COLORS[i], dashed: i === 1 }))}
            />
            {comp && !comp.comparable && (
              <p className="small" style={{ marginTop: 8, color: "var(--serious)" }}>Comparação com ressalva (M-COMPARACAO): {comp.warnings.join(" ")}</p>
            )}
            <p className="small muted" style={{ marginTop: 4 }}>Horas sem dado aparecem como lacuna (não interpoladas). Valores transcritos na especificação a partir do PDF de fluxos — conferir com o original.</p>
          </section>
        )}

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Locais de medição</h2>
              <Link className="link small" href="/corredores">todos os corredores</Link>
            </div>
            <SchematicMap locations={r.locations()} peakByLocation={peakByLocation} />
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Condição operacional</h2>
              <Link className="link small" href="/metodologia#M-CONDICAO">metodologia</Link>
            </div>
            <ConditionScale thresholds={CONDITION_CONFIG.thresholds} active="INDETERMINADO" />
            <p className="small" style={{ marginTop: 12, color: "var(--text-2)" }}>
              As avaliações da fonte (ex.: Linha Vermelha &ldquo;Nível de Serviço E/F nos gargalos de acesso&rdquo;; Jardim Botânico &ldquo;rapidamente ao estado de saturação&rdquo;) aparecem como citação nos segmentos — não são convertidas em nível.
            </p>
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
              <div className="panel-head" style={{ marginBottom: 8 }}>
                <h2>Qualidade de dados</h2>
                <Link className="link small" href="/qualidade">ver registros</Link>
              </div>
              <div className="row">
                {qualityCounts.filter(([, n]) => n > 0).map(([s, n]) => (
                  <span key={s} className="row" style={{ gap: 6, marginRight: 10 }}><QualityBadge status={s} /> <span className="mono">{n}</span></span>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>Nenhum valor foi corrigido ou preenchido automaticamente.</p>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Fluxo de pico reportado — faixas mistas</h2>
            <span className="small muted">faixa mín–máx da matriz (§1) · veíc/h</span>
          </div>
          <RangeChart rows={rows.filter((x) => !isBrt(x.id))} unit="veíc/h" seriesLabels={{ PICO_MANHA: "Pico manhã", PICO_TARDE_NOITE: "Pico tarde/noite" }} />
        </section>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Fluxo de pico reportado — faixa exclusiva BRT</h2>
              <span className="small muted">escala própria</span>
            </div>
            <RangeChart rows={rows.filter((x) => isBrt(x.id))} unit="veíc/h" seriesLabels={{ PICO_MANHA: "Pico manhã", PICO_TARDE_NOITE: "Pico tarde/noite" }} />
            <p className="small muted" style={{ marginTop: 8 }}>Ônibus/articulados: não comparar diretamente com faixas mistas (§2.C — maior transporte de passageiros por veículo).</p>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Velocidade por hora</h2></div>
            <p style={{ color: "var(--text-2)" }}>
              Sem dados. O relatório de velocidades (velocidade média por horário e 85º percentil) ainda não foi incorporado. O modelo já suporta esses campos; a comparação fluxo × velocidade será exibida lado a lado, sem classificação automática.
            </p>
            <Link className="link small" href="/simulacao?scenario=velocidade-baixa">ver comportamento no modo Simulação →</Link>
          </section>
        </div>
      </div>
    </>
  );
}
