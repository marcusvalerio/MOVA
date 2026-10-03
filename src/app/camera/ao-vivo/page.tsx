import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { MethodBadge } from "@/components/badges";
import { LiveCounter } from "@/components/live/LiveCounter";
import { getMethodology } from "@/methodology/registry";

export const metadata = { title: "Contador ao vivo — MOVA" };

export default function LiveCounterPage() {
  const ids = ["M-CV-CONTAGEM", "M-FLUXO-EQUIVALENTE", "M-CV-CONFERENCIA"] as const;
  return (
    <>
      <Topbar title="Contador ao vivo" sub="Aba compartilhada ou arquivo → YOLO no seu computador → contagem por linha virtual → veíc/h" source="CAMERA_TESTE" />
      <div className="content" style={{ maxWidth: 1300 }}>
        <div className="banner">
          <strong>Câmera de teste / validação, não é dado oficial.</strong> A imagem é processada <strong>no seu navegador</strong> e nada é gravado nem enviado.
          Não é integração com o CIVITAS. Uma câmera de terceiros (ex.: transmissão pública no YouTube) só deve ser usada de forma contínua com autorização do responsável.
          Funciona no <strong>computador</strong> (Chrome ou Edge). No celular, o navegador não permite compartilhar outra aba; lá, grave o vídeo e use “Abrir arquivo de vídeo”.
        </div>
        <LiveCounter />
        <div className="grid-2">
          <section className="panel">
            <h2>Como a contagem é feita</h2>
            <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li><strong>Detecção:</strong> YOLO11n (COCO; carro, moto, ônibus e caminhão), conf ≥ 0,25, 640 px. Com a opção marcada, o modelo recebe só a região em volta das linhas, o que aumenta o tamanho aparente dos veículos.</li>
              <li><strong>Rastreamento:</strong> associa cada detecção ao veículo do quadro anterior, pela sobreposição com a posição prevista ou pela distância.</li>
              <li><strong>Contagem:</strong> conta 1 quando o centro do veículo atravessa a linha. Cada veículo conta no máximo uma vez por linha, e o sentido vem do lado de onde ele chegou.</li>
              <li><strong>Agregação:</strong> soma os cruzamentos por intervalo de 1 ou 5 min, por linha e sentido. O fluxo equivalente é q = n · 60 / Δt. Um intervalo com mais de 2 s sem análise é <em>incompleto</em> e não gera fluxo.</li>
              <li><strong>Interpretação:</strong> nenhuma. A condição da via continua não classificada, porque os limites dependem de validação.</li>
            </ol>
            <div className="row" style={{ marginTop: 8 }}>
              {ids.map((id) => <span key={id} className="row"><Link className="link small" href={`/metodologia#${id}`}>{id}</Link> <MethodBadge status={getMethodology(id).status} /></span>)}
            </div>
          </section>
          <section className="panel">
            <h2>Limitações conhecidas</h2>
            <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
              <li><strong>Precisão ainda não medida:</strong> use “Conferir” por alguns minutos antes de confiar nos números.</li>
              <li><strong>Veículos pequenos ao fundo</strong> da imagem não são detectados. Ponha as linhas onde os veículos aparecem grandes.</li>
              <li><strong>À noite</strong>, o modelo vê faróis, não carros, e a precisão cai. Faça uma conferência separada.</li>
              <li><strong>Poucos quadros por segundo</strong> (computador lento ou aba oculta) fazem o sistema perder veículos. O painel mostra a taxa e marca as lacunas.</li>
              <li><strong>Atraso do YouTube:</strong> a transmissão chega com alguns segundos de atraso. A hora registrada é a do computador; compare com o relógio que aparece na imagem.</li>
              <li><strong>Classes:</strong> são as do COCO, não uma taxonomia validada. Vans e utilitários podem sair como carro ou caminhão.</li>
              <li><strong>Velocidade e fila</strong> não são estimadas, porque exigem calibração métrica da cena.</li>
            </ul>
            <p className="small muted">Modelo: Ultralytics YOLO11n (AGPL-3.0), exportado para ONNX. Runtime: onnxruntime-web (MIT).</p>
          </section>
        </div>
      </div>
    </>
  );
}
