import { NextResponse } from "next/server";
import { repo } from "@/repository";
import { getMethodology } from "@/methodology/registry";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ind = repo().indicator(decodeURIComponent(id));
  if (!ind) return NextResponse.json({ error: "Indicador não encontrado" }, { status: 404 });
  return NextResponse.json({ data: { ...ind, methodology: getMethodology(ind.methodologyId) } });
}
