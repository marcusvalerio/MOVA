import { NextResponse } from "next/server";
import { repo } from "@/repository";

export function GET() {
  const r = repo();
  return NextResponse.json({ source: "HISTORICO", data: r.corridors().map((c) => ({ ...c, approaches: r.approaches(c.id) })) });
}
