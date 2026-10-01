import type { Carriageway, LaneType } from "@/domain/types";

/**
 * Mapeamento dos títulos de local dos relatórios de fiscalização (PDFs) para a hierarquia
 * Corredor → Local → Sentido → Pista. Os títulos mudam de formato entre anos
 * ("Av Americas Px2000 PCent-St a Cruz" em 2019 × "AVENIDA DAS AMERICAS PROXIMO AO Nº 2000 - ... - PISTA CENTRAL" em 2023);
 * cada regra declara o padrão aceito. Decisões não triviais têm nota.
 */
export interface LocalRule {
  match: RegExp;
  corridor: string;
  location: string;
  direction: string;
  carriageway: Carriageway;
  laneType: LaneType;
  note?: string;
}

const A = "Av. das Américas";
const AB = "Av. Embaixador Abelardo Bueno";
const JB = "Rua Jardim Botânico";
const LV = "Linha Vermelha";
const TSB = "Túnel Santa Bárbara";
const DH = "Av. Dom Helder Câmara";

export const LOCAL_RULES: LocalRule[] = [
  { match: /AMERICAS.*2000.*SANTA CRUZ.*FAIXA EXCLUSIVA BRT/i, corridor: A, location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "EXCLUSIVA_BRT", laneType: "BRT" },
  { match: /AMERICAS.*2000.*SANTA CRUZ.*PISTA CENTRAL|Americas Px2000 PCent-St a Cruz/i, corridor: A, location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "CENTRAL", laneType: "MISTA" },
  { match: /AMERICAS PROXIMO AO Nº 2000.*SANTA CRUZ.*PISTA LATERAL|Americas Px2000 PLat-St a Cruz/i, corridor: A, location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "LATERAL", laneType: "MISTA" },
  { match: /AM[ÉE]RICAS LO 2000.*ZONA SUL.*PISTA LATERAL/i, corridor: A, location: "próximo ao nº 2000", direction: "Zona Sul", carriageway: "LATERAL", laneType: "MISTA", note: "Título 'LO 2000' interpretado como o lado oposto do nº 2000; mesmo local de medição, sentido Zona Sul." },
  { match: /AMERICAS.*2603.*CONRADO.*FAIXA EXCLUSIVA BRT/i, corridor: A, location: "próximo ao nº 2603", direction: "São Conrado", carriageway: "EXCLUSIVA_BRT", laneType: "BRT" },
  { match: /AMERICAS.*2603.*CONRADO.*PISTA CENTRAL|Americas Px2603 PCent-St SConrado/i, corridor: A, location: "próximo ao nº 2603", direction: "São Conrado", carriageway: "CENTRAL", laneType: "MISTA" },
  { match: /Americas Px2603 PLat-St SConrado/i, corridor: A, location: "próximo ao nº 2603", direction: "São Conrado", carriageway: "LATERAL", laneType: "MISTA" },
  { match: /ABELARDO BUENO.*980.*RIOCENTRO.*PISTA CENTRAL|AbelardoBueno Px980 PCent-St Riocentro/i, corridor: AB, location: "nº 980", direction: "Riocentro", carriageway: "CENTRAL", laneType: "MISTA" },
  { match: /ABELARDO BUENO.*980.*RIOCENTRO.*PISTA LATERAL|AbelardoBueno Px980 PLat-St Riocentro/i, corridor: AB, location: "nº 980", direction: "Riocentro", carriageway: "LATERAL", laneType: "MISTA" },
  { match: /ABELARDO BUENO.*980.*LINHA AMARELA.*PISTA CENTRAL|AbelardoBueno Px980 PCent-St LAmarela/i, corridor: AB, location: "nº 980", direction: "Linha Amarela", carriageway: "CENTRAL", laneType: "MISTA" },
  { match: /ABELARDO BUENO.*980.*LINHA AMARELA.*PISTA LATERAL|AbelardoBueno Px980 PLat-St LAmarela/i, corridor: AB, location: "nº 980", direction: "Linha Amarela", carriageway: "LATERAL", laneType: "MISTA" },
  { match: /Jardim Botanico Px746-St Gavea/i, corridor: JB, location: "nº 746", direction: "Gávea", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA" },
  { match: /Jardim Botanico PxR Gal Garzon/i, corridor: JB, location: "esquina com R. Gal. Garzon", direction: "Humaitá", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA", note: "Em 03/2019 o título diz 'St J. Botanico' mas o campo de sentido diz 'Humaita'; em 2022 o título diz 'St Humaita'. Tratado como sentido Humaitá — validar." },
  { match: /Linha Vermelha,Km5,5 - S\.Ilha|Joao Goulart, Km 5,5-St Via Dutra/i, corridor: LV, location: "Km 5,5", direction: "Ilha do Governador / Baixada", carriageway: "VIA_EXPRESSA", laneType: "NAO_ESPECIFICADO", note: "2019: 'S.Ilha'; 2022: 'St Via Dutra'. Tratados como o mesmo sentido (saída da cidade)." },
  { match: /Linha Vermelha,Km5,5 - S\.Centro|Joao Goulart, Km 5,5-St( Centro)?$/i, corridor: LV, location: "Km 5,5", direction: "Centro", carriageway: "VIA_EXPRESSA", laneType: "NAO_ESPECIFICADO", note: "Em 05/2022 o título do relatório de fluxo está truncado ('...Km 5,5-St'); o de velocidade diz 'St Centro'." },
  { match: /T[úu]nel Santa B[áa]rbara - S\.Centro|Tn Santa B[áa]rbara - S\.Centro|Saida Tn Sta Barbara-St Catumbi/i, corridor: TSB, location: "saída", direction: "Centro / Catumbi", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA", note: "2019: 'S.Centro'; 2022: 'Saída sentido Catumbi'. Tratados como o mesmo sentido — validar." },
  { match: /T[úu]nel Santa B[áa]rbara - S\.Laranjeiras|Tn Santa B[áa]rbara - S\.Laranjeiras|Saida Tn Sta Barbara-St Laranjeiras/i, corridor: TSB, location: "saída", direction: "Laranjeiras", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA" },
  { match: /Dom Helder Camara Px ?2238-St Centro/i, corridor: DH, location: "nº 2238", direction: "Centro", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA" },
  { match: /Dom Helder Camara Px ?2238-St Madureira/i, corridor: DH, location: "nº 2238", direction: "Madureira", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA" },
];

/** Coordenadas impressas nos relatórios (FONTE DOCUMENTAL), convertidas para graus decimais. */
export const LOCATION_COORDS: Record<string, { lat: number; lng: number; raw: string; page: number }> = {
  "Av. das Américas|próximo ao nº 2000": { lat: -(23 + 0 / 60 + 2 / 3600), lng: -(43 + 20 / 60 + 3 / 3600), raw: "23°0'2\"S 43°20'3\"O", page: 28 },
  "Av. das Américas|próximo ao nº 2603": { lat: -(23 + 0 / 60 + 3 / 3600), lng: -(43 + 20 / 60 + 5 / 3600), raw: "23°0'3\"S 43°20'5\"O", page: 64 },
  "Av. Embaixador Abelardo Bueno|nº 980": { lat: -(22 + 58 / 60 + 23 / 3600), lng: -(43 + 23 / 60 + 15 / 3600), raw: "22°58'23\"S 43°23'15\"O", page: 96 },
  "Rua Jardim Botânico|nº 746": { lat: -(22 + 57 / 60 + 58.885 / 3600), lng: -(43 + 13 / 60 + 9.887 / 3600), raw: "22°57'58,885\"S 43°13'09,887\"O", page: 140 },
  "Rua Jardim Botânico|esquina com R. Gal. Garzon": { lat: -(22 + 58 / 60 + 0.502 / 3600), lng: -(43 + 13 / 60 + 10.517 / 3600), raw: "22°58'00,502\"S 43°13'10,517\"O", page: 146 },
  "Linha Vermelha|Km 5,5": { lat: -(22 + 51 / 60 + 18.655 / 3600), lng: -(43 + 14 / 60 + 19.622 / 3600), raw: "S22º51'18,655\" O43º14'19,622\"", page: 172 },
  "Túnel Santa Bárbara|saída": { lat: -(22 + 55 / 60 + 33.822 / 3600), lng: -(43 + 11 / 60 + 21.87 / 3600), raw: "S22º55'33,822\" O43º11'21,87\" (saída Catumbi)", page: 185 },
  "Av. Dom Helder Câmara|nº 2238": { lat: -(22 + 52 / 60 + 52 / 3600), lng: -(43 + 15 / 60 + 26 / 3600), raw: "22°52'52\"S 43°15'26\"O", page: 214 },
};

export function ruleFor(loc: string): LocalRule | null {
  const clean = loc.replace(/COORDENADAS.*$/i, "").trim();
  return LOCAL_RULES.find((r) => r.match.test(clean)) ?? null;
}
