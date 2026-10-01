"""Testes da geometria de cruzamento (python -m unittest cv/tests_geometry.py)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mova_cv.geometry import crossing  # noqa: E402


class CrossingTest(unittest.TestCase):
    H = ((0, 10), (100, 10))  # linha horizontal, esquerda→direita
    V = ((50, 0), (50, 100))  # linha vertical, cima→baixo

    def test_horizontal_descendo_eh_positivo(self):
        self.assertEqual(crossing(*self.H, (20, 5), (20, 15)), 1)

    def test_horizontal_subindo_eh_negativo(self):
        self.assertEqual(crossing(*self.H, (20, 15), (20, 5)), -1)

    def test_fora_do_segmento_nao_conta(self):
        self.assertEqual(crossing(*self.H, (120, 5), (120, 15)), 0)

    def test_sem_cruzar_nao_conta(self):
        self.assertEqual(crossing(*self.H, (20, 2), (20, 8)), 0)

    def test_vertical_para_esquerda_eh_positivo(self):
        self.assertEqual(crossing(*self.V, (60, 50), (40, 50)), 1)

    def test_vertical_para_direita_eh_negativo(self):
        self.assertEqual(crossing(*self.V, (40, 50), (60, 50)), -1)


if __name__ == "__main__":
    unittest.main()
