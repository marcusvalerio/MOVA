import { NextResponse } from "next/server";
import { repo } from "@/repository";

export function GET(req: Request) {
  const approachId = new URL(req.url).searchParams.get("approachId") ?? undefined;
  return NextResponse.json({ source: "HISTORICO", data: repo().indicators(approachId) });
}
