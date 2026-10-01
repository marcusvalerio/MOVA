import type { Corridor, Indicator, Location, Measurement, QualityIssue, RoadSegment, Series, SourceDocument, TrafficObservation } from "@/domain/types";
import { SOURCE_DOCUMENTS } from "@/data/sources";
import { normalizeMatrix } from "@/normalization/normalize-matrix";
import { normalizeUfrj } from "@/normalization/normalize-series";
import { IssueLog, validateCrossSection, validateMeasurements, validateSegments, validateSeries } from "@/quality/rules";
import { segmentIndicators, seriesIndicators } from "@/analytics/indicators";

/**
 * Repositório. Interface estável: a implementação em memória (MVP) pode ser trocada por
 * PostgreSQL (db/schema.sql) sem alterar motor, analytics ou apresentação.
 */
export interface TrafficRepository {
  sources(): SourceDocument[];
  corridors(): Corridor[];
  corridor(id: string): Corridor | undefined;
  locations(corridorId?: string): Location[];
  location(id: string): Location | undefined;
  segments(locationId?: string): RoadSegment[];
  segment(id: string): RoadSegment | undefined;
  measurements(segmentId?: string): Measurement[];
  series(segmentId?: string): Series[];
  observations(seriesId: string): TrafficObservation[];
  indicators(segmentId?: string): Indicator[];
  indicator(id: string): Indicator | undefined;
  qualityIssues(): QualityIssue[];
}

export function createInMemoryRepository(): TrafficRepository {
  const mx = normalizeMatrix();
  const sr = normalizeUfrj(mx.segmentIdByRow);
  const log = new IssueLog();
  const seriesCount: Record<string, number> = {};
  sr.series.forEach((s) => (seriesCount[s.segmentId] = (seriesCount[s.segmentId] ?? 0) + 1));
  validateMeasurements(log, mx.measurements);
  validateSegments(log, mx.segments, mx.measurements, seriesCount);
  validateSeries(log, sr.series, sr.observations);
  validateCrossSection(log, mx.measurements, mx.segmentIdByRow[2]);

  const obsBySeries = (id: string) => sr.observations.filter((o) => o.seriesId === id);
  const indicators: Indicator[] = [];
  for (const seg of mx.segments) {
    indicators.push(...segmentIndicators(seg, mx.measurements));
    for (const s of sr.series.filter((x) => x.segmentId === seg.id)) indicators.push(...seriesIndicators(s, obsBySeries(s.id), seg, mx.measurements));
  }

  return {
    sources: () => SOURCE_DOCUMENTS,
    corridors: () => mx.corridors,
    corridor: (id) => mx.corridors.find((c) => c.id === id),
    locations: (cid) => (cid ? mx.locations.filter((l) => l.corridorId === cid) : mx.locations),
    location: (id) => mx.locations.find((l) => l.id === id),
    segments: (lid) => (lid ? mx.segments.filter((s) => s.locationId === lid) : mx.segments),
    segment: (id) => mx.segments.find((s) => s.id === id),
    measurements: (sid) => (sid ? mx.measurements.filter((m) => m.segmentId === sid) : mx.measurements),
    series: (sid) => (sid ? sr.series.filter((s) => s.segmentId === sid) : sr.series),
    observations: obsBySeries,
    indicators: (sid) => (sid ? indicators.filter((i) => i.segmentId === sid) : indicators),
    indicator: (id) => indicators.find((i) => i.id === id),
    qualityIssues: () => log.issues,
  };
}

let singleton: TrafficRepository | null = null;
export function repo(): TrafficRepository {
  return (singleton ??= createInMemoryRepository());
}
