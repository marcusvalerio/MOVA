import Link from "next/link";

export interface MapPoint {
  id: string;
  label: string;
  sub?: string;
  lat: number;
  lng: number;
  href: string;
}

/**
 * Mapa esquemático (sem tiles externos): posições relativas a partir das coordenadas
 * impressas nos relatórios de fiscalização (fonte documental).
 */
export function SchematicMap({ points }: { points: MapPoint[] }) {
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const pad = 0.025;
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const W = 640, H = 320;
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const s = Math.min(W / ((maxLng - minLng) * k), H / (maxLat - minLat));
  const ox = (W - (maxLng - minLng) * k * s) / 2, oy = (H - (maxLat - minLat) * s) / 2;
  const proj = (lat: number, lng: number) => [ox + (lng - minLng) * k * s, oy + (maxLat - lat) * s] as const;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Mapa esquemático dos corredores monitorados" style={{ display: "block" }}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="var(--grid)" strokeWidth="1" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" rx="8" />
        {points.map((p) => {
          const [x, y] = proj(p.lat, p.lng);
          const end = x > W * 0.6;
          return (
            <Link key={p.id} href={p.href}>
              <g style={{ cursor: "pointer" }}>
                <title>{`${p.label}${p.sub ? ` — ${p.sub}` : ""}`}</title>
                <circle cx={x} cy={y} r={14} fill="transparent" />
                <circle cx={x} cy={y} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                <text x={x + (end ? -10 : 10)} y={y - 8} textAnchor={end ? "end" : "start"} fontSize="12" fill="var(--text)" fontWeight={600}>{p.label}</text>
                {p.sub && <text x={x + (end ? -10 : 10)} y={y + 7} textAnchor={end ? "end" : "start"} fontSize="10.5" fill="var(--text-3)" fontFamily="var(--mono)">{p.sub}</text>}
              </g>
            </Link>
          );
        })}
      </svg>
      <figcaption className="small muted" style={{ marginTop: 8 }}>Posições a partir das coordenadas impressas nos relatórios de fiscalização (fonte documental). Um ponto por corredor.</figcaption>
    </figure>
  );
}
