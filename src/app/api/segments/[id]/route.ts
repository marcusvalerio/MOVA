import { NextResponse } from "next/server";
import { repo } from "@/repository";
import { aggregateHourly } from "@/engine/series";

/** Segmento com medidas da matriz, séries horárias (observações + agregação) e indicadores. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const s = r.segment(decodeURIComponent(id));
  if (!s) return NextResponse.json({ error: "Segmento não encontrado" }, { status: 404 });
  return NextResponse.json({
    source: "HISTORICO",
    data: {
      ...s,
      measurements: r.measurements(s.id),
      series: r.series(s.id).map((x) => ({ ...x, observations: r.observations(x.id), hourly: aggregateHourly(r.observations(x.id)) })),
      indicators: r.indicators(s.id),
    },
  });
}
