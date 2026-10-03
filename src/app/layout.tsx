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
              <Link href="/como-funciona">Como funciona</Link>
              <Link href="/endereco">Buscar endereço</Link>
              <Link href="/dados">Dados</Link>
              <Link href="/camera/ao-vivo">Contador ao vivo</Link>
              <Link href="/camera/demo">Câmera + YOLO</Link>
              <div className="nav-sep" />
              <Link href="/metodologia">Metodologia</Link>
              <Link href="/qualidade">Qualidade de dados</Link>
              <Link href="/fontes">Fontes</Link>
              <Link href="/simulacao">Simulação</Link>
              <Link href="/camera">Contrato da câmera</Link>
            </nav>
            <div className="side-foot">MVP 0.4 · radares 2019–2023</div>
          </aside>
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
