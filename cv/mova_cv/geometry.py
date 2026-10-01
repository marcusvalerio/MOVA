"""Geometria de cruzamento de linha virtual (sem dependências)."""
from __future__ import annotations


def side(p1: tuple[float, float], p2: tuple[float, float], pt: tuple[float, float]) -> float:
    """Produto vetorial (p2-p1) x (pt-p1). Sinal indica de que lado da linha o ponto está."""
    return (p2[0] - p1[0]) * (pt[1] - p1[1]) - (p2[1] - p1[1]) * (pt[0] - p1[0])


def _segments_intersect(a, b, c, d) -> bool:
    def orient(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return 0 if v == 0 else (1 if v > 0 else -1)

    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return o1 != o2 and o3 != o4


def crossing(p1, p2, prev, cur) -> int:
    """Retorna +1 ou -1 se o deslocamento prev→cur cruza o segmento p1–p2, 0 caso contrário.

    +1 = passou do lado negativo para o positivo de side(p1, p2, ·); -1 = o inverso.
    Ex.: linha horizontal da esquerda para a direita (p1.x < p2.x) em coordenadas de imagem
    (y cresce para baixo): +1 = movimento para baixo. Linha vertical de cima para baixo: +1 = para a esquerda.
    """
    if not _segments_intersect(p1, p2, prev, cur):
        return 0
    s0, s1 = side(p1, p2, prev), side(p1, p2, cur)
    if s0 < 0 <= s1:
        return 1
    if s0 > 0 >= s1:
        return -1
    return 0
