import { Topbar } from "@/components/Topbar";
import { repo } from "@/repository";

export default function SourcesPage() {
  return (
    <>
      <Topbar title="Fontes" sub="Documentos que alimentam o sistema" />
      <div className="content">
        <section className="panel table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Documento</th><th>Tipo</th><th>No repositório</th><th>Descrição</th></tr></thead>
            <tbody>
              {repo().sources().map((d) => (
                <tr key={d.id}>
                  <td className="mono small">{d.id}</td>
                  <td>{d.title}{d.fileName && <div className="mono small muted">{d.fileName}</div>}</td>
                  <td>{d.kind === "PRIMARIA" ? "Primária" : "Secundária (síntese)"}</td>
                  <td>{d.availableInRepo ? "Sim" : <span style={{ color: "var(--serious)" }}>Não — pendente</span>}</td>
                  <td className="small">{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
