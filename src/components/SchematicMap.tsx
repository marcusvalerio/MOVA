import Link from "next/link";
import type { Corridor } from "@/domain/types";

/**
 * Mapa esquemático (sem tiles externos). Posições são APROXIMADAS (fonte externa)
 * e servem apenas para orientação espacial relativa.
 */
export function SchematicMap({ corridors, peakByCorridor }: { corridors: Corridor[]; peakByCorridor: Record<string, string> }) {
  const pts = corridors.filter((c) => c.coordinates);
  const lats = pts.map((c) => c.coordinates!.lat);
  const lngs = pts.map((c) => c.coordinates!.lng);
  const pad = 0.02;
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const W = 640, H = 300;
  // Equiretangular simples; cos(lat) corrige a escala da longitude.
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const sx = W / ((maxLng - minLng) * k);
  const sy = H / (maxLat - minLat);
  const s = Math.min(sx, sy);
  const ox = (W - (maxLng - minLng) * k * s) / 2;
  const oy = (H - (maxLat - minLat) * s) / 2;
  const proj = (lat: number, lng: number) => [ox + (lng - minLng) * k * s, oy + (maxLat - lat) * s] as const;

  // Rótulos: evita sobreposição dos dois pontos da Av. das Américas.
  const labelDy: Record<string, number> = { "av-americas-2603": 18, "av-americas-2000": -10, "av-abelardo-bueno-980": 20, "rua-jardim-botanico-746": -24 };
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Mapa esquemático dos corredores (posições aproximadas)" style={{ display: "block" }}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="var(--grid)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" rx="8" />
        {pts.map((c) => {
          const [x, y] = proj(c.coordinates!.lat, c.coordinates!.lng);
          const dy = labelDy[c.id] ?? -10;
          const anchor = x > W * 0.7 ? "end" : "start";
          const dx = anchor === "end" ? -12 : 12;
          return (
            <Link key={c.id} href={`/corredores/${c.id}`}>
              <g style={{ cursor: "pointer" }}>
                <title>{`${c.name} — pico reportado ${peakByCorridor[c.id] ?? "—"} (posição aproximada)`}</title>
                <circle cx={x} cy={y} r={14} fill="transparent" />
                <circle cx={x} cy={y} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                <text x={x + dx} y={y + dy} textAnchor={anchor} fontSize="12" fill="var(--text)" fontWeight={600}>{c.name}</text>
                <text x={x + dx} y={y + dy + 14} textAnchor={anchor} fontSize="11" fill="var(--text-3)" fontFamily="var(--mono)">{peakByCorridor[c.id] ?? ""}</text>
              </g>
            </Link>
          );
        })}
      </svg>
      <figcaption className="small muted" style={{ marginTop: 8 }}>
        Posições aproximadas — FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS. Valor exibido: maior limite superior de pico reportado na matriz.
      </figcaption>
    </figure>
  );
}
