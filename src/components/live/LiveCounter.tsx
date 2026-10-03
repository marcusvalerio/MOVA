"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { equivalentHourlyFlow } from "@/engine/series";
import { Tracker, trackClass, type Track } from "@/live/tracker";
import { cropAroundLines, decodeYolo, letterbox, rgbaToChw, VEHICLE_CLASS_LABEL, type Rect, type VehicleClass } from "@/live/yolo";
import {
  aggregateIntervals, compareCheck, dirLabel, LineCounter, positiveNormal, toCameraObservation, toSaoPauloIso,
  type CountLine, type CrossingEvent, type ManualCheck,
} from "@/live/counter";

/* ---------- runtime do onnxruntime-web (carregado de /ort, copiado de node_modules por scripts/copy-ort.mjs) ---------- */
type OrtTensor = { data: Float32Array<ArrayBuffer>; dims: number[] };
type OrtSession = { inputNames: string[]; outputNames: string[]; run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>> };
type Ort = {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create(url: string, opts: { executionProviders: string[]; graphOptimizationLevel?: string }): Promise<OrtSession> };
};
declare global { interface Window { ort?: Ort } }

function loadOrt(): Promise<Ort> {
  if (window.ort) return Promise.resolve(window.ort);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/ort/ort.webgpu.min.js";
    s.onload = () => (window.ort ? resolve(window.ort) : reject(new Error("onnxruntime-web não carregou")));
    s.onerror = () => reject(new Error("Falha ao baixar /ort/ort.webgpu.min.js (rode npm run dev ou npm run build, que copiam o runtime)"));
    document.head.appendChild(s);
  });
}

const MODEL_URL = "/models/yolo11n.onnx";
const SIZE = 640;
const DET = { conf: 0.25, iou: 0.6 };
const SOURCE_LABEL = "YOLO11n no navegador (onnxruntime-web) + rastreador simplificado · contador ao vivo MOVA";
const CLASS_COLOR: Record<VehicleClass, string> = { carro: "#2f6fdb", moto: "#d6457a", onibus: "#f2c94c", caminhao: "#dd6b20" };
const LS_KEY = "mova.live.v1";
/** Ritmo de análise de arquivos de vídeo: quadros do vídeo por segundo analisados (não é tempo real). */
const FILE_FPS = 10;

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const clock = (ms: number) => toSaoPauloIso(ms).slice(11, 19);

type Source = { kind: "tab"; stream: MediaStream } | { kind: "file"; url: string; name: string };
type Phase = "setup" | "running" | "stopped";
type Saved = { cameraId: string; lines: CountLine[]; intervalS: number };

function readSaved(): Partial<Saved> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Partial<Saved>; } catch { return {}; }
}

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Posiciona o vídeo em t e espera o quadro ficar disponível (sem esperar para sempre por um "seeked" que não vem). */
function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  if (Math.abs(v.currentTime - t) < 1e-3 && v.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); v.removeEventListener("seeked", done); resolve(); };
    const timer = setTimeout(done, 3000);
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

export function LiveCounter() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const work = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; buf: Float32Array<ArrayBuffer> } | null>(null);
  const session = useRef<{ ort: Ort; s: OrtSession } | null>(null);
  const engine = useRef<{ tracker: Tracker; counter: LineCounter; coverage: number[]; crop: Rect; t0: number; startedAtMs: number | null } | null>(null);
  const overlay = useRef<{ tracks: Track[]; flash: Record<string, number> }>({ tracks: [], flash: {} });
  const running = useRef(false);

  const [source, setSource] = useState<Source | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [lines, setLines] = useState<CountLine[]>([]);
  const [cameraId, setCameraId] = useState("BR101-SUL-TESTE");
  const [intervalS, setIntervalS] = useState(60);
  const [useCrop, setUseCrop] = useState(true);
  const [fileStart, setFileStart] = useState("");
  const [pending, setPending] = useState<[number, number] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [model, setModel] = useState<{ status: "idle" | "loading" | "ready" | "error"; backend?: string; msg?: string }>({ status: "idle" });
  const [stats, setStats] = useState({ frames: 0, fps: 0, elapsed: 0, inferMs: 0 });
  const [events, setEvents] = useState<CrossingEvent[]>([]);
  const [coverage, setCoverage] = useState<number[]>([]);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [check, setCheckState] = useState<ManualCheck | null>(null);
  const checkRef = useRef<ManualCheck | null>(null);
  const setCheck = useCallback((c: ManualCheck | null) => { checkRef.current = c; setCheckState(c); }, []);
  const [checks, setChecks] = useState<ManualCheck[]>([]);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  /* ---------- preferências locais (só conveniência; nada depende disso) ---------- */
  useEffect(() => {
    const s = readSaved();
    if (s.cameraId) setCameraId(s.cameraId);
    if (Array.isArray(s.lines)) setLines(s.lines);
    if (s.intervalS === 60 || s.intervalS === 300) setIntervalS(s.intervalS);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ cameraId, lines, intervalS } satisfies Saved)); } catch { /* armazenamento indisponível */ }
  }, [cameraId, lines, intervalS]);

  useEffect(() => {
    const f = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  /* ---------- fonte de vídeo ---------- */
  async function shareTab() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (running.current) stop("compartilhamento da aba encerrado");
        setSource(null);
      });
      setStopReason(null);
      setSource({ kind: "tab", stream });
    } catch (e) {
      setStopReason(`Compartilhamento não iniciado: ${(e as Error).message}`);
    }
  }
  function openFile(f: File | undefined) {
    if (!f) return;
    setStopReason(null);
    setSource({ kind: "file", url: URL.createObjectURL(f), name: f.name });
  }
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !source) return;
    if (source.kind === "tab") { v.srcObject = source.stream; v.src = ""; void v.play(); }
    else { v.srcObject = null; v.src = source.url; v.pause(); }
  }, [source]);

  /* ---------- modelo ---------- */
  const ensureModel = useCallback(async () => {
    if (session.current) return session.current;
    setModel({ status: "loading" });
    try {
      const ort = await loadOrt();
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1; // multi-thread exige isolamento de origem e travou nos testes; WebGPU é o caminho rápido
      let s: OrtSession, backend = "WebGPU";
      try {
        if (!("gpu" in navigator)) throw new Error("sem WebGPU");
        s = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["webgpu"], graphOptimizationLevel: "all" });
      } catch {
        backend = "WASM (CPU)";
        s = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      }
      await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", new Float32Array(3 * SIZE * SIZE), [1, 3, SIZE, SIZE]) });
      session.current = { ort, s };
      setModel({ status: "ready", backend });
      return session.current;
    } catch (e) {
      setModel({ status: "error", msg: (e as Error).message });
      throw e;
    }
  }, []);

  /* ---------- análise de um quadro ---------- */
  async function analyze(t: number) {
    const v = videoRef.current, eng = engine.current, m = session.current;
    if (!v || !eng || !m || v.videoWidth === 0) return;
    if (!work.current) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      work.current = { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })!, buf: new Float32Array(3 * SIZE * SIZE) };
    }
    const { ctx, buf } = work.current, c = eng.crop, lb = letterbox(c.w, c.h, SIZE);
    ctx.fillStyle = "rgb(114,114,114)";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(v, c.x, c.y, c.w, c.h, lb.padX, lb.padY, lb.w, lb.h);
    const input = rgbaToChw(ctx.getImageData(0, 0, SIZE, SIZE).data, SIZE, buf);
    const t1 = performance.now();
    const r = await m.s.run({ [m.s.inputNames[0]]: new m.ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
    const inferMs = performance.now() - t1;
    const out = r[m.s.outputNames[0]];
    const dets = decodeYolo(out.data, out.dims[2], lb, c, DET);
    const tracks = eng.tracker.update(dets, t);
    const crossed = eng.counter.update(tracks, t);
    eng.coverage.push(t);
    overlay.current.tracks = tracks;
    for (const e of crossed) overlay.current.flash[e.line] = performance.now();
    return inferMs;
  }

  /* ---------- laço principal ---------- */
  async function start() {
    const v = videoRef.current;
    if (!v || !source || !lines.length) return;
    if (v.videoWidth === 0) { setStopReason("A imagem ainda não está disponível."); return; }
    try { await ensureModel(); } catch { return; /* erro exibido no painel */ }
    const w = v.videoWidth, h = v.videoHeight;
    let startMs: number | null = null;
    if (source.kind === "tab") startMs = Date.now();
    else if (fileStart) startMs = new Date(`${fileStart}:00-03:00`).getTime();
    engine.current = {
      tracker: new Tracker(), counter: new LineCounter(lines, w, h), coverage: [],
      crop: useCrop ? cropAroundLines(lines, w, h) : { x: 0, y: 0, w, h }, t0: performance.now(), startedAtMs: startMs,
    };
    overlay.current = { tracks: [], flash: {} };
    setStartedAtMs(startMs);
    setEvents([]); setCoverage([]); setChecks([]); setCheck(null); setStopReason(null);
    setPhase("running");
    running.current = true;
    if (source.kind === "file") { v.pause(); await seekTo(v, 0); }

    let frames = 0, lastUi = 0, winStart = performance.now(), winFrames = 0, fps = 0, inferAcc = 0;
    while (running.current) {
      const eng = engine.current!;
      const t = source.kind === "tab" ? (performance.now() - eng.t0) / 1000 : v.currentTime;
      const ms = await analyze(t);
      frames++; winFrames++; inferAcc += ms ?? 0;
      const now = performance.now();
      if (now - winStart >= 1000) { fps = (winFrames * 1000) / (now - winStart); winStart = now; winFrames = 0; }
      if (now - lastUi > 400) {
        lastUi = now;
        setStats({ frames, fps, elapsed: t, inferMs: inferAcc / frames });
        setEvents([...eng.counter.events]); setCoverage([...eng.coverage]);
      }
      if (source.kind === "file") {
        const next = v.currentTime + 1 / FILE_FPS;
        if (next >= v.duration) { stop("fim do vídeo", v.duration); break; }
        await seekTo(v, next);
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  function stop(reason: string, endT?: number) {
    running.current = false;
    const eng = engine.current;
    if (eng) {
      const t = endT ?? (source?.kind === "file" ? videoRef.current?.currentTime ?? 0 : (performance.now() - eng.t0) / 1000);
      setEvents([...eng.counter.events]); setCoverage([...eng.coverage]);
      setStats((s) => ({ ...s, elapsed: t }));
    }
    const c = checkRef.current;
    if (c && eng) {
      const t = endT ?? (source?.kind === "file" ? videoRef.current?.currentTime ?? 0 : (performance.now() - eng.t0) / 1000);
      setChecks((cs) => [...cs, { ...c, endS: t }]);
    }
    setCheck(null);
    setStopReason(reason);
    setPhase("stopped");
  }

  /* ---------- desenho ---------- */
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = videoRef.current, cv = canvasRef.current;
      if (!v || !cv || v.videoWidth === 0) return;
      const w = v.videoWidth, h = v.videoHeight;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(v, 0, 0, w, h);
      const u = Math.max(w, h) / 900;
      const eng = engine.current;
      const crop = running.current && eng ? eng.crop : useCrop && lines.length ? cropAroundLines(lines, w, h) : null;
      if (crop) {
        ctx.setLineDash([8 * u, 6 * u]); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5 * u;
        ctx.strokeRect(crop.x, crop.y, crop.w, crop.h); ctx.setLineDash([]);
      }
      if (running.current) {
        ctx.font = `${12 * u}px ui-monospace, monospace`;
        for (const tr of overlay.current.tracks) {
          const cls = trackClass(tr), b = tr.box;
          ctx.strokeStyle = CLASS_COLOR[cls]; ctx.lineWidth = 2 * u;
          ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
          ctx.fillStyle = CLASS_COLOR[cls];
          ctx.fillText(`#${tr.id}`, b.x1, b.y1 - 3 * u);
        }
      }
      const counts = eng?.counter.events ?? [];
      lines.forEach((l, i) => {
        const a = [l.p1[0] * w, l.p1[1] * h], b = [l.p2[0] * w, l.p2[1] * h];
        const fl = performance.now() - (overlay.current.flash[l.id] ?? 0) < 350;
        ctx.strokeStyle = fl ? "#3ccf7f" : "#ffffff"; ctx.lineWidth = (fl ? 5 : 3) * u;
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4 * u;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const [nx, ny] = positiveNormal(l, w, h), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, L = 26 * u;
        for (const sgn of [1, -1] as const) {
          const ex = mx + sgn * nx * L, ey = my + sgn * ny * L;
          ctx.strokeStyle = sgn === 1 ? "#5b9bff" : "#f2994a"; ctx.lineWidth = 2.5 * u;
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.beginPath(); ctx.arc(ex, ey, 3.5 * u, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
          const n = counts.filter((e) => e.line === l.id && e.dir === sgn).length;
          ctx.font = `600 ${13 * u}px ui-sans-serif, sans-serif`; ctx.fillStyle = "#fff";
          ctx.fillText(`${sgn === 1 ? "+" : "−"} ${n}`, ex + sgn * nx * 6 * u + 4 * u, ey + sgn * ny * 6 * u + 4 * u);
        }
        ctx.font = `600 ${14 * u}px ui-sans-serif, sans-serif`; ctx.fillStyle = "#fff";
        ctx.fillText(`${i + 1}. ${l.label}`, b[0] + 6 * u, b[1]);
        ctx.shadowBlur = 0;
      });
      if (pending) {
        ctx.fillStyle = "#3ccf7f"; ctx.beginPath(); ctx.arc(pending[0] * w, pending[1] * h, 6 * u, 0, Math.PI * 2); ctx.fill();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [lines, pending, useCrop]);

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || phase === "running") return;
    const r = e.currentTarget.getBoundingClientRect();
    const p: [number, number] = [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)];
    if (!pending) { setPending(p); return; }
    const n = lines.length + 1;
    let id = `L${n}`;
    while (lines.some((l) => l.id === id)) id += "b";
    setLines([...lines, { id, label: `Linha ${n}`, p1: pending, p2: p, positive: "sentido +", negative: "sentido −" }]);
    setPending(null); setDrawing(false);
  }
  const editLine = (id: string, patch: Partial<CountLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  /* ---------- conferência manual ---------- */
  const keys = useMemo(() => lines.flatMap((l) => ([1, -1] as const).map((dir) => ({ key: `${l.id}|${dir}`, line: l, dir }))), [lines]);
  const nowS = () => {
    const eng = engine.current;
    if (!eng) return 0;
    return source?.kind === "file" ? videoRef.current?.currentTime ?? 0 : (performance.now() - eng.t0) / 1000;
  };
  const tally = useCallback((key: string, d: number) => {
    const c = checkRef.current;
    if (c) setCheck({ ...c, manual: { ...c.manual, [key]: Math.max(0, (c.manual[key] ?? 0) + d) } });
  }, [setCheck]);
  useEffect(() => {
    if (!check) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < keys.length) { e.preventDefault(); tally(keys[i].key, e.altKey ? -1 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, keys, tally]);
  function endCheck() {
    if (!check) return;
    setChecks([...checks, { ...check, endS: nowS() }]);
    setCheck(null);
  }

  /* ---------- resultados ---------- */
  const elapsed = stats.elapsed;
  const rows = useMemo(() => aggregateIntervals(events, lines, coverage, intervalS, elapsed), [events, lines, coverage, intervalS, elapsed]);
  const intervals = useMemo(() => {
    const m = new Map<number, typeof rows>();
    for (const r of rows) m.set(r.index, [...(m.get(r.index) ?? []), r]);
    return [...m.entries()].reverse();
  }, [rows]);
  const label = (s: number) => (startedAtMs == null ? `${mmss(s)} do vídeo` : clock(startedAtMs + s * 1000));
  const total = (l: CountLine, dir: 1 | -1) => events.filter((e) => e.line === l.id && e.dir === dir);
  const curStart = Math.floor(elapsed / intervalS) * intervalS;

  function exportObservations() {
    const obs = rows.filter((r) => r.complete).map((r) => toCameraObservation(r, cameraId, startedAtMs, SOURCE_LABEL));
    download(`mova-contador-${cameraId}.observations.json`, JSON.stringify(obs, null, 2), "application/json");
  }
  function exportEvents() {
    const head = "t_s,hora,rastro,linha,linha_rotulo,sentido,sentido_rotulo,classe,confianca_media";
    const body = events.map((e) => {
      const l = lines.find((x) => x.id === e.line)!;
      return [e.t.toFixed(2), startedAtMs == null ? "" : toSaoPauloIso(startedAtMs + e.t * 1000), e.track, e.line, JSON.stringify(l.label), e.dir, JSON.stringify(dirLabel(l, e.dir)), e.cls, e.conf].join(",");
    });
    download(`mova-contador-${cameraId}.events.csv`, [head, ...body].join("\n"), "text/csv");
  }
  function exportChecks() {
    const data = checks.map((c) => ({ ...compareCheck(c, events, lines), window: { startS: c.startS, endS: c.endS, start: startedAtMs == null ? null : toSaoPauloIso(startedAtMs + c.startS * 1000) } }));
    download(`mova-contador-${cameraId}.conferencias.json`, JSON.stringify({ cameraId, lines, checks: data }, null, 2), "application/json");
  }

  const canStart = !!source && lines.length > 0 && phase !== "running" && model.status !== "loading";
  const isRunning = phase === "running";

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* ---------------- 1. fonte + desenho ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2>1 · Imagem</h2>
          <div className="row">
            <button type="button" onClick={shareTab} disabled={isRunning}>Compartilhar aba</button>
            <label className={`file-btn${isRunning ? " disabled" : ""}`}>
              Abrir arquivo de vídeo
              <input type="file" accept="video/*" hidden disabled={isRunning} onChange={(e) => openFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        {!source && (
          <ol className="small live-steps">
            <li>Abra a transmissão no YouTube em <strong>outra janela</strong> e deixe as duas janelas lado a lado. Uma aba escondida atrás da outra faz o navegador desacelerar a análise.</li>
            <li>Clique em <strong>Compartilhar aba</strong> e escolha a aba do YouTube. Nada é baixado nem enviado: a imagem fica no seu computador.</li>
            <li>Desenhe as linhas sobre a imagem e clique em <strong>Iniciar contagem</strong>.</li>
          </ol>
        )}
        {stopReason && phase === "setup" && <p className="small" style={{ color: "var(--critical)" }}>{stopReason}</p>}
        {source?.kind === "file" && <p className="small muted">Arquivo: {source.name}. A análise percorre o vídeo a {FILE_FPS} quadros por segundo de vídeo, sem depender da velocidade do computador.</p>}
        <div className="live-stage" style={{ display: source ? "block" : "none" }}>
          <video ref={videoRef} muted playsInline style={{ display: "none" }}
            onError={() => setStopReason("O navegador não conseguiu abrir este vídeo (formato ou codec não suportado). Tente MP4 (H.264) no Chrome ou WebM.")} />
          <canvas ref={canvasRef} className={`live-canvas${drawing ? " drawing" : ""}`} onClick={onCanvasClick} />
        </div>
        {source && (
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className={drawing ? "" : "ghost"} disabled={isRunning} onClick={() => { setDrawing(!drawing); setPending(null); }}>
              {drawing ? (pending ? "Clique no 2º ponto…" : "Clique no 1º ponto…") : "+ Desenhar linha"}
            </button>
            <label className="small row"><input type="checkbox" checked={useCrop} disabled={isRunning} onChange={(e) => setUseCrop(e.target.checked)} /> analisar só a região das linhas (tracejado)</label>
            <span className="small muted">Seta azul = sentido +, laranja = sentido −. Desenhe a linha atravessando a pista, na parte de baixo da imagem.</span>
          </div>
        )}
      </section>

      {/* ---------------- 2. linhas + controle ---------------- */}
      <section className="panel">
        <div className="panel-head"><h2>2 · Linhas e contagem</h2>
          <span className="small muted">Modelo: {model.status === "ready" ? `YOLO11n · ${model.backend}` : model.status === "loading" ? "carregando…" : model.status === "error" ? `erro: ${model.msg}` : "carrega ao iniciar (10,7 MB)"}</span>
        </div>
        {lines.length === 0 ? <p className="small muted">Nenhuma linha. Abra uma imagem e use “+ Desenhar linha”.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>#</th><th>Nome</th><th>Sentido + (seta azul)</th><th>Sentido − (seta laranja)</th><th /></tr></thead>
            <tbody>{lines.map((l, i) => (
              <tr key={l.id}>
                <td className="num">{i + 1}</td>
                <td><input className="inp" value={l.label} disabled={isRunning} onChange={(e) => editLine(l.id, { label: e.target.value })} /></td>
                <td><input className="inp" value={l.positive} disabled={isRunning} onChange={(e) => editLine(l.id, { positive: e.target.value })} /></td>
                <td><input className="inp" value={l.negative} disabled={isRunning} onChange={(e) => editLine(l.id, { negative: e.target.value })} /></td>
                <td className="row" style={{ flexWrap: "nowrap" }}>
                  <button type="button" className="ghost small" disabled={isRunning} onClick={() => editLine(l.id, { positive: l.negative, negative: l.positive })} title="Troca os nomes dos sentidos">⇅</button>
                  <button type="button" className="ghost small" disabled={isRunning} onClick={() => setLines(lines.filter((x) => x.id !== l.id))}>remover</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <div className="row" style={{ marginTop: 14, gap: 14 }}>
          <label className="field small">Câmera (identificador)<input className="inp" value={cameraId} disabled={isRunning} onChange={(e) => setCameraId(e.target.value.replace(/\s+/g, "-"))} /></label>
          <label className="field small">Intervalo de agregação
            <select className="inp" value={intervalS} disabled={isRunning} onChange={(e) => setIntervalS(Number(e.target.value))}>
              <option value={60}>1 minuto</option><option value={300}>5 minutos</option>
            </select>
          </label>
          {source?.kind === "file" && (
            <label className="field small">Início da gravação (opcional)<input className="inp" type="datetime-local" value={fileStart} disabled={isRunning} onChange={(e) => setFileStart(e.target.value)} /></label>
          )}
          <div className="row" style={{ alignSelf: "end" }}>
            {!isRunning
              ? <button type="button" onClick={start} disabled={!canStart}>{phase === "stopped" ? "Recomeçar contagem" : "Iniciar contagem"}</button>
              : <button type="button" onClick={() => stop("parada manual")}>Parar</button>}
          </div>
        </div>
        {model.backend === "WASM (CPU)" && <p className="small" style={{ marginTop: 6, color: "var(--serious)" }}>Sem WebGPU neste navegador: o modelo roda na CPU, mais devagar. Para contar ao vivo, use Chrome ou Edge atualizados no computador.</p>}
        {source?.kind === "file" && !fileStart && <p className="small muted" style={{ marginTop: 6 }}>Sem o horário de início, a data e a hora ficam desconhecidas (null) e não são inventadas.</p>}
      </section>

      {/* ---------------- 3. resultados ---------------- */}
      {phase !== "setup" && (
        <>
          {isRunning && hidden && source?.kind === "tab" && (
            <div className="banner" style={{ borderColor: "var(--serious)", color: "var(--serious)" }}>
              <strong>Esta aba está oculta.</strong> O navegador desacelera a análise e os intervalos com lacunas serão marcados como incompletos. Deixe a janela do MOVA visível.
            </div>
          )}
          {stopReason && phase === "stopped" && <div className="banner">Contagem parada: {stopReason}. Os intervalos incompletos no fim não entram nas observações.</div>}
          <div className="kpis">
            <div className="kpi"><div className="kpi-label">Tempo</div><div className="kpi-value">{mmss(elapsed)}</div><div className="kpi-note">{startedAtMs == null ? "hora real desconhecida" : `início ${clock(startedAtMs)}`}</div></div>
            <div className="kpi"><div className="kpi-label">Cruzamentos</div><div className="kpi-value">{events.length}</div><div className="kpi-note">todas as linhas</div></div>
            <div className="kpi"><div className="kpi-label">Quadros/s</div><div className="kpi-value" style={{ color: stats.fps && stats.fps < 4 && source?.kind === "tab" ? "var(--serious)" : undefined }}>{fmt(stats.fps, 1)}</div><div className="kpi-note">{source?.kind === "file" ? `vídeo: ${FILE_FPS} q/s` : "abaixo de 4: perde veículos"}</div></div>
            <div className="kpi"><div className="kpi-label">Inferência</div><div className="kpi-value">{fmt(stats.inferMs)} ms</div><div className="kpi-note">{model.backend}</div></div>
            <div className="kpi"><div className="kpi-label">Quadros</div><div className="kpi-value">{fmt(stats.frames)}</div><div className="kpi-note">analisados</div></div>
            <div className="kpi"><div className="kpi-label">Intervalos</div><div className="kpi-value">{intervals.length}</div><div className="kpi-note">de {intervalS / 60} min encerrados</div></div>
          </div>

          <section className="panel">
            <div className="panel-head"><h2>Por linha e sentido</h2><span className="small muted">q = n · 60 / Δt (M-FLUXO-EQUIVALENTE), só para intervalos encerrados e completos</span></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Linha · sentido</th><th>Total</th><th>Classes</th><th>Intervalo atual ({mmss(elapsed - curStart)} de {mmss(intervalS)})</th><th>Último intervalo encerrado</th></tr></thead>
              <tbody>{keys.map(({ key, line, dir }) => {
                const ev = total(line, dir);
                const byClass: Partial<Record<VehicleClass, number>> = {};
                for (const e of ev) byClass[e.cls] = (byClass[e.cls] ?? 0) + 1;
                const last = intervals[0]?.[1].find((r) => r.line.id === line.id && r.dir === dir);
                return (
                  <tr key={key}>
                    <td>{line.label} · <span style={{ color: dir === 1 ? "var(--accent)" : "var(--serious)" }}>{dirLabel(line, dir)}</span></td>
                    <td className="num">{ev.length}</td>
                    <td className="small">{Object.entries(byClass).map(([k, n]) => `${VEHICLE_CLASS_LABEL[k as VehicleClass]} ${n}`).join(", ") || "—"}</td>
                    <td className="num">{ev.filter((e) => e.t >= curStart).length} <span className="muted small">em andamento</span></td>
                    <td className="num">{!last ? "—" : !last.complete ? <span style={{ color: "var(--warn)" }}>{last.count} · incompleto</span> : (
                      <>{last.count} → <strong>{fmt(equivalentHourlyFlow(last.count, intervalS / 60))} veíc/h</strong><div className="small muted">{last.count} × 60 / {intervalS / 60}</div></>
                    )}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>

          <div className="grid-2">
            {/* ---------------- conferência ---------------- */}
            <section className="panel">
              <div className="panel-head"><h2>Conferir (contagem manual)</h2>
                {isRunning && !check && <button type="button" onClick={() => setCheck({ startS: nowS(), endS: 0, manual: {} })}>Iniciar conferência</button>}
                {check && <button type="button" onClick={endCheck}>Encerrar · {mmss(elapsed - check.startS)}</button>}
              </div>
              {!check && <p className="small muted">Conte à mão, por alguns minutos, quem cruza cada linha. Clique no botão do sentido ou use as teclas 1–{Math.min(9, keys.length)}; Alt + tecla desfaz. Ao encerrar, o MOVA compara com o contador na mesma janela (M-CV-CONFERENCIA). Funciona melhor com uma linha e um sentido por pessoa.</p>}
              {check && (
                <div className="tally">
                  {keys.map(({ key, line, dir }, i) => (
                    <div key={key} className="tally-item">
                      <button type="button" className="tally-btn" onClick={() => tally(key, 1)}>
                        <span className="small muted">{i < 9 ? `tecla ${i + 1}` : ""}</span>
                        <span>{line.label} · {dirLabel(line, dir)}</span>
                        <strong className="mono">{check.manual[key] ?? 0}</strong>
                      </button>
                      <button type="button" className="ghost small" onClick={() => tally(key, -1)}>−1</button>
                    </div>
                  ))}
                </div>
              )}
              {checks.map((c, i) => {
                const r = compareCheck(c, events, lines);
                return (
                  <div key={i} style={{ marginTop: 14 }}>
                    <h3>Conferência {i + 1} · {label(c.startS)} → {label(c.endS)} ({mmss(r.durationS)})</h3>
                    <div className="table-wrap"><table>
                      <thead><tr><th>Linha · sentido</th><th>Manual</th><th>Contador</th><th>Diferença</th><th>Erro</th></tr></thead>
                      <tbody>
                        {r.rows.map((x) => (
                          <tr key={x.key}><td className="small">{x.line.label} · {dirLabel(x.line, x.dir)}</td><td className="num">{x.manual}</td><td className="num">{x.auto}</td><td className="num">{x.diff > 0 ? "+" : ""}{x.diff}</td><td className="num">{x.relError == null ? "—" : `${x.relError > 0 ? "+" : ""}${fmt(x.relError * 100, 1)}%`}</td></tr>
                        ))}
                        <tr><td><strong>Total</strong></td><td className="num">{r.total.manual}</td><td className="num">{r.total.auto}</td><td className="num">{r.total.diff > 0 ? "+" : ""}{r.total.diff}</td>
                          <td className="num">{r.total.relError == null ? "—" : `${r.total.relError > 0 ? "+" : ""}${fmt(r.total.relError * 100, 1)}%`}<div className="small muted">erro absoluto {r.total.absRelError == null ? "—" : `${fmt(r.total.absRelError * 100, 1)}%`}</div></td></tr>
                      </tbody>
                    </table></div>
                  </div>
                );
              })}
            </section>

            {/* ---------------- intervalos ---------------- */}
            <section className="panel">
              <div className="panel-head"><h2>Intervalos encerrados</h2>
                <div className="row">
                  <button type="button" className="ghost small" disabled={!rows.length} onClick={exportObservations}>observações .json</button>
                  <button type="button" className="ghost small" disabled={!events.length} onClick={exportEvents}>cruzamentos .csv</button>
                  <button type="button" className="ghost small" disabled={!checks.length} onClick={exportChecks}>conferências .json</button>
                </div>
              </div>
              {!intervals.length ? <p className="small muted">O primeiro intervalo fecha em {mmss(intervalS)}.</p> : (
                <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}><table>
                  <thead><tr><th>Início</th>{keys.map(({ key, line, dir }) => <th key={key}>{line.label}<br />{dirLabel(line, dir)}</th>)}</tr></thead>
                  <tbody>{intervals.map(([idx, rs]) => (
                    <tr key={idx}>
                      <td className="num">{label(rs[0].startS)}{!rs[0].complete && <div className="small" style={{ color: "var(--warn)" }}>lacuna {fmt(rs[0].maxGapS, 1)} s</div>}</td>
                      {rs.map((r) => (
                        <td key={r.line.id + r.dir} className="num">{r.count}{r.complete && <div className="small muted">{fmt(equivalentHourlyFlow(r.count, intervalS / 60))} veíc/h</div>}</td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
              <p className="small muted" style={{ marginTop: 8 }}>
                As observações exportadas seguem o contrato <code>CameraObservation</code> (fonte CÂMERA DE TESTE) e podem ser coladas em <a className="link" href="/camera">Contrato da câmera</a>. Intervalos incompletos ficam de fora.
              </p>
            </section>
          </div>

          <section className="panel">
            <h2>Últimos cruzamentos</h2>
            <div className="table-wrap" style={{ maxHeight: 260, overflowY: "auto" }}><table>
              <thead><tr><th>Hora</th><th>Rastro</th><th>Linha</th><th>Sentido</th><th>Classe</th><th>Conf.</th></tr></thead>
              <tbody>{events.slice(-60).reverse().map((e) => {
                const l = lines.find((x) => x.id === e.line);
                return <tr key={`${e.track}-${e.line}`}><td className="num">{label(e.t)}</td><td className="num">#{e.track}</td><td className="small">{l?.label}</td><td className="small">{l ? dirLabel(l, e.dir) : e.dir}</td><td className="small">{VEHICLE_CLASS_LABEL[e.cls]}</td><td className="num">{fmt(e.conf, 2)}</td></tr>;
              })}</tbody>
            </table></div>
          </section>
        </>
      )}
    </div>
  );
}

