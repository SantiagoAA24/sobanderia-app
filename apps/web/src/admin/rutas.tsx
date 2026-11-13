import type { RouteObject } from "react-router-dom";

import { Marcador } from "../Marcador";
import { Agenda } from "./Agenda";
import { Resumen } from "./Resumen";

/** Rutas del administrador dentro de `/admin`. Cada pantalla se llama igual que su archivo en `design/lienzo/`. */
export const rutasAdmin: RouteObject[] = [
  { path: "hoy", element: <Resumen /> },
  { path: "agenda", element: <Agenda /> },
  // Se reemplazan por sus pantallas en los pasos 7.3 a 7.6.
  { path: "sobanderos", element: <Marcador nombre="Admin-Sobanderos" /> },
  { path: "sobanderos/:id", element: <Marcador nombre="Admin-Sobandero" /> },
];
