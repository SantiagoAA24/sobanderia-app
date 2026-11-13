import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { esErrorApi } from "../api/errores";
import type { SummaryCardItem } from "../componentes/ui";
import { fechaLarga, horaParaMostrar } from "../lib/fechas";
import { Cargando } from "../transversales/Cargando";
import { EnlaceVencido } from "../transversales/EnlaceVencido";
import { NoEncontrada } from "../transversales/NoEncontrada";
import { SinConexion } from "../transversales/SinConexion";
import type { CitaCliente } from "./consultas";
import "./Cliente.css";

export interface PantallaClienteProps {
  /** StepHeader o BackHeader. */
  cabecera?: ReactNode;
  /** Botones al pie: un solo botón principal por pantalla. */
  pie?: ReactNode;
  children: ReactNode;
}

/** Cabecera, contenido y botones al pie, como en el lienzo. */
export function PantallaCliente({ cabecera, pie, children }: PantallaClienteProps) {
  return (
    <div className="sb-pantalla">
      {cabecera ? <div className="sb-cl__cab">{cabecera}</div> : null}
      <main className="sb-cl__main">{children}</main>
      {pie ? (
        <section className="sb-cl__pie" aria-label="Acciones">
          {pie}
        </section>
      ) : null}
    </div>
  );
}

export interface ConSobanderoProps {
  nombre: string;
  /** Segunda línea, por ejemplo «Viernes 13 de noviembre». */
  detalle?: string;
  /** Si se indica, aparece el botón «Cambiar». */
  onCambiar?: () => void;
}

/** Franja «Con Carlos» de los pasos 2 y 3. */
export function ConSobandero({ nombre, detalle, onCambiar }: ConSobanderoProps) {
  return (
    <div className="sb-cl__con">
      <span className="sb-cl__avatar body-lg" aria-hidden="true">
        {nombre.charAt(0).toUpperCase()}
      </span>
      <span className="sb-cl__con-texto">
        <span className="body-lg">Con {nombre}</span>
        {detalle ? <span className="caption sb-muted">{detalle}</span> : null}
      </span>
      {onCambiar ? (
        <button type="button" className="sb-cl__cambiar label" onClick={onCambiar}>
          Cambiar
        </button>
      ) : null}
    </div>
  );
}

/**
 * Estados de una consulta: cargando (con su texto), sin conexión (reintentar), enlace vencido (410)
 * y no encontrada (404). Cuando hay datos, pinta `children`.
 */
export function Cargable<T>({
  consulta,
  texto,
  children,
}: {
  consulta: UseQueryResult<T>;
  texto?: string;
  children: (datos: T) => ReactNode;
}) {
  if (consulta.isPending) return <Cargando texto={texto} />;
  if (consulta.isError) {
    const error = consulta.error;
    if (esErrorApi(error, "enlace_vencido")) return <EnlaceVencido />;
    if (esErrorApi(error) && error.estado === 404) return <NoEncontrada />;
    return <SinConexion onRetry={() => void consulta.refetch()} />;
  }
  return <>{children(consulta.data)}</>;
}

/** Con quién, qué día y a qué hora: lo que resume Paso 4, Gestionar y Cancelar. */
export function resumenCita(cita: Pick<CitaCliente, "inicio" | "duracion_min"> & { sobandero: { nombre: string } }): SummaryCardItem[] {
  const { hora, meridiem } = horaParaMostrar(cita.inicio);
  return [
    { icon: "users", text: `Con ${cita.sobandero.nombre}` },
    { icon: "calendar-check", text: fechaLarga(cita.inicio) },
    { icon: "clock", text: `${hora} ${meridiem} · ${cita.duracion_min} min` },
  ];
}
