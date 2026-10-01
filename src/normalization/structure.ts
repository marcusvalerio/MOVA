import type { Carriageway, Corridor, LaneType, Location, RoadSegment, SourceRef } from "@/domain/types";
import { LOCATION_COORDS } from "@/data/raw/pdf-locais";

/**
 * Construtor da hierarquia Corredor → Local → Segmento, compartilhado pela matriz (.docx) e pelos PDFs,
 * para que o mesmo trecho da via tenha o mesmo identificador nas duas fontes.
 */
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

const locationSlug = (s: string) => slug(s).replace(/^proximo-ao-/, "").replace(/^n-/, "");

export const CARRIAGEWAY_LABEL: Record<Carriageway, string> = {
  CENTRAL: "Pista Central",
  LATERAL: "Pista Lateral",
  CENTRAL_E_LATERAL: "Pistas Central e Lateral",
  EXCLUSIVA_BRT: "Faixa Exclusiva BRT",
  VIA_EXPRESSA: "Via Expressa",
  NAO_ESPECIFICADA: "Pista não especificada",
};

export interface SegmentSpec {
  corridor: string;
  location: string;
  direction: string;
  carriageway: Carriageway;
  laneType: LaneType;
  reference?: string | null;
  roadClassRaw?: string | null;
  laneCount?: number | null;
  lanesMonitoredRaw?: string;
  directionRaw?: string;
  speedRecordRaw?: string;
  notesRaw?: string;
  structureNote?: string | null;
  source: SourceRef;
}

export class StructureBuilder {
  readonly corridors = new Map<string, Corridor>();
  readonly locations = new Map<string, Location>();
  readonly segments = new Map<string, RoadSegment>();

  ensure(spec: SegmentSpec): RoadSegment {
    const corridorId = slug(spec.corridor);
    const locationId = `${corridorId}--${locationSlug(spec.location)}`;
    if (!this.corridors.has(corridorId)) this.corridors.set(corridorId, { id: corridorId, name: spec.corridor, description: "", locationIds: [] });
    let loc = this.locations.get(locationId);
    if (!loc) {
      const c = LOCATION_COORDS[`${spec.corridor}|${spec.location}`];
      loc = {
        id: locationId,
        corridorId,
        address: `${spec.corridor}, ${spec.location}`,
        reference: spec.reference ?? null,
        roadClassRaw: spec.roadClassRaw ?? null,
        coordinates: c ? { lat: c.lat, lng: c.lng, provenance: "FONTE_DOCUMENTAL", raw: c.raw, note: `Coordenada impressa no relatório de fluxo (DOC-FLUXOS-UFRJ, p. ${c.page}).` } : null,
        segmentIds: [],
      };
      this.locations.set(locationId, loc);
      this.corridors.get(corridorId)!.locationIds.push(locationId);
    } else {
      loc.reference ??= spec.reference ?? null;
      loc.roadClassRaw ??= spec.roadClassRaw ?? null;
    }
    const id = `${locationId}--${slug(spec.direction)}--${slug(CARRIAGEWAY_LABEL[spec.carriageway])}`;
    let seg = this.segments.get(id);
    if (!seg) {
      seg = {
        id,
        locationId,
        corridorId,
        label: `Sentido ${spec.direction} · ${CARRIAGEWAY_LABEL[spec.carriageway]}`,
        direction: spec.direction,
        carriageway: spec.carriageway,
        laneType: spec.laneType,
        laneCount: spec.laneCount ?? null,
        lanesMonitoredRaw: spec.lanesMonitoredRaw ?? "não informado",
        directionRaw: spec.directionRaw ?? spec.direction,
        speedRecordRaw: spec.speedRecordRaw ?? "—",
        notesRaw: spec.notesRaw ?? "",
        structureNote: spec.structureNote ?? null,
        source: spec.source,
      };
      this.segments.set(id, seg);
      loc.segmentIds.push(id);
    }
    return seg;
  }
}
