"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayDay, ReplaySegment } from "./types";
import { createScene, drawScene, resetScene, stepScene, warmScene } from "./scene";

/**
 * Painel de reprodução: anima um dia REAL dos relatórios (fluxo e velocidade por hora).
 * A cena é ilustrativa: a densidade de carros acompanha o fluxo do relatório e a velocidade dos carros
 * acompanha a velocidade média do relatório. As caixas imitam a saída de um detector (YOLO), sem dados inventados.
 * As barras usam uma régua tirada dos próprios dados (máximo histórico do local) — não há limites/categorias.
 */

const DAY_LABEL: Record<string, string> = { DIA_UTIL: "dia útil", SABADO: "sábado", DOMINGO: "domingo", FERIADO: "feriado/atípico", DESCONHECIDO: "?" };
const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const SECONDS_PER_HOUR = 2.5;
const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/** Cor contínua verde → amarelo → laranja → vermelho para uma razão 0..1 (gradiente sem faixas nem limites). */
export function rampColor(r: number) {
  const t = Math.max(0, Math.min(1, r));
  const hue = 140 - 140 * t;
  return `hsl(${hue.toFixed(0)} 72% ${t > 0.5 ? 50 : 42}%)`;
}

/** Valor na hora fracionária t, interpolando entre os pontos médios das horas. Hora sem dado → null. */
export function sample(values: (number | null)[], t: number): number | null {
  const x = t - 0.5;
  const i0 = Math.floor(x);
  const a = values[(i0 + 24) % 24];
  const b = values[(i0 + 1) % 24];
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a + (b - a) * (x - i0);
}


export function Replay({ segments, initialSegment, initialDate }: { segments: ReplaySegment[]; initialSegment: string; initialDate: string }) {
  const [segId, setSegId] = useState(initialSegment);
  const seg = segments.find((s) => s.id === segId) ?? segments[0];
  const [date, setDate] = useState(initialDate);
  const day: ReplayDay = seg.days.find((d) => d.date === date) ?? seg.days.find((d) => d.complete) ?? seg.days[0];
  const [t, setT] = useState(6);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ t: 6, last: 0, playing: true, rate: 1, day, seg });
  const scene = useRef(createScene());
  state.current.playing = playing;
  state.current.rate = rate;
  state.current.day = day;
  state.current.seg = seg;

  useEffect(() => {
    resetScene(scene.current);
  }, [segId, date]);

  useEffect(() => {
    let raf = 0;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let lastUi = 0;
    const loop = (now: number) => {
      const st = state.current;
      const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0;
      st.last = now;
      const W = cv.clientWidth, H = cv.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (st.playing) st.t = (st.t + (dt * st.rate) / SECONDS_PER_HOUR) % 24;
      if (now - lastUi > 100) { lastUi = now; setT(st.t); }
      const flow = sample(st.day.flow, st.t);
      const speed = sample(st.day.speed, st.t);
      // Tráfego em tempo real (não acelerado): taxa de chegada = fluxo da hora; velocidade = velocidade da hora.
      if (!scene.current.warm) warmScene(scene.current, flow, speed);
      if (st.playing) stepScene(scene.current, dt, flow, speed);
      const hh = Math.floor(st.t), mm = Math.floor((st.t % 1) * 60), ss = Math.floor((((st.t % 1) * 60) % 1) * 60);
      const p2 = (n: number) => String(n).padStart(2, "0");
      const [y, mo, d] = st.day.date.split("-");
      drawScene(ctx, scene.current, W, H, {
        hour: st.t,
        camLabel: `CAM-01 · ${st.seg.corridor.toUpperCase()} · ${st.seg.location.toUpperCase()} · ${st.seg.label.replace(/^Sentido /, "SENTIDO ").toUpperCase()}`,
        stamp: `${d}/${mo}/${y} ${WD[new Date(st.day.date + "T12:00:00Z").getUTCDay()].toUpperCase()} ${p2(hh)}:${p2(mm)}:${p2(ss)}`,
        noData: flow == null,
        blink: Math.floor(now / 600) % 2 === 0,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hour = Math.floor(t) % 24;
  const flowNow = sample(day.flow, t);
  const speedNow = sample(day.speed, t);
  const flowRatio = flowNow != null ? flowNow / seg.maxFlow : null;
  const speedRatio = speedNow != null && seg.maxSpeed ? speedNow / seg.maxSpeed : null;
  const dayOpts = useMemo(() => seg.days.filter((d) => d.flow.some((v) => v != null)), [seg]);
  const wd = (d: string) => WD[new Date(d + "T12:00:00Z").getUTCDay()];
  const chartMax = Math.max(seg.maxFlow, ...day.flow.map((v) => v ?? 0));
  const jump = (h: number) => { state.current.t = h + 0.5; setT(h + 0.5); resetScene(scene.current); };

  return (
    <div className="replay">
      <div className="replay-controls">
        <label className="field">Local
          <select value={segId} onChange={(e) => { const s = segments.find((x) => x.id === e.target.value)!; setSegId(s.id); setDate((s.days.find((d) => d.complete && d.dayType === "DIA_UTIL") ?? s.days[0]).date); }}>
            {segments.map((s) => <option key={s.id} value={s.id}>{s.corridor} · {s.location} · {s.label.replace(/^Sentido /, "")}</option>)}
          </select>
        </label>
        <label className="field">Dia
          <select value={day.date} onChange={(e) => setDate(e.target.value)}>
            {dayOpts.map((d) => <option key={d.date} value={d.date}>{d.date.split("-").reverse().join("/")} · {wd(d.date)} · {DAY_LABEL[d.dayType]}{d.complete ? "" : " · incompleto"}</option>)}
          </select>
        </label>
        <div className="row">
          <button type="button" onClick={() => setPlaying((p) => !p)}>{playing ? "Pausar" : "Reproduzir"}</button>
          {[1, 2, 4].map((r) => <button key={r} type="button" className={rate === r ? "" : "ghost"} onClick={() => setRate(r)} aria-pressed={rate === r}>{r}×</button>)}
        </div>
      </div>

      <div className="replay-hud">
        <div className="clock">
          <span className="mono">{String(hour).padStart(2, "0")}:{String(Math.floor((t % 1) * 60)).padStart(2, "0")}</span>
          <small>{day.date.split("-").reverse().join("/")} · {wd(day.date)} · {DAY_LABEL[day.dayType]}</small>
        </div>
        <Meter label="Fluxo" value={flowNow != null ? `${fmt(flowNow)} veíc/h` : "sem dado"} ratio={flowRatio} color={flowRatio != null ? rampColor(flowRatio) : undefined}
          hint={`do maior fluxo já registrado aqui (${fmt(seg.maxFlow)} veíc/h, ${seg.maxFlowWhen})`} />
        <Meter label="Velocidade" value={speedNow != null ? `${fmt(speedNow)} km/h` : "sem dado"} ratio={speedRatio} color={speedRatio != null ? rampColor(1 - speedRatio) : undefined}
          hint={seg.maxSpeed ? `da maior velocidade média já registrada aqui (${fmt(seg.maxSpeed)} km/h)` : "sem velocidade no relatório"} />
        <div className="status-text">
          <span className="status-label">Condição operacional</span>
          <strong>Não classificada</strong>
          <small>Os limites entre normal, atenção, crítico e congestionado aguardam o professor. As barras mostram a intensidade relativa ao histórico do próprio local.</small>
        </div>
      </div>

      <canvas ref={canvasRef} className="replay-canvas" role="img" aria-label="Animação do tráfego no local selecionado" />

      <div className="replay-chart" aria-label="Fluxo por hora do dia selecionado">
        {day.flow.map((v, h) => (
          <button key={h} type="button" className={`bar${h === hour ? " now" : ""}`} onClick={() => jump(h)}
            title={`${String(h).padStart(2, "0")}h: ${v == null ? "sem dado" : `${fmt(v)} veíc/h`}${day.speed[h] != null ? ` · ${day.speed[h]} km/h` : ""}`}>
            <i style={{ height: v == null ? "100%" : `${Math.max(2, (v / chartMax) * 100)}%`, background: v == null ? "repeating-linear-gradient(45deg, var(--border-strong) 0 3px, transparent 3px 6px)" : rampColor(v / seg.maxFlow) }} />
            <span>{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>
          </button>
        ))}
        <div className="playhead" style={{ left: `${(t / 24) * 100}%` }} />
      </div>
      <p className="small muted">
        Fonte: {seg.source}. Um dia inteiro em {24 * SECONDS_PER_HOUR} s (1×). Clique numa barra para ir àquela hora; barras hachuradas = hora sem dado no relatório.
        {day.note ? ` Atenção: ${day.note}.` : ""}
      </p>
    </div>
  );
}

function Meter({ label, value, ratio, color, hint }: { label: string; value: string; ratio: number | null; color?: string; hint: string }) {
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><strong className="mono">{value}</strong></div>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio ?? 0)) * 100)}%`, background: color }} /></div>
      <small>{ratio != null ? <b>{Math.round(ratio * 100)}%</b> : null} {hint}</small>
    </div>
  );
}
