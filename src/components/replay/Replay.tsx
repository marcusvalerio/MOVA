"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayDay, ReplaySegment } from "./types";

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

interface Car { id: number; lane: number; x: number; len: number; color: string; v: number }

export function Replay({ segments, initialSegment, initialDate }: { segments: ReplaySegment[]; initialSegment: string; initialDate: string }) {
  const [segId, setSegId] = useState(initialSegment);
  const seg = segments.find((s) => s.id === segId) ?? segments[0];
  const [date, setDate] = useState(initialDate);
  const day: ReplayDay = seg.days.find((d) => d.date === date) ?? seg.days.find((d) => d.complete) ?? seg.days[0];
  const [t, setT] = useState(6);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ t: 6, cars: [] as Car[], acc: 0, nextId: 1, last: 0, playing: true, rate: 1, day, seg });
  state.current.playing = playing;
  state.current.rate = rate;
  state.current.day = day;
  state.current.seg = seg;

  useEffect(() => {
    state.current.cars = [];
  }, [segId, date]);

  useEffect(() => {
    let raf = 0;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const PAL = ["#cfd6df", "#9aa7b5", "#e8ecf1", "#5b6573", "#b9c2cc", "#7f8a97", "#d9b48f"];
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
      const lanes = 3;
      const roadTop = H * 0.22, roadH = H * 0.54, laneH = roadH / lanes;
      // Escala de animação (não é contagem): taxa de surgimento proporcional ao fluxo do relatório.
      const spawnPerSec = flow != null ? (flow / 3600) * 8 * st.rate : 0;
      const vpx = (speed ?? 40) * (W / 170) * Math.sqrt(st.rate);
      if (st.playing && flow != null) {
        st.acc += spawnPerSec * dt;
        while (st.acc >= 1) {
          st.acc -= 1;
          const lane = Math.floor(Math.random() * lanes);
          const tail = st.cars.filter((c) => c.lane === lane).reduce((m, c) => Math.min(m, c.x), Infinity);
          if (tail < 70) continue;
          st.cars.push({ id: st.nextId++, lane, x: -40, len: 46 + Math.random() * 14, color: PAL[Math.floor(Math.random() * PAL.length)], v: vpx });
        }
      }
      for (let l = 0; l < lanes; l++) {
        const lc = st.cars.filter((c) => c.lane === l).sort((a, b) => b.x - a.x);
        for (let i = 0; i < lc.length; i++) {
          const c = lc[i];
          c.v += (vpx * (0.9 + ((c.id * 37) % 20) / 100) - c.v) * Math.min(1, dt * 2);
          let nx = c.x + (st.playing ? c.v * dt : 0);
          if (i > 0) nx = Math.min(nx, lc[i - 1].x - lc[i - 1].len - 8);
          c.x = nx;
        }
      }
      st.cars = st.cars.filter((c) => c.x < W + 60);

      ctx.fillStyle = "#151a21";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2a3039";
      ctx.fillRect(0, roadTop, W, roadH);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, roadTop); ctx.lineTo(W, roadTop); ctx.moveTo(0, roadTop + roadH); ctx.lineTo(W, roadTop + roadH); ctx.stroke();
      ctx.setLineDash([18, 16]);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      for (let l = 1; l < lanes; l++) { ctx.beginPath(); ctx.moveTo(0, roadTop + l * laneH); ctx.lineTo(W, roadTop + l * laneH); ctx.stroke(); }
      ctx.setLineDash([]);
      const lx = W * 0.62;
      ctx.strokeStyle = "rgba(80,220,120,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, roadTop - 6); ctx.lineTo(lx, roadTop + roadH + 6); ctx.stroke();
      ctx.fillStyle = "rgba(80,220,120,0.95)";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText("linha virtual de contagem", lx + 6, roadTop - 10);
      for (const c of st.cars) {
        const y = roadTop + c.lane * laneH + laneH * 0.26, h = laneH * 0.48;
        ctx.fillStyle = c.color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(c.x, y, c.len, h, 4); else ctx.rect(c.x, y, c.len, h);
        ctx.fill();
        ctx.fillStyle = "rgba(20,24,30,0.55)";
        ctx.fillRect(c.x + c.len * 0.62, y + 2, c.len * 0.18, h - 4);
        ctx.strokeStyle = "rgba(91,155,255,0.9)";
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x - 3, y - 3, c.len + 6, h + 6);
        ctx.fillStyle = "rgba(91,155,255,0.95)";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(`carro #${c.id}`, c.x - 3, y - 5);
      }
      if (flow == null) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, roadTop, W, roadH);
        ctx.fillStyle = "#fff";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("Hora sem dado no relatório (não preenchida)", 16, roadTop + roadH / 2);
      }
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("→ sentido " + st.seg.label.replace(/^Sentido /, "").split(" · ")[0], 12, roadTop + roadH + 22);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Animação ilustrativa · densidade e velocidade dos carros seguem o relatório da hora", 12, H - 10);
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
  const jump = (h: number) => { state.current.t = h + 0.5; setT(h + 0.5); };

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
