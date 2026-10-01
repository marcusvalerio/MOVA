/**
 * DATA LAYER — dados brutos.
 * Transcrição literal da Seção 1 ("Matriz Comparativa de Fontes, Fluxo e Velocidade")
 * do documento DOC-PARAMETROS. NÃO editar valores: cada string é exatamente o
 * texto da célula (incluindo "veg/dia", "~", travessões e espaços finais removidos).
 */
export interface RawMatrixRow {
  row: number;
  corredor: string;
  sentidoPista: string;
  faixas: string;
  vdmDiasUteis: string;
  volumeFimDeSemana: string;
  picoManha: string;
  picoTardeNoite: string;
  registroVelocidades: string;
  observacoes: string;
}

export const RAW_MATRIX: RawMatrixRow[] = [
  {
    row: 1,
    corredor: "Av. das Américas, 2000 (Colégio Anglo Americano)",
    sentidoPista: "Santa Cruz / Pista Lateral",
    faixas: "3 Faixas mistas",
    vdmDiasUteis: "~22.000 – 32.000 veg/dia",
    volumeFimDeSemana: "~15.000 – 28.000 veg/dia",
    picoManha: "08h–09h / 11h–12h (~1.500–2.000 veg/h)",
    picoTardeNoite: "14h–18h (~2.000–2.300 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Tráfego com forte distribuição ao longo do dia; oscilações pontuais por interferência local.",
  },
  {
    row: 2,
    corredor: "Av. das Américas, 2000 (Colégio Anglo Americano)",
    sentidoPista: "Santa Cruz / Pista Central",
    faixas: "3 Faixas mistas (Faixas 2, 3 e 4)",
    vdmDiasUteis: "~38.000 – 44.000 veg/dia",
    volumeFimDeSemana: "~20.000 – 35.000 veg/dia",
    picoManha: "07h–09h (~2.500–2.800 veg/h)",
    picoTardeNoite: "17h–19h (~2.800–3.200 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Eixo arterial principal de escoamento sentido Borda Oeste / Santa Cruz.",
  },
  {
    row: 3,
    corredor: "Av. das Américas, 2000",
    sentidoPista: "Santa Cruz / Faixa Exclusiva BRT",
    faixas: "1 Faixa BRT (Faixa 1)",
    vdmDiasUteis: "~200 – 450 veíc/dia",
    volumeFimDeSemana: "~60 – 100 veíc/dia",
    picoManha: "07h–09h (~15–22 veíc/h)",
    picoTardeNoite: "16h–18h (~40–72 veíc/h)",
    registroVelocidades: "Contabilizada em canal separado (Velocidade média calculada).",
    observacoes: "Exclusivo para ônibus/articulados; volumes numéricos reduzidos em relação ao tráfego misto.",
  },
  {
    row: 4,
    corredor: "Av. das Américas, 2603",
    sentidoPista: "São Conrado / Pista Central e Lateral",
    faixas: "Faixas Mistas e BRT",
    vdmDiasUteis: "~35.000 – 45.000 veg/dia (Central)",
    volumeFimDeSemana: "~20.000 – 30.000 veg/dia",
    picoManha: "07h–09h (~2.700–3.100 veg/h)",
    picoTardeNoite: "17h–19h (~2.600–2.900 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Corredor de atratividade de viagens de fluxo de retorno em direção à Zona Sul.",
  },
  {
    row: 5,
    corredor: "Av. Embaixador Abelardo Bueno, 980",
    sentidoPista: "Sentido Riocentro e Linha Amarela",
    faixas: "Pista Central e Lateral",
    vdmDiasUteis: "~24.000 – 28.000 veg/dia (por sentido)",
    volumeFimDeSemana: "~15.000 – 20.000 veg/dia",
    picoManha: "07h–09h (~1.200–1.400 veg/h)",
    picoTardeNoite: "17h–19h (~1.700–1.900 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Forte impacto do polo do Parque Olímpico / Maria Lenk.",
  },
  {
    row: 6,
    corredor: "Rua Jardim Botânico, 746 / Gal. Garzon",
    sentidoPista: "Sentidos Gávea e Humaitá",
    faixas: "Vias Urbanas Tráfego Misto",
    vdmDiasUteis: "~15.000 – 21.000 veg/dia",
    volumeFimDeSemana: "~11.000 – 17.000 veg/dia",
    picoManha: "07h–09h (~1.100–1.400 veg/h)",
    picoTardeNoite: "17h–19h (~1.200–1.500 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Corredor adensado da Zona Sul com capacidade viária estruturalmente limitada.",
  },
  {
    row: 7,
    corredor: "Linha Vermelha, Km 5,5",
    sentidoPista: "Sentido Ilha do Governador / Baixada",
    faixas: "Via Expressa (4 Faixas)",
    vdmDiasUteis: "~51.000 – 65.000 veg/dia",
    volumeFimDeSemana: "~42.000 – 53.000 veg/dia",
    picoManha: "06h–08h (~3.500–4.100 veg/h)",
    picoTardeNoite: "16h–19h (~3.500–4.500 veg/h)",
    registroVelocidades: "Não discriminada no relatório de fluxo.",
    observacoes: "Via expressa de alta demanda arterial com acentuados picos de congestionamento pendular.",
  },
];

/**
 * Seção 2 — afirmações qualitativas/regras descritivas, transcritas literalmente.
 * Usadas como regras de verificação e interpretação; nenhuma delas é fórmula.
 */
export const RAW_SECTION2 = {
  picoManhaUteis:
    "Pico da Manhã (07:00 às 09:00): Predomínio de movimento pendular de entrada/deslocamento para o trabalho ou escola. O tráfego nas pistas centrais da Av. das Américas (sentido São Conrado) e na Linha Vermelha atinge picos operacionais elevados entre 07:00 e 08:00.",
  picoTardeUteis:
    "Pico da Tarde/Noite (17:00 às 19:00): Movimento pendular de retorno à residência. Na Av. das Américas (sentido Santa Cruz) e na Av. Abelardo Bueno (sentido Riocentro), os volumes atingem seus pontos máximos diários entre 17:00 e 18:00.",
  sabados:
    "Sábados: Apresentam perfil intermediário com concentração de fluxo entre 11:00 e 15:00, motivado por atividades comerciais, de lazer e serviços.",
  domingos:
    "Domingos: Apresentam menor volume total, com pico deslocado para o final da tarde/noite (16:00 às 19:00).",
  variacaoSemanal:
    "Variação Semanal: Os volumes totais em dias úteis (segunda a sexta) mantêm-se em patamares elevados e homogêneos (ex.: ~40.000 a 44.000 veíc/dia nas pistas centrais da Av. das Américas). Às sextas-feiras, observa-se uma antecipação do pico da tarde e maior volume residual no início da noite. A queda do Volume Diário Médio (VDM) nos fins de semana varia de 25% a 50%, dependendo da tipologia da via.",
  variacaoHoraria:
    "Variação Diária e Horária: Durante as madrugadas (01:00 às 05:00), o fluxo cai aos níveis mínimos (geralmente abaixo de 5% do volume de pico). O crescimento do fluxo é abrupto a partir das 06:00.",
  linhaVermelha:
    "Linha Vermelha: Com volumes horários superando 4.000 a 4.500 veíc/h nos horários de pico, a via opera no limite de sua capacidade teórica por faixa (frequentemente atingindo o Nível de Serviço E/F nos gargalos de acesso).",
  americasCentrais:
    "Av. das Américas (Pistas Centrais): Registram volumes superiores a 2.800 – 3.200 veíc/h por sentido nos picos. A capacidade é altamente condicionada pelas interseções, agulhas de transição entre pista central e lateral e travessias.",
  brt:
    "Desempenho da Faixa Exclusiva BRT: Apresenta contagens de volume de veículos (ônibus/articulados) significativamente menores em relação às faixas mistas. Isso demonstra maior eficiência no transporte de passageiros por veículo, mantendo a faixa segregada operando com folga de capacidade viária física para o tráfego de composições públicas.",
  jardimBotanico:
    "Corredores Urbanos Adensados (Rua Jardim Botânico): Com fluxos na faixa de 1.200 a 1.500 veíc/h nos picos em calha viária limitada, qualquer pequenas interferência (paradas de ônibus, embarque/desembarque e semáforos) leva a via rapidamente ao estado de saturação.",
} as const;
