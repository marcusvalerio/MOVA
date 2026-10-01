import { describe, expect, it } from "vitest";
import { GET as corridors } from "@/app/api/corridors/route";
import { GET as corridor } from "@/app/api/corridors/[id]/route";
import { GET as segment } from "@/app/api/segments/[id]/route";
import { GET as indicator } from "@/app/api/indicators/[id]/route";
import { GET as methodology } from "@/app/api/methodology/route";
import { GET as quality } from "@/app/api/quality/route";
import { GET as simulation } from "@/app/api/simulation/route";
import { POST as camera } from "@/app/api/camera/observations/route";

const p = <T,>(v: T) => ({ params: Promise.resolve(v) });
const req = (u = "http://x") => new Request(u);
const SEG = "av-americas--2000--santa-cruz--pista-central";

describe("API", () => {
  it("GET /api/corridors devolve a hierarquia", async () => {
    const j = await corridors().json();
    expect(j.data).toHaveLength(4);
    expect(j.data[0].locations[0].segments.length).toBe(3);
  });
  it("GET /api/corridors/[id] 200/404", async () => {
    expect((await corridor(req(), p({ id: "av-americas" }))).status).toBe(200);
    expect((await corridor(req(), p({ id: "x" }))).status).toBe(404);
  });
  it("GET /api/segments/[id] traz séries com observações e agregação horária", async () => {
    const j = await (await segment(req(), p({ id: SEG }))).json();
    expect(j.data.series).toHaveLength(2);
    expect(j.data.series.find((s: { date: string }) => s.date === "2023-03-01").hourly[17].flow).toBe(2961);
    expect((await segment(req(), p({ id: "x" }))).status).toBe(404);
  });
  it("GET /api/indicators/[id] inclui metodologia", async () => {
    const j = await (await indicator(req(), p({ id: "ufrj-2023-03-01-americas-2000-central--PICO" }))).json();
    expect(j.data.methodology.id).toBe("M-PICO");
  });
  it("GET /api/methodology sem limites de condição", async () => expect((await methodology().json()).conditionConfig.thresholds).toBeNull());
  it("GET /api/quality", async () => expect((await quality().json()).data.length).toBeGreaterThan(0));
  it("GET /api/simulation valida parâmetros", async () => {
    expect(simulation(req("http://x/api/simulation")).status).toBe(400);
    expect(simulation(req(`http://x/api/simulation?segmentId=${SEG}&scenario=foo`)).status).toBe(400);
    expect(simulation(req(`http://x/api/simulation?segmentId=${SEG}&dayType=FERIADO`)).status).toBe(400);
    expect(simulation(req("http://x/api/simulation?segmentId=x")).status).toBe(404);
    const j = await simulation(req(`http://x/api/simulation?segmentId=${SEG}&scenario=fila-crescente&dayType=SABADO`)).json();
    expect(j.source).toBe("SIMULACAO");
  });
  it("POST /api/camera/observations — 202 com três camadas, nada persistido", async () => {
    const body = { cameraId: "C1", timestamp: "2026-03-04T07:30:00-03:00", intervalSeconds: 300, vehicleCount: 127, direction: "X", confidence: 0.8, source: "t" };
    const res = await camera(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    expect(res.status).toBe(202);
    const j = await res.json();
    expect(j.persisted).toBe(false);
    expect(j.results[0].calculado.equivalentHourlyFlow).toBe(1524);
  });
  it("POST inválido 422; JSON quebrado 400", async () => {
    expect((await camera(new Request("http://x", { method: "POST", body: "{\"cameraId\":\"\"}" }))).status).toBe(422);
    expect((await camera(new Request("http://x", { method: "POST", body: "{" }))).status).toBe(400);
  });
});
