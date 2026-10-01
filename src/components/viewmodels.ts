import type { Series } from "@/domain/types";
import { aggregateHourly } from "@/engine/series";
import type { TrafficRepository } from "@/repository";

export const SERIES_COLORS = ["var(--accent)", "var(--accent-2)"];

export function seriesValues(r: TrafficRepository, s: Series) {
  return aggregateHourly(r.observations(s.id)).map((h) => h.flow);
}

export function segmentTitle(r: TrafficRepository, segmentId: string) {
  const s = r.segment(segmentId)!;
  const l = r.location(s.locationId)!;
  return { corridor: r.corridor(s.corridorId)!.name, location: l.address, segment: s.label, full: `${l.address} · ${s.label}` };
}
