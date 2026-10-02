import { NextResponse } from "next/server";
import { repo } from "@/repository";
import { LOGRADOUROS_SOURCE, distanceToPathM, searchLogradouros } from "@/adapters/logradouros";

export const dynamic = "force-dynamic";

/**
 * Busca de endereço: localiza o trecho na base pública de Logradouros (fonte externa) e lista os locais do estudo
 * mais próximos, por distância em linha reta ao traçado. Não há limite de "perto/longe": a distância é exibida como está.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 120) ?? "";
  let result;
  try {
    result = await searchLogradouros(q);
  } catch (e) {
    return NextResponse.json({ error: `Base de Logradouros indisponível: ${(e as Error).message}`, source: LOGRADOUROS_SOURCE }, { status: 502 });
  }
  if (result.kind !== "trechos") return NextResponse.json({ source: LOGRADOUROS_SOURCE, result });
  const r = repo();
  const paths = result.trechos.flatMap((t) => (t.path.length ? [t.path] : []));
  const nearest = r
    .corridors()
    .flatMap((c) => r.locations(c.id).map((l) => ({ c, l })))
    .filter(({ l }) => l.coordinates)
    .map(({ c, l }) => ({
      corridor: c.name,
      locationId: l.id,
      address: l.address,
      coordinates: l.coordinates!,
      distanceM: Math.round(Math.min(...paths.map((p) => distanceToPathM(l.coordinates!, p)))),
      segments: r
        .segments(l.id)
        .filter((s) => r.periods(s.id).length)
        .map((s) => ({ id: s.id, label: s.label, periods: r.periods(s.id).map((p) => p.period) })),
    }))
    .filter((x) => x.segments.length && Number.isFinite(x.distanceM))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 3);
  return NextResponse.json({ source: LOGRADOUROS_SOURCE, result, nearest });
}
