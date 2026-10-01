import { NextResponse } from "next/server";
import { CAMERA_STATUS, CameraObservationSchema, resolveApproach, toTrafficObservation } from "@/adapters/camera";

/** Valida payloads de câmera. Sem câmera conectada: nada é persistido. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const items = Array.isArray(body) ? body : [body];
  const results = items.map((item) => {
    const p = CameraObservationSchema.safeParse(item);
    if (!p.success) return { valid: false, issues: p.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
    const approachId = resolveApproach(p.data);
    return {
      valid: true,
      approachId,
      trafficObservation: toTrafficObservation(p.data, approachId ?? "NAO_ASSOCIADA"),
    };
  });
  const allValid = results.every((r) => r.valid);
  return NextResponse.json(
    { connected: CAMERA_STATUS.connected, persisted: false, message: CAMERA_STATUS.message, results },
    { status: allValid ? 202 : 422 },
  );
}
