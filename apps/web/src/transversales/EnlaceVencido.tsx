import { Button } from "../componentes/ui";
import { PantallaCierre } from "./PantallaCierre";

/** Pantalla `Enlace-vencido` del lienzo. */
export function EnlaceVencido() {
  return (
    <PantallaCierre
      icon="clock"
      title="Este enlace ya no sirve"
      text="Por su seguridad, los enlaces vencen. Pídanos uno nuevo con su número de celular y le llegará por WhatsApp."
    >
      <Button to="/encontrar-cita" icon="chat" block>
        Pedir enlace nuevo
      </Button>
      <Button to="/" variant="outline" block>
        Ir al inicio
      </Button>
    </PantallaCierre>
  );
}
