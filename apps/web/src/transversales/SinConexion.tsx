import { Button, EmptyState } from "../componentes/ui";
import "./Estados.css";

export interface SinConexionProps {
  onRetry: () => void;
}

/** Pantalla `Sin-conexion` del lienzo. El número de la sobandería llega con «Datos del negocio» (Fase 7). */
export function SinConexion({ onRetry }: SinConexionProps) {
  return (
    <div className="sb-pantalla">
      <main className="sb-estado">
        <span className="section-title sb-estado__marca">Sobandería</span>
        <h1 className="display-lg">Sin conexión</h1>
        <EmptyState title="No podemos conectarnos" text="Revise su internet e inténtelo de nuevo. Si es urgente, llame a la sobandería." />
      </main>
      <div className="sb-estado__acciones">
        <Button onClick={onRetry} block>
          Intentar de nuevo
        </Button>
      </div>
    </div>
  );
}
