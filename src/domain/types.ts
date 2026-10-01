/**
 * Tipos centrais do domínio MOVA.
 * Toda grandeza carrega origem (observado na fonte x calculado pelo sistema)
 * e referência metodológica, para permitir rastreabilidade ponta a ponta.
 */

export type DataSourceKind = "HISTORICO" | "SIMULACAO" | "CAMERA";

export type MethodStatus = "CONFIRMADO" | "PENDENTE" | "EXPERIMENTAL";

export type QualityStatus = "VALIDO" | "AUSENTE" | "INVALIDO" | "SUSPEITO" | "INCOMPLETO";

/** De onde vem um número exibido. */
export type ValueOrigin =
  | "OBSERVADO_NA_FONTE" // transcrito do documento, sem cálculo
  | "CALCULADO" // produzido pelo motor a partir de dados
  | "SIMULADO" // gerado pelo modo simulação
  | "INDISPONIVEL"; // não há dado/método para produzir

export type Unit = "veic/dia" | "veic/h" | "km/h" | "%" | "faixas" | "adimensional";

/** Faixa numérica. Quando min === max é um valor pontual. */
export interface NumericRange {
  min: number;
  max: number;
  /** Fonte marcou o valor com "~" (aproximado). */
  approximate: boolean;
}

export interface TimeWindow {
  /** "HH:MM" */
  start: string;
  end: string;
}

export interface SourceRef {
  documentId: string;
  /** Seção do documento (página não identificável em .docx). */
  section: string;
  /** Linha/célula, quando aplicável. */
  locator?: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  fileName: string | null;
  kind: "PRIMARIA" | "SECUNDARIA";
  availableInRepo: boolean;
  description: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
  /** Coordenadas NÃO constam nos documentos. */
  provenance: "APROXIMADO_FONTE_EXTERNA";
  note: string;
}

export interface Corridor {
  id: string;
  name: string;
  address: string;
  reference: string | null;
  roadClassRaw: string | null;
  coordinates: Coordinates | null;
  approachIds: string[];
}

/** Uma linha da matriz do documento: corredor + sentido/pista. */
export interface Approach {
  id: string;
  corridorId: string;
  label: string;
  directionRaw: string;
  lanesRaw: string;
  laneCount: number | null;
  speedRecordRaw: string;
  notesRaw: string;
  source: SourceRef;
}

export type MeasurementMetric =
  | "VDM_DIAS_UTEIS"
  | "VOLUME_FIM_DE_SEMANA"
  | "PICO_MANHA"
  | "PICO_TARDE_NOITE";

/** Medida agregada reportada no documento (não é observação primária). */
export interface Measurement {
  id: string;
  approachId: string;
  metric: MeasurementMetric;
  /** Texto exatamente como na fonte. */
  raw: string;
  value: NumericRange | null;
  unit: Unit | null;
  /** Unidade como escrita na fonte (ex.: "veg/dia"). */
  rawUnit: string | null;
  windows: TimeWindow[];
  /** Qualificador entre parênteses fora da janela (ex.: "Central", "por sentido"). */
  qualifier: string | null;
  source: SourceRef;
}

/** Observação primária em intervalo (simulação / futura câmera / contagem). */
export interface TrafficObservation {
  id: string;
  approachId: string;
  source: DataSourceKind;
  intervalStart: string; // ISO
  intervalEnd: string; // ISO
  vehicleCount: number | null;
  averageSpeedKmh: number | null;
  quality: QualityStatus;
}

export interface QualityIssue {
  id: string;
  status: QualityStatus;
  rule: string;
  target: { kind: "measurement" | "approach" | "document" | "observation"; id: string };
  message: string;
  evidence: string;
}

export interface MethodologyEntry {
  id: string;
  name: string;
  description: string;
  /** Fórmula exatamente como na fonte; null quando a fonte não traz fórmula. */
  formula: string | null;
  /** Expressão implementada pelo sistema (pode diferir de `formula`). */
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

export type TraceStepKind =
  | "INDICADOR"
  | "VARIAVEIS"
  | "ENTRADA"
  | "FORMULA"
  | "INTERMEDIARIO"
  | "RESULTADO"
  | "INTERPRETACAO";

export interface TraceStep {
  kind: TraceStepKind;
  title: string;
  lines: string[];
}

export interface Indicator {
  id: string;
  key: string;
  name: string;
  approachId: string;
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
  /** Limite inferior (inclusivo) de cada nível acima de NORMAL. */
  atencao: number;
  critico: number;
  congestionado: number;
}
