import { NextResponse } from "next/server";
import { repo } from "@/repository";
import { runSimulation } from "@/simulation/run";
import { SCENARIOS, type ScenarioId } from "@/simulation/generator";

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const segmentId = sp.get("segmentId");
  const seed = Number(sp.get("seed") ?? 1);
  const scenario = (sp.get("scenario") ?? "fluxo-alto") as ScenarioId;
  const day = sp.get("dayType") ?? "DIA_UTIL";
  if (!segmentId) return NextResponse.json({ error: "segmentId obrigatório" }, { status: 400 });
  if (!Number.isInteger(seed)) return NextResponse.json({ error: "seed deve ser inteiro" }, { status: 400 });
  if (!(scenario in SCENARIOS)) return NextResponse.json({ error: `cenário inválido; use ${Object.keys(SCENARIOS).join(", ")}` }, { status: 400 });
  if (!["DIA_UTIL", "SABADO", "DOMINGO"].includes(day)) return NextResponse.json({ error: "dayType inválido" }, { status: 400 });
  const res = runSimulation(repo(), segmentId, seed, scenario, day as "DIA_UTIL");
  if (!res) return NextResponse.json({ error: "Segmento não encontrado" }, { status: 404 });
  return NextResponse.json({ source: "SIMULACAO", warning: "Dados sintéticos — não observados.", data: res });
}
