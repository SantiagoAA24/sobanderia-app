import type { RouteObject } from "react-router-dom";

import { Cita } from "./Cita";
import { CancelarSobandero, CitaCancelada, NoAsistio, Reprogramar } from "./CambiosCita";
import { Hoy } from "./Hoy";
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
];
