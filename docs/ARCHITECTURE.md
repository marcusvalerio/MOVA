# Architecture

```
DATA INGESTION      src/data/raw            texto literal das fontes
      ↓
NORMALIZATION       src/normalization       faixas, unidades, janelas, intervalos, datas, tipo de dia
      ↓
DATA QUALITY        src/quality             registra VALIDO/AUSENTE/INVALIDO/INCOMPLETO/SUSPEITO; não corrige
      ↓
TRAFFIC ENGINE      src/engine              agregação horária, picos, madrugada, fluxo equivalente,
                                            intervalos, comparabilidade, saturação, classificação
      ↓
METHODOLOGY ENGINE  src/methodology         catálogo versionado + configuração da condição (vazia)
      ↓
ANALYTICS           src/analytics           indicadores com trilha de 7 passos
      ↓
REPOSITORY          src/repository          interface (memória hoje → PostgreSQL: db/schema.sql)
      ↓
API                 src/app/api             REST
      ↓
DASHBOARD           src/app, src/components Next.js (App Router), SVG próprio, responsivo, tema claro/escuro

CAMERA (teste) → src/adapters/camera.ts (zod) → TrafficObservation → TRAFFIC ENGINE
SIMULAÇÃO      → src/simulation               → TrafficObservation → TRAFFIC ENGINE
```

**Contrato central:** o motor recebe apenas `TrafficObservation`. Histórico, simulação e câmera entram pelo mesmo tipo, então trocar a fonte não exige reescrever os cálculos.

**Visão computacional × motor:** o adaptador responde "o que foi observado" (contagem, velocidade, fila). O motor calcula (fluxo equivalente) e a metodologia interpreta (condição). A resposta da API mantém essas três camadas separadas.

## API

| Método | Rota | Retorno |
|---|---|---|
| GET | /api/corridors | hierarquia Corredor → Local → Segmento |
| GET | /api/corridors/:id | um corredor |
| GET | /api/segments/:id | medidas, séries (observações + agregação horária) e indicadores |
| GET | /api/indicators?segmentId= | indicadores |
| GET | /api/indicators/:id | indicador + metodologia |
| GET | /api/methodology | catálogo + configuração da condição |
| GET | /api/quality | registros de qualidade |
| GET | /api/simulation?segmentId&scenario&dayType&seed | simulação marcada como SIMULACAO |
| POST | /api/camera/observations | valida e processa nas camadas observado → calculado → interpretado; não persiste |
