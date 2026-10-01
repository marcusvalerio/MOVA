import type { NumericRange } from "@/domain/types";

/**
 * TRAFFIC ENGINE — operações sobre faixas (aritmética de intervalos).
 * Não usa ponto médio: preserva a incerteza da fonte.
 */

/** Intervalo de queda relativa de `after` em relação a `before`, em fração (0.25 = 25%). */
export function relativeDropInterval(before: NumericRange, after: NumericRange): { min: number; max: number } {
  if (before.min <= 0 || before.max <= 0) throw new RangeError("Faixa de referência deve ser positiva");
  return {
    min: 1 - after.max / before.min,
    max: 1 - after.min / before.max,
  };
}

export function intersects(a: { min: number; max: number }, b: { min: number; max: number }): boolean {
  return a.min <= b.max && b.min <= a.max;
}

/** Regra da fonte (Seção 2.B): queda de 25% a 50%. */
export const WEEKEND_DROP_RULE = { min: 0.25, max: 0.5 } as const;

export function weekendDropCheck(vdm: NumericRange, weekend: NumericRange) {
  const drop = relativeDropInterval(vdm, weekend);
  return { drop, rule: WEEKEND_DROP_RULE, compatible: intersects(drop, WEEKEND_DROP_RULE) };
}
