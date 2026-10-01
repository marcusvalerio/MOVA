import { NextResponse } from "next/server";
import { repo } from "@/repository";

export function GET(req: Request) {
  const segmentId = new URL(req.url).searchParams.get("segmentId") ?? undefined;
  return NextResponse.json({ source: "HISTORICO", data: repo().indicators(segmentId) });
}
