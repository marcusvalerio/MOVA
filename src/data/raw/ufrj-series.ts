/**
 * DATA LAYER — séries horárias do PDF "Fluxos UFRJ", conforme transcritas na especificação
 * (DOC-ESPECIFICACAO, seções 3 e 5). Valores literais. `null` = ausente na transcrição.
 */
export interface RawHourlySeries {
  id: string;
  /** Linha da matriz (DOC-PARAMETROS) que corresponde ao mesmo segmento. */
  matrixRow: number;
  descriptionRaw: string;
  dateRaw: string;
  date: string | null;
  month: string;
  section: string;
  values: { interval: string; raw: string | null }[];
}

export const RAW_UFRJ_SERIES: RawHourlySeries[] = [
  {
    id: "ufrj-2019-03-americas-2000-central",
    matrixRow: 2,
    descriptionRaw: "Av. das Américas — Santa Cruz — Pista Central",
    dateRaw: "Em um dos registros de março de 2019",
    date: null,
    month: "2019-03",
    section: "Seção 3 (Fluxos UFRJ)",
    values: [
      { interval: "07:00–08:00", raw: "1.113" },
      { interval: "08:00–09:00", raw: "1.590" },
      { interval: "09:00–10:00", raw: "1.842" },
      { interval: "10:00–11:00", raw: "2.057" },
      { interval: "11:00–12:00", raw: "2.092" },
      { interval: "12:00–13:00", raw: "2.285" },
      { interval: "13:00–14:00", raw: "2.356" },
      { interval: "14:00–15:00", raw: "2.397" },
      { interval: "15:00–16:00", raw: "2.328" },
      { interval: "16:00–17:00", raw: "2.138" },
      { interval: "17:00–18:00", raw: "1.988" },
      { interval: "18:00–19:00", raw: "1.892" },
    ],
  },
  {
    id: "ufrj-2023-03-01-americas-2000-central",
    matrixRow: 2,
    descriptionRaw: "Av. das Américas — sentido Santa Cruz — pista central",
    dateRaw: "01/03/2023",
    date: "2023-03-01",
    month: "2023-03",
    section: "Seção 5 (Fluxo de março de 2023)",
    values: [
      { interval: "00–01", raw: "520" },
      { interval: "01–02", raw: "668" },
      { interval: "02–03", raw: "365" },
      { interval: "03–04", raw: "93" },
      { interval: "04–05", raw: "89" },
      { interval: "05–06", raw: "322" },
      { interval: "06–07", raw: "1.178" },
      { interval: "07–08", raw: "2.257" },
      { interval: "08–09", raw: "2.390" },
      { interval: "09–10", raw: "2.473" },
      { interval: "10–11", raw: "2.758" },
      { interval: "11–12", raw: "2.886" },
      { interval: "12–13", raw: "2.033" },
      { interval: "13–14", raw: "2.896" },
      { interval: "14–15", raw: "1.853" },
      { interval: "15–16", raw: "2.940" },
      { interval: "16–17", raw: "2.432" },
      { interval: "17–18", raw: "2.961" },
      { interval: "18–19", raw: "2.076" },
      { interval: "19–20", raw: "2.469" },
      { interval: "20–21", raw: "2.733" },
      { interval: "21–22", raw: "1.935" },
      { interval: "22–23", raw: "continuar conforme fonte" },
      { interval: "23–24", raw: "continuar conforme fonte" },
    ],
  },
];
