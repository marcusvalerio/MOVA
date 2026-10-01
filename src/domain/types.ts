/**
 * Tipos centrais do domínio MOVA.
 * Toda grandeza carrega origem (observado / calculado / interpretado / simulado)
 * e referência metodológica, para permitir rastreabilidade ponta a ponta.
 */

export type DataSourceKind = "HISTORICO" | "SIMULACAO" | "CAMERA_TESTE";

export type MethodStatus = "CONFIRMADO" | "INFERIDO" | "EXPERIMENTAL" | "PENDENTE";

/** Equivalência com a especificação: VALID, MISSING, INVALID, INCOMPLETE, SUSPECT. */
export type QualityStatus = "VALIDO" | "AUSENTE" | "INVALIDO" | "INCOMPLETO" | "SUSPEITO";

/** Camada epistemológica de um número exibido. */
export type ValueOrigin =
  | "OBSERVADO" // transcrito da fonte ou recebido de um sensor, sem cálculo
  | "CALCULADO" // produzido pelo motor a partir de dados observados
  | "INTERPRETADO" // classificação/juízo derivado de metodologia
  | "SIMULADO" // gerado pelo modo simulação
  | "INDISPONIVEL"; // não há dado/método para produzir

export type Unit = "veic/dia" | "veic/h" | "veic" | "km/h" | "%" | "m" | "adimensional";

/** FERIADO = feriado ou data atípica (calendário externo, ver src/data/calendario.ts). */
export type DayType = "DIA_UTIL" | "SABADO" | "DOMINGO" | "FERIADO" | "DESCONHECIDO";

export type Carriageway = "CENTRAL" | "LATERAL" | "CENTRAL_E_LATERAL" | "EXCLUSIVA_BRT" | "VIA_EXPRESSA" | "NAO_ESPECIFICADA";

export type LaneType = "MISTA" | "BRT" | "MISTA_E_BRT" | "NAO_ESPECIFICADO";

export interface NumericRange {
  min: number;
  max: number;
  /** Fonte marcou o valor com "~" (aproximado). */
  approximate: boolean;
}

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;
}

export interface SourceRef {
  documentId: string;
  section: string;
  locator?: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  fileName: string | null;
  kind: "PRIMARIA" | "SECUNDARIA" | "ESPECIFICACAO";
  availableInRepo: boolean;
  description: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  provenance: "APROXIMADO_FONTE_EXTERNA" | "FONTE_DOCUMENTAL";
  raw?: string;
  note: string;
}

/** Eixo viário (ex.: Av. das Américas). */
export interface Corridor {
  id: string;
  name: string;
  description: string;
  locationIds: string[];
}

/** Ponto de medição ao longo do corredor (ex.: próximo ao nº 2000). */
export interface Location {
  id: string;
  corridorId: string;
  address: string;
  reference: string | null;
  roadClassRaw: string | null;
  coordinates: Coordinates | null;
  segmentIds: string[];
}

/** Sentido + pista + conjunto de faixas monitoradas num local. */
export interface RoadSegment {
  id: string;
  locationId: string;
  corridorId: string;
  label: string;
  direction: string;
  carriageway: Carriageway;
  laneType: LaneType;
  laneCount: number | null;
  lanesMonitoredRaw: string;
  directionRaw: string;
  speedRecordRaw: string;
  notesRaw: string;
  /** Interpretação estrutural da linha da matriz — explicitada para validação. */
  structureNote: string | null;
  source: SourceRef;
}

export type MeasurementMetric = "VDM_DIAS_UTEIS" | "VOLUME_FIM_DE_SEMANA" | "PICO_MANHA" | "PICO_TARDE_NOITE";

/** Medida agregada reportada num documento (faixa), não observação primária. */
export interface Measurement {
  id: string;
  segmentId: string;
  metric: MeasurementMetric;
  raw: string;
  value: NumericRange | null;
  unit: Unit | null;
  rawUnit: string | null;
  windows: TimeWindow[];
  qualifier: string | null;
  source: SourceRef;
}

/**
 * Observação primária em intervalo — mesma estrutura para HISTÓRICO, SIMULAÇÃO e CÂMERA.
 * A data pode ser desconhecida (ex.: série de 03/2019 sem dia informado): nunca é inventada.
 */
export interface TrafficObservation {
  id: string;
  segmentId: string;
  source: DataSourceKind;
  /** Agrupa observações de um mesmo dia/série. */
  seriesId: string;
  date: string | null; // YYYY-MM-DD
  month: string | null; // YYYY-MM
  weekday: number | null; // 0 = domingo
  dayType: DayType;
  /** HH:MM local; null quando a hora da gravação é desconhecida (nunca inventada). */
  startTime: string | null;
  durationMinutes: number;
  vehicleCount: number | null;
  averageSpeedKmh: number | null;
  p85SpeedKmh: number | null;
  queueLengthM: number | null;
  quality: QualityStatus;
  sourceRef: SourceRef | null;
  raw: string | null;
}

export interface Series {
  id: string;
  /** Total diário impresso no relatório (veíc), quando houver. */
  reportedDailyTotal?: number | null;
  /** Velocidade média diária impressa (km/h). */
  reportedDailyMeanSpeed?: number | null;
  /** 85º percentil impresso (km/h). */
  reportedV85?: number | null;
  /** Observação do calendário quando FERIADO. */
  dayNote?: string | null;
  segmentId: string;
  source: DataSourceKind;
  label: string;
  date: string | null;
  month: string | null;
  weekday: number | null;
  dayType: DayType;
  sourceRef: SourceRef | null;
  observationIds: string[];
}

export interface QualityIssue {
  id: string;
  status: QualityStatus;
  rule: string;
  target: { kind: "measurement" | "segment" | "document" | "observation" | "series"; id: string };
  message: string;
  evidence: string;
}

export interface MethodologyEntry {
  id: string;
  name: string;
  /** Classificação da Etapa 2. */
  category: "DADO" | "INDICADOR" | "FORMULA" | "REGRA" | "INTERPRETACAO" | "HIPOTESE";
  description: string;
  formula: string | null;
  implementation: string | null;
  variables: { symbol: string; meaning: string; unit: string }[];
  unit: Unit | null;
  purpose: string;
  sources: SourceRef[];
  externalSource: string | null;
  version: string;
  status: MethodStatus;
  gaps: string[];
}

export type TraceStepKind = "INDICADOR" | "VARIAVEIS" | "ENTRADA" | "FORMULA" | "INTERMEDIARIO" | "RESULTADO" | "INTERPRETACAO";

export interface TraceStep {
  kind: TraceStepKind;
  title: string;
  lines: string[];
}

export interface Indicator {
  id: string;
  key: string;
  name: string;
  segmentId: string;
  origin: ValueOrigin;
  value: NumericRange | null;
  unit: Unit | null;
  display: string;
  period: string;
  methodologyId: string;
  sourceKind: DataSourceKind;
  trace: TraceStep[];
}

export type OperationalLevel = "NORMAL" | "ATENCAO" | "CRITICO" | "CONGESTIONADO";

export interface ConditionThresholds {
  atencao: number;
  critico: number;
  congestionado: number;
}
