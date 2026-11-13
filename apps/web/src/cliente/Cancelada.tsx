import { Navigate, useParams } from "react-router-dom";

import { Button } from "../componentes/ui";
import { PantallaCierre } from "../transversales/PantallaCierre";
import { Cargable } from "./Disposicion";
import { useCita } from "./consultas";
import { rutaCita } from "./estadoAgendar";

/** Pantalla `Cancelada` del lienzo. Solo se muestra si la cita de verdad está cancelada. */
export function Cancelada() {
  const { token = "" } = useParams();
  const cita = useCita(token);
  return (
    <Cargable consulta={cita}>
      {(c) =>
        c.estado !== "cancelada" ? (
          <Navigate to={rutaCita.ver(token)} replace />
        ) : (
          <PantallaCierre
            icon="x"
            title="Su cita fue cancelada"
            text={`Ya le avisamos a ${c.sobandero.nombre}. Cuando quiera, puede agendar otra cita.`}
          >
            <Button to="/agendar" icon="calendar-check" block>
              Agendar otra cita
            </Button>
          </PantallaCierre>
        )
      }
    </Cargable>
  );
}
