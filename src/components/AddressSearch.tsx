"use client";
import Link from "next/link";
import { useState } from "react";
import type { SearchResult, Trecho } from "@/adapters/logradouros";

interface Near {
  corridor: string;
  locationId: string;
  address: string;
  coordinates: { lat: number; lng: number; raw?: string };
  distanceM: number;
  segments: { id: string; label: string; periods: string[] }[];
}
interface Resp { result?: SearchResult; nearest?: Near[]; error?: string }

const EXAMPLES = ["Av. das Américas 2000", "Rua Jardim Botânico 746", "Av. Embaixador Abelardo Bueno 980"];
const fmtM = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const month = (p: string) => {
  const [y, m] = p.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][+m - 1]}/${y}`;
};
const rng = (r: [number, number] | null) => (r ? `${r[0]}–${r[1]}` : "—");

export function AddressSearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);

  async function run(text: string) {
    setQ(text);
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/endereco?q=${encodeURIComponent(text)}`);
      setResp(await r.json());
    } catch {
      setResp({ error: "Falha de rede ao consultar a busca." });
    } finally {
      setBusy(false);
    }
  }

  const res = resp?.result;
  return (
    <>
      <section className="panel">
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(q); }}>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>Logradouro e número
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Av. das Américas 2000" autoComplete="off" />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button>
        </form>
        <div className="row small" style={{ marginTop: 8 }}>
          <span className="muted">Exemplos:</span>
          {EXAMPLES.map((e) => <button key={e} type="button" className="ghost" onClick={() => run(e)}>{e}</button>)}
        </div>
      </section>

      {resp?.error && <div className="banner">{resp.error}</div>}
      {res?.kind === "vazio" && <div className="banner">{res.motivo}</div>}
      {res?.kind === "logradouros" && (
        <section className="panel">
          <h2>Escolha o logradouro e informe o número</h2>
          <div className="row">
            {res.logradouros.map((l) => (
              <button key={`${l.logradouro}|${l.bairro}`} type="button" className="ghost" onClick={() => setQ(`${l.logradouro} `)}>
                {l.logradouro}{l.bairro ? ` · ${l.bairro}` : ""}
              </button>
            ))}
          </div>
        </section>
      )}
      {res?.kind === "trechos" && res.aproximado && <div className="banner">{res.aproximado}</div>}
      {res?.kind === "trechos" && <Found trechos={res.trechos} nearest={resp?.nearest ?? []} number={res.parsed.number} />}
    </>
  );
}

function Found({ trechos, nearest, number }: { trechos: Trecho[]; nearest: Near[]; number: number | null }) {
  return (
    <>
      <>
        <section className="panel">
          <h2>{trechos.length > 1 ? `Trechos encontrados (${trechos.length})` : "Trecho encontrado"}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Logradouro · bairro</th><th>Hierarquia</th><th>Circulação</th><th>Vel. regulamentada</th><th>Numeração (par / ímpar)</th></tr></thead>
              <tbody>
                {trechos.map((t) => (
                  <tr key={t.codTrecho}>
                    <td>{t.logradouro}<div className="small muted">{t.bairro ?? "—"}{t.tipoTrecho && t.tipoTrecho !== "Normal" ? ` · ${t.tipoTrecho}` : ""}</div></td>
                    <td className="small">{t.hierarquia ?? "—"}</td>
                    <td className="small">{t.mao}</td>
                    <td className="num">{t.velocidadeRegulamentadaKmh != null ? `${t.velocidadeRegulamentadaKmh} km/h` : "—"}</td>
                    <td className="num">{rng(t.numeracao.par)} / {rng(t.numeracao.impar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Fonte externa: cadastro de Logradouros da Prefeitura (Data.Rio). Hierarquia viária e velocidade regulamentada são atributos cadastrais,
            não medições, e não equivalem à capacidade da via.
          </p>
        </section>
        <section className="panel">
          <h2>Mapa</h2>
          <TrechoMap trechos={trechos} nearest={nearest} />
        </section>
      </>

      <section className="panel">
        <h2>Locais do estudo mais próximos{number != null ? ` do nº ${number}` : ""}</h2>
        {nearest.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Distância</th><th>Local do estudo</th><th>Trechos com dados (sentido · pista)</th></tr></thead>
              <tbody>
                {nearest.map((n) => (
                  <tr key={n.locationId}>
                    <td className="num">{fmtM(n.distanceM)}</td>
                    <td>{n.corridor}<div className="small muted">{n.address}</div></td>
                    <td className="small">
                      {n.segments.map((s) => (
                        <div key={s.id}>
                          <Link className="link" href={`/segmentos/${encodeURIComponent(s.id)}`}>{s.label.replace(/^Sentido /, "")}</Link>
                          <span className="muted"> · {s.periods.map(month).join(", ")}</span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Nenhum local do estudo com coordenadas.</p>}
        <p className="small muted" style={{ marginTop: 8 }}>
          Distância em linha reta entre a coordenada impressa no relatório e o traçado do trecho. O sistema não decide se um radar
          &ldquo;cobre&rdquo; o endereço: os dados são históricos (relatórios de 2019–2023) e valem para o ponto do radar, no sentido indicado.
          Dados em tempo real dependem de acesso autorizado ao CIVITAS — sem integração no momento.
        </p>
      </section>
    </>
  );
}

function TrechoMap({ trechos, nearest }: { trechos: Trecho[]; nearest: Near[] }) {
  const line = trechos.flatMap((t) => t.path);
  if (!line.length) return <p className="muted">Trecho sem traçado na base.</p>;
  // Enquadramento (escolha de exibição): o trecho e os locais do estudo a até 2 km; os demais ficam só na tabela.
  const shown = nearest.filter((n) => n.distanceM <= 2000);
  const pts: [number, number][] = [...line, ...shown.map((n) => [n.coordinates.lng, n.coordinates.lat] as [number, number])];
  const W = 880, H = 340, pad = 40;
  const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  // Extensão mínima de ~500 m para o trecho não virar um ponto.
  const half = 0.0025;
  const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2;
  const [minX, maxX, minY, maxY] = [Math.min(cx - half, ...lngs), Math.max(cx + half, ...lngs), Math.min(cy - half, ...lats), Math.max(cy + half, ...lats)];
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const s = Math.min((W - 2 * pad) / Math.max((maxX - minX) * k, 1e-6), (H - 2 * pad) / Math.max(maxY - minY, 1e-6));
  const ox = (W - (maxX - minX) * k * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const P = ([lng, lat]: [number, number]) => [ox + (lng - minX) * k * s, oy + (maxY - lat) * s];
  // Barra de escala: 1 grau de latitude ≈ 111,32 km.
  const target = (W * 0.25) / s * 111320;
  const step = [50, 100, 200, 500, 1000, 2000, 5000, 10000].reduce((a, b) => (b <= target ? b : a), 50);
  const barPx = (step / 111320) * s;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Trecho encontrado e locais do estudo próximos" style={{ display: "block" }}>
        <defs><pattern id="g2" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="var(--grid)" strokeWidth="1" /></pattern></defs>
        <rect width={W} height={H} fill="url(#g2)" rx="8" />
        {trechos.map((t) => (
          <polyline key={t.codTrecho} points={t.path.map((p) => P(p).join(",")).join(" ")} fill="none" stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
            <title>{`${t.logradouro} · ${t.bairro ?? ""}`}</title>
          </polyline>
        ))}
        {shown.map((n, i) => {
          const [x, y] = P([n.coordinates.lng, n.coordinates.lat]);
          const end = x > W * 0.6;
          return (
            <g key={n.locationId}>
              <title>{`${n.corridor} · ${n.address} — ${fmtM(n.distanceM)}`}</title>
              <circle cx={x} cy={y} r={6} fill={i === 0 ? "var(--serious)" : "var(--text-3)"} stroke="var(--surface)" strokeWidth={2} />
              {i === 0 && <><text x={x + (end ? -10 : 10)} y={y - 8} textAnchor={end ? "end" : "start"} fontSize="11.5" fill="var(--text)" fontWeight={600}>{n.address}</text>
              <text x={x + (end ? -10 : 10)} y={y + 7} textAnchor={end ? "end" : "start"} fontSize="10.5" fill="var(--text-3)" fontFamily="var(--mono)">{fmtM(n.distanceM)}</text></>}
            </g>
          );
        })}
        <g transform={`translate(${pad},${H - 14})`}>
          <line x1={0} x2={barPx} y1={0} y2={0} stroke="var(--text-2)" strokeWidth={2} />
          <text x={barPx + 6} y={4} fontSize="10.5" fill="var(--text-3)" fontFamily="var(--mono)">{fmtM(step)}</text>
        </g>
      </svg>
      <figcaption className="small muted" style={{ marginTop: 6 }}>Linha azul: trecho da base de Logradouros. Ponto vermelho: local do estudo mais próximo; cinza: outros a até 2 km (passe o mouse para ver). Coordenadas dos relatórios.</figcaption>
    </figure>
  );
}
