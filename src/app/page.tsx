import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { Replay } from "@/components/replay/Replay";
import { replaySegments } from "@/components/replay/data";
import { alternationRun } from "@/quality/rules";

export default function Home() {
  const r = repo();
  const segments = replaySegments(r);
  const initial = segments.find((s) => s.id === "av-americas--2000--santa-cruz--pista-central") ?? segments[0];
  // Abre num dia útil completo sem alerta de padrão alternado (ver qualidade de dados).
  const initialDay = initial.days.find((d) => d.complete && d.dayType === "DIA_UTIL" && !alternationRun(d.flow)) ?? initial.days.find((d) => d.complete) ?? initial.days[0];
  return (
    <>
      <Topbar title="Painel" sub="Reprodução de dias reais registrados pelos radares · fluxo e velocidade hora a hora" source="HISTORICO" />
      <div className="content">
        <section className="panel">
          <Replay segments={segments} initialSegment={initial.id} initialDate={initialDay.date} />
        </section>
        <div className="next-steps">
          <Link href="/como-funciona" className="panel next">
            <h3>Como funciona</h3>
            <p className="small">Dos documentos aos números: o que cada fonte traz, quais fórmulas são usadas e o que ainda depende do professor.</p>
          </Link>
          <Link href="/dados" className="panel next">
            <h3>Dados dos corredores</h3>
            <p className="small">{segments.length} trechos monitorados, VDM, horário de pico e velocidade por mês, com rastreio de cada número.</p>
          </Link>
          <Link href="/camera/demo" className="panel next">
            <h3>Câmera + YOLO</h3>
            <p className="small">Demonstração com vídeo real: detecção, rastreamento e contagem de veículos alimentando o motor do MOVA.</p>
          </Link>
        </div>
      </div>
    </>
  );
}
