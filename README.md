# MOVA — Plataforma de Inteligência de Tráfego

*Inteligência para compreender o movimento urbano.*

MVP acadêmico construído a partir dos materiais de um professor de Mestrado em Engenharia de Transportes. O MOVA é uma **caixa-preta aberta**: qualquer número exibido pode ser clicado para mostrar a fonte, os dados de entrada, a fórmula (ou a falta dela), o cálculo intermediário, a interpretação e o status metodológico.

Prioridade do projeto: **correção → rastreabilidade → metodologia → dados → visualização → design**.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/AVALIACAO_DOCUMENTOS.md](docs/AVALIACAO_DOCUMENTOS.md) | Avaliação dos PDFs de fluxo e velocidade e do .docx; conferência da especificação e da matriz |
| [docs/INVENTARIO.md](docs/INVENTARIO.md) | Etapas 1–4: dados, indicadores, fórmulas, regras, interpretações; o que está confirmado e o que não está |
| [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) | Fontes e cadeia de proveniência |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | Todos os campos |
| [docs/METHODOLOGY_CATALOG.md](docs/METHODOLOGY_CATALOG.md) | Catálogo de regras e fórmulas (gerado do código) |
| [docs/INDICATOR_CATALOG.md](docs/INDICATOR_CATALOG.md) | Indicadores |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Hipóteses do sistema |
| [docs/PENDING_VALIDATION.md](docs/PENDING_VALIDATION.md) | O que precisa ser validado com o professor |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Camadas e API |
| [db/schema.sql](db/schema.sql) | Esquema PostgreSQL |

## Contador ao vivo (`/camera/ao-vivo`)

Contagem por linha virtual **no navegador**, enquanto não há acesso autorizado ao CIVITAS:

1. Abra a transmissão da câmera (ex.: YouTube) em outra janela; no MOVA, clique em **Compartilhar aba**. Também aceita **arquivo de vídeo** (ex.: gravação do celular).
2. Desenhe as linhas sobre a imagem (uma por pista/sentido) e inicie.
3. YOLO11n (ONNX, `public/models/yolo11n.onnx`) + rastreador simplificado contam cada cruzamento por sentido e classe; agregação em 1 ou 5 min e q = n · 60 / Δt.
4. **Conferir:** contagem manual na mesma janela → erro do contador (M-CV-CONFERENCIA).
5. Exporta `CameraObservation` (.json), cruzamentos (.csv) e conferências (.json). Fonte: CÂMERA DE TESTE, nunca dado oficial.

Nada sai do computador. Requer computador com Chrome/Edge (WebGPU; sem ele, roda em CPU, mais lento). O runtime `onnxruntime-web` é copiado para `public/ort` por `scripts/copy-ort.mjs` antes de `dev`/`build`. Código em `src/live/` (geometria, YOLO, rastreador, contagem), testado em `tests/live-counter.test.ts`; o decodificador foi conferido contra o Ultralytics (mesmas caixas e confianças).

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

# extração das tabelas dos PDFs (requer: pip install pdfplumber)
python3 scripts/extracao/extrair_tabelas.py docs/fontes/FLUXOS_UFRJ_REVISADO.pdf FLUXOS data/extraido/fluxos.json
python3 scripts/extracao/avaliar.py
```
