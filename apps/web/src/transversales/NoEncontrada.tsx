import { Button } from "../componentes/ui";
import { PantallaCierre } from "./PantallaCierre";

/** Pantalla `No-encontrada` del lienzo. */
export function NoEncontrada() {
  return (
    <PantallaCierre
      icon="x"
      title="No encontramos esa página"
      text="Puede que el enlace esté incompleto o ya no exista. Desde el inicio puede agendar o buscar su cita."
    >
      <Button to="/" icon="calendar-check" block>
        Ir al inicio
      </Button>
    </PantallaCierre>
  );
}
