export interface ReplayDay {
  date: string;
  dayType: string;
  note: string | null;
  complete: boolean;
  flow: (number | null)[];
  speed: (number | null)[];
  total: number | null;
}

export interface ReplaySegment {
  id: string;
  corridor: string;
  location: string;
  label: string;
  laneType: string;
  /** Maior fluxo horário válido registrado no segmento (todos os períodos). */
  maxFlow: number;
  maxFlowWhen: string;
  /** Maior velocidade média horária registrada no segmento. */
  maxSpeed: number | null;
  source: string;
  days: ReplayDay[];
}
