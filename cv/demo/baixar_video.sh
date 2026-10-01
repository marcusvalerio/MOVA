#!/usr/bin/env sh
# Baixa o vídeo de demonstração (CC BY-SA 3.0, Deror_avi, Wikimedia Commons).
set -e
cd "$(dirname "$0")"
curl -fL -A "MOVA-demo/0.1 (academic; https://github.com/marcusvalerio/MOVA)" -o ayalon.ogv \
  "https://upload.wikimedia.org/wikipedia/commons/f/f9/Ayalon_Freeway_Azriely_Towers_View_P1150161.ogv"
