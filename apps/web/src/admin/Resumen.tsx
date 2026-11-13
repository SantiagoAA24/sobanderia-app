import { useLocation, useNavigate } from "react-router-dom";

import { useSesion } from "../api/sesion";
import { Cargable } from "../cliente/Disposicion";
import { OptionRow, StatusNote, SummaryCard } from "../componentes/ui";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { useAhora } from "../panel/ahora";
import { citasTexto, inicialDe, textoHora } from "../panel/formato";
import { useResumen, type ResumenAdmin } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

/** Pantalla `Admin-Hoy` del lienzo: total del día y resumen por sobandero. */
export function Resumen() {
  const ahora = useAhora();
  const hoy = diaBogota(ahora);
  const nombre = useSesion().data?.nombre ?? "";
  const consulta = useResumen(hoy);
  // Lo deja la pantalla que acaba de guardar algo (por ejemplo, Datos del negocio).
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  return (
    <PantallaAdmin nav="today" encabezado={{ fecha: fechaLarga(hoy), titulo: "Resumen del día", inicial: inicialDe(nombre) }}>
      {aviso ? <StatusNote icon="check">{aviso}</StatusNote> : null}
      <Cargable consulta={consulta} texto="Buscando el resumen…">
        {(r) => <ContenidoResumen resumen={r} />}
      </Cargable>
    </PantallaAdmin>
  );
}

function ContenidoResumen({ resumen }: { resumen: ResumenAdmin }) {
  const navigate = useNavigate();
  const atendiendo = resumen.sobanderos_atendiendo;
  return (
    <>
      <SummaryCard
        label="Resumen"
        items={[
          { icon: "calendar-check", text: `${citasTexto(resumen.citas_total)} hoy en total` },
          { icon: "users", text: atendiendo === 1 ? "1 sobandero atendiendo" : `${atendiendo} sobanderos atendiendo` },
        ]}
      />
      <section className="sb-pn__seccion" aria-label="Por sobandero">
        <h2 className="section-title">Por sobandero</h2>
        <ul className="sb-pn__lista">
          {resumen.por_sobandero.map((s) => (
            <li key={s.id}>
              <OptionRow
                title={s.nombre}
                caption={s.citas === 0 ? "Sin citas hoy" : `${citasTexto(s.citas)} hoy${s.siguiente ? ` · Siguiente ${textoHora(s.siguiente)}` : ""}`}
                initial={inicialDe(s.nombre)}
                onClick={() => navigate(`/admin/sobanderos/${s.id}`)}
              />
            </li>
          ))}
        </ul>
      </section>
      <OptionRow title="Datos del negocio" caption="Teléfono, dirección y mensaje de bienvenida" icon="users" onClick={() => navigate("/admin/negocio")} />
      <OptionRow title="Registro de actividad" caption="Quién cambió qué y cuándo" icon="clock" onClick={() => navigate("/admin/actividad")} />
    </>
  );
}
