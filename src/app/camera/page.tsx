import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { CameraTester } from "@/components/CameraTester";
import { CAMERA_REGISTRY, CAMERA_STATUS } from "@/adapters/camera";

const FIELDS: [string, string, string][] = [
  ["cameraId", "string", "Identificador da câmera"],
  ["timestamp", "ISO 8601 com fuso | null", "Início do intervalo; null se a data/hora for desconhecida"],
  ["intervalSeconds", "número (0–3600]", "Duração do intervalo em segundos"],
  ["vehicleCount", "int ≥ 0", "Veículos detectados/rastreados no intervalo"],
  ["vehicleTypes", "{classe: int}", "Contagem por classe (opcional)"],
  ["averageSpeed", "km/h | null", "Velocidade média estimada (opcional)"],
  ["queueLength", "m | null", "Comprimento de fila (opcional)"],
  ["direction", "string", "Sentido — associado a um segmento"],
  ["occupancy", "0–1 | null", "Ocupação (opcional)"],
  ["confidence", "0–1", "Confiança do detector"],
  ["source", "string", "Origem (ex.: YOLO local, CIVITAS com acesso autorizado)"],
];

export default function CameraPage() {
  return (
    <>
      <Topbar title="Câmera de teste / Computer Vision" sub="Interface de entrada preparada — sem câmera física conectada" source="CAMERA_TESTE" />
      <div className="content" style={{ maxWidth: 1100 }}>
        <div className="banner"><strong>{CAMERA_STATUS.message}</strong> Câmeras cadastradas: {CAMERA_REGISTRY.length}. Nenhuma integração CIVITAS/Vision AI — só seria implementada com acesso autorizado.</div>
        <section className="panel">
          <h2>Pipeline previsto</h2>
          <p className="mono small" style={{ lineHeight: 2 }}>CÂMERA → VIDEO STREAM → COMPUTER VISION → VEÍCULOS DETECTADOS → OBJECT TRACKING → CONTAGEM · VELOCIDADE · FILA · DIREÇÃO → CameraObservation → MOVA TRAFFIC ENGINE → INDICADORES → CONDIÇÃO OPERACIONAL</p>
          <p className="small" style={{ color: "var(--text-2)" }}>A visão computacional responde <strong>&ldquo;o que está sendo observado?&rdquo;</strong>. O motor de engenharia responde <strong>&ldquo;o que esses dados significam?&rdquo;</strong>. A IA não classifica a via.</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Demonstração com vídeo real</h2><Link className="link small" href="/camera/demo">abrir demonstração →</Link></div>
          <p className="small" style={{ color: "var(--text-2)" }}>YOLO + rastreamento + contagem por linha virtual sobre um vídeo de tráfego com licença aberta, processado pelo mesmo adaptador abaixo.</p>
        </section>
        <section className="panel">
          <h2>Testar o contrato</h2>
          <CameraTester />
        </section>
        <section className="panel">
          <h2>Contrato CameraObservation</h2>
          <div className="table-wrap"><table><thead><tr><th>Campo</th><th>Tipo</th><th>Descrição</th></tr></thead>
            <tbody>{FIELDS.map(([f, t, d]) => <tr key={f}><td className="mono small">{f}</td><td className="mono small muted">{t}</td><td>{d}</td></tr>)}</tbody></table></div>
          <h2 style={{ marginTop: 16 }}>Pendente de validação</h2>
          <ul className="small">
            <li>Fluxo equivalente: inferido do exemplo &ldquo;127 veículos → 1.524 veíc/h&rdquo; (implica intervalo de 5 min).</li>
            <li>Confiança mínima do detector: não definida.</li>
            <li>Associação câmera → segmento: aguardando cadastro de câmeras.</li>
            <li>Taxonomia de classes de veículo: não definida (fonte cita ônibus/articulados no BRT).</li>
          </ul>
        </section>
      </div>
    </>
  );
}
