import { Link } from "react-router-dom";

import { AppointmentRow } from "../componentes/ui";
import { llamar } from "../lib/contacto";
import { horaParaMostrar } from "../lib/fechas";
import type { CitaPanel } from "./consultas";
import { minutosEntre } from "./formato";

/** Fila de una cita: toda la fila abre su detalle, salvo el botón de llamar. */
export function FilaCita({ cita }: { cita: CitaPanel }) {
  const { hora, meridiem } = horaParaMostrar(cita.inicio);
  return (
    <div className="sb-pn__fila-cita">
      <AppointmentRow
        time={hora}
        meridiem={meridiem}
        name={cita.cliente.nombre}
        duration={`${minutosEntre(cita.inicio, cita.fin)} min`}
        onCall={() => llamar(cita.cliente.celular)}
      />
      <Link to={`/panel/citas/${cita.id}`} className="sb-pn__fila-enlace" aria-label={`Ver la cita de ${cita.cliente.nombre}, ${hora} ${meridiem}`} />
    </div>
  );
}
