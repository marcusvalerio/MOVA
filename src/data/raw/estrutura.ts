import type { Carriageway, LaneType } from "@/domain/types";

/**
 * Interpretação estrutural de cada linha da matriz (DOC-PARAMETROS §1) na hierarquia
 * Corredor → Local → Sentido → Pista → Faixas. Feita pelo sistema a partir do texto;
 * cada decisão não trivial tem nota e deve ser validada.
 */
export interface RowStructure {
  row: number;
  corridor: string;
  location: string;
  direction: string;
  carriageway: Carriageway;
  laneType: LaneType;
  note: string | null;
}

export const ROW_STRUCTURE: RowStructure[] = [
  { row: 1, corridor: "Av. das Américas", location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "LATERAL", laneType: "MISTA", note: null },
  { row: 2, corridor: "Av. das Américas", location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "CENTRAL", laneType: "MISTA", note: null },
  { row: 3, corridor: "Av. das Américas", location: "próximo ao nº 2000", direction: "Santa Cruz", carriageway: "EXCLUSIVA_BRT", laneType: "BRT", note: null },
  { row: 4, corridor: "Av. das Américas", location: "próximo ao nº 2603", direction: "São Conrado", carriageway: "CENTRAL_E_LATERAL", laneType: "MISTA_E_BRT", note: "A matriz agrupa pistas central e lateral e faixas mistas e BRT numa única linha; VDM qualificado '(Central)'." },
  { row: 5, corridor: "Av. Embaixador Abelardo Bueno", location: "nº 980", direction: "Riocentro e Linha Amarela", carriageway: "CENTRAL_E_LATERAL", laneType: "NAO_ESPECIFICADO", note: "A matriz agrupa os dois sentidos numa única linha; VDM declarado 'por sentido'. A pista aparece na coluna de faixas." },
  { row: 6, corridor: "Rua Jardim Botânico", location: "nº 746 / Gal. Garzon", direction: "Gávea e Humaitá", carriageway: "NAO_ESPECIFICADA", laneType: "MISTA", note: "A matriz agrupa os dois sentidos numa única linha." },
  { row: 7, corridor: "Linha Vermelha", location: "Km 5,5", direction: "Ilha do Governador / Baixada", carriageway: "VIA_EXPRESSA", laneType: "NAO_ESPECIFICADO", note: "Tipo de faixa não informado ('Via Expressa (4 Faixas)')." },
];
