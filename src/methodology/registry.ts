import type { MethodologyEntry } from "@/domain/types";

/**
 * METHODOLOGY — registro rastreável de cada regra/fórmula utilizada.
 *
 * Princípio: o documento DOC-PARAMETROS NÃO contém nenhuma fórmula explícita.
 * Portanto:
 *  - grandezas transcritas da fonte têm método "transcrição" (CONFIRMADO como dado);
 *  - regras descritivas da Seção 2 são CONFIRMADAS como regra, e o modo de
 *    operacionalizá-las é EXPERIMENTAL ou PENDENTE;
 *  - qualquer cálculo cuja definição não está na fonte é PENDENTE, com a lacuna descrita.
 */
const S1 = { documentId: "DOC-PARAMETROS", section: "1. Matriz Comparativa de Fontes, Fluxo e Velocidade" };
const S2A = { documentId: "DOC-PARAMETROS", section: "2.A Definição dos Dias e Horários de Pico" };
const S2B = { documentId: "DOC-PARAMETROS", section: "2.B Variações Semanais, Diárias e Horárias" };
const S2C = { documentId: "DOC-PARAMETROS", section: "2.C Avaliação do Comportamento da Capacidade Viária e Nível de Serviço" };

export const METHODOLOGY: MethodologyEntry[] = [
  {
    id: "M-VDM",
    name: "Volume Diário Médio (VDM) — dias úteis",
    description:
      "Volume de veículos por dia em dias úteis. No histórico, o valor é transcrito da matriz como faixa aproximada; o sistema não recalcula.",
    formula: null,
    implementation:
      "HISTÓRICO: transcrição da faixa [mín, máx]. SÉRIES (simulação/câmera): média aritmética dos volumes diários de dias úteis completos — PENDENTE.",
    variables: [
      { symbol: "VDM", meaning: "Volume Diário Médio em dias úteis", unit: "veíc/dia" },
      { symbol: "V_d", meaning: "Volume total do dia útil d (24 h completas)", unit: "veíc/dia" },
    ],
    unit: "veic/dia",
    purpose: "Caracterizar o patamar de demanda do corredor em dias úteis (Seção 1) e comparar com fins de semana (Seção 2.B).",
    sources: [S1, S2B],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: [
      "A fonte nomeia o indicador ('Volume Diário Médio') mas não define o procedimento: quais dias, quantas semanas, tratamento de dias incompletos.",
      "A média aritmética usada nas séries é inferida do nome do indicador, não de uma fórmula documentada.",
      "A fonte grafa a unidade como 'veg/dia' na maioria das linhas — tratado como 'veíc/dia' (validar).",
    ],
  },
  {
    id: "M-VOL-FDS",
    name: "Volume diário — fins de semana",
    description: "Volume de veículos por dia em sábados e domingos, transcrito da matriz como faixa aproximada.",
    formula: null,
    implementation: "Transcrição da faixa [mín, máx].",
    variables: [{ symbol: "V_fds", meaning: "Volume diário em fins de semana", unit: "veíc/dia" }],
    unit: "veic/dia",
    purpose: "Comparar demanda de fim de semana com dias úteis (Seção 2.B).",
    sources: [S1],
    externalSource: null,
    version: "0.1.0",
    status: "CONFIRMADO",
    gaps: ["Não se sabe se a faixa agrega sábado e domingo ou se representa o intervalo entre os dois dias."],
  },
  {
    id: "M-PICO",
    name: "Pico horário (janela e fluxo máximo)",
    description:
      "Janela horária de pico e faixa de fluxo máximo, transcritas da matriz. Para séries, o sistema identifica a hora de maior fluxo.",
    formula: null,
    implementation:
      "HISTÓRICO: transcrição da janela e da faixa. SÉRIES: q_pico = max(q_h) dentro da janela de pico da fonte — PENDENTE.",
    variables: [
      { symbol: "q_h", meaning: "Fluxo na hora h", unit: "veíc/h" },
      { symbol: "q_pico", meaning: "Maior fluxo horário na janela", unit: "veíc/h" },
    ],
    unit: "veic/h",
    purpose: "Identificar os períodos de maior solicitação do corredor (Seções 1 e 2.A).",
    sources: [S1, S2A],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: [
      "A fonte não define se 'fluxo máximo' é a maior hora cheia, maior hora móvel (ex.: 4×15 min) ou outro critério.",
      "Algumas janelas da matriz diferem das janelas gerais da Seção 2.A (ex.: linha 1, 14h–18h).",
    ],
  },
  {
    id: "M-FLUXO-HORARIO",
    name: "Fluxo horário a partir de contagens em intervalos",
    description: "Agregação de contagens de intervalos (ex.: 15 min) em fluxo por hora cheia.",
    formula: null,
    implementation: "q_h = Σ contagens dos intervalos contidos na hora h; somente se a hora tiver 60 min de cobertura válida.",
    variables: [
      { symbol: "n_i", meaning: "Contagem de veículos no intervalo i", unit: "veíc" },
      { symbol: "q_h", meaning: "Fluxo na hora h", unit: "veíc/h" },
    ],
    unit: "veic/h",
    purpose: "Permitir que contagens de câmera ou simulação alimentem os mesmos indicadores expressos em veíc/h na fonte.",
    sources: [S1],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: [
      "A fonte usa veíc/h, mas não descreve o procedimento de contagem nem a duração dos intervalos dos relatórios originais.",
      "Critério de completude (exigir 60 min válidos) é escolha do sistema — validar.",
    ],
  },
  {
    id: "M-QUEDA-FDS",
    name: "Queda do VDM nos fins de semana",
    description:
      "Regra descritiva da fonte: a queda do VDM nos fins de semana varia de 25% a 50%, dependendo da tipologia da via. O sistema calcula o intervalo de queda compatível com as faixas da matriz e verifica se intersecta 25–50%.",
    formula: null,
    implementation:
      "queda_mín = 1 − V_fds,máx / VDM_mín ; queda_máx = 1 − V_fds,mín / VDM_máx (aritmética de intervalos; sem uso de ponto médio). Compatível se [queda_mín, queda_máx] ∩ [25%, 50%] ≠ ∅.",
    variables: [
      { symbol: "VDM_mín, VDM_máx", meaning: "Limites da faixa de VDM em dias úteis", unit: "veíc/dia" },
      { symbol: "V_fds,mín, V_fds,máx", meaning: "Limites da faixa de volume em fins de semana", unit: "veíc/dia" },
    ],
    unit: "%",
    purpose: "Verificar a coerência interna entre a matriz (Seção 1) e a regra de variação semanal (Seção 2.B).",
    sources: [S2B, S1],
    externalSource: null,
    version: "0.1.0",
    status: "EXPERIMENTAL",
    gaps: [
      "A regra de 25–50% é CONFIRMADA na fonte; a forma de calculá-la (percentual relativo ao VDM de dias úteis, por aritmética de intervalos) é escolha do sistema.",
      "A fonte não define a 'tipologia da via' que determina a posição dentro de 25–50%.",
    ],
  },
  {
    id: "M-MADRUGADA",
    name: "Fluxo de madrugada em relação ao pico",
    description:
      "Regra descritiva da fonte: entre 01:00 e 05:00 o fluxo cai aos níveis mínimos, geralmente abaixo de 5% do volume de pico.",
    formula: null,
    implementation: "razão = max(q_h, h ∈ [01:00, 05:00)) / q_pico ; sinaliza quando razão ≥ 5%.",
    variables: [
      { symbol: "q_h", meaning: "Fluxo horário na madrugada", unit: "veíc/h" },
      { symbol: "q_pico", meaning: "Maior fluxo horário do dia", unit: "veíc/h" },
    ],
    unit: "%",
    purpose: "Verificação de plausibilidade de séries horárias (simulação e futura câmera).",
    sources: [S2B],
    externalSource: null,
    version: "0.1.0",
    status: "EXPERIMENTAL",
    gaps: ["A fonte diz 'geralmente': é um padrão descritivo, não um limite normativo. Usado apenas como alerta, nunca para invalidar dado."],
  },
  {
    id: "M-VELOCIDADE",
    name: "Velocidade média",
    description: "Velocidade média dos veículos no ponto/trecho.",
    formula: null,
    implementation: "SÉRIES: média ponderada pela contagem, v̄ = Σ(n_i·v_i)/Σn_i — PENDENTE. HISTÓRICO: sem dados.",
    variables: [
      { symbol: "v_i", meaning: "Velocidade média no intervalo i", unit: "km/h" },
      { symbol: "n_i", meaning: "Contagem no intervalo i", unit: "veíc" },
    ],
    unit: "km/h",
    purpose: "Caracterizar o comportamento operacional (citado como 'Registro de Velocidades' na matriz).",
    sources: [S1],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: [
      "Nenhuma velocidade numérica consta na fonte: 6 linhas 'Não discriminada no relatório de fluxo'; a linha BRT cita 'Velocidade média calculada' sem valor nem método.",
      "Não definido se a média é temporal (local) ou espacial; a ponderação por contagem é escolha do sistema.",
    ],
  },
  {
    id: "M-V85",
    name: "Velocidade do 85º percentil",
    description: "Indicador citado no escopo do projeto, mas ausente dos documentos.",
    formula: null,
    implementation: null,
    variables: [],
    unit: "km/h",
    purpose: "—",
    sources: [],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: ["Não consta na fonte. Não implementado. Requer velocidades individuais (os relatórios originais podem conter)."],
  },
  {
    id: "M-CAPACIDADE",
    name: "Capacidade viária",
    description:
      "A fonte menciona 'capacidade teórica por faixa' (Linha Vermelha) e capacidade condicionada por interseções, mas não fornece valores nem método.",
    formula: null,
    implementation: "Parâmetro por aproximação, inicialmente indefinido (null).",
    variables: [{ symbol: "c", meaning: "Capacidade da aproximação", unit: "veíc/h" }],
    unit: "veic/h",
    purpose: "Base para saturação e nível de serviço (Seção 2.C).",
    sources: [S2C],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: ["Sem valor numérico de capacidade por faixa ou por aproximação.", "Sem método (ex.: manual de capacidade) indicado."],
  },
  {
    id: "M-SATURACAO",
    name: "Grau de saturação (v/c)",
    description:
      "Razão entre fluxo e capacidade. A fonte usa o termo 'saturação' apenas qualitativamente.",
    formula: null,
    implementation: "x = q / c — calculado somente se c estiver definido; caso contrário, indisponível.",
    variables: [
      { symbol: "q", meaning: "Fluxo horário", unit: "veíc/h" },
      { symbol: "c", meaning: "Capacidade", unit: "veíc/h" },
    ],
    unit: "adimensional",
    purpose: "Possível base para a condição operacional — aguardando validação.",
    sources: [S2C],
    externalSource:
      "FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS — a razão fluxo/capacidade foi listada no escopo do projeto, não na fonte.",
    version: "0.1.0",
    status: "PENDENTE",
    gaps: ["Depende de M-CAPACIDADE.", "Confirmar com o professor se v/c é o indicador desejado."],
  },
  {
    id: "M-NIVEL-SERVICO",
    name: "Nível de Serviço (A–F)",
    description: "A fonte cita 'Nível de Serviço E/F' para a Linha Vermelha, sem critério de classificação.",
    formula: null,
    implementation: null,
    variables: [],
    unit: null,
    purpose: "Classificação operacional citada na Seção 2.C.",
    sources: [S2C],
    externalSource: null,
    version: "0.1.0",
    status: "PENDENTE",
    gaps: ["Sem tabela de critérios (medida de desempenho e limites). Não implementado. A afirmação E/F é exibida apenas como avaliação qualitativa da fonte."],
  },
  {
    id: "M-CONDICAO",
    name: "Condição operacional (NORMAL → ATENÇÃO → CRÍTICO → CONGESTIONADO)",
    description:
      "Escala visual de 4 níveis solicitada no escopo do projeto. Nem o indicador-base nem os limites constam na fonte.",
    formula: null,
    implementation:
      "nível = NORMAL se x < L1; ATENÇÃO se L1 ≤ x < L2; CRÍTICO se L2 ≤ x < L3; CONGESTIONADO se x ≥ L3. Sem L1..L3 definidos → INDETERMINADO.",
    variables: [
      { symbol: "x", meaning: "Indicador-base (a definir: v/c, velocidade, fluxo…)", unit: "—" },
      { symbol: "L1, L2, L3", meaning: "Limites entre níveis", unit: "—" },
    ],
    unit: null,
    purpose: "Comunicação rápida do estado operacional no painel.",
    sources: [],
    externalSource: "Escala definida no escopo do projeto; não presente nos documentos.",
    version: "0.1.0",
    status: "PENDENTE",
    gaps: ["Limites aguardando validação metodológica.", "Indicador-base não definido."],
  },
];

export function getMethodology(id: string): MethodologyEntry {
  const m = METHODOLOGY.find((x) => x.id === id);
  if (!m) throw new Error(`Metodologia desconhecida: ${id}`);
  return m;
}
