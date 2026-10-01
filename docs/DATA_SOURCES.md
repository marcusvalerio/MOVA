# Data Sources

| ID | Documento | Tipo | No repositório | Uso no sistema |
|---|---|---|---|---|
| DOC-FLUXOS-UFRJ | Fluxos UFRJ-Revisado (1).pdf | Primária | **Não** (arquivo grande) | Origem das séries horárias. Apenas 2 séries chegaram, via especificação. |
| DOC-VELOCIDADES | Relatório de velocidades | Primária | **Não** | Nenhum valor. O modelo suporta velocidade média e 85º percentil. |
| DOC-PARAMETROS | `docs/fontes/PARAMETROS_DO_FLUXO_DE_TRAFEGO.docx` | Secundária (síntese) | Sim | Matriz comparativa (§1), regras e observações (§2). |
| DOC-ESPECIFICACAO | `docs/fontes/ESPECIFICACAO_MOVA_trechos.md` | Especificação | Sim | Trechos com valores transcritos do PDF de fluxos. Fonte intermediária. |

## Cadeia de proveniência

```
Fluxos UFRJ (PDF) ──transcrição pelo autor──▶ Especificação ──literal──▶ src/data/raw/ufrj-series.ts
PARAMETROS (.docx) ──literal──▶ src/data/raw/parametros-matriz.ts (+ estrutura.ts: interpretação explicada)
```

Cada observação guarda `sourceRef` (documento, seção, localizador) e `raw` (o texto original).

## Fontes do sistema

| Fonte | Significado | Exibição |
|---|---|---|
| HISTÓRICO | Dados dos documentos | selo azul "Histórico" |
| SIMULAÇÃO | Dados sintéticos | selo roxo "Simulação" e aviso fixo |
| CÂMERA DE TESTE | Entrada manual no formato de visão computacional; nenhuma câmera física | selo "Câmera de teste" |

**CIVITAS / Vision AI:** sem integração. Ela só será construída com acesso autorizado; nenhum scraping ou contorno de autenticação.

## Para incorporar o PDF de fluxos

1. Coloque o arquivo em `docs/fontes/`. Pelo GitHub web, o limite é 25 MB por arquivo; se passar disso, divida por capítulo ou mês.
2. Extraia as séries para `src/data/raw/` no formato `RawHourlySeries`, com data, intervalo e valor literal.
3. Troque `DOC-ESPECIFICACAO` por `DOC-FLUXOS-UFRJ` (com página) no `sourceRef`.
4. Confira as 2 séries já transcritas com o PDF.
