import { useSesion } from "../api/sesion";
import { Cargable } from "../cliente/Disposicion";
import { EmptyState, OptionRow } from "../componentes/ui";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { useAhora } from "../panel/ahora";
import { citasTexto, inicialDe, textoHora } from "../panel/formato";
import { useAgenda, type CitaAgenda } from "./consultas";
import { PantallaAdmin } from "./Disposicion";

/** Pantalla `Admin-Agenda` del lienzo: las citas del día de todos los sobanderos. */
export function Agenda() {
  const hoy = diaBogota(useAhora());
  const nombre = useSesion().data?.nombre ?? "";
  const consulta = useAgenda(hoy);
  return (
    <PantallaAdmin nav="agenda" encabezado={{ fecha: fechaLarga(hoy), titulo: "Agenda de todos", inicial: inicialDe(nombre) }}>
      <Cargable consulta={consulta} texto="Buscando las citas…">
        {(citas) => <ListaAgenda citas={citas} />}
      </Cargable>
    </PantallaAdmin>
  );
}

function ListaAgenda({ citas }: { citas: CitaAgenda[] }) {
  if (citas.length === 0) return <EmptyState title="No hay citas hoy" text="Cuando alguien agende, la cita aparecerá aquí." />;
  const titulo = citasTexto(citas.length);
  return (
    <section className="sb-pn__seccion" aria-label={titulo}>
      <h2 className="section-title">{titulo}</h2>
      <ul className="sb-pn__lista">
        {citas.map((c) => (
          <li key={c.id}>
            <OptionRow title={`${textoHora(c.inicio)} · ${c.cliente_nombre}`} caption={`Con ${c.sobandero.nombre}`} trailing="none" />
          </li>
        ))}
      </ul>
    </section>
  );
}
