# Inventário metodológico (etapas 1 a 4)

**Fontes usadas:**
- `DOC-PARAMETROS`: o arquivo .docx do professor.
- `DOC-ESPECIFICACAO`: a especificação do projeto, que traz trechos transcritos do PDF de fluxos.

**Fontes citadas, mas não disponíveis:**
- `DOC-FLUXOS-UFRJ`: "Fluxos UFRJ-Revisado (1).pdf".
- `DOC-VELOCIDADES`: o relatório de velocidades.

Legenda de status:
- **C** = confirmado: está explícito numa fonte.
- **I** = inferido: está implícito; a dedução é explicada.
- **E** = experimental: escolha do sistema.
- **P** = pendente de validação com o professor.

## Etapa 1 e 2 — conteúdos classificados

### DADOS

| # | Conteúdo | Fonte | Status |
|---|---|---|---|
| D1 | Série horária da Av. das Américas nº 2000, Santa Cruz, pista central, 03/2019, 07–19h (12 valores; o dia não foi informado) | ESPEC §3 ← UFRJ | C (transcrição intermediária) |
| D2 | Série horária do mesmo segmento em 01/03/2023 (quarta-feira), 00–22h (22 valores); 22–24h aparecem como "continuar conforme fonte" | ESPEC §5 ← UFRJ | C; 22–24h **AUSENTES** |
| D3 | Existem séries da pista lateral (nº 2000), da pista central sentido São Conrado (nº 2603) e da faixa BRT | ESPEC §3 | C (sem valores) |
| D4 | Os registros de fluxo contêm logradouro, localização, referência, sentido, pista, faixa, coordenada, período, data, dia da semana, horário, fluxo e resumo diário | ESPEC §3 | C (estrutura) |
| D5 | Os dados de velocidade trazem data, dia da semana, horário, velocidade média e 85º percentil | ESPEC §7 ← VEL | C (estrutura, sem valores) |
| D6 | Matriz comparativa: 7 linhas com faixas de VDM, volume de fim de semana, picos, faixas e observações | PARAM §1 | C (faixas aproximadas) |
| D7 | Volumes de pico citados no texto: Linha Vermelha 4.000–4.500; Américas centrais 2.800–3.200; Jardim Botânico 1.200–1.500 veíc/h | PARAM §2.C | C (observações do estudo) |
| D8 | ~40.000–44.000 veíc/dia nas pistas centrais da Av. das Américas | PARAM §2.B | C; **diverge da §1 (38.000–44.000)** |

### INDICADORES

| # | Conteúdo | Fonte | Status |
|---|---|---|---|
| N1 | VDM em dias úteis | PARAM §1, §2.B | o nome é C; o procedimento é **I** (média aritmética deduzida do nome) |
| N2 | Volume diário de fim de semana | PARAM §1 | C (transcrito) |
| N3 | Pico da manhã e da tarde/noite (janela + fluxo máximo) | PARAM §1, §2.A | C (transcrito); critério de "máximo" **I** |
| N4 | Fluxo horário | UFRJ (veíc/h) | I |
| N5 | Velocidade média | VEL | C como dado; agregação **P** |
| N6 | Velocidade do 85º percentil | VEL | C como dado reportado; sem valores |
| N7 | Capacidade | PARAM §2.C (citada) | **P** (sem valor nem método) |
| N8 | Saturação | PARAM §2.C (qualitativa) | **P**; a razão v/c é FONTE EXTERNA |
| N9 | Nível de Serviço A–F | PARAM §2.C ("E/F") | **P** (sem critério) |

### FÓRMULAS

| # | Conteúdo | Fonte | Status |
|---|---|---|---|
| F1 | Fluxo equivalente q = n · 60 / Δt | ESPEC §33 (exemplo 127 → 1.524) | **I**: o exemplo só fecha com Δt = 5 min |
| F2 | v/c | — | P / fonte externa |
| — | **Nenhuma fórmula matemática explícita existe nas fontes.** | | |

### REGRAS

| # | Conteúdo | Fonte | Status |
|---|---|---|---|
| R1 | Picos em dias úteis: 07–09h e 17–19h | PARAM §2.A | C |
| R2 | Américas (São Conrado) e Linha Vermelha atingem o pico entre 07 e 08h; Américas (Santa Cruz) e Abelardo Bueno (Riocentro), entre 17 e 18h | PARAM §2.A | C (exibido como citação) |
| R3 | Sábado: concentração entre 11 e 15h. Domingo: menor volume, pico entre 16 e 19h | PARAM §2.A | C |
| R4 | Dias úteis homogêneos; às sextas o pico antecipa e há mais volume residual à noite | PARAM §2.B | C (descritivo; sexta-feira ainda não modelada) |
| R5 | Queda do VDM no fim de semana: 25–50%, conforme a tipologia da via | PARAM §2.B | C; verificação **E** |
| R6 | Madrugada (01–05h) geralmente abaixo de 5% do pico; crescimento abrupto a partir das 06h | PARAM §2.B | C; verificação **E** |
| R7 | Não comparar períodos incompatíveis sem deixar isso explícito | ESPEC §31 | C; critério operacional **E** |
| R8 | Distinguir dia útil, sábado e domingo | ESPEC §11, PARAM §2.A | C |
| R9 | Não comparar fluxos de BRT e de faixa mista de forma ingênua | ESPEC §16, PARAM §2.C | C |

### INTERPRETAÇÕES

| # | Conteúdo | Fonte | Status |
|---|---|---|---|
| T1 | Linha Vermelha opera perto do limite da capacidade teórica por faixa e chega ao Nível de Serviço E/F nos gargalos | PARAM §2.C | C como citação; **não calculada** |
| T2 | Capacidade das Américas condicionada por interseções, agulhas e travessias | PARAM §2.C | C como citação |
| T3 | BRT: maior eficiência por veículo, com folga de capacidade física | PARAM §2.C | C como citação |
| T4 | Jardim Botânico: pequenas interferências levam rapidamente à saturação | PARAM §2.C | C como citação |
| T5 | Fluxo subindo com velocidade caindo indica possível deterioração | ESPEC §8 | conceito; **proibido classificar** sem metodologia |
| T6 | Barra de condição NORMAL → ATENÇÃO → CRÍTICO → CONGESTIONADO | ESPEC §19 | estrutura C; limites **P** |

### HIPÓTESES DO SISTEMA

Ver [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Etapa 3 — o que está confirmado e implementado

- **Dados e estrutura:**
  - D1, D2 e D6 estão carregados com o texto literal da fonte.
  - A hierarquia Corredor → Local → Sentido → Pista → Faixas cobre os 7 segmentos.
  - As faixas mistas e BRT estão separadas.
- **Regras:** R1, R3 e R8 estão implementadas (janelas por tipo de dia; tipo de dia a partir da data).
- **Comparações:** R7 está implementada; toda comparação incompatível aparece com aviso.
- **Citações:** R2, T1, T2, T3 e T4 aparecem como citação no segmento correspondente.

## Etapa 4 — o que está incompleto ou precisa ser validado

Ver [PENDING_VALIDATION.md](PENDING_VALIDATION.md).

**Achados nos próprios dados:**
- **Madrugada de 01/03/2023:** às 01h o fluxo é 668, ou 22,6% do pico (2.961). Isso diverge da regra R6, que diz "geralmente abaixo de 5%".
- **Padrão alternado em 01/03/2023:** entre 11h e 16h os valores sobem e descem de forma alternada (2.886 → 2.033 → 2.896 → 1.853 → 2.940). Pode ser erro de transcrição.
- **Pico de 03/2019:** o máximo é 2.397, às 14h. Fica fora das janelas de dia útil, mas o tipo de dia é desconhecido.
- **Pico da manhã de 2023:** na janela 07–09h o máximo é 2.390, abaixo da faixa da matriz (~2.500–2.800). O pico da tarde (2.961, às 17h) está dentro da faixa da matriz (~2.800–3.200).
