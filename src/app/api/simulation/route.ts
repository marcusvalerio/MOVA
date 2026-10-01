import { NextResponse } from "next/server";
import { repo } from "@/repository";
import { runSimulation } from "@/simulation/run";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const approachId = sp.get("approachId");
  const seed = Number(sp.get("seed") ?? 1);
  if (!approachId) return NextResponse.json({ error: "approachId obrigatório" }, { status: 400 });
  if (!Number.isInteger(seed)) return NextResponse.json({ error: "seed deve ser inteiro" }, { status: 400 });
  const res = runSimulation(repo(), approachId, seed);
  if (!res) return NextResponse.json({ error: "Aproximação não encontrada" }, { status: 404 });
  return NextResponse.json({ source: "SIMULACAO", warning: "Dados sintéticos — não observados.", data: res });
}
