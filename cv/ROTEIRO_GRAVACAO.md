# Roteiro de gravação — Av. das Américas

O objetivo é comparar a contagem da câmera (YOLO) com o radar do mesmo ponto, que aparece nos relatórios.

## Onde gravar

- **Local do radar:** Av. das Américas, próximo ao nº 2000, na **Barra da Tijuca** (referência: Colégio Anglo Americano).
  - "Santa Cruz" é o **sentido** do tráfego, não o bairro onde gravar.
  - Coordenadas do relatório: 23°0'2"S, 43°20'3"O (pista central) e 23°0'1"S, 43°20'4"O (pista lateral).
- **Pista:** escolha uma (central ou lateral) e anote qual foi. No relatório elas são séries separadas.
- **Posição:** de preferência do alto (passarela ou viaduto), olhando ao longo da via, com todas as faixas daquela pista visíveis.

## Como gravar

1. **Celular parado** num tripé ou apoiado. Sem zoom e sem mexer durante a gravação.
2. **Duração:** pelo menos 10 minutos. O ideal são 15 minutos, cobrindo três intervalos de 5 minutos.
3. **Horário:**
   - um dia útil no pico da tarde (17h–19h), para comparar com o pico do estudo;
   - de preferência, também um trecho fora do pico.
4. **Resolução:** 1080p, 30 fps.

## O que anotar

- Data e **hora exata do início** (o vídeo vira `timestamp`; sem ela, o tipo de dia fica desconhecido).
- Sentido e pista gravados.
- Coordenada do ponto de gravação (pelo GPS do celular).
- **Uma distância conhecida na via** para calibrar a velocidade. Por exemplo, o comprimento de uma faixa tracejada mais o espaço até a próxima. Se possível, meça; se não, anote qual marcação aparece no vídeo.
- Observações: chuva, acidente, obra, semáforo visível.

## Depois

Me mande o vídeo e as anotações. Eu:

1. ajusto as linhas de contagem para a cena;
2. desligo a estabilização (câmera parada);
3. gero uma `CameraObservation` a cada 5 minutos;
4. comparo a contagem com o radar no mesmo horário e tipo de dia (perfil médio de março de 2023).

Uma contagem manual de 5 minutos, feita por uma pessoa assistindo ao vídeo, permite medir a precisão do YOLO.
