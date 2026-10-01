import { describe, expect, it } from "vitest";
import { GET as corridors } from "@/app/api/corridors/route";
import { GET as corridor } from "@/app/api/corridors/[id]/route";
import { GET as indicator } from "@/app/api/indicators/[id]/route";
import { GET as methodology } from "@/app/api/methodology/route";
import { GET as quality } from "@/app/api/quality/route";
import { GET as simulation } from "@/app/api/simulation/route";
import { POST as camera } from "@/app/api/camera/observations/route";

const p = <T,>(v: T) => ({ params: Promise.resolve(v) });

describe("API", () => {
  it("GET /api/corridors", async () => {
    const j = await corridors().json();
    expect(j.source).toBe("HISTORICO");
    expect(j.data).toHaveLength(5);
  });
  it("GET /api/corridors/[id] 200 e 404", async () => {
    expect((await corridor(new Request("http://x"), p({ id: "linha-vermelha-km-5-5" }))).status).toBe(200);
    expect((await corridor(new Request("http://x"), p({ id: "nope" }))).status).toBe(404);
  });
  it("GET /api/indicators/[id] inclui metodologia", async () => {
    const j = await (await indicator(new Request("http://x"), p({ id: "av-americas-2000--r2--QUEDA_FDS" }))).json();
    expect(j.data.methodology.id).toBe("M-QUEDA-FDS");
  });
  it("GET /api/methodology traz configuração da condição sem limites", async () => {
    const j = await methodology().json();
    expect(j.conditionConfig.thresholds).toBeNull();
  });
  it("GET /api/quality", async () => {
    expect((await quality().json()).data.length).toBeGreaterThan(0);
  });
  it("GET /api/simulation valida parâmetros e marca SIMULACAO", async () => {
    expect(simulation(new Request("http://x/api/simulation")).status).toBe(400);
    expect(simulation(new Request("http://x/api/simulation?approachId=nope")).status).toBe(404);
    const res = simulation(new Request("http://x/api/simulation?approachId=linha-vermelha-km-5-5--r7&seed=3"));
    expect((await res.json()).source).toBe("SIMULACAO");
  });
  it("POST /api/camera/observations — válido não persiste", async () => {
    const body = { cameraId: "C1", timestamp: "2026-01-05T07:00:00Z", intervalSeconds: 900, vehicleCount: 50, direction: "X", confidence: 0.8, source: "teste" };
    const res = await camera(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    expect(res.status).toBe(202);
    const j = await res.json();
    expect(j.connected).toBe(false);
    expect(j.persisted).toBe(false);
  });
  it("POST /api/camera/observations — inválido 422, JSON quebrado 400", async () => {
    expect((await camera(new Request("http://x", { method: "POST", body: JSON.stringify({ cameraId: "" }) }))).status).toBe(422);
    expect((await camera(new Request("http://x", { method: "POST", body: "{" }))).status).toBe(400);
  });
});
