import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useSesion, type Rol } from "../api/sesion";
import { NoEncontrada } from "../transversales/NoEncontrada";
import { Cargando } from "../transversales/Cargando";
import { SinConexion } from "../transversales/SinConexion";

export const RUTA_INGRESO = "/ingreso";
export const RUTA_PRIMERA_CLAVE = "/primera-clave";

export interface GuardaProps {
  /** Roles con permiso en esta área. */
  roles: readonly Rol[];
  /** Solo para `/primera-clave`: no redirige a sí misma aunque `debe_cambiar_clave` sea verdadero. */
  enPrimeraClave?: boolean;
}

/**
 * Guarda de ruta del frontend. Solo decide qué pantalla mostrar: la verificación real del rol
 * se repite en el servidor en cada ruta de la API.
 *
 * - Sin sesión: va a `/ingreso`.
 * - Con clave temporal: todo se redirige a `/primera-clave`.
 * - Rol sin permiso: «No encontrada», para no revelar que el área existe.
 */
export function Guarda({ roles, enPrimeraClave = false }: GuardaProps) {
  const sesion = useSesion();
  const ubicacion = useLocation();

  if (sesion.isPending) return <Cargando />;
  if (sesion.isError) return <SinConexion onRetry={() => void sesion.refetch()} />;

  const usuario = sesion.data;
  if (!usuario) return <Navigate to={RUTA_INGRESO} replace state={{ desde: ubicacion.pathname }} />;
  if (usuario.debe_cambiar_clave && !enPrimeraClave) return <Navigate to={RUTA_PRIMERA_CLAVE} replace />;
  if (!roles.includes(usuario.rol)) return <NoEncontrada />;
  return <Outlet />;
}

export const GuardaPanel = () => <Guarda roles={["sobandero", "admin"]} />;
export const GuardaAdmin = () => <Guarda roles={["admin"]} />;
export const GuardaPrimeraClave = () => <Guarda roles={["sobandero", "admin"]} enPrimeraClave />;
