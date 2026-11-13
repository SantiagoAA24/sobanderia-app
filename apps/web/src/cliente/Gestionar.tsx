import { useNavigate, useParams } from "react-router-dom";

import { BackHeader, Button, SummaryCard } from "../componentes/ui";
import { Cancelada } from "./Cancelada";
import { Cargable, PantallaCliente, resumenCita } from "./Disposicion";
import { useCita } from "./consultas";
import { rutaCita } from "./estadoAgendar";

/** Pantalla `Gestionar` del lienzo: ver la cita, cambiar el día u hora, o cancelar. */
export function Gestionar() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const cita = useCita(token);

  return (
    <Cargable consulta={cita}>
      {(c) => {
        if (c.estado === "cancelada") return <Cancelada />;
        const modificable = c.puede_modificar;
        return (
          <PantallaCliente
            cabecera={<BackHeader onBack={() => navigate("/")} />}
            pie={
              modificable ? (
                <>
                  <Button icon="calendar-week" onClick={() => navigate(rutaCita.dia(token))} block>
                    Cambiar día u hora
                  </Button>
                  <Button variant="outline" icon="x" onClick={() => navigate(rutaCita.cancelar(token))} block>
                    Cancelar mi cita
                  </Button>
                </>
              ) : (
                <Button to="/agendar" icon="calendar-check" block>
                  Agendar otra cita
                </Button>
              )
            }
          >
            <h1 className="display-lg">Su cita</h1>
            <SummaryCard items={resumenCita(c)} />
            <p className="body-lg">
              {modificable
                ? "Si no puede asistir, avísenos con tiempo para ofrecer su hora a otra persona."
                : "Esta cita ya no se puede cambiar."}
            </p>
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
