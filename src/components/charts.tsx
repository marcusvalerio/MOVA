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

/** Série horária (uma série por gráfico; sem eixo duplo). */
export function HourlyChart({
  values,
  unit,
  band,
  color = "var(--sim)",
  label,
}: {
  values: (number | null)[];
  unit: string;
  band?: { min: number; max: number; label: string } | null;
  color?: string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, L = 52, R = 12, T = 10, B = 26;
  const vmax = niceMax(Math.max(1, ...values.filter((v): v is number => v != null), band?.max ?? 0));
  const x = (h: number) => L + (h / 23) * (W - L - R);
  const y = (v: number) => T + (1 - v / vmax) * (H - T - B);
  const path = values
    .map((v, h) => (v == null ? null : `${x(h)},${y(v)}`))
    .reduce<string[]>((acc, p, i) => {
      if (p == null) return acc;
      acc.push(`${i === 0 || values[i - 1] == null ? "M" : "L"}${p}`);
      return acc;
    }, [])
    .join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => (vmax / 4) * i);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
        onMouseMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          setHover(Math.max(0, Math.min(23, Math.round(((px - L) / (W - L - R)) * 23))));
        }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={L - 8} y={y(t) + 4} fontSize="10.5" textAnchor="end" fill="var(--text-3)" fontFamily="var(--mono)">{fmt(t)}</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <text key={h} x={x(h)} y={H - 8} fontSize="10.5" textAnchor="middle" fill="var(--text-3)" fontFamily="var(--mono)">{String(h).padStart(2, "0")}h</text>
        ))}
        {band && (
          <g>
            <rect x={L} width={W - L - R} y={y(band.max)} height={Math.max(1, y(band.min) - y(band.max))} fill="var(--accent)" opacity={0.1} />
            <text x={W - R - 4} y={y(band.max) - 4} fontSize="10.5" textAnchor="end" fill="var(--text-2)">{band.label}</text>
          </g>
        )}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && values[hover] != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--border-strong)" />
            <circle cx={x(hover)} cy={y(values[hover] as number)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: hover > 16 ? "translateX(-110%)" : "translateX(10px)" }}>
          {String(hover).padStart(2, "0")}:00 · {values[hover] == null ? "incompleto" : `${fmt(values[hover] as number)} ${unit}`}
        </div>
      )}
    </div>
  );
}
