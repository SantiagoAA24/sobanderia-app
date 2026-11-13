import { Button, OptionRow } from "../componentes/ui";
import { PantallaCliente } from "./Disposicion";

/** Pantalla `Instalar-app` del lienzo. */
export function InstalarApp() {
  return (
    <PantallaCliente
      pie={
        <>
          <Button to="/" icon="check" block>
            Listo
          </Button>
          <Button to="/" variant="outline" block>
            Ahora no
          </Button>
        </>
      }
    >
      <h1 className="display-lg">Tenga la app a la mano</h1>
      <p className="body-lg">Así entra con un toque, sin buscar el enlace. En iPhone:</p>
      <ol className="sb-cl__lista" aria-label="Pasos en iPhone">
        <li>
          <OptionRow title="Abra esta página en Safari" initial="1" trailing="none" />
        </li>
        <li>
          <OptionRow title="Toque el botón Compartir" initial="2" trailing="none" />
        </li>
        <li>
          <OptionRow title="Elija «Agregar a inicio»" initial="3" trailing="none" />
        </li>
      </ol>
      <p className="body-lg">En Android, Chrome le ofrecerá «Instalar» al abrir la página.</p>
    </PantallaCliente>
  );
}
