import type { Corridor, Indicator, Location, Measurement, QualityIssue, RoadSegment, Series, SourceDocument, TrafficObservation } from "@/domain/types";
import { SOURCE_DOCUMENTS } from "@/data/sources";
import { normalizeMatrix } from "@/normalization/normalize-matrix";
import { normalizePdf } from "@/normalization/normalize-pdf";
import { StructureBuilder } from "@/normalization/structure";
import { IssueLog, validateCrossSection, validateMeasurements, validatePdf, validateSegments } from "@/quality/rules";
import { periodIndicators, segmentIndicators } from "@/analytics/indicators";
import { periodStats, summarizeDay, type DaySummary, type PeriodStats } from "@/engine/aggregate";

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
  day(seriesId: string): DaySummary | undefined;
  periods(segmentId: string): PeriodStats[];
  indicators(segmentId?: string): Indicator[];
  indicator(id: string): Indicator | undefined;
  qualityIssues(): QualityIssue[];
}

export function createInMemoryRepository(): TrafficRepository {
  const builder = new StructureBuilder();
  const mx = normalizeMatrix(undefined, builder);
  const pdf = normalizePdf(builder);
  const corridors = [...builder.corridors.values()];
  const locations = [...builder.locations.values()];
  const segments = [...builder.segments.values()];

  const obsBySeries = new Map<string, TrafficObservation[]>();
  for (const o of pdf.observations) {
    const a = obsBySeries.get(o.seriesId);
    if (a) a.push(o);
    else obsBySeries.set(o.seriesId, [o]);
  }
  const days = new Map<string, DaySummary>();
  for (const s of pdf.series) days.set(s.id, summarizeDay(s, obsBySeries.get(s.id) ?? []));

  const periodsBySeg = new Map<string, PeriodStats[]>();
  for (const seg of segments) {
    const byMonth = new Map<string, DaySummary[]>();
    for (const s of pdf.series.filter((x) => x.segmentId === seg.id)) {
      const k = s.month as string;
      (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(days.get(s.id)!);
    }
    periodsBySeg.set(seg.id, [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, ds]) => periodStats(k, ds.sort((a, b) => (a.series.date as string).localeCompare(b.series.date as string)))));
  }

  const log = new IssueLog();
  const seriesCount: Record<string, number> = {};
  pdf.series.forEach((s) => (seriesCount[s.segmentId] = (seriesCount[s.segmentId] ?? 0) + 1));
  validateMeasurements(log, mx.measurements);
  validateSegments(log, segments, mx.measurements, seriesCount);
  validatePdf(log, pdf.issues, [...periodsBySeg.entries()]);
  validateCrossSection(log, mx.measurements, mx.segmentIdByRow[2]);

  const indicators: Indicator[] = [];
  for (const seg of segments) {
    for (const ps of periodsBySeg.get(seg.id) ?? []) indicators.push(...periodIndicators(seg, ps, mx.measurements));
    indicators.push(...segmentIndicators(seg, mx.measurements, (periodsBySeg.get(seg.id) ?? []).length > 0));
  }
  const indById = new Map(indicators.map((i) => [i.id, i]));

  return {
    sources: () => SOURCE_DOCUMENTS,
    corridors: () => corridors,
    corridor: (id) => corridors.find((c) => c.id === id),
    locations: (cid) => (cid ? locations.filter((l) => l.corridorId === cid) : locations),
    location: (id) => locations.find((l) => l.id === id),
    segments: (lid) => (lid ? segments.filter((s) => s.locationId === lid) : segments),
    segment: (id) => builder.segments.get(id),
    measurements: (sid) => (sid ? mx.measurements.filter((m) => m.segmentId === sid) : mx.measurements),
    series: (sid) => (sid ? pdf.series.filter((s) => s.segmentId === sid) : pdf.series),
    observations: (id) => obsBySeries.get(id) ?? [],
    day: (id) => days.get(id),
    periods: (sid) => periodsBySeg.get(sid) ?? [],
    indicators: (sid) => (sid ? indicators.filter((i) => i.segmentId === sid) : indicators),
    indicator: (id) => indById.get(id),
    qualityIssues: () => log.issues,
  };
}

let singleton: TrafficRepository | null = null;
export function repo(): TrafficRepository {
  return (singleton ??= createInMemoryRepository());
}
