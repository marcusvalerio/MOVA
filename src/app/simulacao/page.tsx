import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { HourlyChart } from "@/components/charts";
import { ConditionScale } from "@/components/ConditionScale";
import { runSimulation } from "@/simulation/run";
import { SIMULATION_PARAMS } from "@/simulation/generator";
import { classifyCondition } from "@/engine/series";
import type { ConditionThresholds } from "@/domain/types";

const fmt = (n: number | null | undefined, d = 0) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: d }));

export default async function SimulationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const r = repo();
  const approaches = r.approaches();
  const approachId = sp.approach && r.approach(sp.approach) ? sp.approach : approaches[approaches.length - 1].id;
  const seed = Number.isFinite(Number(sp.seed)) && sp.seed ? Math.trunc(Number(sp.seed)) : 1;
  const res = runSimulation(r, approachId, seed)!;
  const c = r.corridor(res.approach.corridorId)!;

  const t = [sp.l1, sp.l2, sp.l3].map((x) => (x ? Number(x) : NaN));
  let thresholds: ConditionThresholds | null = null;
  let thresholdError: string | null = null;
  if (t.every(Number.isFinite)) {
    if (t[0] < t[1] && t[1] < t[2]) thresholds = { atencao: t[0], critico: t[1], congestionado: t[2] };
    else thresholdError = "Limites devem ser crescentes (L1 < L2 < L3).";
  }
  const level = thresholds ? classifyCondition(res.peak?.flow ?? null, thresholds) : "INDETERMINADO";
  const peakM = r.measurements(approachId).filter((m) => m.metric.startsWith("PICO") && m.value);
  const band = peakM.length ? { min: Math.min(...peakM.map((m) => m.value!.min)), max: Math.max(...peakM.map((m) => m.value!.max)), label: "faixa de pico da fonte" } : null;

  return (
    <>
      <Topbar title="Simulação" sub={`${c.name} · ${res.approach.label} · semente ${seed}`} source="SIMULACAO" />
      <div className="content">
        <div className="banner sim">
          <strong>SIMULAÇÃO — dados sintéticos, não observados.</strong> Usados apenas para exercitar o motor de cálculo. Da fonte vêm somente as janelas e faixas de pico da aproximação
          e a regra de madrugada &lt; 5% do pico (Seção 2.B). Formato da curva, ruído e <strong>todas as velocidades</strong> são parâmetros arbitrários.
        </div>

        <section className="panel">
          <form className="inline" method="get">
            <label className="field">Aproximação
              <select name="approach" defaultValue={approachId}>
                {approaches.map((a) => <option key={a.id} value={a.id}>{r.corridor(a.corridorId)!.name} · {a.label}</option>)}
              </select>
            </label>
            <label className="field">Semente<input name="seed" type="number" defaultValue={seed} style={{ width: 90 }} /></label>
            <label className="field">L1 atenção<input name="l1" type="number" defaultValue={sp.l1} placeholder="veíc/h" style={{ width: 100 }} /></label>
            <label className="field">L2 crítico<input name="l2" type="number" defaultValue={sp.l2} placeholder="veíc/h" style={{ width: 100 }} /></label>
            <label className="field">L3 congest.<input name="l3" type="number" defaultValue={sp.l3} placeholder="veíc/h" style={{ width: 100 }} /></label>
            <button type="submit">Simular</button>
          </form>
        </section>

        <section className="kpis">
          <div className="kpi"><div className="kpi-label">Volume diário (sim.)</div><div className="kpi-value">{fmt(res.daily)}</div><div className="kpi-note">fonte: {res.sourceVdm ? `${fmt(res.sourceVdm.min)}–${fmt(res.sourceVdm.max)}` : "—"} {res.dailyWithinSourceVdm === false ? "· fora da faixa" : res.dailyWithinSourceVdm ? "· dentro da faixa" : ""}</div></div>
          <div className="kpi"><div className="kpi-label">Hora de pico (sim.)</div><div className="kpi-value">{res.peak ? `${String(res.peak.hour).padStart(2, "0")}h` : "—"}</div><div className="kpi-note">{fmt(res.peak?.flow)} veíc/h</div></div>
          <div className="kpi"><div className="kpi-label">Velocidade média (sim.)</div><div className="kpi-value">{fmt(res.meanSpeed, 1)}</div><div className="kpi-note">km/h · sintética</div></div>
          <div className="kpi"><div className="kpi-label">Madrugada / pico</div><div className="kpi-value">{res.overnight ? `${fmt(res.overnight.ratio * 100, 1)}%` : "—"}</div><div className="kpi-note">regra Seção 2.B: &lt; 5% {res.overnight?.belowRule ? "· ok" : "· alerta"}</div></div>
          <div className="kpi"><div className="kpi-label">Observações</div><div className="kpi-value">{res.observationCount}</div><div className="kpi-note">intervalos de {SIMULATION_PARAMS.intervalMinutes} min</div></div>
          <div className="kpi"><div className="kpi-label">Condição (exp.)</div><div className="kpi-value muted">{level}</div><div className="kpi-note">{thresholds ? "limites do usuário" : "sem limites"}</div></div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Fluxo por hora — simulado</h2><span className="small muted">veíc/h · M-FLUXO-HORARIO (pendente)</span></div>
          <HourlyChart values={res.hourly.map((h) => h.flow)} unit="veíc/h" band={band} label="Fluxo horário simulado" />
        </section>
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Velocidade por hora — sintética</h2><span className="small muted">km/h · sem base documental</span></div>
            <HourlyChart values={res.hourly.map((h) => (h.speed == null ? null : Math.round(h.speed * 10) / 10))} unit="km/h" label="Velocidade média horária sintética" />
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Condição operacional — teste</h2><Link className="link small" href="/metodologia#M-CONDICAO">metodologia</Link></div>
            <ConditionScale thresholds={thresholds} active={level} unit="veíc/h" />
            <p className="small" style={{ marginTop: 12, color: "var(--text-2)" }}>
              {thresholdError ?? (thresholds
                ? `EXPERIMENTAL: limites informados pelo usuário aplicados ao fluxo da hora de pico simulada (${fmt(res.peak?.flow)} veíc/h). Não são limites validados.`
                : "Informe L1, L2 e L3 acima para testar a classificação. O indicador-base aqui é o fluxo horário, escolhido apenas para teste.")}
            </p>
          </section>
        </div>
        <section className="panel">
          <h2>Parâmetros da simulação</h2>
          <table><tbody>
            {Object.entries(SIMULATION_PARAMS).map(([k, v]) => <tr key={k}><td className="mono small">{k}</td><td className="num">{String(v)}</td><td className="small muted">{k === "overnightShare" ? "arbitrário, escolhido < 5% para respeitar a Seção 2.B" : "arbitrário"}</td></tr>)}
            <tr><td className="mono small">targetPeakFlow</td><td className="num">{fmt(res.targetPeakFlow)}</td><td className="small muted">sorteado dentro da maior faixa de pico da fonte</td></tr>
          </tbody></table>
        </section>
      </div>
    </>
  );
}
