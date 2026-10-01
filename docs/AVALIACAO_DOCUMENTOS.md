# Avaliação dos documentos-fonte

Arquivos avaliados, todos em `docs/fontes/`:

| Arquivo | Conteúdo | Páginas |
|---|---|---|
| `FLUXOS_UFRJ_REVISADO.pdf` | Fiscalização Eletrônica — **Relatório 05**: fluxo veicular diário por faixa horária, por mês e por endereço | 199 |
| `VELOCIDADE_UFRJ.pdf` | Fiscalização Eletrônica — **Relatório 06**: velocidade média diária por faixa horária e 85º percentil | 234 |
| `PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx` | Síntese: matriz comparativa e relatório qualitativo | — |

**Como os dados foram extraídos:**
- O script `scripts/extracao/extrair_tabelas.py` leu as tabelas pela posição de cada palavra na página.
- O resultado ficou em `data/extraido/fluxos.json` (1.046 colunas-dia) e `data/extraido/velocidade.json` (1.088 colunas-dia).
- O script `scripts/extracao/avaliar.py` reproduz os números deste relatório.

**Validação da extração:**
- Nos **847 dias de fluxo com as 24 horas preenchidas**, a soma extraída é **igual ao total impresso** ("SOMA"/"RESUMO") **em 100% dos casos**.
- Todas as datas foram conferidas contra o dia da semana impresso. Isso foi necessário porque os relatórios misturam quatro formatos de data: `01/03/2019`, `3/5/2019` (mês/dia), `01/05/22` e só o dia (`1`, `2`).

---

## 1. O que os PDFs contêm

São relatórios oficiais de radares (fiscalização eletrônica), com uma tabela de 24 horas por dia, cobrindo o mês inteiro.

| Corredor | Local / sentido / pista | Meses com fluxo | Velocidade |
|---|---|---|---|
| Av. das Américas | nº 2000 · Santa Cruz · pista **lateral** | 03/2019, 03/2023 | sim (2023: também **por faixa**) |
| | nº 2000 · Santa Cruz · pista **central** | 03/2019, 03/2023 | sim |
| | nº 2000 · Santa Cruz · **faixa exclusiva BRT** | 03/2023 | sim |
| | nº 2603 · São Conrado · pista lateral | 03/2019 | sim |
| | nº 2603 · São Conrado · pista central | 03/2019, 03/2023 | sim |
| | nº 2603 · São Conrado · **faixa exclusiva BRT** | 03/2023 | sim |
| | LO 2000 · **sentido Zona Sul** · pista lateral | 03/2023 | sim |
| Av. Embaixador Abelardo Bueno | nº 980 · Riocentro e Linha Amarela · pistas central e lateral (**4 segmentos**) | 03/2019, 03/2023 | sim |
| Rua Jardim Botânico | nº 746 · sentido Gávea | 03/2019, 03/2022 | sim |
| | Gal. Garzon · sentido Humaitá / J. Botânico | 03/2019, 03/2022 | sim |
| Linha Vermelha (Via Expressa Pres. João Goulart) | Km 5,5 · sentidos Ilha/Via Dutra e Centro | 05/2019, 05/2022 | sim |
| **Túnel Santa Bárbara** | sentidos Centro/Catumbi e Laranjeiras | 05/2019, 05/2022 | sim |
| **Av. Dom Helder Câmara** | nº 2238 · sentidos Centro e Madureira | 05/2019, 05/2022 | sim (05/2019 incompleto na extração) |

Também constam, em parte das páginas: **código CET**, **número do equipamento** e **coordenadas** (UTM ou graus). Por exemplo, Américas 2000 Central em 2023: `23°0'2"S 43°20'3"O`, equipamento 3200041.

**Resumo:**
- São **34 séries mensais** de fluxo e quase todas têm a série de velocidade correspondente.
- Os PDFs contêm **dois corredores que não aparecem na matriz do .docx**: o Túnel Santa Bárbara e a Av. Dom Helder Câmara.
- Também contêm **três segmentos que a matriz não lista**: a faixa BRT do nº 2603, a pista lateral do nº 2603 e o sentido Zona Sul do nº 2000.

---

## 2. Qualidade dos dados

### 2.1 Cobertura

| | Fluxo |
|---|---|
| Colunas-dia extraídas | 1.046 |
| Dias com as 24 horas preenchidas | 847 (81%) |
| Células vazias (hora sem valor) | 2.092 |
| Células com zero (`0` / `00`) | 242 |

Séries que se destacam pela falta de dados:
- **Américas 2000, faixa BRT (03/2023):** nenhum dia completo; 5 dias totalmente vazios.
- **Abelardo Bueno, Riocentro, pista lateral (03/2023):** 4 dias completos em 31.
- **Américas 2000, pista lateral (03/2023):** 11 dias completos.
- **Jardim Botânico, Gal. Garzon (03/2019):** 21 dias completos.

### 2.2 Zeros e falhas de equipamento

**Os zeros aparecem em blocos**, o que é típico de equipamento parado, não de via vazia:
- **Túnel Santa Bárbara, sentido Centro:** 31 horas zeradas em 12/05/2019.
- **Jardim Botânico, sentido Humaitá:** zeros em 7 dias de março de 2022 (20, 21, 22, 25, 26, 27 e 28/03), e o V85 desses dias aparece como **0 km/h**.
- **Américas 2000, pista central, 04/03/2023 (sábado):** quatro horas com `00` (08h, 15h, 17h e 18h). Nas horas `00` a velocidade fica em branco.

**Regra adotada:** zero vira **SUSPEITO** e célula vazia vira **AUSENTE**. Nada é preenchido. Valores muito baixos entre horas normais (por exemplo, `1`, `4` e `11` no Jardim Botânico em 05/03/2019) indicam falha parcial e também ficam marcados para conferência.

### 2.3 Velocidade

- **Média diária impressa:**
  - fica a até 1 km/h da média **aritmética** das 24 horas em 663 de 774 dias completos (86%);
  - coincide exatamente com a média aritmética em 556 dias e com a média **ponderada pelo fluxo** em 217.
  - **Conclusão:** o relatório parece usar a média aritmética das horas, mas não de forma uniforme. A metodologia da média diária **não está documentada** e é pendente de validação.
- **85º percentil:**
  - **Em 2019 é constante no mês inteiro em cada local.** Por exemplo, Américas 2000 Lateral = 57 km/h nos 31 dias e Américas 2000 Central = 67 km/h. Isso indica um valor **mensal repetido** em cada dia, não um valor diário.
  - Em 2022 e 2023 o valor varia por dia.
  - **Linha Vermelha 05/2022:** o "V85" impresso (16–45 km/h) é **menor que a velocidade média do dia** (~66–75 km/h). Isso é impossível por definição. Ou é erro da fonte, ou o campo representa outra coisa. Fica **SUSPEITO** e precisa de validação.
- **Dados por faixa (lane):** a pista lateral do Américas 2000 (03/2023) tem tabelas por faixa, com códigos CET 0540171211, 0540171212 e 0540171213, além do total. A pista central de 2023 traz a nota "Velocidade média das faixas 2, 3 e 4 / Total das faixas".

### 2.4 Calendário

- **Março de 2019 contém o Carnaval** (4 e 5/03, segunda e terça, com quarta-feira de Cinzas em 6/03). FONTE EXTERNA / NÃO PRESENTE NOS DOCUMENTOS: o calendário do Carnaval não consta dos relatórios. Os dados confirmam o efeito: o Américas 2000 Lateral tem 394 veículos às 07h de 04/03, contra cerca de 1.100 em segundas-feiras normais.
- **1º de maio** (feriado) está dentro de maio de 2019 e de maio de 2022.

**Consequência:** a pergunta 17 da lista de pendências (feriados) deixa de ser hipotética. Sem tratar feriados, o VDM de dias úteis de 03/2019 fica distorcido.

---

## 3. Conferência da especificação contra os PDFs

| Afirmação da especificação | O que o PDF mostra | Situação |
|---|---|---|
| Série "de março de 2019" (1.113, 1.590 … 1.892) é da **pista central** do Américas 2000 Santa Cruz | Os valores são da **pista lateral** (`Av Americas Px2000 PLat-St a Cruz`), dia **01/03/2019, sexta-feira** (véspera de Carnaval) | **Erro de atribuição** na especificação |
| Série de 01/03/2023 da pista central (520, 668 … 1.935) | Confere em todos os 22 valores | Correto |
| 22–23h e 23–24h "continuar conforme fonte" | O PDF tem **1.467** e **947**. Total do dia: **42.741** (a soma das 24 horas bate) | Os dados existem |
| 01h = 668 é maior que 00h e diverge da regra "madrugada < 5% do pico" | Está assim no PDF. Não é erro de transcrição | Dado da fonte; divergência da regra continua registrada |
| Alternância entre 11h e 16h (2.886 → 2.033 → 2.896 → 1.853 → 2.940) | Está assim no PDF. Não é transcrição. Padrões semelhantes aparecem em outros dias de 2023 (ex.: 03/03, de 2.739 para 829), sugerindo comportamento do equipamento ou do tráfego | Dado da fonte; continua SUSPEITO para validação |

---

## 4. Conferência da matriz do .docx contra os PDFs

Para cada segmento, calculei os totais diários de dias úteis e de fim de semana a partir dos dias completos, sem zeros e excluindo Carnaval e 1º de maio:

| Linha da matriz (.docx) | Matriz: VDM dias úteis | PDF (dias úteis completos) | Observação |
|---|---|---|---|
| 1 · Américas 2000 Lateral | ~22.000–32.000 | 2019: 20.133–32.582 (média 30.348) · 2023: 13.081–25.628 (8 dias) | A matriz corresponde a **2019** |
| 2 · Américas 2000 Central | ~38.000–44.000 | 2019: 39.491–44.197 (média 41.725) · 2023: 22.507–44.456 | Corresponde a 2019; 2023 tem muitos dias com falhas |
| 4 · Américas 2603 (Central) | ~35.000–45.000 | Central 2019: 32.747–44.556 · 2023: 23.970–48.811 (média 42.470) | Compatível |
| 5 · Abelardo Bueno (por sentido) | ~24.000–28.000 | Riocentro central 2023: 24.884–28.040 · Riocentro central 2019: 17.765–27.582 | O "por sentido" parece referir-se ao **sentido Riocentro, pista central, 2023** |
| 6 · Jardim Botânico | ~15.000–21.000 | Gávea 2022: 13.530–19.751 · Humaitá 2022: 13.997–21.936 | Compatível (2022) |
| 7 · Linha Vermelha | ~51.000–65.000 | S. Ilha 2019: 42.095–65.273 · S. Centro 2019: 53.014–69.986 | Faixa aproximada da S. Ilha |

**Pontos em que a síntese não é sustentada pelos dados:**

1. **Picos da pista central do Américas 2000:**
   - A matriz diz "07h–09h (~2.500–2.800)" para a manhã.
   - No PDF, a hora de pico típica dos dias úteis é **16h** em 2019 e **15h–17h** em 2023.
   - O PDF não sustenta uma janela de pico de manhã para essa pista.
2. **Linha Vermelha, sentido Centro, 05/2019:** o fim de semana tem **mais** volume que os dias úteis (média de 69.980 contra 63.542). Isso contraria a regra "queda de 25–50% nos fins de semana".
3. **Abelardo Bueno, sentido Linha Amarela, pista central (2023):** a queda no fim de semana é de cerca de 6% (média de 18.662 para 17.479), fora da faixa de 25–50%.
4. **Corredores fora da matriz:** a matriz não cita o Túnel Santa Bárbara nem a Av. Dom Helder Câmara, embora estejam nos PDFs.
5. **Período de cada valor:** a matriz mistura anos (2019, 2022, 2023) sem dizer qual período cada valor representa.

**Conclusão:** o .docx é uma síntese útil para orientação, mas **não deve ser fonte de números**. A fonte de dados do MOVA passa a ser os PDFs. A matriz fica como referência secundária e é confrontada com os dados no sistema.

---

## 5. Impacto na lista de pendências

| # | Pendência | Situação após os PDFs |
|---|---|---|
| 1 | PDFs de fluxo e velocidade | **Resolvido** |
| 2 | Conferir 01/03/2023 | **Resolvido.** Os valores conferem; 22–24h existem; 668 e a alternância estão na fonte |
| 3 | Dia exato da série de 2019 | **Resolvido.** É 01/03/2019, mas da pista **lateral** |
| 6 | Linhas agrupadas da matriz | **Parcial.** Os PDFs separam todos os sentidos e pistas; o significado da matriz ainda depende do autor |
| 7 | O que as faixas da matriz representam | **Indício:** variação entre dias de um mês específico (2019 ou 2022/2023), sem indicar o ano |
| 10 | Velocidade média agregada | **Parcial.** A média diária impressa é próxima da média aritmética das horas; não é uniforme |
| 17 | Feriados | **Agora necessário.** Carnaval de 2019 e 1º de maio estão nos dados |
| — | Coordenadas | **Parcial.** Disponíveis para parte dos equipamentos |
| **Novo** | V85 de 2019 constante no mês | Confirmar se é valor mensal |
| **Novo** | V85 < velocidade média na Linha Vermelha 2022 | Confirmar o que o campo representa |
| **Novo** | Túnel Santa Bárbara e Dom Helder Câmara | Confirmar se entram no escopo do estudo |

As pendências metodológicas (capacidade, nível de serviço, limites da condição operacional) **continuam em aberto**: nenhum dos três documentos as define.

---

## 6. Próximo passo recomendado

Incorporar `data/extraido/*.json` ao MOVA como fonte HISTÓRICO principal:
1. São 34 séries mensais de fluxo com velocidade.
2. A página de origem fica registrada em cada valor.
3. Zeros e vazios são marcados, não corrigidos.
4. O calendário de feriados fica explícito e marcado como fonte externa.

Isso habilita no sistema: VDM real por tipo de dia, perfis horários médios, comparação entre 2019 e 2023 no mesmo segmento e relação fluxo × velocidade, sem classificação automática.
