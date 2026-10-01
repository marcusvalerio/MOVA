import type { QualityStatus } from "@/domain/types";

/** Classifica uma célula bruta (ex.: "#NUM!", "", "0", "1.250", "continuar conforme fonte"). */
export function classifyRawCell(raw: string | number | null | undefined): { status: QualityStatus; value: number | null } {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return { status: "AUSENTE", value: null };
  if (typeof raw === "string" && /^#(NUM|DIV\/0|VALUE|REF|N\/A|NAME)[!?]?/i.test(raw.trim())) return { status: "INVALIDO", value: null };
  if (typeof raw === "string" && !/\d/.test(raw)) return { status: "AUSENTE", value: null };
  const n = typeof raw === "number" ? raw : Number(raw.trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return { status: "INVALIDO", value: null };
  if (n === 0) return { status: "SUSPEITO", value: 0 };
  if (n < 0) return { status: "INVALIDO", value: n };
  return { status: "VALIDO", value: n };
}
