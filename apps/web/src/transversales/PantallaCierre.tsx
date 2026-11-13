import type { ReactNode } from "react";

import { Icon, type IconName } from "../componentes/ui";
import "./PantallaCierre.css";

export interface PantallaCierreProps {
  /** Icono del círculo superior. */
  icon: IconName;
  title: string;
  text: string;
  /** Botones al pie: un solo botón principal por pantalla. */
  children: ReactNode;
}

/** Estructura de las pantallas de cierre: círculo con icono, título, texto y acciones abajo. */
export function PantallaCierre({ icon, title, text, children }: PantallaCierreProps) {
  return (
    <div className="sb-pantalla">
      <main className="sb-cierre">
        <div className="sb-cierre__encabezado">
          <span className="sb-cierre__circulo" aria-hidden="true">
            <Icon name={icon} size="xl" />
          </span>
          <h1 className="display-lg">{title}</h1>
        </div>
        <p className="body-lg sb-muted">{text}</p>
      </main>
      <section className="sb-cierre__acciones" aria-label="Acciones">
        {children}
      </section>
    </div>
  );
}
