import Link from "next/link";
import { repo } from "@/repository";
import { Topbar } from "@/components/Topbar";
import { MethodBadge } from "@/components/badges";
import { getMethodology } from "@/methodology/registry";
import { RAW_SECTION2 } from "@/data/raw/parametros-matriz";

const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const br = (d: string) => d.split("-").reverse().join("/");
const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;

function Formula({ id, title, expr, plain, example }: { id: string; title: string; expr: string; plain: string; example?: string }) {
  const m = getMethodology(id);
  return (
    <div className="howto-formula">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3>{title}</h3>
        <MethodBadge status={m.status} />
      </div>
      <code className="howto-expr">{expr}</code>
      <p className="small">{plain}</p>
      {example && <p className="small muted">Exemplo: {example}</p>}
      <p className="small muted">
        De onde vem: {m.sources.length ? m.sources.map((s) => s.section).join("; ") : "escolha do sistema"} · <Link className="link" href={`/metodologia#${m.id}`}>detalhes</Link>
      </p>
    </div>
  );
}

export default function HowItWorks() {
  const r = repo();
  const segId = "av-americas--2000--santa-cruz--pista-central";
  const ps = r.periods(segId).find((p) => p.period === "2023-03")!;
  const exDay = ps.completeWeekdays[0];
  const row07 = exDay.hourly[7].flow as number;
  const lat = r.periods("av-americas--2000--santa-cruz--pista-lateral").find((p) => p.period === "2019-03")!;

  return (
    <>
      <Topbar title="Como funciona" sub="Dos documentos do estudo aos números e cores do painel" />
      <div className="content howto" style={{ maxWidth: 1100 }}>
        <section className="panel">
          <h2>1. De onde vêm os dados</h2>
          <div className="howto-docs">
            <div>
              <span className="howto-tag">Dado principal</span>
              <h3>Relatório de fluxo (radares)</h3>
              <p className="small">Quantos veículos passaram em cada hora, em cada dia do mês, em cada sentido e pista. 199 páginas, {fmt(r.series().length)} dias.</p>
            </div>
            <div>
              <span className="howto-tag">Dado principal</span>
              <h3>Relatório de velocidade</h3>
              <p className="small">A velocidade média em cada hora e o 85º percentil de cada dia, nos mesmos pontos.</p>
            </div>
            <div>
              <span className="howto-tag">Referência</span>
              <h3>Parâmetros do Fluxo de Tráfego</h3>
              <p className="small">Síntese do estudo: horários de pico, variação semanal, comportamento de cada corredor. Usada para comparar e interpretar — não como fonte de números.</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>2. Do relatório ao número — um exemplo real</h2>
          <p className="small muted">Av. das Américas, próximo ao nº 2000 · sentido Santa Cruz · pista central · março de 2023</p>
          <ol className="howto-steps">
            <li>
              <span>Dado observado</span>
              <strong>{fmt(row07)} veículos</strong>
              <p className="small">passaram entre 07h e 08h de {br(exDay.series.date as string)}. Está impresso no relatório ({exDay.series.sourceRef?.locator?.split(" · ")[0]}).</p>
            </li>
            <li>
              <span>Total do dia</span>
              <strong>{fmt(exDay.total as number)} veículos</strong>
              <p className="small">soma das 24 horas. Confere com o total impresso no próprio relatório.</p>
            </li>
            <li>
              <span>Média dos dias úteis (VDM)</span>
              <strong>{fmt(Math.round(ps.vdm!.mean))} veíc/dia</strong>
              <p className="small">média de {ps.vdm!.n} dias úteis completos. Ficaram de fora dias com hora em branco ou zerada e feriados.</p>
            </li>
            <li>
              <span>Comparação com o estudo</span>
              <strong>{ps.weekendDrop != null ? `queda de ${pct(ps.weekendDrop)} no fim de semana` : "—"}</strong>
              <p className="small">o estudo diz que a queda nos fins de semana fica entre 25% e 50%. O sistema mostra se o dado confirma ou não.</p>
            </li>
          </ol>
          <p className="small">Em qualquer tela, clique num indicador para ver esse caminho completo: dado de entrada, fórmula, cálculo e interpretação.</p>
        </section>

        <section className="panel">
          <h2>3. As fórmulas</h2>
          <p className="small muted">Os documentos não trazem fórmulas matemáticas. Cada fórmula abaixo indica se está explícita na fonte (confirmado), se foi deduzida (inferência) ou se é escolha do sistema (experimental).</p>
          <div className="howto-formulas">
            <Formula id="M-FLUXO-HORARIO" title="Fluxo horário" expr="q = veículos contados em 1 hora" plain="Os relatórios já trazem a contagem hora a hora. Quando a contagem vem em intervalos menores (câmera), soma-se a hora." example={`${fmt(row07)} veíc/h às 07h de ${br(exDay.series.date as string)}.`} />
            <Formula id="M-VDM" title="Volume Diário Médio (VDM)" expr="VDM = (soma dos totais dos dias úteis) ÷ (número de dias úteis)" plain="Caracteriza o volume típico de um dia útil no trecho." example={`${fmt(Math.round(ps.vdm!.mean))} veíc/dia em ${ps.vdm!.n} dias.`} />
            <Formula id="M-QUEDA-FDS" title="Queda no fim de semana" expr="queda = 1 − (média do fim de semana ÷ VDM)" plain={`Testa a observação do estudo: "${RAW_SECTION2.variacaoSemanal.split(". ").pop()}"`} example={ps.weekendDrop != null ? `${pct(ps.weekendDrop)} neste trecho.` : undefined} />
            <Formula id="M-PICO" title="Hora de pico" expr="pico = hora com o maior fluxo do dia" plain="O estudo indica picos às 07–09h e 17–19h em dias úteis. O sistema mostra quando o dado confirma ou contradiz isso." example={ps.typicalPeakHour ? `${String(ps.typicalPeakHour.hour).padStart(2, "0")}h foi o pico em ${ps.typicalPeakHour.count} de ${ps.typicalPeakHour.n} dias úteis.` : undefined} />
            <Formula id="M-VELOCIDADE-MEDIA" title="Velocidade média" expr="v̄ = Σ (fluxo × velocidade) ÷ Σ fluxo" plain="Junta as velocidades médias de cada hora, dando mais peso às horas com mais veículos." example={ps.speedWeekday != null ? `${fmt(ps.speedWeekday, 1)} km/h em dias úteis.` : undefined} />
            <Formula id="M-FLUXO-EQUIVALENTE" title="Fluxo equivalente (câmera)" expr="q = veículos contados × 60 ÷ minutos do intervalo" plain="Transforma a contagem de poucos minutos de uma câmera em veículos por hora." example="127 veículos em 5 min → 1.524 veíc/h (exemplo da especificação)." />
            <Formula id="M-INTENSIDADE-RELATIVA" title="Barras do painel" expr="intensidade = fluxo da hora ÷ maior fluxo já registrado no trecho" plain="Mostra se o movimento está alto ou baixo para aquele local. É uma régua dos próprios dados, não um limite de congestionamento." />
          </div>
        </section>

        <section className="panel">
          <h2>4. Observado, calculado, interpretado</h2>
          <div className="howto-docs">
            <div><span className="howto-tag">Observado</span><h3>O que foi medido</h3><p className="small">Contagens e velocidades do radar ou da câmera. O sistema não altera esses valores.</p></div>
            <div><span className="howto-tag">Calculado</span><h3>O que o sistema conta</h3><p className="small">Totais, médias, horários de pico e fluxo equivalente, sempre com a fórmula e os dados de entrada à mostra.</p></div>
            <div><span className="howto-tag">Interpretado</span><h3>O que isso significa</h3><p className="small">Condição operacional (normal → congestionado). <strong>Aguarda o professor</strong>: os documentos não definem os limites.</p></div>
          </div>
        </section>

        <section className="panel">
          <h2>5. O que os dados revelaram</h2>
          <ul className="small howto-list">
            <li>O pico típico da pista central do Américas 2000 (sentido Santa Cruz) é às {ps.typicalPeakHour ? `${String(ps.typicalPeakHour.hour).padStart(2, "0")}h` : "—"} em março de 2023, fora das janelas de pico citadas no estudo.</li>
            <li>A madrugada fica acima de 5% do pico na maioria dos trechos, ao contrário do que diz o estudo (&ldquo;geralmente abaixo de 5%&rdquo;).</li>
            <li>Em março de 2019 o Carnaval derruba o volume: dias de Carnaval e feriados ficam fora das médias de dias úteis.</li>
            <li>No Américas 2000, pista lateral, o VDM de março de 2019 foi {lat.vdm ? fmt(Math.round(lat.vdm.mean)) : "—"} veíc/dia — compatível com a faixa da matriz do estudo (~22.000–32.000).</li>
          </ul>
        </section>

        <section className="panel">
          <h2>6. O que ainda depende do professor</h2>
          <ul className="small howto-list">
            <li>Os <strong>limites</strong> entre normal, atenção, crítico e congestionado, e qual indicador usar (fluxo, velocidade, fluxo ÷ capacidade…).</li>
            <li>A <strong>capacidade</strong> de cada via e o critério de <strong>nível de serviço</strong> citado no estudo (E/F na Linha Vermelha).</li>
            <li>Se o procedimento do VDM e da velocidade média adotado aqui corresponde ao usado no estudo.</li>
          </ul>
          <p className="small"><Link className="link" href="/metodologia">Catálogo completo de metodologia</Link> · <Link className="link" href="/qualidade">Qualidade dos dados</Link> · <Link className="link" href="/fontes">Fontes</Link></p>
        </section>

        <section className="panel">
          <h2>7. E a câmera?</h2>
          <ol className="howto-steps">
            <li><span>Câmera</span><strong>Vídeo da via</strong><p className="small">Câmera fixa sobre o trecho.</p></li>
            <li><span>YOLO</span><strong>Detecta veículos</strong><p className="small">Cada carro, ônibus, moto ou caminhão vira uma caixa na imagem.</p></li>
            <li><span>Rastreamento</span><strong>Conta quem cruza</strong><p className="small">Cada veículo é seguido e contado uma vez ao cruzar a linha virtual.</p></li>
            <li><span>MOVA</span><strong>Calcula e mostra</strong><p className="small">A contagem entra nas mesmas fórmulas usadas para os radares.</p></li>
          </ol>
          <p className="small"><Link className="link" href="/camera/demo">Ver a demonstração com vídeo real →</Link></p>
        </section>
      </div>
    </>
  );
}
