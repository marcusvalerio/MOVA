import type { Corridor, Location, Measurement, MeasurementMetric, RoadSegment } from "@/domain/types";
import { RAW_MATRIX, type RawMatrixRow } from "@/data/raw/parametros-matriz";
import { ROW_STRUCTURE } from "@/data/raw/estrutura";
import { parseLaneCount, parseQualifier, parseQuantity, parseWindows } from "./parse";
import { StructureBuilder } from "./structure";

export { slug } from "./structure";

const METRIC_FIELDS: [MeasurementMetric, keyof RawMatrixRow][] = [
  ["VDM_DIAS_UTEIS", "vdmDiasUteis"],
  ["VOLUME_FIM_DE_SEMANA", "volumeFimDeSemana"],
  ["PICO_MANHA", "picoManha"],
  ["PICO_TARDE_NOITE", "picoTardeNoite"],
];

export interface NormalizedMatrix {
  corridors: Corridor[];
  locations: Location[];
  segments: RoadSegment[];
  measurements: Measurement[];
  segmentIdByRow: Record<number, string>;
}

export function normalizeMatrix(rows: RawMatrixRow[] = RAW_MATRIX, builder = new StructureBuilder()): NormalizedMatrix {
  const measurements: Measurement[] = [];
  const segmentIdByRow: Record<number, string> = {};
  for (const r of rows) {
    const st = ROW_STRUCTURE.find((s) => s.row === r.row);
    if (!st) throw new Error(`Linha ${r.row} sem estrutura definida`);
    const ref = /\(([^)]*)\)/.exec(r.corredor);
    const source = { documentId: "DOC-PARAMETROS", section: "1. Matriz Comparativa de Fontes, Fluxo e Velocidade", locator: `linha ${r.row}` };
    const seg = builder.ensure({
      corridor: st.corridor,
      location: st.location,
      direction: st.direction,
      carriageway: st.carriageway,
      laneType: st.laneType,
      reference: ref ? ref[1] : null,
      roadClassRaw: /Via Expressa/i.test(r.faixas) ? "Via Expressa" : /Vias Urbanas/i.test(r.faixas) ? "Via urbana" : null,
      laneCount: parseLaneCount(r.faixas),
      lanesMonitoredRaw: r.faixas,
      directionRaw: r.sentidoPista,
      speedRecordRaw: r.registroVelocidades,
      notesRaw: r.observacoes,
      structureNote: st.note,
      source,
    });
    segmentIdByRow[r.row] = seg.id;
    for (const [metric, field] of METRIC_FIELDS) {
      const raw = String(r[field]);
      const q = parseQuantity(raw);
      measurements.push({
        id: `${seg.id}--${metric}`,
        segmentId: seg.id,
        metric,
        raw,
        value: q?.value ?? null,
        unit: q?.unit ?? null,
        rawUnit: q?.rawUnit ?? null,
        windows: metric.startsWith("PICO") ? parseWindows(raw) : [],
        qualifier: parseQualifier(raw),
        source: { ...source, locator: `linha ${r.row}, coluna ${metricColumn(metric)}` },
      });
    }
  }
  return { corridors: [...builder.corridors.values()], locations: [...builder.locations.values()], segments: [...builder.segments.values()], measurements, segmentIdByRow };
}

export function metricColumn(m: MeasurementMetric): string {
  return {
    VDM_DIAS_UTEIS: "Volume Diário Médio (VDM - Dias Úteis)",
    VOLUME_FIM_DE_SEMANA: "Volume Diário (Fins de Semana)",
    PICO_MANHA: "Pico Manhã (Horário / Fluxo Máx.)",
    PICO_TARDE_NOITE: "Pico Tarde/Noite (Horário / Fluxo Máx.)",
  }[m];
}
