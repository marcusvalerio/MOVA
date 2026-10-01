import type { Corridor, Location, Measurement, MeasurementMetric, RoadSegment } from "@/domain/types";
import { RAW_MATRIX, type RawMatrixRow } from "@/data/raw/parametros-matriz";
import { ROW_STRUCTURE } from "@/data/raw/estrutura";
import { parseLaneCount, parseQualifier, parseQuantity, parseWindows } from "./parse";

/**
 * Coordenadas: NÃO constam nos documentos disponíveis (o PDF de fluxos as contém, segundo a especificação).
 * FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS — posições aproximadas para visualização esquemática.
 */
const APPROX_COORDS: Record<string, [number, number]> = {
  "av-americas--2000": [-23.0019, -43.3238],
  "av-americas--2603": [-23.0022, -43.3275],
  "av-abelardo-bueno--980": [-22.9739, -43.3929],
  "rua-jardim-botanico--746": [-22.967, -43.2195],
  "linha-vermelha--km-5-5": [-22.859, -43.2435],
};

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/^av-embaixador-/, "av-")
    .replace(/^av-das-/, "av-");
}

const locationSlug = (s: string) => slug(s).replace(/^proximo-ao-/, "").replace(/^n-/, "").replace(/-gal-garzon$/, "");

const CARRIAGEWAY_LABEL = {
  CENTRAL: "Pista Central",
  LATERAL: "Pista Lateral",
  CENTRAL_E_LATERAL: "Pistas Central e Lateral",
  EXCLUSIVA_BRT: "Faixa Exclusiva BRT",
  VIA_EXPRESSA: "Via Expressa",
  NAO_ESPECIFICADA: "Pista não especificada",
} as const;

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

export function normalizeMatrix(rows: RawMatrixRow[] = RAW_MATRIX): NormalizedMatrix {
  const corridors = new Map<string, Corridor>();
  const locations = new Map<string, Location>();
  const segments: RoadSegment[] = [];
  const measurements: Measurement[] = [];
  const segmentIdByRow: Record<number, string> = {};

  for (const r of rows) {
    const st = ROW_STRUCTURE.find((s) => s.row === r.row);
    if (!st) throw new Error(`Linha ${r.row} sem estrutura definida`);
    const corridorId = slug(st.corridor);
    const locationId = `${corridorId}--${locationSlug(st.location)}`;
    if (!corridors.has(corridorId)) corridors.set(corridorId, { id: corridorId, name: st.corridor, description: "", locationIds: [] });
    if (!locations.has(locationId)) {
      const ref = /\(([^)]*)\)/.exec(r.corredor);
      const c = APPROX_COORDS[locationId];
      locations.set(locationId, {
        id: locationId,
        corridorId,
        address: `${st.corridor}, ${st.location}`,
        reference: ref ? ref[1] : null,
        roadClassRaw: /Via Expressa/i.test(r.faixas) ? "Via Expressa" : /Vias Urbanas/i.test(r.faixas) ? "Via urbana" : null,
        coordinates: c
          ? { lat: c[0], lng: c[1], provenance: "APROXIMADO_FONTE_EXTERNA", note: "Coordenada aproximada inserida pelo sistema. O PDF de fluxos contém coordenadas — substituir ao incorporá-lo." }
          : null,
        segmentIds: [],
      });
      corridors.get(corridorId)!.locationIds.push(locationId);
    } else {
      const ref = /\(([^)]*)\)/.exec(r.corredor);
      if (ref && !locations.get(locationId)!.reference) locations.get(locationId)!.reference = ref[1];
    }

    const segmentId = `${locationId}--${slug(st.direction)}--${slug(CARRIAGEWAY_LABEL[st.carriageway])}`;
    segmentIdByRow[r.row] = segmentId;
    locations.get(locationId)!.segmentIds.push(segmentId);
    const source = { documentId: "DOC-PARAMETROS", section: "1. Matriz Comparativa de Fontes, Fluxo e Velocidade", locator: `linha ${r.row}` };
    segments.push({
      id: segmentId,
      locationId,
      corridorId,
      label: `Sentido ${st.direction} · ${CARRIAGEWAY_LABEL[st.carriageway]}`,
      direction: st.direction,
      carriageway: st.carriageway,
      laneType: st.laneType,
      laneCount: parseLaneCount(r.faixas),
      lanesMonitoredRaw: r.faixas,
      directionRaw: r.sentidoPista,
      speedRecordRaw: r.registroVelocidades,
      notesRaw: r.observacoes,
      structureNote: st.note,
      source,
    });

    for (const [metric, field] of METRIC_FIELDS) {
      const raw = String(r[field]);
      const q = parseQuantity(raw);
      measurements.push({
        id: `${segmentId}--${metric}`,
        segmentId,
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
  return { corridors: [...corridors.values()], locations: [...locations.values()], segments, measurements, segmentIdByRow };
}

export function metricColumn(m: MeasurementMetric): string {
  return {
    VDM_DIAS_UTEIS: "Volume Diário Médio (VDM - Dias Úteis)",
    VOLUME_FIM_DE_SEMANA: "Volume Diário (Fins de Semana)",
    PICO_MANHA: "Pico Manhã (Horário / Fluxo Máx.)",
    PICO_TARDE_NOITE: "Pico Tarde/Noite (Horário / Fluxo Máx.)",
  }[m];
}
