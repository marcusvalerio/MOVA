"use client";
import { useState } from "react";

const SAMPLE = JSON.stringify(
  { cameraId: "TESTE-01", timestamp: "2026-03-04T07:30:00-03:00", intervalSeconds: 300, vehicleCount: 127, vehicleTypes: { carro: 112, onibus: 9, moto: 6 }, averageSpeed: 18, queueLength: 60, direction: "Centro", occupancy: null, confidence: 0.82, source: "teste-manual" },
  null,
  2,
);

type Result = {
  valid: boolean;
  issues?: { path: string; message: string }[];
  observado?: Record<string, unknown>;
  calculado?: { equivalentHourlyFlow: number | null; expression: string | null; methodologyId: string; status: string };
  interpretado?: { condition: string; note: string; methodologyId: string };
};

export function CameraTester() {
  const [text, setText] = useState(SAMPLE);
  const [res, setRes] = useState<{ status: number; body: { results?: Result[]; error?: string } } | null>(null);
  async function send() {
    const r = await fetch("/api/camera/observations", { method: "POST", headers: { "content-type": "application/json" }, body: text });
    setRes({ status: r.status, body: await r.json() });
  }
  const first = res?.body.results?.[0];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label className="field">Payload CameraObservation (JSON)
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      </label>
      <div className="row"><button type="button" onClick={send}>Enviar para o motor</button><span className="small muted">Nada é persistido.</span></div>
      {res && (
        <div>
          <div className="small muted" style={{ marginBottom: 8 }}>HTTP {res.status}</div>
          {res.body.error && <p style={{ color: "var(--critical)" }}>{res.body.error}</p>}
          {first && !first.valid && (
            <ul className="small" style={{ color: "var(--critical)" }}>{first.issues?.map((i) => <li key={i.path}><code>{i.path || "(raiz)"}</code>: {i.message}</li>)}</ul>
          )}
          {first?.valid && (
            <div className="layers">
              <div className="layer">
                <div className="trace-kind">Observado · visão computacional</div>
                <ul className="small mono" style={{ listStyle: "none", padding: 0 }}>
                  {Object.entries(first.observado ?? {}).map(([k, v]) => <li key={k}>{k}: {v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</li>)}
                </ul>
              </div>
              <div className="layer">
                <div className="trace-kind">Calculado · motor de tráfego</div>
                <div className="ind-val">{first.calculado?.equivalentHourlyFlow?.toLocaleString("pt-BR") ?? "—"} veíc/h</div>
                <div className="small mono">{first.calculado?.expression}</div>
                <div className="small muted">{first.calculado?.methodologyId} · {first.calculado?.status === "INFERIDO" ? "Inferência" : first.calculado?.status}</div>
              </div>
              <div className="layer">
                <div className="trace-kind">Interpretado · metodologia</div>
                <div className="ind-val muted">{first.interpretado?.condition === "INDETERMINADO" ? "Não classificada" : first.interpretado?.condition}</div>
                <div className="small muted">{first.interpretado?.note}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
