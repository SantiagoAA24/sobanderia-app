import { Button, OptionRow } from "../componentes/ui";
import { PantallaCliente } from "./Disposicion";

/** Pantalla `Instalar-app` del lienzo. No usa la API: tiene que abrir también sin conexión. */
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
      <p className="body-lg sb-muted">Así entra con un toque, sin buscar el enlace.</p>

      <h2 className="section-title">En iPhone</h2>
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

      <h2 className="section-title">En Android</h2>
      <ol className="sb-cl__lista" aria-label="Pasos en Android">
        <li>
          <OptionRow title="Abra esta página en Chrome" initial="1" trailing="none" />
        </li>
        <li>
          <OptionRow title="Toque el menú de los tres puntos" initial="2" trailing="none" />
        </li>
        <li>
          <OptionRow title="Elija «Instalar app»" initial="3" trailing="none" />
        </li>
      </ol>
    </PantallaCliente>
  );
}
