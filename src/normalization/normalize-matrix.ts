import type { Approach, Corridor, Measurement, MeasurementMetric } from "@/domain/types";
import { RAW_MATRIX, type RawMatrixRow } from "@/data/raw/parametros-matriz";
import { parseLaneCount, parseQualifier, parseQuantity, parseWindows } from "./parse";

/**
 * Coordenadas: NÃO constam nos documentos.
 * FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS — posições aproximadas para
 * permitir a visualização esquemática. Devem ser validadas.
 */
const APPROX_COORDS: Record<string, [number, number]> = {
  "av-americas-2000": [-23.0019, -43.3238],
  "av-americas-2603": [-23.0022, -43.3275],
  "av-abelardo-bueno-980": [-22.9739, -43.3929],
  "rua-jardim-botanico-746": [-22.967, -43.2195],
  "linha-vermelha-km-5-5": [-22.859, -43.2435],
};

export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/^av-embaixador-/, "av-")
    .replace(/^av-das-/, "av-");
}

const METRIC_FIELDS: [MeasurementMetric, keyof RawMatrixRow][] = [
  ["VDM_DIAS_UTEIS", "vdmDiasUteis"],
  ["VOLUME_FIM_DE_SEMANA", "volumeFimDeSemana"],
  ["PICO_MANHA", "picoManha"],
  ["PICO_TARDE_NOITE", "picoTardeNoite"],
];

export interface NormalizedDataset {
  corridors: Corridor[];
  approaches: Approach[];
  measurements: Measurement[];
}

export function normalizeMatrix(rows: RawMatrixRow[] = RAW_MATRIX): NormalizedDataset {
  const corridors = new Map<string, Corridor>();
  const approaches: Approach[] = [];
  const measurements: Measurement[] = [];

  for (const r of rows) {
    const corridorId = slug(r.corredor);
    const refMatch = /\(([^)]*)\)/.exec(r.corredor);
    if (!corridors.has(corridorId)) {
      const c = APPROX_COORDS[corridorId];
      corridors.set(corridorId, {
        id: corridorId,
        name: r.corredor.replace(/\s*\(.*?\)\s*/g, "").trim(),
        address: r.corredor.replace(/\s*\(.*?\)\s*/g, "").trim(),
        reference: refMatch ? refMatch[1] : null,
        roadClassRaw: /Via Expressa/i.test(r.faixas) ? "Via Expressa" : /Vias Urbanas/i.test(r.faixas) ? "Via urbana" : null,
        coordinates: c
          ? {
              lat: c[0],
              lng: c[1],
              provenance: "APROXIMADO_FONTE_EXTERNA",
              note: "Coordenada aproximada inserida pelo sistema para visualização. Não consta nos documentos — validar.",
            }
          : null,
        approachIds: [],
      });
    } else if (refMatch && !corridors.get(corridorId)!.reference) {
      corridors.get(corridorId)!.reference = refMatch[1];
    }

    const approachId = `${corridorId}--r${r.row}`;
    corridors.get(corridorId)!.approachIds.push(approachId);
    const source = { documentId: "DOC-PARAMETROS", section: "1. Matriz Comparativa de Fontes, Fluxo e Velocidade", locator: `linha ${r.row}` };
    approaches.push({
      id: approachId,
      corridorId,
      label: r.sentidoPista,
      directionRaw: r.sentidoPista,
      lanesRaw: r.faixas,
      laneCount: parseLaneCount(r.faixas),
      speedRecordRaw: r.registroVelocidades,
      notesRaw: r.observacoes,
      source,
    });

    for (const [metric, field] of METRIC_FIELDS) {
      const raw = String(r[field]);
      const q = parseQuantity(raw);
      measurements.push({
        id: `${approachId}--${metric}`,
        approachId,
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
  return { corridors: [...corridors.values()], approaches, measurements };
}

export function metricColumn(m: MeasurementMetric): string {
  return {
    VDM_DIAS_UTEIS: "Volume Diário Médio (VDM - Dias Úteis)",
    VOLUME_FIM_DE_SEMANA: "Volume Diário (Fins de Semana)",
    PICO_MANHA: "Pico Manhã (Horário / Fluxo Máx.)",
    PICO_TARDE_NOITE: "Pico Tarde/Noite (Horário / Fluxo Máx.)",
  }[m];
}
