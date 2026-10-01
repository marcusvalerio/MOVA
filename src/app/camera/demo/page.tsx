import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { MethodBadge, OriginBadge } from "@/components/badges";
import { cvDemo } from "@/adapters/cv-demo";
import { getMethodology } from "@/methodology/registry";

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

export default function CvDemoPage() {
  const { run, events, observations, processed } = cvDemo();
  const v = run.camera.video;
  const mCont = getMethodology("M-CV-CONTAGEM");
  const mEq = getMethodology("M-FLUXO-EQUIVALENTE");
  const mCond = getMethodology("M-CONDICAO");
  const total = events.length;
  return (
    <>
      <Topbar title="Demonstração — visão computacional" sub="Vídeo → YOLO → rastreamento → contagem por linha → motor MOVA" source="CAMERA_TESTE" />
      <div className="content" style={{ maxWidth: 1200 }}>
        <div className="banner">
          <strong>Vídeo de demonstração com licença aberta — não é câmera CIVITAS nem via do Rio de Janeiro.</strong> Imagens da Ayalon Freeway (Tel Aviv). Nenhuma integração com
          a Prefeitura foi feita; o CIVITAS só será conectado com acesso autorizado.
        </div>

        <div className="grid-2">
          <section className="panel">
            <div className="panel-head"><h2>Vídeo anotado</h2><span className="small muted">{fmt(run.durationSeconds, 1)} s válidos de {fmt(run.framesInVideo / run.fps, 1)} s</span></div>
            <video controls muted playsInline loop preload="metadata" style={{ width: "100%", borderRadius: 6, background: "#000" }}>
              <source src="/cv-demo/annotated.webm" type="video/webm" />
              <source src="/cv-demo/annotated.mp4" type="video/mp4" />
            </video>
            <p className="small muted" style={{ marginTop: 8 }}>
              Linhas brancas = linhas virtuais de contagem (ficam verdes ao registrar um cruzamento). Caixas = veículos detectados, com o ID do rastreamento.
            </p>
            <p className="small muted">
              Fonte: <a className="link" href={v.url} target="_blank" rel="noreferrer">{v.title}</a>, por {v.author}, {v.license} (<a className="link" href={v.licenseUrl} target="_blank" rel="noreferrer">licença</a>).
              O vídeo anotado é obra derivada, distribuída sob a mesma licença.
            </p>
          </section>
          <section className="panel">
            <h2>Execução</h2>
            <table><tbody>
              <tr><td className="muted">Modelo</td><td className="mono small">{run.model.weights} · imgsz {run.model.imgsz} · conf ≥ {run.model.conf} · Ultralytics {run.model.ultralytics}</td></tr>
              <tr><td className="muted">Rastreamento</td><td className="mono small">{run.model.tracker}</td></tr>
              <tr><td className="muted">Classes</td><td className="small">{Object.values(run.model.classes).join(", ")} (COCO)</td></tr>
              <tr><td className="muted">Estabilização</td><td className="small">{run.stabilization.method} · mín. {run.stabilization.minInliers} inliers (observado: {run.stabilization.minInliersObserved})</td></tr>
              <tr><td className="muted">Janela válida</td><td className="small">quadros 0–{run.frames - 1} ({fmt(run.durationSeconds, 2)} s a {fmt(run.fps)} fps)</td></tr>
              <tr><td className="muted">Parada</td><td className="small">{run.stoppedReason}</td></tr>
              <tr><td className="muted">Processamento</td><td className="small">{fmt(run.processingSeconds)} s em CPU · {run.tracksTotal} rastros · {total} cruzamentos</td></tr>
              <tr><td className="muted">Data/hora</td><td className="small">desconhecida → tipo de dia DESCONHECIDO (não inventado)</td></tr>
            </tbody></table>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>Observado → Calculado → Interpretado</h2>
            <span className="small muted">cada linha virtual e sentido vira uma CameraObservation, processada pelo adaptador do MOVA</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Linha · sentido</th>
                  <th>Observado (n)</th>
                  <th>Classes</th>
                  <th>Confiança média</th>
                  <th>Calculado: q = n · 60 / Δt</th>
                  <th>Interpretado</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((p, i) => {
                  const o = observations[i];
                  return (
                    <tr key={o.cameraId + o.direction}>
                      <td>{o.cameraId.split(":")[1]} · {o.direction}</td>
                      <td className="num">{p.observado.vehicleCount}</td>
                      <td className="small">{Object.entries(o.vehicleTypes).map(([k, n]) => `${k} ${n}`).join(", ") || "—"}</td>
                      <td className="num">{o.vehicleCount ? fmt(o.confidence, 2) : "—"}</td>
                      <td className="num">{p.calculado.equivalentHourlyFlow == null ? "—" : `${fmt(p.calculado.equivalentHourlyFlow)} veíc/h`}<div className="small muted">{p.calculado.expression}</div></td>
                      <td className="small muted">{p.interpretado.condition === "INDETERMINADO" ? "Não classificada" : p.interpretado.condition}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 16 }}>
            <span className="row"><OriginBadge origin="OBSERVADO" /> <Link className="link small" href="/metodologia#M-CV-CONTAGEM">M-CV-CONTAGEM</Link> <MethodBadge status={mCont.status} /></span>
            <span className="row"><OriginBadge origin="CALCULADO" /> <Link className="link small" href="/metodologia#M-FLUXO-EQUIVALENTE">M-FLUXO-EQUIVALENTE</Link> <MethodBadge status={mEq.status} /></span>
            <span className="row"><OriginBadge origin="INTERPRETADO" /> <Link className="link small" href="/metodologia#M-CONDICAO">M-CONDICAO</Link> <MethodBadge status={mCond.status} /></span>
          </div>
          <p className="small" style={{ marginTop: 12, color: "var(--serious)" }}>
            Atenção: Δt = {fmt(run.durationSeconds, 2)} s. Extrapolar {fmt(run.durationSeconds, 1)} segundos para uma taxa horária amplifica qualquer erro de contagem ~{fmt(3600 / run.durationSeconds)}×.
            O valor calculado demonstra o encadeamento do motor; <strong>não é uma medida de fluxo horário</strong>. Com câmera real, o intervalo seria de minutos (ex.: 5 min, como no exemplo 127 → 1.524).
          </p>
        </section>

        <div className="grid-2">
          <section className="panel">
            <h2>Cruzamentos registrados (auditáveis)</h2>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
              <table>
                <thead><tr><th>t (s)</th><th>Rastro</th><th>Linha</th><th>Sentido</th><th>Classe</th><th>Conf.</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={`${e.track}-${e.linha}`}>
                      <td className="num">{fmt(e.tempo_s, 2)}</td><td className="num">#{e.track}</td><td className="small">{e.linha}</td><td className="small">{e.sentido}</td><td className="small">{e.classe}</td><td className="num">{fmt(e.confianca_media, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>Limitações</h2>
            <ul className="small">{run.limitations.map((l) => <li key={l} style={{ marginBottom: 4 }}>{l}</li>)}</ul>
            <h2 style={{ marginTop: 14 }}>O que a visão computacional NÃO faz aqui</h2>
            <ul className="small">
              <li>Não decide se a via está congestionada — isso é da metodologia (limites pendentes).</li>
              <li>Não estima velocidade nem fila — exigiria calibração métrica da cena.</li>
              <li>Não compara com os radares do Rio — o vídeo é de outro lugar.</li>
            </ul>
            <p className="small muted" style={{ marginTop: 10 }}>Para reproduzir: <code>cv/README.md</code>.</p>
          </section>
        </div>
      </div>
    </>
  );
}
