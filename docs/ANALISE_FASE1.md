# MOVA — Análise da Fase 1

Fonte analisada: `docs/fontes/PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx` (DOC-PARAMETROS).
Fontes citadas, mas **não disponíveis**: relatórios de fiscalização eletrônica da Cidade do Rio de Janeiro (DOC-FISCALIZACAO-RJ) e estudo técnico UFRJ (DOC-UFRJ).

---

## 1. Análise do documento

**Estrutura**
- **Seção 1, Matriz comparativa:** 7 linhas (corredor + sentido/pista) × 9 colunas (faixas, VDM em dias úteis, volume de fim de semana, picos da manhã e da tarde/noite, registro de velocidades, observações).
- **Seção 2, Relatório qualitativo:**
  - 2.A: dias e horários de pico;
  - 2.B: variações semanais, diárias e horárias;
  - 2.C: capacidade e nível de serviço.

**Características que condicionam o sistema**
1. **Não há nenhuma fórmula no documento.** Todos os números são valores reportados.
2. **Todos os valores são faixas aproximadas** (`~22.000 – 32.000`). Não são observações primárias. O sistema guarda mínimo e máximo e nunca reduz a faixa a um ponto médio.
3. **Não há série temporal.** O documento traz apenas janelas de pico e faixas. Não há dados hora a hora nem datas de coleta.
4. **Não há velocidades.** Seis linhas dizem "Não discriminada no relatório de fluxo". A linha do BRT cita "Velocidade média calculada", sem valor.
5. **O documento é uma síntese secundária.** O conteúdo aparece duplicado. A segunda cópia traz marcadores "PDF"/"PDF+ n" e a frase truncada "qui está a análise comparativa…". Ela foi produzida a partir dos PDFs primários, provavelmente com uma ferramenta assistida.
6. **Não há coordenadas, datas de coleta nem período de observação.**

## 2. Inventário metodológico

| Indicador / conceito | Fonte | Entradas | Fórmula na fonte | Unidade | Finalidade (segundo a fonte) | Status |
|---|---|---|---|---|---|---|
| VDM, dias úteis | §1 (coluna), §2.B | volumes diários | **ausente** (só o nome) | veíc/dia ("veg/dia") | caracterizar a demanda; comparar com o fim de semana | Dado: transcrito · Cálculo em séries: **PENDENTE** |
| Volume diário, fim de semana | §1 | volumes diários | ausente | veíc/dia | comparação semanal | **CONFIRMADO** (transcrição) |
| Pico da manhã / tarde (janela + fluxo máx.) | §1, §2.A | fluxos horários | ausente | veíc/h | períodos de maior solicitação | Transcrito · Operacionalização: **PENDENTE** |
| Fluxo horário | §1 (unidade) | contagens | ausente | veíc/h | base dos picos | **PENDENTE** |
| Queda do VDM no fim de semana (25–50%) | §2.B | VDM, volume do fim de semana | regra numérica, sem fórmula | % | variação semanal por tipologia | Regra **CONFIRMADA** · Cálculo **EXPERIMENTAL** |
| Madrugada < 5% do pico | §2.B | fluxos horários | regra descritiva ("geralmente") | % | padrão horário | **EXPERIMENTAL** (só alerta) |
| Velocidade média | §1 (coluna) | velocidades | ausente; sem dados | km/h | comportamento operacional | **PENDENTE** |
| Velocidade do 85º percentil | — | — | **não consta** | km/h | — | **PENDENTE** (não implementado) |
| Capacidade | §2.C (citada) | características da via | **ausente**, sem valores | veíc/h | saturação e nível de serviço | **PENDENTE** |
| Saturação (v/c) | §2.C (termo qualitativo) | fluxo, capacidade | **ausente** · FONTE EXTERNA | — | condição operacional | **PENDENTE** |
| Nível de Serviço A–F | §2.C ("E/F") | — | **ausente** | — | classificação | **PENDENTE** (exibido só como citação) |
| Condição operacional (4 níveis) | escopo do projeto | a definir | **ausente** | — | painel | **PENDENTE**: limites aguardando validação |

O detalhamento completo (variáveis, implementação, lacunas) está em `src/methodology/registry.ts` e na aba **Metodologia** do sistema.

## 3. Modelo de dados

`SourceDocument` → `Corridor` (5) → `Approach` (7, uma por linha da matriz) → `Measurement` (28 faixas, com o texto literal).

Entidades de suporte:
- `TrafficObservation`: intervalos de contagem e velocidade. Recebe dados da simulação e, no futuro, de câmeras.
- `CameraObservation`: contrato de entrada.
- `MethodologyEntry`: versionada, com status.
- `Indicator`: valor, origem (observado / calculado / simulado / indisponível) e `trace` em 7 passos.
- `QualityIssue`: diagnóstico do dado, sem alterá-lo.

Os tipos estão em `src/domain/types.ts` e o esquema PostgreSQL em `db/schema.sql`.

## 4. Arquitetura

| Camada | Pasta | Responsabilidade |
|---|---|---|
| 1. Data layer | `src/data` | texto literal da fonte e inventário de documentos |
| 2. Normalization | `src/normalization` | parsing determinístico (faixas, unidades, janelas, faixas de rolamento) |
| 3. Data quality | `src/quality` | regras que só registram, sem corrigir nada |
| 4. Traffic engine | `src/engine` | aritmética de intervalos; séries horárias; saturação; classificação |
| 5. Methodology | `src/methodology` | registro de fórmulas e regras; configuração da condição operacional |
| 6. Analytics | `src/analytics` | indicadores e trilhas de rastreabilidade |
| 7. Presentation | `src/app`, `src/components` | painel, corredores, rastreio, metodologia, qualidade, simulação |
| 8. CV adapter | `src/adapters/camera.ts` | schema zod + conversão para `TrafficObservation` |

O motor (`src/engine/series.ts`) recebe apenas `TrafficObservation`. Simulação e câmera entram pelo mesmo tipo. O repositório (`src/repository`) é uma interface: em memória no MVP, PostgreSQL depois.

## 5. Fórmulas identificadas na fonte

**Nenhuma.** O documento contém apenas regras numéricas descritivas:
- R1 (§2.B): "A queda do VDM nos fins de semana varia de 25% a 50%, dependendo da tipologia da via."
- R2 (§2.B): "Durante as madrugadas (01:00 às 05:00), o fluxo cai… geralmente abaixo de 5% do volume de pico."
- R3 (§2.A): janelas de pico típicas: dias úteis 07–09 e 17–19; sábado 11–15; domingo 16–19.

## 6. Fórmulas ausentes (necessárias para o escopo)

1. Procedimento de cálculo do VDM: dias considerados, número de semanas, dias incompletos.
2. Definição de "fluxo máximo" do pico: hora cheia, hora móvel ou fator de hora de pico.
3. Agregação de contagens em veíc/h e duração dos intervalos dos relatórios.
4. Velocidade média: temporal ou espacial, ponderação.
5. Velocidade do 85º percentil.
6. Capacidade por faixa e por aproximação, com o método usado.
7. Grau de saturação (v/c).
8. Critério de Nível de Serviço: medida de desempenho e limites.
9. Indicador-base e limites de NORMAL / ATENÇÃO / CRÍTICO / CONGESTIONADO.
10. Limite de confiança mínimo para dados de visão computacional.

## 7. Indicadores implementados

Para cada uma das 7 aproximações há 8 indicadores, todos clicáveis com trilha de rastreio:

| Indicador | Origem | Exibição |
|---|---|---|
| VDM, dias úteis | observado na fonte | faixa |
| Volume, fim de semana | observado na fonte | faixa |
| Pico da manhã | observado na fonte | janela + faixa |
| Pico da tarde/noite | observado na fonte | janela + faixa |
| Queda fim de semana × dias úteis | calculado | intervalo %, verificado contra R1 |
| Velocidade média | indisponível | "Sem dado" |
| Saturação | indisponível | "Sem dado" (sem capacidade) |
| Condição operacional | indisponível | INDETERMINADO |

Resultado da verificação R1 (aritmética de intervalos):

| Linha | Corredor / pista | Queda possível | Compatível com 25–50%? |
|---|---|---|---|
| 1 | Américas 2000 Lateral | −27,3% a 53,1% | sim, mas as faixas se sobrepõem |
| 2 | Américas 2000 Central | 7,9% a 54,5% | sim |
| 3 | Américas 2000 BRT | 50,0% a 86,7% | só no limite (50%) |
| 4 | Américas 2603 | 14,3% a 55,6% | sim |
| 5 | Abelardo Bueno | 16,7% a 46,4% | sim |
| 6 | Jardim Botânico | −13,3% a 47,6% | sim, mas as faixas se sobrepõem |
| 7 | Linha Vermelha | −3,9% a 35,4% | sim, mas as faixas se sobrepõem |

## 8. Mapa de funcionalidades

| Rota | Conteúdo |
|---|---|
| `/` Painel | KPIs, mapa esquemático, escala de condição (sem limites), faixas de pico (misto e BRT), resumo de qualidade, matriz literal |
| `/corredores/[id]` | indicadores por sentido, observações e avaliações qualitativas citadas, qualidade |
| `/rastreio/[id]` | indicador → variáveis → entradas → fórmula → intermediário → resultado → interpretação |
| `/metodologia` | todas as entradas com status, fonte e lacunas |
| `/qualidade` | registros (31 suspeitos, 10 ausentes, 0 inválidos) |
| `/fontes` | documentos e disponibilidade |
| `/simulacao` | modo SIMULAÇÃO: série horária, velocidade sintética, limites experimentais definidos pelo usuário |
| `/camera` | contrato CameraObservation e status "não conectada" |

API REST: `/api/corridors`, `/api/corridors/[id]`, `/api/indicators`, `/api/indicators/[id]`, `/api/methodology`, `/api/quality`, `/api/simulation`, `POST /api/camera/observations`.

## 9. Plano do MVP

- **Feito:**
  - ingestão do histórico com texto literal;
  - normalização e regras de qualidade;
  - motor de intervalos e de séries;
  - registro de metodologia;
  - indicadores com rastreio;
  - painel responsivo (claro/escuro);
  - simulação determinística;
  - contrato de câmera;
  - API;
  - esquema PostgreSQL;
  - 71 testes.
- **Próximo, ao receber os PDFs primários:**
  1. Extrair as séries horárias e as velocidades para `TrafficObservation`, com fonte HISTÓRICO.
  2. Confrontar as faixas da síntese com os dados primários.
  3. Ativar os indicadores que dependem de série (fluxo horário, pico, velocidade).
- **Depois da validação com o professor:**
  1. Preencher capacidade, indicador-base e limites da condição.
  2. Mudar o status das metodologias de PENDENTE para CONFIRMADO, com a fonte citada.
  3. Trocar o repositório em memória pelo PostgreSQL.
  4. Adicionar multi-tenant (SaaS).

## 10. Pontos a validar com o professor

1. **Relatórios primários:** envio dos PDFs, por exemplo divididos por capítulo, para substituir a síntese.
2. **Grafia "veg/dia" / "veg/h":** confirmar que significa veículos. Afeta 24 das 28 células.
3. **Linha 4 (Américas 2603):** o VDM marcado "(Central)" vale só para a pista central? E o volume de fim de semana?
4. **Linha 5 (Abelardo Bueno):** o VDM "(por sentido)" se refere a qual sentido? Existem dados separados para Riocentro e Linha Amarela?
5. **Divergência entre §2.B e §1:** o texto diz ~40.000–44.000 veíc/dia nas pistas centrais; a matriz diz ~38.000–44.000. Qual vale?
6. **Linha Vermelha:** a fonte diz "no limite de sua capacidade teórica por faixa" com 4.000–4.500 veíc/h em 4 faixas. Qual capacidade por faixa foi usada?
7. **Nível de Serviço E/F:** qual metodologia (medida e limites) sustenta essa classificação?
8. **Condição operacional:**
   - qual indicador-base usar (v/c, velocidade, densidade)?
   - quais limites para NORMAL / ATENÇÃO / CRÍTICO / CONGESTIONADO?
9. **Definição de VDM e de "fluxo máximo" do pico:**
   - quantos dias e semanas entram no VDM?
   - o pico é uma hora cheia ou uma hora móvel?
10. **Faixas da matriz:** representam a variação entre dias, entre equipamentos ou incerteza? Isso muda como o sistema deve compará-las.
11. **Velocidade:** os relatórios de fiscalização trazem velocidades individuais? Isso permitiria calcular a velocidade média e o 85º percentil.
12. **Coordenadas dos pontos de medição** (hoje aproximadas por fonte externa) e período de coleta.
