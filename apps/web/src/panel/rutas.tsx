import type { RouteObject } from "react-router-dom";

import { Cita } from "./Cita";
import { CancelarSobandero, CitaCancelada, NoAsistio, Reprogramar } from "./CambiosCita";
import { Bloquear } from "./Bloquear";
import { Cliente } from "./FichaCliente";
import { Clientes } from "./Clientes";
import { ClaveCambiada, Perfil, PerfilClave, PerfilCorreo } from "./Perfil";
import { Hoy } from "./Hoy";
import { Horario } from "./Horario";
import { HorarioDia } from "./HorarioDia";
import { NuevaCita } from "./NuevaCita";
import { Semana } from "./Semana";

/** Rutas del sobandero dentro de `/panel`. Cada pantalla se llama igual que su archivo en `design/lienzo/`. */
export const rutasPanel: RouteObject[] = [
  { path: "hoy", element: <Hoy /> },
  { path: "semana", element: <Semana /> },
  { path: "citas/:id", element: <Cita /> },
  { path: "citas/:id/cambiar", element: <Reprogramar /> },
  { path: "citas/:id/no-asistio", element: <NoAsistio /> },
  { path: "citas/:id/cancelar", element: <CancelarSobandero /> },
  { path: "citas/:id/cancelada", element: <CitaCancelada /> },
  { path: "nueva-cita", element: <NuevaCita /> },
  { path: "bloquear", element: <Bloquear /> },
  { path: "horario", element: <Horario /> },
  { path: "horario/:dia", element: <HorarioDia /> },
  { path: "clientes", element: <Clientes /> },
  { path: "clientes/:id", element: <Cliente /> },
  { path: "perfil", element: <Perfil /> },
  { path: "perfil/correo", element: <PerfilCorreo /> },
  { path: "perfil/clave", element: <PerfilClave /> },
  { path: "perfil/clave-cambiada", element: <ClaveCambiada /> },
];
