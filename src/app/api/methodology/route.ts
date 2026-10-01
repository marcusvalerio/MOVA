import { NextResponse } from "next/server";
import { METHODOLOGY } from "@/methodology/registry";
import { CONDITION_CONFIG } from "@/methodology/condition-config";

export function GET() {
  return NextResponse.json({ data: METHODOLOGY, conditionConfig: CONDITION_CONFIG });
}
