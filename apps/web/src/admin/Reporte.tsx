import { useNavigate } from "react-router-dom";

import { Cargable } from "../cliente/Disposicion";
import { BackHeader, OptionRow, SummaryCard } from "../componentes/ui";
import { inicialDe, rangoSemana } from "../panel/formato";
import { useReporte, type ReporteSemanal } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

const atendidas = (n: number) => (n === 1 ? "1 cita atendida" : `${n} citas atendidas`);
const noAsistieron = (n: number) => (n === 1 ? "1 no asistió" : `${n} no asistieron`);
const canceladas = (n: number) => (n === 1 ? "1 cancelada" : `${n} canceladas`);

/** Pantalla `Admin-Reporte` del lienzo: atendidas, no asistidas y canceladas, en total y por sobandero. */
export function Reporte() {
  const navigate = useNavigate();
  const consulta = useReporte();
  return (
    <PantallaAdmin cabecera={<BackHeader onBack={() => navigate("/admin/hoy")} />}>
      <h1 className="display-lg">Resumen semanal</h1>
      <Cargable consulta={consulta} texto="Buscando el resumen de la semana…">
        {(r) => <Contenido reporte={r} />}
      </Cargable>
    </PantallaAdmin>
  );
}

function Contenido({ reporte: r }: { reporte: ReporteSemanal }) {
  return (
    <>
      <p className="body-lg sb-muted">{rangoSemana(r.desde, r.hasta)}</p>
      <SummaryCard
        label="Total de la semana"
        items={[
          { icon: "check", text: atendidas(r.atendidas) },
          { icon: "x", text: noAsistieron(r.no_asistieron) },
          { icon: "calendar-week", text: canceladas(r.canceladas) },
        ]}
      />
      <section className="sb-pn__seccion" aria-label="Por sobandero">
        <h2 className="section-title">Por sobandero</h2>
        <ul className="sb-pn__lista">
          {r.por_sobandero.map((s) => (
            <li key={s.id}>
              <OptionRow
                title={s.nombre}
                caption={`${s.atendidas === 1 ? "1 atendida" : `${s.atendidas} atendidas`} · ${noAsistieron(s.no_asistieron)}`}
                initial={inicialDe(s.nombre)}
                trailing="none"
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
