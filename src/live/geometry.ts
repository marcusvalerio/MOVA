/** Geometria de cruzamento de linha virtual — mesma regra de cv/mova_cv/geometry.py (M-CV-CONTAGEM). */
export type Pt = readonly [number, number];

/** Produto vetorial (p2−p1) × (pt−p1). O sinal indica de que lado da linha o ponto está. */
export function side(p1: Pt, p2: Pt, pt: Pt): number {
  return (p2[0] - p1[0]) * (pt[1] - p1[1]) - (p2[1] - p1[1]) * (pt[0] - p1[0]);
}

function orient(p: Pt, q: Pt, r: Pt): number {
  const v = side(p, q, r);
  return v === 0 ? 0 : v > 0 ? 1 : -1;
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
}

/**
 * +1 ou −1 se o deslocamento prev→cur cruza o segmento p1–p2; 0 caso contrário.
 * +1 = do lado negativo para o positivo de side(p1, p2, ·). Em coordenadas de imagem (y para baixo),
 * numa linha desenhada da esquerda para a direita, +1 = movimento para baixo.
 * Escalas positivas e independentes em x e y (pixels ↔ coordenadas normalizadas) não mudam o resultado.
 */
export function crossing(p1: Pt, p2: Pt, prev: Pt, cur: Pt): 1 | -1 | 0 {
  if (!segmentsIntersect(p1, p2, prev, cur)) return 0;
  const s0 = side(p1, p2, prev), s1 = side(p1, p2, cur);
  if (s0 < 0 && s1 >= 0) return 1;
  if (s0 > 0 && s1 <= 0) return -1;
  return 0;
}
