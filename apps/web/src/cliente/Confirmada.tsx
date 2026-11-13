import { useNavigate, useParams } from "react-router-dom";

import { Button, ConfirmationCard, Icon, StatusNote } from "../componentes/ui";
import { fechaLarga, horaParaMostrar } from "../lib/fechas";
import { descargarIcs } from "./calendario";
import { Cargable, PantallaCliente } from "./Disposicion";
import { useCita, useNegocio } from "./consultas";
import { rutaCita } from "./estadoAgendar";

/** Pantalla `Confirmada` del lienzo. La cita sale del enlace de la URL, así recargar no la pierde. */
export function Confirmada() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const cita = useCita(token);
  const direccion = useNegocio().data?.direccion;

  return (
    <Cargable consulta={cita}>
      {(c) => {
        const { hora, meridiem } = horaParaMostrar(c.inicio);
        return (
          <PantallaCliente
            pie={
              <>
                <Button
                  icon="calendar-check"
                  onClick={() => descargarIcs({ uid: token.slice(0, 16), inicio: c.inicio, fin: c.fin, sobandero: c.sobandero.nombre, lugar: direccion })}
                  block
                >
                  Agregar al calendario
                </Button>
                <Button variant="outline" onClick={() => navigate(rutaCita.ver(token))} block>
                  Cambiar o cancelar la cita
                </Button>
              </>
            }
          >
            <div className="sb-cl__encabezado">
              <span className="sb-cl__ok" aria-hidden="true">
                <Icon name="check" size="xl" />
              </span>
              <h1 className="display-lg">Su cita quedó agendada</h1>
            </div>
            <ConfirmationCard
              time={hora}
              meridiem={meridiem}
              title={fechaLarga(c.inicio)}
              detail={`Con ${c.sobandero.nombre} · Sesión de ${c.duracion_min} minutos`}
            />
            <StatusNote>Confirmación enviada por WhatsApp</StatusNote>
            <span className="caption sb-muted">Le recordaremos su cita un día antes.</span>
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
