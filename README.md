# MOVA — Plataforma de monitoramento e inteligência de tráfego (MVP)

Protótipo baseado na metodologia e nos dados fornecidos (`docs/fontes`). É uma **caixa-preta aberta**: cada número exibido pode ser clicado para mostrar a fonte, a fórmula (ou a ausência dela), os dados de entrada e o status metodológico.

- **Análise da Fase 1** (inventário, lacunas, pontos a validar): [`docs/ANALISE_FASE1.md`](docs/ANALISE_FASE1.md)
- **Esquema PostgreSQL:** [`db/schema.sql`](db/schema.sql)

## Princípios

- **Nenhuma metodologia é inventada.** O documento-fonte não contém fórmulas. Todo cálculo sem definição documental aparece como `PENDENTE` ou `EXPERIMENTAL`.
- **Dados históricos são preservados literalmente.** As faixas `~mín – máx` nunca são reduzidas a um ponto.
- **Qualidade de dados registra e não corrige.**
- **Fontes separadas e identificadas:** `HISTÓRICO`, `SIMULAÇÃO` e `CÂMERA` (esta ainda não conectada).

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run typecheck
npm run build
```

## Arquitetura

```
src/data            1. dados brutos (texto literal da fonte)
src/normalization   2. normalização
src/quality         3. qualidade de dados
src/engine          4. motor de engenharia de tráfego
src/methodology     5. registro de metodologia
src/analytics       6. indicadores + rastreabilidade
src/app, components 7. apresentação (Next.js)
src/adapters        8. adaptador de visão computacional
src/repository      interface de repositório (memória → PostgreSQL)
```
