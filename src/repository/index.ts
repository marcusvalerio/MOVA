import type { Approach, Corridor, Indicator, Measurement, QualityIssue, SourceDocument } from "@/domain/types";
import { SOURCE_DOCUMENTS } from "@/data/sources";
import { normalizeMatrix } from "@/normalization/normalize-matrix";
import { resetQualitySeq, validateApproaches, validateCrossSection, validateMeasurements } from "@/quality/rules";
import { buildIndicators } from "@/analytics/indicators";

/**
 * Repositório. A interface permite trocar a implementação em memória
 * (MVP, carregada a partir da camada de dados brutos) por PostgreSQL (db/schema.sql)
 * sem alterar motor, analytics ou apresentação.
 */
export interface TrafficRepository {
  sources(): SourceDocument[];
  corridors(): Corridor[];
  corridor(id: string): Corridor | undefined;
  approaches(corridorId?: string): Approach[];
  approach(id: string): Approach | undefined;
  measurements(approachId?: string): Measurement[];
  indicators(approachId?: string): Indicator[];
  indicator(id: string): Indicator | undefined;
  qualityIssues(): QualityIssue[];
}

export function createInMemoryRepository(): TrafficRepository {
  const ds = normalizeMatrix();
  resetQualitySeq();
  const issues = [...validateMeasurements(ds.measurements), ...validateApproaches(ds.approaches, ds.measurements), ...validateCrossSection(ds.measurements)];
  const indicators = buildIndicators(ds.approaches, ds.measurements);
  return {
    sources: () => SOURCE_DOCUMENTS,
    corridors: () => ds.corridors,
    corridor: (id) => ds.corridors.find((c) => c.id === id),
    approaches: (cid) => (cid ? ds.approaches.filter((a) => a.corridorId === cid) : ds.approaches),
    approach: (id) => ds.approaches.find((a) => a.id === id),
    measurements: (aid) => (aid ? ds.measurements.filter((m) => m.approachId === aid) : ds.measurements),
    indicators: (aid) => (aid ? indicators.filter((i) => i.approachId === aid) : indicators),
    indicator: (id) => indicators.find((i) => i.id === id),
    qualityIssues: () => issues,
  };
}

let singleton: TrafficRepository | null = null;
export function repo(): TrafficRepository {
  return (singleton ??= createInMemoryRepository());
}
