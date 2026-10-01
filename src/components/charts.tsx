"use client";
import { useState } from "react";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

export interface RangeRow {
  id: string;
  label: string;
  sub: string;
  series: { key: string; min: number; max: number; window: string }[];
}

/** Gráfico de faixas (mín–máx) — preserva a incerteza da fonte em vez de reduzi-la a um ponto. */
export function RangeChart({ rows, seriesLabels, unit }: { rows: RangeRow[]; seriesLabels: Record<string, string>; unit: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const colors = ["var(--accent)", "var(--accent-2)"];
  const keys = Object.keys(seriesLabels);
  const max = niceMax(Math.max(...rows.flatMap((r) => r.series.map((s) => s.max))));
  const labelW = 210, W = 760, rowH = 40, top = 8, H = top + rows.length * rowH + 24;
  const x = (v: number) => labelW + (v / max) * (W - labelW - 16);
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  return (
    <div style={{ position: "relative" }}>
      <div className="row small" style={{ marginBottom: 8 }} aria-hidden>
        {keys.map((k, i) => (
          <span key={k} className="row" style={{ gap: 6, marginRight: 12 }}>
            <i style={{ width: 14, height: 4, borderRadius: 2, background: colors[i], display: "inline-block" }} />
            {seriesLabels[k]}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Faixas de fluxo de pico por aproximação, em ${unit}`} onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={H - 20} stroke="var(--grid)" />
            <text x={x(t)} y={H - 6} fontSize="10.5" textAnchor="middle" fill="var(--text-3)" fontFamily="var(--mono)">{fmt(t)}</text>
          </g>
        ))}
        {rows.map((r, ri) => {
          const y0 = top + ri * rowH;
          return (
            <g key={r.id}>
              <text x={0} y={y0 + 15} fontSize="12" fill="var(--text)">{r.label}</text>
              <text x={0} y={y0 + 29} fontSize="10.5" fill="var(--text-3)">{r.sub}</text>
              {r.series.map((s) => {
                const si = keys.indexOf(s.key);
                const y = y0 + 9 + si * 12;
                const w = Math.max(4, x(s.max) - x(s.min));
                return (
                  <g key={s.key}>
                    <rect x={x(s.min) - 4} y={y - 6} width={w + 8} height={16} fill="transparent"
                      onMouseMove={(e) => {
                        const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        setTip({ x: e.clientX - b.left + 12, y: e.clientY - b.top + 12, text: `${seriesLabels[s.key]} · ${s.window} · ~${fmt(s.min)}–${fmt(s.max)} ${unit}` });
                      }} />
                    <rect x={x(s.min)} y={y} width={w} height={4} rx={2} fill={colors[si]} pointerEvents="none" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}

export interface HourlySeries {
  label: string;
  values: (number | null)[];
  color: string;
  dashed?: boolean;
}

/**
 * Série(s) horária(s) num único eixo (nunca eixo duplo). Horas sem dado ficam como lacuna
 * — nunca interpoladas. Faixas verticais marcam janelas de pico da fonte.
 */
export function HourlyChart({
  series,
  unit,
  label,
  windows = [],
  band,
}: {
  series: HourlySeries[];
  unit: string;
  label: string;
  windows?: { label: string; startHour: number; endHour: number }[];
  band?: { min: number; max: number; label: string } | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 240, L = 52, R = 12, T = 22, B = 26;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const vmax = niceMax(Math.max(1, ...all, band?.max ?? 0));
  // Eixo x por início da hora (0..24): a hora h ocupa [h, h+1); ponto no centro.
  const x = (h: number) => L + (h / 24) * (W - L - R);
  const y = (v: number) => T + (1 - v / vmax) * (H - T - B);
  const path = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, h) => {
      if (v == null) return;
      d += `${h === 0 || vals[h - 1] == null ? "M" : "L"}${x(h + 0.5)},${y(v)} `;
    });
    return d;
  };
  const ticks = Array.from({ length: 5 }, (_, i) => (vmax / 4) * i);
  return (
    <div style={{ position: "relative" }}>
      {(series.length > 1 || windows.length > 0) && (
        <div className="row small" style={{ marginBottom: 6 }}>
          {series.map((s) => (
            <span key={s.label} className="row" style={{ gap: 6, marginRight: 12 }}>
              <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>
              {s.label}
            </span>
          ))}
          {windows.length > 0 && (
            <span className="row" style={{ gap: 6 }}>
              <i style={{ width: 12, height: 10, background: "var(--text)", opacity: 0.08, display: "inline-block", borderRadius: 2 }} /> janelas de pico (§2.A)
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
        onMouseMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          setHover(Math.max(0, Math.min(23, Math.floor(((px - L) / (W - L - R)) * 24))));
        }}
        onMouseLeave={() => setHover(null)}>
        {windows.map((w) => (
          <g key={w.label}>
            <rect x={x(w.startHour)} width={x(w.endHour) - x(w.startHour)} y={T} height={H - T - B} fill="var(--text)" opacity={0.06} />
            <text x={x(w.startHour) + 3} y={T - 6} fontSize="10" fill="var(--text-3)">{w.label}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={L - 8} y={y(t) + 4} fontSize="10.5" textAnchor="end" fill="var(--text-3)" fontFamily="var(--mono)">{fmt(t)}</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <text key={h} x={x(h)} y={H - 8} fontSize="10.5" textAnchor="middle" fill="var(--text-3)" fontFamily="var(--mono)">{String(h).padStart(2, "0")}h</text>
        ))}
        {band && (
          <g>
            <rect x={L} width={W - L - R} y={y(band.max)} height={Math.max(1, y(band.min) - y(band.max))} fill="var(--accent)" opacity={0.1} />
            <text x={W - R - 4} y={y(band.max) - 4} fontSize="10.5" textAnchor="end" fill="var(--text-2)">{band.label}</text>
          </g>
        )}
        {series.map((s) => (
          <g key={s.label}>
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
            {s.values.map((v, h) => (v != null && (h === 0 || s.values[h - 1] == null) && (h === 23 || s.values[h + 1] == null) ? <circle key={h} cx={x(h + 0.5)} cy={y(v)} r={3} fill={s.color} /> : null))}
          </g>
        ))}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={T} y2={H - B} stroke="var(--border-strong)" />
            {series.map((s) => (s.values[hover] != null ? <circle key={s.label} cx={x(hover + 0.5)} cy={y(s.values[hover] as number)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover + 0.5) / W) * 100}%`, top: 24, transform: hover > 15 ? "translateX(-108%)" : "translateX(10px)" }}>
          <div>{String(hover).padStart(2, "0")}h–{String(hover + 1).padStart(2, "0")}h</div>
          {series.map((s) => (
            <div key={s.label}>{s.label}: {s.values[hover] == null ? "sem dado" : `${fmt(s.values[hover] as number)} ${unit}`}</div>
          ))}
        </div>
      )}
    </div>
  );
}
