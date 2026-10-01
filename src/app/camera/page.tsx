import { Topbar } from "@/components/Topbar";
import { CAMERA_REGISTRY, CAMERA_STATUS } from "@/adapters/camera";

const FIELDS: [string, string, string][] = [
  ["cameraId", "string", "Identificador da câmera"],
  ["timestamp", "ISO 8601", "Início do intervalo agregado"],
  ["intervalSeconds", "int (1–3600)", "Duração do intervalo"],
  ["vehicleCount", "int ≥ 0", "Veículos detectados/rastreados no intervalo"],
  ["vehicleTypes", "{tipo: int}", "Contagem por classe (opcional)"],
  ["averageSpeed", "km/h | null", "Velocidade média estimada (opcional)"],
  ["queueLength", "m | null", "Comprimento de fila (opcional)"],
  ["direction", "string", "Sentido — associado a uma aproximação"],
  ["occupancy", "0–1 | null", "Ocupação (opcional)"],
  ["confidence", "0–1", "Confiança do detector"],
  ["source", "string", "Origem (ex.: CIVITAS, YOLO local)"],
];

export default function CameraPage() {
  return (
    <>
      <Topbar title="Câmera / Computer Vision" sub="Interface de entrada preparada — sem integração ativa" source="CAMERA" />
      <div className="content" style={{ maxWidth: 1000 }}>
        <div className="banner"><strong>{CAMERA_STATUS.message}</strong> Câmeras cadastradas: {CAMERA_REGISTRY.length}. Nenhum dado de câmera é exibido no sistema.</div>
        <section className="panel">
          <h2>Pipeline previsto</h2>
          <p className="mono small" style={{ lineHeight: 2 }}>CÂMERA → COMPUTER VISION → VEÍCULOS DETECTADOS → TRACKING → CameraObservation → TrafficObservation → TRAFFIC ENGINE → INDICADORES → PAINEL</p>
          <p className="small muted">O motor de engenharia recebe <code>TrafficObservation</code> — o mesmo tipo usado pela simulação. Trocar a fonte não exige reescrever cálculos.</p>
        </section>
        <section className="panel">
          <h2>Contrato CameraObservation</h2>
          <table><thead><tr><th>Campo</th><th>Tipo</th><th>Descrição</th></tr></thead>
            <tbody>{FIELDS.map(([f, t, d]) => <tr key={f}><td className="mono small">{f}</td><td className="mono small muted">{t}</td><td>{d}</td></tr>)}</tbody></table>
        </section>
        <section className="panel">
          <h2>Endpoint de validação</h2>
          <p className="mono small">POST /api/camera/observations</p>
          <p className="small">Valida o payload e mostra a conversão para TrafficObservation. Não persiste nada enquanto não houver câmera cadastrada.</p>
          <h2 style={{ marginTop: 12 }}>Pendências</h2>
          <ul className="small">
            <li>Limite mínimo de confiança: PENDENTE DE VALIDAÇÃO (não definido nos documentos).</li>
            <li>Associação câmera → aproximação: aguardando lista de câmeras/pontos.</li>
            <li>Classes de veículo: a fonte cita ônibus/articulados (BRT) e tráfego misto, sem taxonomia.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
