import { Button } from "../componentes/ui";
import { PantallaCierre } from "./PantallaCierre";

/** Pantalla `Sesion-vencida` del lienzo. */
export function SesionVencida() {
  return (
    <PantallaCierre
      icon="clock"
      title="Su sesión terminó"
      text="Para cuidar sus datos, cerramos la sesión después de un tiempo sin uso. Ingrese de nuevo; sus citas siguen igual."
    >
      <Button to="/ingreso" block>
        Ingresar de nuevo
      </Button>
    </PantallaCierre>
  );
}
