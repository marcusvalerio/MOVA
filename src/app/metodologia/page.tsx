import { Topbar } from "@/components/Topbar";
import { MethodBadge } from "@/components/badges";
import { METHODOLOGY } from "@/methodology/registry";
import { SOURCE_DOCUMENTS } from "@/data/sources";

const CATS = [["DADO", "Dados"], ["INDICADOR", "Indicadores"], ["FORMULA", "Fórmulas"], ["REGRA", "Regras"], ["INTERPRETACAO", "Interpretações"], ["HIPOTESE", "Hipóteses"]] as const;

export default function MethodologyPage() {
  const docTitle = (id: string) => SOURCE_DOCUMENTS.find((d) => d.id === id)?.title ?? id;
  return (
    <>
      <Topbar title="Metodologia" sub="Como cada número é produzido · fonte, fórmula, variáveis, status" />
      <div className="content">
        <div className="banner">
          <strong>Nenhuma fonte disponível contém fórmula matemática explícita.</strong> Status: <em>Confirmado</em> = explícito na fonte · <em>Inferência</em> = implícito, dedução explicada ·
          <em> Experimental</em> = escolha do sistema · <em>Pendente</em> = pendente de validação com o professor.
        </div>
        {CATS.map(([cat, title]) => (
        <section key={cat} className="panel">
          <h2>{title}</h2>
          {METHODOLOGY.filter((m) => m.category === cat).map((m) => (
            <article key={m.id} id={m.id} className="method">
              <div>
                <div className="mono small muted">{m.id} · v{m.version}</div>
                <h3>{m.name}</h3>
                <MethodBadge status={m.status} />
              </div>
              <dl>
                <dt>O que é</dt>
                <dd>{m.description}</dd>
                <dt>Fórmula (fonte)</dt>
                <dd>{m.formula ? <code>{m.formula}</code> : <span className="muted">Não documentada na fonte.</span>}</dd>
                <dt>Implementação</dt>
                <dd>{m.implementation ? <code style={{ whiteSpace: "pre-wrap" }}>{m.implementation}</code> : <span className="muted">Não implementado.</span>}</dd>
                <dt>Variáveis</dt>
                <dd>
                  {m.variables.length ? (
                    <ul>{m.variables.map((v) => <li key={v.symbol}><code>{v.symbol}</code> — {v.meaning} [{v.unit}]</li>)}</ul>
                  ) : <span className="muted">—</span>}
                </dd>
                <dt>Unidade</dt>
                <dd>{m.unit ?? "—"}</dd>
                <dt>Por que utilizamos</dt>
                <dd>{m.purpose}</dd>
                <dt>Fonte</dt>
                <dd>
                  {m.sources.length ? <ul>{m.sources.map((s) => <li key={s.section}>{docTitle(s.documentId)} — {s.section}</li>)}</ul> : <span className="muted">Nenhuma fonte documental.</span>}
                  {m.externalSource && <div className="small" style={{ color: "var(--serious)", marginTop: 4 }}>{m.externalSource}</div>}
                </dd>
                <dt>Lacunas</dt>
                <dd>{m.gaps.length ? <ul>{m.gaps.map((g) => <li key={g}>{g}</li>)}</ul> : "—"}</dd>
              </dl>
            </article>
          ))}
        </section>
        ))}
      </div>
    </>
  );
}
