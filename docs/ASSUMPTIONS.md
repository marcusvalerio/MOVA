# Assumptions (hipóteses do sistema)

São escolhas feitas pelo sistema para operacionalizar algo que as fontes não definem. Todas estão visíveis na interface.

| # | Hipótese | Onde | Por quê |
|---|---|---|---|
| H1 | "veg/dia" e "veg/h" significam veículos | normalização | grafia presente em 24 de 28 células |
| H2 | Faixas `~mín – máx` são mantidas como intervalo, sem ponto médio | normalização e motor | preservar a incerteza da fonte |
| H3 | Estrutura de cada linha da matriz (corredor, local, sentido, pista, tipo de faixa) | `src/data/raw/estrutura.ts` | as linhas 4, 5, 6 e 7 agrupam pistas ou sentidos |
| H4 | As séries da especificação pertencem ao segmento "Américas 2000 · Santa Cruz · Pista Central" (linha 2 da matriz) | `ufrj-series.ts` | a descrição coincide |
| H5 | Seg–sex = dia útil; feriados não são tratados | M-TIPO-DIA | a fonte não define feriados |
| H6 | Fluxo horário exige 60 min de cobertura válida | M-FLUXO-HORARIO | evitar horas parciais disfarçadas de completas |
| H7 | VDM em séries = média aritmética de dias úteis completos | M-VDM | deduzido do nome "Volume Diário Médio" |
| H8 | "Fluxo máximo" = maior hora cheia | M-PICO | as séries disponíveis são de hora cheia |
| H9 | Velocidade média agregada ponderada pela contagem | M-VELOCIDADE-MEDIA | sem definição na fonte |
| H10 | V85 nunca é agregado entre intervalos | M-V85 | agregar exigiria as velocidades individuais |
| H11 | Fluxo equivalente q = n · 60 / Δt | M-FLUXO-EQUIVALENTE | o exemplo 127 → 1.524 implica Δt = 5 min |
| H12 | Comparável = mesmo segmento e mesmo tipo de dia conhecido | M-COMPARACAO | operacionaliza a especificação §31 |
| H13 | Verificação de 25–50% por aritmética de intervalos | M-QUEDA-FDS | sem fórmula na fonte |
| H14 | "Volume de pico" na regra da madrugada = maior fluxo horário do dia | M-MADRUGADA | sem definição na fonte |
| H15 | Heurística de padrão alternado: ≥ 3 inversões com amplitude ≥ 20% | M-QA-ALTERNANCIA | priorizar a conferência da transcrição |
| H16 | Horário da câmera em America/Sao_Paulo (UTC−3) | adaptador de câmera | o Brasil não tem horário de verão desde 2019 |
| H17 | Coordenadas aproximadas | mapa | as fontes disponíveis não trazem coordenadas |
| H18 | Simulação: curva, ruído, multiplicadores dos cenários, velocidades e filas são arbitrários; queda de fim de semana aplicada ao pico | `src/simulation` | servem para testar o motor, não para representar a realidade |
