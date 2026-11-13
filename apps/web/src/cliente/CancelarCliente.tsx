import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { esErrorApi } from "../api/errores";
import { BackHeader, Button, SummaryCard } from "../componentes/ui";
import { Cargable, PantallaCliente, resumenCita } from "./Disposicion";
import { useCancelarCita, useCita } from "./consultas";
import { rutaCita } from "./estadoAgendar";

/** Pantalla `Cancelar-cliente` del lienzo: la acción principal es conservar la cita. */
export function CancelarCliente() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const cita = useCita(token);
  const cancelar = useCancelarCita(token);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <Cargable consulta={cita}>
      {(c) => {
        if (c.estado === "cancelada") return <Navigate to={rutaCita.cancelada(token)} replace />;
        if (!c.puede_modificar) return <Navigate to={rutaCita.ver(token)} replace />;
        return (
          <PantallaCliente
            cabecera={<BackHeader onBack={() => navigate(rutaCita.ver(token))} />}
            pie={
              <>
                <Button icon="check" onClick={() => navigate(rutaCita.ver(token))} block>
                  No, conservar mi cita
                </Button>
                <Button
                  variant="outline"
                  icon="x"
                  disabled={cancelar.isPending}
                  onClick={() => {
                    setAviso(null);
                    cancelar.mutate(undefined, {
                      onSuccess: () => navigate(rutaCita.cancelada(token), { replace: true }),
                      onError: (error) =>
                        setAviso(esErrorApi(error) ? error.message : "No hay conexión. Revise su internet e inténtelo de nuevo."),
                    });
                  }}
                  block
                >
                  Sí, cancelar mi cita
                </Button>
              </>
            }
          >
            <h1 className="display-lg">¿Quiere cancelar su cita?</h1>
            <SummaryCard items={resumenCita(c)} />
            <p className="body-lg">Le avisaremos a {c.sobandero.nombre} para que ofrezca esa hora a otra persona.</p>
            {aviso ? (
              <p role="alert" className="body sb-cl__error">
                {aviso}
              </p>
            ) : null}
          </PantallaCliente>
        );
      }}
    </Cargable>
  );
}
