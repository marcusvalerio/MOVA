# MOVA — visão computacional (demonstração)

Pipeline: **vídeo → YOLO (Ultralytics) → ByteTrack → contagem por linha virtual → `CameraObservation` → motor MOVA**.

A visão computacional só responde **"o que foi observado?"** (contagem por linha e sentido, classe, confiança). Quem calcula é o motor do MOVA (fluxo equivalente), e quem interpretaria é a metodologia. A condição operacional continua **não classificada**, porque os limites dependem de validação com o professor.

## Vídeo de demonstração

- *Ayalon Freeway Azriely Towers View P1150161.ogv*, por **Deror_avi**, licença **CC BY-SA 3.0**: https://commons.wikimedia.org/wiki/File:Ayalon_Freeway_Azriely_Towers_View_P1150161.ogv
- Mostra Tel Aviv. **Não é uma via do Rio nem uma câmera CIVITAS.**
- A data e a hora da gravação são desconhecidas.
- O vídeo anotado (`public/cv-demo/annotated.mp4`) é obra derivada e é distribuído sob a mesma licença CC BY-SA 3.0.

**Por que só 7,5 s dos 19,5 s:**
- A câmera é de mão. A estabilização (ORB + homografia para o quadro 0) corrige o tremor.
- Aos 7,5 s a panorâmica tira uma das linhas do enquadramento. O pipeline **para automaticamente** nesse ponto, em vez de contar sobre uma cena diferente.

## Como rodar

```bash
cd cv
python3 -m venv .venv && . .venv/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision   # sem GPU
pip install -r requirements.txt
./demo/baixar_video.sh
python -m mova_cv.pipeline demo/config.json --out demo/out
python -m unittest tests_geometry.py
```

Para atualizar a página `/camera/demo`, copie `demo/out/annotated.mp4` e `annotated.webm` para `public/cv-demo/` e `run.json` e `observations.json` para `src/data/cv-demo/`. Converta `events.csv` para `events.json`.

## Configuração (`demo/config.json`)

- `lines`: segmentos P1 → P2 em pixels do quadro de referência. Cada linha declara o rótulo de cada sentido.
  - Sentido +1 = cruzou do lado negativo para o positivo do produto vetorial (P2 − P1) × (c − P1).
  - Numa linha horizontal da esquerda para a direita, +1 é descer na imagem.
- `stabilization`: liga ou desliga a estabilização e define o mínimo de pontos correspondentes. Em câmera fixa, desligue.
- `model`: pesos, resolução, confiança mínima, rastreador e classes COCO.

## Saídas

| Arquivo | Conteúdo |
|---|---|
| `events.csv` | um cruzamento por linha: rastro, classe, confiança média, quadro, tempo, linha e sentido |
| `observations.json` | uma `CameraObservation` por linha e sentido, no contrato de `src/adapters/camera.ts` |
| `run.json` | parâmetros, janela válida, motivo da parada, contagens e limitações |
| `annotated.mp4` | vídeo anotado (H.264) |

## Limitações

Também aparecem em `run.json` e na página.

- **Precisão não medida:** não há contagem manual de referência.
- **Rastreamento:** trocas de ID podem duplicar contagens, e veículos encobertos podem não ser contados.
- **Classes:** são as do COCO (carro, moto, ônibus, caminhão), com erros visíveis; por exemplo, um ônibus foi detectado como caminhão.
- **Velocidade e fila:** não são estimadas, porque exigem calibração métrica da cena.
- **Fluxo em veíc/h:** extrapolar 7,5 s para uma taxa horária tem incerteza muito alta. Serve só para demonstrar o encadeamento do motor.

## Gravação em campo

Veja [ROTEIRO_GRAVACAO.md](ROTEIRO_GRAVACAO.md).

## Próximo passo com câmera real

Com acesso autorizado a uma câmera (CIVITAS ou outra), basta trocar a fonte de vídeo por um stream e emitir uma `CameraObservation` a cada 5 minutos para `POST /api/camera/observations`. Para isso:

- desligue a estabilização (câmera fixa);
- informe o `timestamp` real;
- associe cada câmera e sentido a um segmento do MOVA (`CAMERA_REGISTRY`).
