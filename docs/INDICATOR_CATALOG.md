# Indicator Catalog

| Indicador | key | Origem | Metodologia | Unidade | Quando há valor |
|---|---|---|---|---|---|
| VDM — dias úteis (matriz) | vdm | OBSERVADO | M-VDM | veíc/dia | sempre (faixa) |
| Volume — fins de semana (matriz) | vol-fds | OBSERVADO | M-MATRIZ | veíc/dia | sempre (faixa) |
| Pico da manhã (matriz) | pico-manha | OBSERVADO | M-PICO | veíc/h + janela | sempre (faixa) |
| Pico da tarde/noite (matriz) | pico-tarde | OBSERVADO | M-PICO | veíc/h + janela | sempre (faixa) |
| Queda fim de semana × dias úteis | queda-fds | CALCULADO | M-QUEDA-FDS | % (intervalo) | VDM e fim de semana disponíveis |
| Velocidade média | velocidade | INDISPONÍVEL | M-VELOCIDADE-MEDIA | km/h | quando houver o relatório de velocidades |
| Velocidade do 85º percentil | v85 | INDISPONÍVEL | M-V85 | km/h | quando houver o relatório de velocidades |
| Grau de saturação (v/c) | saturacao | INDISPONÍVEL | M-SATURACAO | — | quando a capacidade for definida |
| Condição operacional | condicao | INDISPONÍVEL → INTERPRETADO | M-CONDICAO | nível | quando indicador-base e limites forem validados |
| Fluxo horário máximo observado | pico-serie | CALCULADO | M-PICO | veíc/h | por série horária |
| Volume do dia / volume parcial | volume-serie | CALCULADO | M-VDM | veíc | por série; marcado INCOMPLETO se < 24 h |
| Madrugada / pico | madrugada | CALCULADO | M-MADRUGADA | % | série com as horas 01–05 |
| Fluxo horário equivalente (câmera) | — | CALCULADO | M-FLUXO-EQUIVALENTE | veíc/h | por observação de câmera |

Todos os indicadores abrem a página `/rastreio/<id>` e são devolvidos pela API em `/api/indicators/<id>`, junto com a metodologia.
