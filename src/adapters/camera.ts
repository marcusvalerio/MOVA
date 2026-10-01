import { z } from "zod";
import type { TrafficObservation } from "@/domain/types";
import { classifyCondition, equivalentHourlyFlow } from "@/engine/series";
import { CONDITION_CONFIG } from "@/methodology/condition-config";
import { validateObservation } from "@/quality/rules";

/**
 * COMPUTER VISION ADAPTER — contrato de entrada. Nenhuma câmera real está conectada.
 *
 *  CÂMERA → VIDEO STREAM → CV (YOLO/OpenCV…) → DETECÇÃO → TRACKING → CONTAGEM/VELOCIDADE/FILA
 *    → CameraObservation → toTrafficObservation() → TRAFFIC ENGINE → INDICADORES → CONDIÇÃO
 *
 * A visão computacional responde "o que está sendo observado?". O motor responde "o que significa?".
 * Integração CIVITAS/Vision AI: apenas mediante acesso autorizado; nenhum scraping ou contorno de autenticação.
 */
export const CameraObservationSchema = z.object({
  cameraId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
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

/** Câmera + sentido → segmento. Vazio: nenhuma câmera cadastrada. */
export const CAMERA_REGISTRY: { cameraId: string; direction: string; segmentId: string }[] = [];

export const CAMERA_STATUS = {
  connected: false,
  message: "Nenhuma câmera física conectada. Disponível: CÂMERA DE TESTE (entrada manual de observações no formato de visão computacional).",
} as const;

/** PENDENTE DE VALIDAÇÃO — null = não filtra, apenas registra a confiança. */
export const MIN_CONFIDENCE: number | null = null;

export function toTrafficObservation(c: CameraObservation, segmentId: string): TrafficObservation {
  const d = new Date(c.timestamp);
  // Data/hora em America/Sao_Paulo (UTC−3, sem horário de verão desde 2019).
  const local = new Date(d.getTime() - 3 * 3600000);
  const date = local.toISOString().slice(0, 10);
  const wd = local.getUTCDay();
  const o: TrafficObservation = {
    id: `cam-${c.cameraId}-${d.toISOString()}`,
    segmentId,
    source: "CAMERA_TESTE",
    seriesId: `cam-${c.cameraId}-${date}`,
    date,
    month: date.slice(0, 7),
    weekday: wd,
    dayType: wd === 0 ? "DOMINGO" : wd === 6 ? "SABADO" : "DIA_UTIL",
    startTime: local.toISOString().slice(11, 16),
    durationMinutes: c.intervalSeconds / 60,
    vehicleCount: c.vehicleCount,
    averageSpeedKmh: c.averageSpeed ?? null,
    p85SpeedKmh: null,
    queueLengthM: c.queueLength ?? null,
    quality: "VALIDO",
    sourceRef: { documentId: "CAMERA_TESTE", section: c.source, locator: c.cameraId },
    raw: JSON.stringify(c),
  };
  o.quality = validateObservation(o);
  if (MIN_CONFIDENCE != null && c.confidence < MIN_CONFIDENCE && o.quality === "VALIDO") o.quality = "SUSPEITO";
  return o;
}

export function resolveSegment(c: CameraObservation): string | null {
  return CAMERA_REGISTRY.find((r) => r.cameraId === c.cameraId && r.direction === c.direction)?.segmentId ?? null;
}

/** Separação OBSERVADO → CALCULADO → INTERPRETADO (especificação §33). */
export function processCameraObservation(c: CameraObservation) {
  const segmentId = resolveSegment(c);
  const obs = toTrafficObservation(c, segmentId ?? "NAO_ASSOCIADO");
  const minutes = c.intervalSeconds / 60;
  const q = obs.quality === "VALIDO" ? equivalentHourlyFlow(c.vehicleCount, minutes) : null;
  return {
    observado: {
      vehicleCount: c.vehicleCount,
      intervalMinutes: minutes,
      averageSpeedKmh: c.averageSpeed ?? null,
      queueLengthM: c.queueLength ?? null,
      direction: c.direction,
      vehicleTypes: c.vehicleTypes ?? null,
      occupancy: c.occupancy ?? null,
      confidence: c.confidence,
      quality: obs.quality,
    },
    calculado: {
      equivalentHourlyFlow: q,
      methodologyId: "M-FLUXO-EQUIVALENTE",
      expression: q == null ? null : `${c.vehicleCount} × 60 / ${minutes} = ${q}`,
      status: "INFERIDO",
    },
    interpretado: {
      condition: classifyCondition(null, CONDITION_CONFIG.thresholds),
      methodologyId: "M-CONDICAO",
      note: CONDITION_CONFIG.note,
    },
    segmentId,
    trafficObservation: obs,
  };
}
