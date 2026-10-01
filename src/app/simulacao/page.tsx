import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { HourlyChart } from "@/components/charts";
import { ConditionScale } from "@/components/ConditionScale";
import { DAY_TYPE_LABEL } from "@/components/badges";
import { segmentTitle } from "@/components/viewmodels";
import { runSimulation } from "@/simulation/run";
import { SCENARIOS, SIMULATION_PARAMS, type ScenarioId } from "@/simulation/generator";
import { classifyCondition, PEAK_WINDOWS } from "@/engine/series";
import type { ConditionThresholds } from "@/domain/types";

const fmt = (n: number | null | undefined, d = 0) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: d }));
const DAYS = ["DIA_UTIL", "SABADO", "DOMINGO"] as const;

export default async function SimulationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const r = repo();
  const segs = r.segments();
  const segmentId = sp.segment && r.segment(sp.segment) ? sp.segment : segs[1].id;
  const seed = sp.seed && Number.isFinite(Number(sp.seed)) ? Math.trunc(Number(sp.seed)) : 1;
  const scenario = (sp.scenario && sp.scenario in SCENARIOS ? sp.scenario : "fluxo-alto") as ScenarioId;
  const dayType = (DAYS as readonly string[]).includes(sp.day ?? "") ? (sp.day as (typeof DAYS)[number]) : "DIA_UTIL";
  const res = runSimulation(r, segmentId, seed, scenario, dayType)!;
  const t = segmentTitle(r, segmentId);

  const th = [sp.l1, sp.l2, sp.l3].map((x) => (x ? Number(x) : NaN));
  let thresholds: ConditionThresholds | null = null;
  let thErr: string | null = null;
  if (th.every(Number.isFinite)) {
    if (th[0] < th[1] && th[1] < th[2]) thresholds = { atencao: th[0], critico: th[1], congestionado: th[2] };
    else thErr = "Limites devem ser crescentes (L1 < L2 < L3).";
  }
  const level = thresholds ? classifyCondition(res.peak?.flow ?? null, thresholds) : "INDETERMINADO";
  const hasQueue = res.hourly.some((h) => h.queue != null);

  return (
    <>
      <Topbar title="Simulação" sub={`${t.full} · ${SCENARIOS[scenario].label} · ${DAY_TYPE_LABEL[dayType]} · semente ${seed}`} source="SIMULACAO" />
      <div className="content">
        <div className="banner sim">
          <strong>SIMULAÇÃO — dados sintéticos, não observados.</strong> Servem para testar o motor. Das fontes vêm só as janelas de pico por tipo de dia (§2.A), a faixa de pico do segmento (§1) e a madrugada baixa (§2.B).
          Multiplicadores dos cenários, formato da curva, ruído, <strong>velocidades e filas</strong> são arbitrários.
        </div>
        <section className="panel">
          <form className="inline" method="get">
            <label className="field">Segmento
              <select name="segment" defaultValue={segmentId}>
                {segs.map((s) => <option key={s.id} value={s.id}>{segmentTitle(r, s.id).full}</option>)}
              </select>
            </label>
            <label className="field">Cenário
              <select name="scenario" defaultValue={scenario}>
                {Object.entries(SCENARIOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="field">Tipo de dia
              <select name="day" defaultValue={dayType}>{DAYS.map((d) => <option key={d} value={d}>{DAY_TYPE_LABEL[d]}</option>)}</select>
            </label>
            <label className="field">Semente<input name="seed" type="number" defaultValue={seed} style={{ width: 80 }} /></label>
            <label className="field">L1<input name="l1" type="number" defaultValue={sp.l1} placeholder="veíc/h" style={{ width: 90 }} /></label>
            <label className="field">L2<input name="l2" type="number" defaultValue={sp.l2} placeholder="veíc/h" style={{ width: 90 }} /></label>
            <label className="field">L3<input name="l3" type="number" defaultValue={sp.l3} placeholder="veíc/h" style={{ width: 90 }} /></label>
            <button type="submit">Simular</button>
          </form>
        </section>
        <section className="kpis">
          <div className="kpi"><div className="kpi-label">Volume diário (sim.)</div><div className="kpi-value">{fmt(res.daily)}</div><div className="kpi-note">veíc/dia</div></div>
          <div className="kpi"><div className="kpi-label">Hora de pico (sim.)</div><div className="kpi-value">{res.peak ? `${String(res.peak.hour).padStart(2, "0")}h` : "—"}</div><div className="kpi-note">{fmt(res.peak?.flow)} veíc/h · {res.peakWindows?.insideWindow ? "dentro" : "fora"} das janelas §2.A</div></div>
          <div className="kpi"><div className="kpi-label">Velocidade média (sim.)</div><div className="kpi-value">{fmt(res.meanSpeed, 1)}</div><div className="kpi-note">km/h · sintética</div></div>
          <div className="kpi"><div className="kpi-label">Madrugada / pico</div><div className="kpi-value">{res.overnight ? `${fmt(res.overnight.ratio * 100, 1)}%` : "—"}</div><div className="kpi-note">§2.B: geralmente &lt; 5%</div></div>
          <div className="kpi"><div className="kpi-label">Fila máx. (sim.)</div><div className="kpi-value">{hasQueue ? `${fmt(Math.max(...res.hourly.map((h) => h.queue ?? 0)))} m` : "—"}</div><div className="kpi-note">{SCENARIOS[scenario].queue}</div></div>
          <div className="kpi"><div className="kpi-label">Condição (exp.)</div><div className="kpi-value muted">{level === "INDETERMINADO" ? "Não classificada" : level}</div><div className="kpi-note">{thresholds ? "limites do usuário" : "sem limites"}</div></div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Fluxo por hora — simulado</h2><span className="small muted">veíc/h</span></div>
          <HourlyChart unit="veíc/h" label="Fluxo horário simulado" windows={PEAK_WINDOWS[dayType]} series={[{ label: "Simulação", values: res.hourly.map((h) => h.flow), color: "var(--sim)" }]} />
        </section>
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Velocidade por hora — sintética</h2><span className="small muted">km/h · sem base documental</span></div>
            <HourlyChart unit="km/h" label="Velocidade sintética" series={[{ label: "Velocidade", values: res.hourly.map((h) => (h.speed == null ? null : Math.round(h.speed * 10) / 10)), color: "var(--sim)" }]} />
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Condição operacional — teste</h2><Link className="link small" href="/metodologia#M-CONDICAO">metodologia</Link></div>
            <ConditionScale thresholds={thresholds} active={level} unit="veíc/h" experimental />
            <p className="small" style={{ color: "var(--text-2)" }}>{thErr ?? (thresholds ? `Limites aplicados ao fluxo da hora de pico simulada (${fmt(res.peak?.flow)} veíc/h). Indicador-base escolhido só para teste.` : "Informe L1, L2 e L3 para testar a classificação.")}</p>
          </section>
        </div>
        {hasQueue && (
          <section className="panel">
            <div className="panel-head"><h2>Fila — sintética</h2><span className="small muted">m · fim de cada hora</span></div>
            <HourlyChart unit="m" label="Fila sintética" series={[{ label: "Fila", values: res.hourly.map((h) => h.queue), color: "var(--sim)" }]} />
          </section>
        )}
        <section className="panel">
          <h2>Parâmetros</h2>
          <table><tbody>
            <tr><td className="mono small">cenário</td><td>{SCENARIOS[scenario].label}</td><td className="small muted">{SCENARIOS[scenario].note} (arbitrário)</td></tr>
            {Object.entries(SIMULATION_PARAMS).map(([k, v]) => <tr key={k}><td className="mono small">{k}</td><td className="num">{String(v)}</td><td className="small muted">arbitrário</td></tr>)}
            <tr><td className="mono small">fator fim de semana</td><td className="num">{fmt(res.weekendFactor, 2)}</td><td className="small muted">sorteado em 0,50–0,75 a partir da queda de 25–50% da §2.B (aplicada ao pico: hipótese do simulador)</td></tr>
            <tr><td className="mono small">pico alvo</td><td className="num">{fmt(res.peakFlowTarget)}</td><td className="small muted">sorteado na maior faixa de pico da matriz × fatores</td></tr>
          </tbody></table>
        </section>
      </div>
    </>
  );
}
