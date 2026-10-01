import { NextResponse } from "next/server";
import { repo } from "@/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const c = r.corridor(id);
  if (!c) return NextResponse.json({ error: "Corredor não encontrado" }, { status: 404 });
  return NextResponse.json({ source: "HISTORICO", data: { ...c, locations: r.locations(id).map((l) => ({ ...l, segments: r.segments(l.id) })) } });
}
