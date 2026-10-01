import { NextResponse } from "next/server";
import { repo } from "@/repository";

export function GET() {
  return NextResponse.json({ data: repo().qualityIssues() });
}
