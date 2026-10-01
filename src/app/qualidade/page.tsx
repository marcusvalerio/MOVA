import { Topbar } from "@/components/Topbar";
import { QualityBadge } from "@/components/badges";
import { repo } from "@/repository";

export default function QualityPage() {
  const issues = repo().qualityIssues();
  return (
    <>
      <Topbar title="Qualidade de dados" sub="Diagnóstico registrado — nenhum valor é corrigido automaticamente" source="HISTORICO" />
      <div className="content">
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Status</th><th>Regra</th><th>Alvo</th><th>Diagnóstico</th><th>Evidência (texto da fonte)</th></tr></thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id}>
                    <td className="num">{i.id}</td>
                    <td><QualityBadge status={i.status} /></td>
                    <td className="mono small">{i.rule}</td>
                    <td className="mono small muted" style={{ overflowWrap: "anywhere" }}>{i.target.id}</td>
                    <td>{i.message}</td>
                    <td className="small muted">{i.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
