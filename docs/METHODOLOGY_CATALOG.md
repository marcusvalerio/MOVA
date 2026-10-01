# Methodology Catalog

> Gerado a partir de `src/methodology/registry.ts` (fonte da verdade). O teste `tests/docs.test.ts` falha se algum item do registro não estiver aqui.

Status: **CONFIRMADO** = explícito numa fonte · **INFERIDO** = implícito, dedução explicada · **EXPERIMENTAL** = escolha do sistema · **PENDENTE** = pendente de validação com o professor.

**Nenhuma fonte disponível contém fórmula matemática explícita.** A coluna "Implementação" descreve o que o sistema faz, não o que a fonte define.

| ID | Nome | Categoria | Status |
|---|---|---|---|
| M-FLUXO-OBS | Fluxo veicular observado por intervalo | DADO | CONFIRMADO |
| M-VELOCIDADE-OBS | Velocidade média e 85º percentil reportados | DADO | CONFIRMADO |
| M-MATRIZ | Faixas reportadas na matriz comparativa | DADO | CONFIRMADO |
| M-VDM | Volume Diário Médio (VDM) — dias úteis | INDICADOR | INFERIDO |
| M-FLUXO-HORARIO | Fluxo horário | INDICADOR | INFERIDO |
| M-FLUXO-EQUIVALENTE | Fluxo horário equivalente | FORMULA | INFERIDO |
| M-PICO | Hora de pico e fluxo máximo | INDICADOR | INFERIDO |
| M-VELOCIDADE-MEDIA | Velocidade média agregada | INDICADOR | PENDENTE |
| M-V85 | Velocidade do 85º percentil | INDICADOR | CONFIRMADO |
| M-CAPACIDADE | Capacidade viária | INDICADOR | PENDENTE |
| M-SATURACAO | Grau de saturação (v/c) | FORMULA | PENDENTE |
| M-TIPO-DIA | Tipo de dia (dia útil, sábado, domingo) | REGRA | CONFIRMADO |
| M-JANELAS-PICO | Janelas de pico por tipo de dia | REGRA | CONFIRMADO |
| M-QUEDA-FDS | Queda do VDM nos fins de semana (25–50%) | REGRA | EXPERIMENTAL |
| M-MADRUGADA | Madrugada (01–05h) abaixo de 5% do pico | REGRA | EXPERIMENTAL |
| M-COMPARACAO | Comparabilidade entre períodos | REGRA | CONFIRMADO |
| M-QA-ALTERNANCIA | Heurística de qualidade — padrão alternado | HIPOTESE | EXPERIMENTAL |
| M-NIVEL-SERVICO | Nível de Serviço (A–F) | INTERPRETACAO | PENDENTE |
| M-RELACAO-FLUXO-VELOCIDADE | Relação fluxo × velocidade | INTERPRETACAO | PENDENTE |
| M-CONDICAO | Condição operacional (NORMAL → ATENÇÃO → CRÍTICO → CONGESTIONADO) | INTERPRETACAO | PENDENTE |

## Dados

### M-FLUXO-OBS — Fluxo veicular observado por intervalo

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** Contagem de veículos por faixa horária, por data, endereço, sentido e pista, conforme relatórios de fluxo.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Transcrição do valor do intervalo (ex.: '07:00–08:00 → 1.113'). Texto não numérico → AUSENTE.`
- **Variáveis:** `n_i` Veículos no intervalo i [veíc]
- **Unidade:** veic
- **Por que existe:** Dado primário que alimenta todos os indicadores temporais.
- **Fontes:** Fluxos UFRJ-Revisado (1).pdf — Relatórios de fluxo por faixa horária; Especificação MOVA (síntese do autor) — §3, §5
- **Lacunas:**
  - Valores disponíveis vêm da transcrição na especificação (2 séries), não do PDF.
  - A 'faixa' (lane) de cada contagem não foi transcrita: as séries estão no nível da pista.

### M-VELOCIDADE-OBS — Velocidade média e 85º percentil reportados

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** Velocidade média por data/horário e 85º percentil, conforme o relatório de velocidades.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Campos averageSpeedKmh e p85SpeedKmh em TrafficObservation. Nenhum valor incorporado.`
- **Variáveis:** `v̄_i` Velocidade média no intervalo i [km/h]; `V85_i` 85º percentil da velocidade no intervalo i [km/h]
- **Unidade:** km/h
- **Por que existe:** Observar como o tráfego se comporta, não só quantos veículos passam (especificação §7–8).
- **Fontes:** Relatório de velocidades — Velocidade média e 85º percentil; Especificação MOVA (síntese do autor) — §7
- **Lacunas:**
  - Relatório de velocidades não recebido — nenhum valor no sistema.
  - Não se sabe se V85 é reportado por hora, por dia ou por período.

### M-MATRIZ — Faixas reportadas na matriz comparativa

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** VDM, volume de fim de semana e picos por corredor/sentido, em faixas aproximadas (~mín – máx).
- **Fórmula na fonte:** não documentada
- **Implementação:** `Transcrição + normalização (separador de milhar, '~', mín–máx). Nunca reduzidas a ponto médio.`
- **Unidade:** —
- **Por que existe:** Caracterização comparativa dos corredores (DOC-PARAMETROS §1).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 1. Matriz Comparativa
- **Lacunas:**
  - Não se sabe se a faixa representa variação entre dias, entre equipamentos ou incerteza.
  - Unidade grafada 'veg/dia' — interpretada como veículos.

## Indicadores

### M-VDM — Volume Diário Médio (VDM) — dias úteis

- **Status:** INFERIDO · v0.2.0
- **O que é:** Volume médio diário em dias úteis. Histórico: faixa transcrita da matriz. Séries: média de volumes diários completos.
- **Fórmula na fonte:** não documentada
- **Implementação:** `VDM = (Σ V_d) / N, sobre dias úteis com 24 h completas. Dias incompletos são excluídos.`
- **Variáveis:** `V_d` Volume do dia útil d (24 h completas) [veíc/dia]; `N` Número de dias úteis completos [dias]
- **Unidade:** veic/dia
- **Por que existe:** Caracterizar o volume médio diário do corredor (§1) e comparar com fins de semana (§2.B).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 1. Matriz Comparativa; Parâmetros do Fluxo de Tráfego — 2.B Variações semanais, diárias e horárias
- **Lacunas:**
  - A fonte nomeia o indicador ('Volume Diário Médio') sem definir procedimento (quais dias, quantas semanas, dias incompletos). Média aritmética inferida do nome.
  - Nenhuma série com 24 h completas disponível: VDM não calculável a partir das séries.

### M-FLUXO-HORARIO — Fluxo horário

- **Status:** INFERIDO · v0.2.0
- **O que é:** Veículos por hora. Nas séries UFRJ o intervalo já é de 1 h; para intervalos menores, soma dos intervalos da hora.
- **Fórmula na fonte:** não documentada
- **Implementação:** `q_h = Σ n_i (intervalos válidos contidos na hora h); exige 60 min válidos, senão a hora fica sem valor.`
- **Variáveis:** `n_i` Contagem no intervalo i [veíc]; `q_h` Fluxo na hora h [veíc/h]
- **Unidade:** veic/h
- **Por que existe:** Base das análises de pico e de variação horária.
- **Fontes:** Fluxos UFRJ-Revisado (1).pdf — Relatórios de fluxo por faixa horária; Parâmetros do Fluxo de Tráfego — 1. Matriz Comparativa
- **Lacunas:**
  - Exigir 60 min válidos é critério do sistema.

### M-PICO — Hora de pico e fluxo máximo

- **Status:** INFERIDO · v0.2.0
- **O que é:** Hora de maior fluxo no dia e dentro das janelas de pico da fonte.
- **Fórmula na fonte:** não documentada
- **Implementação:** `q_pico = max(q_h); também restrito às janelas de M-JANELAS-PICO conforme o tipo de dia.`
- **Variáveis:** `q_pico` Maior fluxo horário [veíc/h]
- **Unidade:** veic/h
- **Por que existe:** Identificar os períodos de maior solicitação (§1, §2.A).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 1. Matriz Comparativa; Parâmetros do Fluxo de Tráfego — 2.A Dias e horários de pico
- **Lacunas:**
  - A fonte não define se 'fluxo máximo' é hora cheia, hora móvel ou outro critério; as séries disponíveis são de hora cheia.

### M-VELOCIDADE-MEDIA — Velocidade média agregada

- **Status:** PENDENTE · v0.2.0
- **O que é:** Velocidade média de um período a partir das médias por intervalo.
- **Fórmula na fonte:** não documentada
- **Implementação:** `v̄ = Σ(n_i · v̄_i) / Σ n_i (ponderada pela contagem).`
- **Variáveis:** `v̄_i` Velocidade média no intervalo i [km/h]; `n_i` Contagem no intervalo i [veíc]
- **Unidade:** km/h
- **Por que existe:** Comparar velocidade e fluxo (especificação §8).
- **Fontes:** Relatório de velocidades — Velocidade média e 85º percentil; Especificação MOVA (síntese do autor) — §7
- **Lacunas:**
  - Agregação não definida na fonte (temporal × espacial; ponderação).
  - Sem dados de velocidade.

### M-V85 — Velocidade do 85º percentil

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** Velocidade abaixo da qual trafegam 85% dos veículos. O relatório de velocidades apresenta essa informação.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Exibido somente como valor reportado pela fonte. Não é recalculado nem agregado entre intervalos.`
- **Variáveis:** `V85` 85º percentil [km/h]
- **Unidade:** km/h
- **Por que existe:** Caracterizar a distribuição de velocidades (especificação §7).
- **Fontes:** Relatório de velocidades — Velocidade média e 85º percentil; Especificação MOVA (síntese do autor) — §7
- **Lacunas:**
  - Sem valores. Agregar V85 de vários intervalos exigiria as velocidades individuais — não implementado.

### M-CAPACIDADE — Capacidade viária

- **Status:** PENDENTE · v0.2.0
- **O que é:** A fonte cita 'capacidade teórica por faixa' e capacidade condicionada por interseções, agulhas e travessias, sem valores.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Parâmetro por segmento; indefinido (null).`
- **Variáveis:** `c` Capacidade do segmento [veíc/h]
- **Unidade:** veic/h
- **Por que existe:** Base para saturação e nível de serviço (§2.C); permite representar FLUXO + CAPACIDADE + INTERFERÊNCIAS (especificação §17).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.C Capacidade viária e nível de serviço
- **Lacunas:**
  - Sem valor numérico nem método.

## Fórmulas

### M-FLUXO-EQUIVALENTE — Fluxo horário equivalente

- **Status:** INFERIDO · v0.2.0
- **O que é:** Converte uma contagem em intervalo curto (ex.: câmera) em taxa horária.
- **Fórmula na fonte:** não documentada
- **Implementação:** `q_eq = n · 60 / Δt   (Δt em minutos)`
- **Variáveis:** `n` Veículos contados no intervalo [veíc]; `Δt` Duração do intervalo [min]; `q_eq` Fluxo horário equivalente [veíc/h]
- **Unidade:** veic/h
- **Por que existe:** Separar o OBSERVADO (contagem) do CALCULADO (taxa) — especificação §33.
- **Fontes:** Especificação MOVA (síntese do autor) — §33
- **Lacunas:**
  - A especificação dá o exemplo '127 veículos → 1.524 veíc/h' sem informar o intervalo; 1.524 / 127 = 12, o que implica Δt = 5 min. Confirmar a fórmula e se há fator de pico.

### M-SATURACAO — Grau de saturação (v/c)

- **Status:** PENDENTE · v0.2.0
- **O que é:** Razão fluxo/capacidade. A fonte usa 'saturação' apenas qualitativamente.
- **Fórmula na fonte:** não documentada
- **Implementação:** `x = q / c — somente com c definido.`
- **Variáveis:** `q` Fluxo horário [veíc/h]; `c` Capacidade [veíc/h]
- **Unidade:** adimensional
- **Por que existe:** Possível base da condição operacional.
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.C Capacidade viária e nível de serviço
- **Fonte externa:** FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS — a razão v/c não aparece nas fontes.
- **Lacunas:**
  - Depende de M-CAPACIDADE.
  - Confirmar se v/c é o indicador desejado.

## Regras

### M-TIPO-DIA — Tipo de dia (dia útil, sábado, domingo)

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** A fonte distingue dias úteis (segunda a sexta), sábados e domingos.
- **Fórmula na fonte:** não documentada
- **Implementação:** `dia da semana da data: seg–sex → DIA_UTIL; sáb → SABADO; dom → DOMINGO; sem data → DESCONHECIDO.`
- **Unidade:** —
- **Por que existe:** Evitar tratar todos os dias com o mesmo padrão (especificação §11).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.A Dias e horários de pico; Especificação MOVA (síntese do autor) — §11
- **Lacunas:**
  - Feriados não são tratados (não definidos na fonte): um feriado em dia de semana seria classificado como DIA_UTIL.

### M-JANELAS-PICO — Janelas de pico por tipo de dia

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** Dias úteis: manhã 07–09 e tarde/noite 17–19. Sábado: concentração 11–15. Domingo: pico 16–19.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Tabela PEAK_WINDOWS (src/engine/series.ts). Usada para posicionar o pico observado e para a simulação.`
- **Unidade:** —
- **Por que existe:** Referência temporal do estudo para análise de picos (§2.A).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.A Dias e horários de pico
- **Lacunas:**
  - São observações do estudo, não limites universais. Destaques por corredor (07–08 Américas/São Conrado e Linha Vermelha; 17–18 Américas/Santa Cruz e Abelardo Bueno) exibidos como citação.

### M-QUEDA-FDS — Queda do VDM nos fins de semana (25–50%)

- **Status:** EXPERIMENTAL · v0.2.0
- **O que é:** Observação do estudo: a queda do VDM nos fins de semana varia de 25% a 50%, conforme a tipologia da via.
- **Fórmula na fonte:** não documentada
- **Implementação:** `queda_mín = 1 − V_fds,máx / VDM_mín ; queda_máx = 1 − V_fds,mín / VDM_máx (aritmética de intervalos). Compatível se intersecta [25%, 50%].`
- **Variáveis:** `VDM_mín, VDM_máx` Faixa de VDM em dias úteis [veíc/dia]; `V_fds,mín, V_fds,máx` Faixa de volume de fim de semana [veíc/dia]
- **Unidade:** %
- **Por que existe:** Verificação de coerência entre §1 e §2.B — não é limite universal.
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.B Variações semanais, diárias e horárias; Parâmetros do Fluxo de Tráfego — 1. Matriz Comparativa
- **Lacunas:**
  - A regra 25–50% está na fonte; a forma de calculá-la é escolha do sistema.
  - 'Tipologia da via' não definida.

### M-MADRUGADA — Madrugada (01–05h) abaixo de 5% do pico

- **Status:** EXPERIMENTAL · v0.2.0
- **O que é:** Observação do estudo: entre 01:00 e 05:00 o fluxo cai aos níveis mínimos, geralmente abaixo de 5% do volume de pico; crescimento abrupto a partir das 06:00.
- **Fórmula na fonte:** não documentada
- **Implementação:** `razão = max(q_h, 01h ≤ h < 05h) / max(q_h) ; exige as 4 horas; divergência registrada como SUSPEITO, nunca corrigida.`
- **Unidade:** %
- **Por que existe:** Visualizar e verificar o comportamento temporal (especificação §13).
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.B Variações semanais, diárias e horárias
- **Lacunas:**
  - 'Geralmente' — padrão descritivo, não limite. Interpretação de 'volume de pico' como maior fluxo horário do dia é do sistema.

### M-COMPARACAO — Comparabilidade entre períodos

- **Status:** CONFIRMADO · v0.2.0
- **O que é:** Não comparar períodos incompatíveis sem deixar isso explícito (especificação §31).
- **Fórmula na fonte:** não documentada
- **Implementação:** `Comparável ⇔ mesmo segmento E mesmo tipo de dia conhecido. Caso contrário, a comparação é exibida com aviso.`
- **Unidade:** —
- **Por que existe:** Evitar comparações enganosas entre dias úteis, sábados, domingos e locais diferentes.
- **Fontes:** Especificação MOVA (síntese do autor) — §31
- **Lacunas:**
  - Critério operacional (mesmo segmento + mesmo tipo de dia) é do sistema; diferenças de ano/mês são mostradas mas não bloqueiam.

## Interpretações

### M-NIVEL-SERVICO — Nível de Serviço (A–F)

- **Status:** PENDENTE · v0.2.0
- **O que é:** A fonte cita 'Nível de Serviço E/F' na Linha Vermelha, sem critério.
- **Fórmula na fonte:** não documentada
- **Implementação:** não implementado
- **Unidade:** —
- **Por que existe:** Classificação citada em §2.C.
- **Fontes:** Parâmetros do Fluxo de Tráfego — 2.C Capacidade viária e nível de serviço
- **Lacunas:**
  - Sem medida de desempenho nem limites. Não implementado; exibido só como citação.

### M-RELACAO-FLUXO-VELOCIDADE — Relação fluxo × velocidade

- **Status:** PENDENTE · v0.2.0
- **O que é:** Conceito: fluxo ↑ com velocidade ↓ pode indicar deterioração operacional.
- **Fórmula na fonte:** não documentada
- **Implementação:** `Somente visualização lado a lado (sem eixo duplo). Não gera classificação.`
- **Unidade:** —
- **Por que existe:** Observar como o tráfego se comporta, não só quantos veículos há (especificação §8).
- **Fontes:** Especificação MOVA (síntese do autor) — §8
- **Lacunas:**
  - A especificação proíbe transformar a relação em fórmula ou classificação sem metodologia do professor.

### M-CONDICAO — Condição operacional (NORMAL → ATENÇÃO → CRÍTICO → CONGESTIONADO)

- **Status:** PENDENTE · v0.2.0
- **O que é:** Barra de condição exemplificada pelo professor. Indicador-base e limites não definidos.
- **Fórmula na fonte:** não documentada
- **Implementação:** `nível = NORMAL se x < L1; ATENÇÃO se L1 ≤ x < L2; CRÍTICO se L2 ≤ x < L3; CONGESTIONADO se x ≥ L3. Sem L1..L3 → INDETERMINADO (não exibido como nível).`
- **Variáveis:** `x` Indicador-base (a definir) [—]; `L1, L2, L3` Limites entre níveis [—]
- **Unidade:** —
- **Por que existe:** Transformar dados em condição operacional compreensível (especificação §19).
- **Fontes:** Especificação MOVA (síntese do autor) — §19
- **Lacunas:**
  - Limites aguardando validação metodológica.
  - Indicador-base não definido.

## Hipóteses

### M-QA-ALTERNANCIA — Heurística de qualidade — padrão alternado

- **Status:** EXPERIMENTAL · v0.2.0
- **O que é:** Sinaliza séries cuja variação horária inverte de sentido repetidamente com grande amplitude — possível erro de transcrição/transposição.
- **Fórmula na fonte:** não documentada
- **Implementação:** `≥ 3 inversões consecutivas de sinal de Δq, cada uma com |Δq| ≥ 20% do valor anterior → SUSPEITO.`
- **Unidade:** —
- **Por que existe:** Qualidade de dados. Não é metodologia de tráfego e não altera valores.
- **Fontes:** nenhuma fonte documental
- **Fonte externa:** Parâmetros do sistema (3 inversões; 20%) — não presentes nos documentos.
- **Lacunas:**
  - Parâmetros arbitrários; servem para priorizar conferência com o PDF.
