import type { RouteObject } from "react-router-dom";

import { Cita } from "./Cita";
import { CancelarSobandero, CitaCancelada, NoAsistio, Reprogramar } from "./CambiosCita";
import { Bloquear } from "./Bloquear";
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
];
