import { Skeleton } from "../componentes/ui";
import "./Estados.css";

/** Carga genérica: bloques con un texto visible. Cada pantalla de las Fases 5-7 usa su propio texto. */
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="sb-pantalla">
      <main className="sb-estado" aria-busy="true">
        <p role="status" className="body-lg sb-muted">
          {texto}
        </p>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </main>
    </div>
  );
}
