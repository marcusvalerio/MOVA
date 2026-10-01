# Data Dictionary

Os tipos estão em `src/domain/types.ts`; o esquema SQL, em `db/schema.sql`.

## Corridor (corredor)
| Campo | Tipo | Descrição |
|---|---|---|
| id | string | slug, por exemplo `av-americas` |
| name | string | nome do eixo viário |
| description | string | descrição livre |
| locationIds | string[] | locais de medição |

## Location (local de medição)
| Campo | Tipo | Descrição |
|---|---|---|
| id | string | `<corredor>--<número/km>` |
| corridorId | string | corredor ao qual pertence |
| address | string | por exemplo "Av. das Américas, próximo ao nº 2000" |
| reference | string \| null | ponto de referência (ex.: Colégio Anglo Americano) |
| roadClassRaw | string \| null | "Via Expressa" ou "Via urbana", quando a fonte diz |
| coordinates | {lat, lng, provenance, note} \| null | hoje **APROXIMADO_FONTE_EXTERNA**; o PDF de fluxos contém as coordenadas reais |

## RoadSegment (sentido + pista + faixas)
| Campo | Tipo | Descrição |
|---|---|---|
| id | string | `<local>--<sentido>--<pista>` |
| direction | string | sentido, por exemplo "Santa Cruz" |
| carriageway | enum | CENTRAL, LATERAL, CENTRAL_E_LATERAL, EXCLUSIVA_BRT, VIA_EXPRESSA, NAO_ESPECIFICADA |
| laneType | enum | MISTA, BRT, MISTA_E_BRT, NAO_ESPECIFICADO |
| laneCount | int \| null | só quando a fonte é explícita ("3 Faixas") |
| lanesMonitoredRaw | string | texto literal, por exemplo "3 Faixas mistas (Faixas 2, 3 e 4)" |
| directionRaw, speedRecordRaw, notesRaw | string | células literais da matriz |
| structureNote | string \| null | interpretação de linha agrupada, a validar |
| source | SourceRef | documento, seção e linha |

## Measurement (faixa reportada na matriz)
| Campo | Tipo | Descrição |
|---|---|---|
| metric | enum | VDM_DIAS_UTEIS, VOLUME_FIM_DE_SEMANA, PICO_MANHA, PICO_TARDE_NOITE |
| raw | string | texto literal da célula |
| value | {min, max, approximate} \| null | faixa; nunca reduzida a ponto médio |
| unit / rawUnit | string | unidade normalizada / unidade como está na fonte ("veg/dia") |
| windows | {start, end}[] | janelas de pico |
| qualifier | string \| null | por exemplo "Central" ou "por sentido" |

## TrafficObservation (observação em intervalo — igual para todas as fontes)
| Campo | Tipo | Descrição |
|---|---|---|
| source | HISTORICO \| SIMULACAO \| CAMERA_TESTE | fonte do dado |
| seriesId | string | agrupa as observações do mesmo dia ou série |
| date | YYYY-MM-DD \| null | **null quando a fonte não informa**; nunca é inventada |
| month | YYYY-MM \| null | mês |
| weekday | 0–6 \| null | 0 = domingo |
| dayType | DIA_UTIL \| SABADO \| DOMINGO \| DESCONHECIDO | regra M-TIPO-DIA |
| startTime | HH:MM | início do intervalo (horário local) |
| durationMinutes | number | duração do intervalo |
| vehicleCount | int \| null | contagem; null = ausente |
| averageSpeedKmh | number \| null | velocidade média |
| p85SpeedKmh | number \| null | 85º percentil reportado |
| queueLengthM | number \| null | fila (simulação ou câmera) |
| quality | VALIDO \| AUSENTE \| INVALIDO \| INCOMPLETO \| SUSPEITO | = VALID, MISSING, INVALID, INCOMPLETE, SUSPECT |
| sourceRef | SourceRef \| null | documento, seção e localizador |
| raw | string \| null | texto original da célula ou payload |

## Series
Reúne metadados de uma série (dia): id, segmentId, label, date, month, weekday, dayType, sourceRef e observationIds.

## Indicator
| Campo | Tipo | Descrição |
|---|---|---|
| origin | OBSERVADO \| CALCULADO \| INTERPRETADO \| SIMULADO \| INDISPONIVEL | camada epistemológica do valor |
| value / unit / display | — | valor, unidade e texto exibido |
| period | string | série, data e tipo de dia |
| methodologyId | string | referência ao catálogo |
| trace | TraceStep[7] | INDICADOR → VARIÁVEIS → ENTRADA → FÓRMULA → INTERMEDIÁRIO → RESULTADO → INTERPRETAÇÃO |

## MethodologyEntry
Campos: id, name, category (DADO, INDICADOR, FORMULA, REGRA, INTERPRETACAO, HIPOTESE), description, formula (**sempre o texto da fonte; null se ausente**), implementation, variables, unit, purpose, sources, externalSource, version e status (CONFIRMADO, INFERIDO, EXPERIMENTAL, PENDENTE), gaps.

## QualityIssue
Campos: id, status, rule, target {kind, id}, message, evidence. Registra o problema e **nunca altera o dado**.

## CameraObservation (entrada de visão computacional)
Campos: cameraId, timestamp (ISO com fuso), intervalSeconds, vehicleCount, vehicleTypes, averageSpeed, queueLength, direction, occupancy, confidence, source. O schema zod está em `src/adapters/camera.ts`.
