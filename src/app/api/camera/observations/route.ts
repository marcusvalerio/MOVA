import { NextResponse } from "next/server";
import { CAMERA_STATUS, CameraObservationSchema, processCameraObservation } from "@/adapters/camera";

/** Câmera de teste: valida e processa (observado → calculado → interpretado). Nada é persistido. */
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
    return { valid: true, ...processCameraObservation(p.data) };
  });
  return NextResponse.json(
    { source: "CAMERA_TESTE", connected: CAMERA_STATUS.connected, persisted: false, message: CAMERA_STATUS.message, results },
    { status: results.every((r) => r.valid) ? 202 : 422 },
  );
}
