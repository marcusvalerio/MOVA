# MOVA — Plataforma de Inteligência de Tráfego

*Inteligência para compreender o movimento urbano.*

MVP acadêmico construído a partir dos materiais de um professor de Mestrado em Engenharia de Transportes. O MOVA é uma **caixa-preta aberta**: qualquer número exibido pode ser clicado para mostrar a fonte, os dados de entrada, a fórmula (ou a falta dela), o cálculo intermediário, a interpretação e o status metodológico.

Prioridade do projeto: **correção → rastreabilidade → metodologia → dados → visualização → design**.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/INVENTARIO.md](docs/INVENTARIO.md) | Etapas 1–4: dados, indicadores, fórmulas, regras, interpretações; o que está confirmado e o que não está |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Fontes e cadeia de proveniência |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | Todos os campos |
| [docs/METHODOLOGY_CATALOG.md](docs/METHODOLOGY_CATALOG.md) | Catálogo de regras e fórmulas (gerado do código) |
| [docs/INDICATOR_CATALOG.md](docs/INDICATOR_CATALOG.md) | Indicadores |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Hipóteses do sistema |
| [docs/PENDING_VALIDATION.md](docs/PENDING_VALIDATION.md) | O que precisa ser validado com o professor |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Camadas e API |
| [db/schema.sql](db/schema.sql) | Esquema PostgreSQL |

## Princípios

- **Nenhuma fórmula, limite ou classificação é inventada.** As fontes não têm fórmulas explícitas. Cada cálculo traz o status CONFIRMADO, INFERIDO, EXPERIMENTAL ou PENDENTE.
- **Observado, calculado e interpretado ficam sempre separados.**
- **Dados ausentes ficam visíveis.** Nada é preenchido, interpolado ou corrigido em silêncio.
- **Datas desconhecidas não são inventadas**, e só se comparam períodos compatíveis (mesmo segmento e mesmo tipo de dia); o resto aparece com aviso.
- **Fontes separadas e identificadas:** HISTÓRICO, SIMULAÇÃO e CÂMERA DE TESTE. Não há integração com CIVITAS.

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest
npm run typecheck
npm run docs         # regenera docs/METHODOLOGY_CATALOG.md
npm run build
```
