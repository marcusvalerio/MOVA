import type { TrafficObservation } from "@/domain/types";

export const obs = (hour: number, minute: number, count: number | null, opts: Partial<TrafficObservation> = {}): TrafficObservation => ({
  id: `${hour}-${minute}`,
  segmentId: "s",
  source: "SIMULACAO",
  seriesId: "x",
  date: null,
  month: null,
  weekday: null,
  dayType: "DIA_UTIL",
  startTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  durationMinutes: 15,
  vehicleCount: count,
  averageSpeedKmh: null,
  p85SpeedKmh: null,
  queueLengthM: null,
  quality: count == null ? "AUSENTE" : "VALIDO",
  sourceRef: null,
  raw: null,
  ...opts,
});

export const hourlyObs = (values: (number | null)[], opts: Partial<TrafficObservation> = {}) =>
  values.map((v, h) => obs(h, 0, v, { durationMinutes: 60, ...opts }));
