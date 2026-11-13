import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { BottomNav, ScreenHeader } from "../componentes/ui";
import "./Panel.css";

/** Las cuatro pestañas de la barra inferior y su ruta. */
export const RUTAS_NAV: Record<string, string> = {
  today: "/panel/hoy",
  week: "/panel/semana",
  clients: "/panel/clientes",
  schedule: "/panel/horario",
};
export type PestanaNav = keyof typeof RUTAS_NAV;

export interface PantallaPanelProps {
  /** BackHeader, o nada en las pantallas de cierre y de ingreso. */
  cabecera?: ReactNode;
  /** Pantallas principales: fecha, título y avatar (abre «Mi perfil»). */
  encabezado?: { fecha: string; titulo: string; inicial?: string };
  /** Botones al pie: un solo botón principal por pantalla. */
  pie?: ReactNode;
  /** Si se indica, dibuja la barra inferior con esa pestaña activa. */
  nav?: PestanaNav;
  children: ReactNode;
}

/** Cabecera, contenido, botones al pie y barra inferior, como en el lienzo. */
export function PantallaPanel({ cabecera, encabezado, pie, nav, children }: PantallaPanelProps) {
  const navigate = useNavigate();
  return (
    <div className="sb-pantalla">
      {cabecera ? <div className="sb-pn__cab">{cabecera}</div> : null}
      {encabezado ? (
        <div className="sb-pn__encabezado">
          <ScreenHeader date={encabezado.fecha} title={encabezado.titulo} initial={encabezado.inicial} />
          {encabezado.inicial ? (
            <button type="button" className="sb-pn__avatar" aria-label="Mi perfil" onClick={() => navigate("/panel/perfil")} />
          ) : null}
        </div>
      ) : null}
      <main className="sb-pn__main">{children}</main>
      {pie ? <div className="sb-pn__pie">{pie}</div> : null}
      {nav ? <BottomNav active={nav} onSelect={(id) => navigate(RUTAS_NAV[id] ?? "/panel/hoy")} className="sb-pn__nav" /> : null}
    </div>
  );
}
