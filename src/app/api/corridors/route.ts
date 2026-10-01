import { NextResponse } from "next/server";
import { repo } from "@/repository";

/** Hierarquia Corredor → Local → Segmento. */
export function GET() {
  const r = repo();
  return NextResponse.json({
    source: "HISTORICO",
    data: r.corridors().map((c) => ({ ...c, locations: r.locations(c.id).map((l) => ({ ...l, segments: r.segments(l.id) })) })),
  });
}
