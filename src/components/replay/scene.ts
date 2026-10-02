/**
 * Cena de câmera (CCTV) em perspectiva para o painel de reprodução.
 *
 * Geometria: câmera pinhole a CAM_H metros de altura, deslocada para a lateral da via, olhando ao longo dela.
 * Tráfego: os carros vêm de longe em direção à câmera, na velocidade média da hora (relatório), e surgem
 * a uma taxa igual ao fluxo da hora (veíc/h ÷ 3600 por segundo). Em regime, a densidade na tela é
 * k = q / v — a mesma relação fundamental do tráfego, sem fator de escala inventado.
 * Tudo que não vem do relatório (cores, tamanhos, cenário) é apenas visual.
 */

export interface SceneCar {
  id: number;
  lane: number;
  z: number; // distância da frente do carro à câmera (m)
  v: number; // m/s
  len: number;
  wid: number;
  hgt: number;
  color: [number, number, number];
  kind: "carro" | "suv" | "onibus";
  counted: boolean;
}

export interface SceneState {
  cars: SceneCar[];
  acc: number;
  nextId: number;
  flash: number;
  counted: number;
  noise: HTMLCanvasElement | null;
  warm: boolean;
}

const LANE_W = 3.5;
const LANES = 3;
const ROAD_HALF = (LANE_W * LANES) / 2;
const CAM_H = 16;
const CAM_X = ROAD_HALF + 1.2; // câmera em poste na borda direita da pista
const Z_FAR = 460;
const Z_NEAR = 30;
const COUNT_Z = 80;
const PALETTE: [number, number, number][] = [
  [228, 230, 233], [200, 204, 210], [150, 156, 165], [70, 76, 86], [30, 33, 38], [168, 40, 38], [40, 72, 130], [196, 180, 150],
];

export function createScene(): SceneState {
  return { cars: [], acc: 0, nextId: 1, flash: 0, counted: 0, noise: null, warm: false };
}

export function resetScene(s: SceneState) {
  s.cars = [];
  s.acc = 0;
  s.counted = 0;
  s.warm = false;
}

/** Preenche a via com o regime permanente da hora atual (simula o tempo de travessia instantaneamente). */
export function warmScene(s: SceneState, flow: number | null, speed: number | null) {
  s.warm = true;
  if (flow == null || flow <= 0) return;
  const v = Math.max(2, (speed ?? 40) / 3.6);
  const steps = Math.ceil((Z_FAR - Z_NEAR) / v / 0.1) + 20;
  for (let i = 0; i < steps; i++) stepScene(s, 0.1, flow, speed);
  s.counted = 0;
  s.flash = 0;
}

const laneX = (lane: number) => -ROAD_HALF + LANE_W * (lane + 0.5);

/** Avança a simulação dt segundos (tempo real). flow em veíc/h, speed em km/h. */
export function stepScene(s: SceneState, dt: number, flow: number | null, speed: number | null) {
  if (dt <= 0) return;
  const vTarget = Math.max(2, (speed ?? 40) / 3.6);
  if (flow != null && flow > 0) {
    s.acc += (flow / 3600) * dt;
    let guard = 0;
    while (s.acc >= 1 && guard++ < 6) {
      s.acc -= 1;
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      for (const lane of lanes) {
        const last = s.cars.filter((c) => c.lane === lane).reduce((m, c) => Math.max(m, c.z), -Infinity);
        const r = Math.random();
        const kind: SceneCar["kind"] = r < 0.04 ? "onibus" : r < 0.3 ? "suv" : "carro";
        const len = kind === "onibus" ? 12 : kind === "suv" ? 4.8 : 4.3;
        if (last < Z_FAR - len - 6) {
          s.cars.push({
            id: s.nextId++, lane, z: Z_FAR, v: vTarget * (0.92 + Math.random() * 0.16), len,
            wid: kind === "onibus" ? 2.5 : kind === "suv" ? 1.9 : 1.78, hgt: kind === "onibus" ? 3.1 : kind === "suv" ? 1.7 : 1.45,
            color: kind === "onibus" ? [214, 214, 210] : PALETTE[Math.floor(Math.random() * PALETTE.length)], kind, counted: false,
          });
          break;
        }
      }
    }
  }
  for (let lane = 0; lane < LANES; lane++) {
    const lc = s.cars.filter((c) => c.lane === lane).sort((a, b) => a.z - b.z); // mais próximo primeiro
    for (let i = 0; i < lc.length; i++) {
      const c = lc[i];
      const want = vTarget * (0.94 + ((c.id * 37) % 13) / 100);
      c.v += (want - c.v) * Math.min(1, dt * 1.5);
      let nz = c.z - c.v * dt;
      if (i > 0) {
        const ahead = lc[i - 1];
        const gap = 2 + c.v * 0.9; // distância de segurança simples
        nz = Math.max(nz, ahead.z + ahead.len + gap);
        if (nz > c.z) nz = c.z;
      }
      if (!c.counted && c.z > COUNT_Z && nz <= COUNT_Z) { c.counted = true; s.counted++; s.flash = 0.25; }
      c.z = nz;
    }
  }
  s.flash = Math.max(0, s.flash - dt);
  s.cars = s.cars.filter((c) => c.z > Z_NEAR + 1);
}

interface Light { sky0: string; sky1: string; ground: number; night: number }

/** Iluminação aproximada pela hora do relógio (apenas visual). */
function lightAt(hour: number): Light {
  const d = hour < 5 || hour >= 19.5 ? 0 : hour < 7 ? (hour - 5) / 2 : hour < 17.5 ? 1 : (19.5 - hour) / 2;
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const s0 = mix([10, 14, 26], [120, 170, 220], d), s1 = mix([22, 26, 40], [210, 225, 235], d);
  return { sky0: `rgb(${s0})`, sky1: `rgb(${s1})`, ground: 0.25 + 0.75 * d, night: 1 - d };
}

export interface DrawInfo {
  hour: number;
  camLabel: string;
  stamp: string;
  noData: boolean;
  blink: boolean;
}

export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState, W: number, H: number, info: DrawInfo) {
  // Teleobjetiva (como câmeras de trânsito): mais metros de via no quadro, carros distantes ainda legíveis.
  const f = W * 1.75;
  const cx = W * 0.62;
  const hy = H * 0.2;
  const P = (x: number, y: number, z: number): [number, number] => [cx + (f * (x - CAM_X)) / z, hy + (f * (CAM_H - y)) / z];
  const L = lightAt(info.hour);
  const shade = (rgb: number[], k: number) => `rgb(${rgb.map((v) => Math.round(v * k * (0.35 + 0.65 * L.ground))).join(",")})`;
  const poly = (pts: [number, number][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // céu e horizonte
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, L.sky0);
  g.addColorStop(1, L.sky1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, hy + 2);
  // silhueta de prédios
  ctx.fillStyle = shade([70, 78, 90], 1);
  let bx = 0, seed = 7;
  while (bx < W) {
    seed = (seed * 9301 + 49297) % 233280;
    const bw = 30 + (seed % 70), bh = 12 + ((seed >> 3) % 50);
    ctx.fillRect(bx, hy - bh, bw, bh + 2);
    if (L.night > 0.4) {
      ctx.fillStyle = `rgba(255,214,140,${0.5 * L.night})`;
      for (let wy = hy - bh + 5; wy < hy - 3; wy += 8) for (let wx = bx + 4; wx < bx + bw - 4; wx += 9) if ((wx * wy + seed) % 5 === 0) ctx.fillRect(wx, wy, 3, 3);
      ctx.fillStyle = shade([70, 78, 90], 1);
    }
    bx += bw + 4;
  }
  // terreno
  ctx.fillStyle = shade([88, 110, 72], 1);
  ctx.fillRect(0, hy, W, H - hy);
  // canteiro esquerdo, calçada direita, pista
  const zN = Z_NEAR, zF = Z_FAR;
  poly([P(-ROAD_HALF - 4, 0, zN), P(-ROAD_HALF - 4, 0, zF), P(-ROAD_HALF, 0, zF), P(-ROAD_HALF, 0, zN)], shade([96, 120, 78], 1));
  // árvores no canteiro (apenas cenário)
  for (let z = zF - 6; z > zN + 10; z -= 18) {
    const b0 = P(-ROAD_HALF - 2, 0, z), b1 = P(-ROAD_HALF - 2, 3, z), r = (f * 2.2) / z;
    ctx.strokeStyle = shade([80, 64, 48], 1);
    ctx.lineWidth = Math.max(1, (f * 0.25) / z);
    ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    ctx.fillStyle = shade([58, 92, 52], 1);
    ctx.beginPath(); ctx.ellipse(b1[0], b1[1] - r * 0.6, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  poly([P(ROAD_HALF, 0, zN), P(ROAD_HALF, 0, zF), P(ROAD_HALF + 4.5, 0, zF), P(ROAD_HALF + 4.5, 0, zN)], shade([170, 168, 160], 1));
  poly([P(-ROAD_HALF, 0, zN), P(-ROAD_HALF, 0, zF), P(ROAD_HALF, 0, zF), P(ROAD_HALF, 0, zN)], shade([62, 66, 72], 1));
  // meio-fio
  ctx.strokeStyle = shade([215, 215, 210], 1);
  ctx.lineWidth = 2;
  for (const x of [-ROAD_HALF, ROAD_HALF]) {
    const a = P(x, 0, zN), b = P(x, 0, zF);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // faixas tracejadas
  ctx.fillStyle = shade([230, 230, 225], 1);
  for (let l = 1; l < LANES; l++) {
    const x = -ROAD_HALF + LANE_W * l;
    for (let z = zN; z < zF; z += 12) poly([P(x - 0.07, 0, z), P(x - 0.07, 0, z + 4), P(x + 0.07, 0, z + 4), P(x + 0.07, 0, z)], shade([230, 230, 225], 1));
  }
  // postes
  for (let z = 60; z < zF; z += 45) {
    const base = P(ROAD_HALF + 3.8, 0, z), top = P(ROAD_HALF + 3.8, 8, z), arm = P(ROAD_HALF + 1.5, 8, z);
    ctx.strokeStyle = shade([90, 94, 100], 1);
    ctx.lineWidth = Math.max(1, (f * 0.18) / z);
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]); ctx.lineTo(arm[0], arm[1]); ctx.stroke();
    if (L.night > 0.3) {
      const rg = ctx.createRadialGradient(arm[0], arm[1] + 2, 0, arm[0], arm[1] + 2, (f * 3) / z);
      rg.addColorStop(0, `rgba(255,220,150,${0.55 * L.night})`);
      rg.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(arm[0] - (f * 3) / z, arm[1] - (f * 3) / z, (f * 6) / z, (f * 6) / z);
    }
  }
  // linha virtual de contagem (no chão)
  const c1 = P(-ROAD_HALF, 0, COUNT_Z), c2 = P(ROAD_HALF, 0, COUNT_Z);
  ctx.strokeStyle = s.flash > 0 ? "rgba(120,255,150,1)" : "rgba(60,220,110,0.9)";
  ctx.lineWidth = s.flash > 0 ? 4 : 3;
  ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke();

  // carros: do mais distante para o mais próximo
  const cars = [...s.cars].sort((a, b) => b.z - a.z);
  for (const c of cars) {
    if (c.z > zF) continue;
    const xc = laneX(c.lane);
    const x0 = xc - c.wid / 2, x1 = xc + c.wid / 2;
    const z0 = Math.max(c.z, Z_NEAR + 0.3), z1 = c.z + c.len;
    // sombra
    poly([P(x0 - 0.2, 0, z0 - 0.2), P(x1 + 0.3, 0, z0 - 0.2), P(x1 + 0.6, 0, z1 + 0.3), P(x0, 0, z1 + 0.3)], `rgba(0,0,0,${0.25 + 0.15 * L.ground})`);
    const bodyH = c.kind === "onibus" ? c.hgt : c.hgt * 0.55;
    // lateral visível (camera à direita → vê o lado direito, x1)
    poly([P(x1, 0, z0), P(x1, 0, z1), P(x1, bodyH, z1), P(x1, bodyH, z0)], shade(c.color, 0.72));
    // topo da carroceria
    poly([P(x0, bodyH, z0), P(x1, bodyH, z0), P(x1, bodyH, z1), P(x0, bodyH, z1)], shade(c.color, 1.05));
    // frente
    poly([P(x0, 0, z0), P(x1, 0, z0), P(x1, bodyH, z0), P(x0, bodyH, z0)], shade(c.color, 0.88));
    if (c.kind === "onibus") {
      poly([P(x0 + 0.15, bodyH * 0.45, z0), P(x1 - 0.15, bodyH * 0.45, z0), P(x1 - 0.15, bodyH * 0.9, z0), P(x0 + 0.15, bodyH * 0.9, z0)], "rgba(30,40,55,0.9)");
      for (let wz = z0 + 1.2; wz < z1 - 1; wz += 1.6) poly([P(x1, bodyH * 0.5, wz), P(x1, bodyH * 0.5, wz + 1.2), P(x1, bodyH * 0.85, wz + 1.2), P(x1, bodyH * 0.85, wz)], "rgba(30,40,55,0.85)");
    } else {
      // cabine
      const ca = z0 + c.len * 0.3, cb = z0 + c.len * 0.78, ix = 0.14, top = c.hgt;
      poly([P(x1 - ix, bodyH, ca), P(x1 - ix, bodyH, cb), P(x1 - ix, top, cb - 0.3), P(x1 - ix, top, ca + 0.4)], "rgba(35,45,58,0.92)");
      poly([P(x0 + ix, top, ca + 0.4), P(x1 - ix, top, ca + 0.4), P(x1 - ix, top, cb - 0.3), P(x0 + ix, top, cb - 0.3)], shade(c.color, 1.1));
      poly([P(x0 + ix, bodyH, ca), P(x1 - ix, bodyH, ca), P(x1 - ix, top, ca + 0.4), P(x0 + ix, top, ca + 0.4)], "rgba(25,32,44,0.95)");
    }
    // faróis
    const hl = L.night > 0.35;
    for (const hx of [x0 + 0.25, x1 - 0.45]) poly([P(hx, bodyH * 0.55, z0), P(hx + 0.2, bodyH * 0.55, z0), P(hx + 0.2, bodyH * 0.8, z0), P(hx, bodyH * 0.8, z0)], hl ? "rgba(255,248,220,1)" : "rgba(235,235,225,0.9)");
    if (hl) {
      const a = P(xc, bodyH * 0.6, z0);
      const rg = ctx.createRadialGradient(a[0], a[1], 0, a[0], a[1], (f * 2.4) / z0);
      rg.addColorStop(0, `rgba(255,245,210,${0.45 * L.night})`);
      rg.addColorStop(1, "rgba(255,245,210,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(a[0] - (f * 2.4) / z0, a[1] - (f * 2.4) / z0, (f * 4.8) / z0, (f * 4.8) / z0);
    }
    // caixa de detecção (estilo YOLO) = envoltória da projeção
    const pts = [P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, c.hgt, z0), P(x1, c.hgt, z1), P(x0, c.hgt, z1)];
    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    if (maxX - minX > 6) {
      ctx.strokeStyle = c.kind === "onibus" ? "rgba(255,196,60,0.95)" : "rgba(80,160,255,0.95)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
      if (maxX - minX > 26) {
        const label = `${c.kind === "onibus" ? "onibus" : "carro"} #${c.id}`;
        ctx.font = "10px ui-monospace, monospace";
        const tw = ctx.measureText(label).width + 6;
        ctx.fillStyle = c.kind === "onibus" ? "rgba(255,196,60,0.95)" : "rgba(80,160,255,0.95)";
        ctx.fillRect(minX - 2, minY - 15, tw, 13);
        ctx.fillStyle = "#0b0e12";
        ctx.fillText(label, minX + 1, minY - 5);
      }
    }
  }

  if (info.noData) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText("Hora sem dado no relatório (não preenchida)", 18, H / 2);
  }

  // efeito de câmera: granulação + vinheta + carimbos
  if (!s.noise) {
    const n = document.createElement("canvas");
    n.width = 160; n.height = 120;
    const nc = n.getContext("2d")!;
    const im = nc.createImageData(160, 120);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 22; }
    nc.putImageData(im, 0, 0);
    s.noise = n;
  }
  ctx.globalAlpha = 0.5 + 0.4 * L.night;
  ctx.drawImage(s.noise, (Math.random() * -40) | 0, (Math.random() * -30) | 0, W + 40, H + 30);
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(8, 8, ctx.measureText(info.camLabel).width + 16, 20);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillText(info.camLabel, 16, 22);
  const sw = ctx.measureText(info.stamp).width;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(W - sw - 50, 8, sw + 42, 20);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillText(info.stamp, W - sw - 16, 22);
  if (info.blink) { ctx.fillStyle = "#ff3b30"; ctx.beginPath(); ctx.arc(W - sw - 34, 18, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(`linha virtual: ${s.counted} veículo(s) na animação · densidade = fluxo ÷ velocidade (tempo real)`, 14, H - 12);
}
