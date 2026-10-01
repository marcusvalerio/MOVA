import { z } from "zod";
import type { TrafficObservation } from "@/domain/types";
import { validateObservation } from "@/quality/rules";

/**
 * COMPUTER VISION ADAPTER — contrato de entrada para futuras câmeras (CIVITAS/Vision AI,
 * YOLO/OpenCV ou outro detector). NENHUMA câmera está conectada neste MVP.
 *
 * Fluxo previsto: CÂMERA → CV → DETECÇÕES → TRACKING → CameraObservation
 *   → toTrafficObservation() → TRAFFIC ENGINE → INDICADORES → PAINEL
 */
export const CameraObservationSchema = z.object({
  cameraId: z.string().min(1),
  /** Início do intervalo agregado (ISO 8601). */
  timestamp: z.string().datetime({ offset: true }),
  /** Duração do intervalo agregado, em segundos. */
  intervalSeconds: z.number().int().positive().max(3600),
  vehicleCount: z.number().int().nonnegative(),
  vehicleTypes: z.record(z.string(), z.number().int().nonnegative()).optional(),
  averageSpeed: z.number().nonnegative().nullable().optional(),
  queueLength: z.number().nonnegative().nullable().optional(),
  direction: z.string().min(1),
  occupancy: z.number().min(0).max(1).nullable().optional(),
  confidence: z.number().min(0).max(1),
  source: z.string().min(1),
});

export type CameraObservation = z.infer<typeof CameraObservationSchema>;

/** Associação câmera+sentido → aproximação. Vazio: nenhuma câmera cadastrada. */
export const CAMERA_REGISTRY: { cameraId: string; direction: string; approachId: string }[] = [];

export const CAMERA_STATUS = { connected: false, message: "Nenhuma câmera conectada. Interface preparada; sem integração ativa." } as const;

/**
 * Limite mínimo de confiança para aceitar uma observação.
 * PENDENTE DE VALIDAÇÃO — não definido nos documentos; null = não filtra, apenas registra.
 */
export const MIN_CONFIDENCE: number | null = null;

export function toTrafficObservation(c: CameraObservation, approachId: string): TrafficObservation {
  const start = new Date(c.timestamp);
  const end = new Date(start.getTime() + c.intervalSeconds * 1000);
  const o: TrafficObservation = {
    id: `cam-${c.cameraId}-${start.toISOString()}`,
    approachId,
    source: "CAMERA",
    intervalStart: start.toISOString(),
    intervalEnd: end.toISOString(),
    vehicleCount: c.vehicleCount,
    averageSpeedKmh: c.averageSpeed ?? null,
    quality: "VALIDO",
  };
  o.quality = validateObservation(o);
  if (MIN_CONFIDENCE != null && c.confidence < MIN_CONFIDENCE && o.quality === "VALIDO") o.quality = "SUSPEITO";
  return o;
}

export function resolveApproach(c: CameraObservation): string | null {
  return CAMERA_REGISTRY.find((r) => r.cameraId === c.cameraId && r.direction === c.direction)?.approachId ?? null;
}
