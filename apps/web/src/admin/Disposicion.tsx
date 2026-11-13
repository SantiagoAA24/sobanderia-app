import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { BottomNav, ScreenHeader, type BottomNavItem } from "../componentes/ui";
import "../panel/Panel.css";

/** La barra inferior del administrador: Hoy, Sobanderos y Agenda. */
export const NAV_ADMIN: BottomNavItem[] = [
  { id: "today", label: "Hoy", icon: "calendar-check" },
  { id: "sobs", label: "Sobanderos", icon: "users" },
  { id: "agenda", label: "Agenda", icon: "calendar-week" },
];

export const RUTAS_NAV_ADMIN = {
  today: "/admin/hoy",
  sobs: "/admin/sobanderos",
  agenda: "/admin/agenda",
} as const;
export type PestanaAdmin = keyof typeof RUTAS_NAV_ADMIN;

export interface PantallaAdminProps {
  /** BackHeader en las pantallas de detalle. */
  cabecera?: ReactNode;
  /** Pantallas principales: fecha, título y avatar. */
  encabezado?: { fecha: string; titulo: string; inicial?: string };
  /** Botones al pie: un solo botón principal por pantalla. */
  pie?: ReactNode;
  /** Si se indica, dibuja la barra inferior con esa pestaña activa. */
  nav?: PestanaAdmin;
  children: ReactNode;
}

/** Cabecera, contenido, botones al pie y barra inferior, como en el lienzo del administrador. */
export function PantallaAdmin({ cabecera, encabezado, pie, nav, children }: PantallaAdminProps) {
  const navigate = useNavigate();
  return (
    <div className="sb-pantalla">
      {cabecera ? <div className="sb-pn__cab">{cabecera}</div> : null}
      {encabezado ? (
        <div className="sb-pn__encabezado">
          <ScreenHeader date={encabezado.fecha} title={encabezado.titulo} initial={encabezado.inicial} />
        </div>
      ) : null}
      <main className="sb-pn__main">{children}</main>
      {pie ? (
        <section className="sb-pn__pie" aria-label="Acciones">
          {pie}
        </section>
      ) : null}
      {nav ? (
        <BottomNav
          items={NAV_ADMIN}
          active={nav}
          onSelect={(id) => navigate(RUTAS_NAV_ADMIN[id as PestanaAdmin] ?? RUTAS_NAV_ADMIN.today)}
          className="sb-pn__nav"
        />
      ) : null}
    </div>
  );
}
