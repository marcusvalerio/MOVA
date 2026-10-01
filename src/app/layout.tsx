import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOVA — Inteligência de Tráfego",
  description: "Protótipo de plataforma de monitoramento e inteligência de tráfego com metodologia rastreável.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <span className="brand-mark" aria-hidden />
              <div>
                MOVA<small>Inteligência de tráfego</small>
              </div>
            </div>
            <nav className="nav">
              <Link href="/">Painel</Link>
              <Link href="/corredores">Corredores</Link>
              <Link href="/metodologia">Metodologia</Link>
              <Link href="/qualidade">Qualidade de dados</Link>
              <Link href="/fontes">Fontes</Link>
              <div className="nav-sep" />
              <Link href="/simulacao">Simulação</Link>
              <Link href="/camera">Câmera de teste</Link>
            </nav>
            <div className="side-foot">MVP 0.2 · fontes: UFRJ (trechos), Parâmetros</div>
          </aside>
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
