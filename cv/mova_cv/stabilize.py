"""Estabilização por homografia: alinha cada quadro ao quadro de referência (ORB + RANSAC).

As linhas de contagem são definidas nas coordenadas do quadro de referência. Os centroides
detectados em cada quadro são projetados para essas coordenadas antes do teste de cruzamento.
Quando o alinhamento se perde (poucos inliers ou escala anômala), a contagem é interrompida:
a cena mudou e as linhas deixam de representar a mesma seção da via.
"""
from __future__ import annotations

import cv2
import numpy as np


class Stabilizer:
    def __init__(self, ref_frame, n_features: int = 4000, min_inliers: int = 300, max_scale_dev: float = 0.05):
        self.orb = cv2.ORB_create(n_features)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        g = cv2.cvtColor(ref_frame, cv2.COLOR_BGR2GRAY)
        self.k0, self.d0 = self.orb.detectAndCompute(g, None)
        self.min_inliers = min_inliers
        self.max_scale_dev = max_scale_dev

    def homography(self, frame):
        """Retorna (H quadro→referência, inliers, ok)."""
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        k, d = self.orb.detectAndCompute(g, None)
        if d is None or len(k) < 10:
            return None, 0, False
        m = sorted(self.bf.match(self.d0, d), key=lambda x: x.distance)[:800]
        if len(m) < 10:
            return None, 0, False
        src = np.float32([k[x.trainIdx].pt for x in m])
        dst = np.float32([self.k0[x.queryIdx].pt for x in m])
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
        if H is None:
            return None, 0, False
        inl = int(mask.sum())
        scale = float(np.sqrt(abs(np.linalg.det(H[:2, :2]))))
        ok = inl >= self.min_inliers and abs(scale - 1) <= self.max_scale_dev
        return H, inl, ok


def project(H, pt):
    p = cv2.perspectiveTransform(np.float32([[pt]]), H)[0][0]
    return float(p[0]), float(p[1])
