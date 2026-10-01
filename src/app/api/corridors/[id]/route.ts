import { NextResponse } from "next/server";
import { repo } from "@/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = repo();
  const c = r.corridor(id);
  if (!c) return NextResponse.json({ error: "Corredor não encontrado" }, { status: 404 });
  const approaches = r.approaches(id).map((a) => ({ ...a, measurements: r.measurements(a.id), indicators: r.indicators(a.id) }));
  return NextResponse.json({ source: "HISTORICO", data: { ...c, approaches } });
}
