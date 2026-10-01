import type { TrafficRepository } from "@/repository";
import type { ReplaySegment } from "./types";

/** Prepara os dias reais de cada segmento para o painel de reprodução (somente dados observados). */
export function replaySegments(r: TrafficRepository): ReplaySegment[] {
  const out: ReplaySegment[] = [];
  for (const seg of r.segments()) {
    const periods = r.periods(seg.id);
    if (!periods.length) continue;
    let maxFlow = 0, maxWhen = "", maxSpeed: number | null = null;
    for (const p of periods) {
      if (p.maxHour && p.maxHour.flow > maxFlow) { maxFlow = p.maxHour.flow; maxWhen = `${p.maxHour.date.split("-").reverse().join("/")} às ${String(p.maxHour.hour).padStart(2, "0")}h`; }
      if (p.maxSpeed != null && (maxSpeed == null || p.maxSpeed > maxSpeed)) maxSpeed = p.maxSpeed;
    }
    if (!maxFlow) continue;
    const loc = r.location(seg.locationId)!;
    const days = periods.flatMap((p) => p.days).map((d) => ({
      date: d.series.date as string,
      dayType: d.series.dayType,
      note: d.series.dayNote ?? null,
      complete: d.complete,
      flow: d.hourly.map((h) => h.flow),
      speed: d.hourly.map((h) => (h.speed == null ? null : Math.round(h.speed))),
      total: d.total,
    }));
    out.push({
      id: seg.id,
      corridor: r.corridor(seg.corridorId)!.name,
      location: loc.address.split(", ").slice(1).join(", "),
      label: seg.label,
      laneType: seg.laneType,
      maxFlow,
      maxFlowWhen: maxWhen,
      maxSpeed,
      source: "Relatórios de fiscalização eletrônica (DOC-FLUXOS-UFRJ e DOC-VELOCIDADES)",
      days,
    });
  }
  return out;
}
