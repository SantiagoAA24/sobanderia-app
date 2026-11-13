import type { RouteObject } from "react-router-dom";

import { Actividad } from "./Actividad";
import { Agenda } from "./Agenda";
import { BajaSobandero } from "./BajaSobandero";
import { DuracionSobandero } from "./DuracionSobandero";
import { FichaSobandero } from "./FichaSobandero";
import { HorarioDiaSobandero, HorarioSobandero } from "./HorarioSobandero";
import { Negocio } from "./Negocio";
import { NuevoSobandero } from "./NuevoSobandero";
import { Reporte } from "./Reporte";
import { Resumen } from "./Resumen";
import { Sobanderos } from "./Sobanderos";

/** Rutas del administrador dentro de `/admin`. Cada pantalla se llama igual que su archivo en `design/lienzo/`. */
export const rutasAdmin: RouteObject[] = [
  { path: "hoy", element: <Resumen /> },
  { path: "agenda", element: <Agenda /> },
  { path: "reporte", element: <Reporte /> },
  { path: "negocio", element: <Negocio /> },
  { path: "actividad", element: <Actividad /> },
  { path: "sobanderos", element: <Sobanderos /> },
  { path: "sobanderos/nuevo", element: <NuevoSobandero /> },
  { path: "sobanderos/:id", element: <FichaSobandero /> },
  { path: "sobanderos/:id/baja", element: <BajaSobandero /> },
  { path: "sobanderos/:id/duracion", element: <DuracionSobandero /> },
  { path: "sobanderos/:id/horario", element: <HorarioSobandero /> },
  { path: "sobanderos/:id/horario/:dia", element: <HorarioDiaSobandero /> },
];
