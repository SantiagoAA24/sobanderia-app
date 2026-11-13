import type { RouteObject } from "react-router-dom";

import { CancelarCliente } from "./CancelarCliente";
import { Cancelada } from "./Cancelada";
import { Confirmada } from "./Confirmada";
import { EncontrarCita, EnlaceEnviadoCliente } from "./EncontrarCita";
import { Gestionar } from "./Gestionar";
import { Inicio } from "./Inicio";
import { InstalarApp } from "./InstalarApp";
import { Paso1Sobandero } from "./Paso1Sobandero";
import { Paso2Dia } from "./Paso2Dia";
import { Paso3Hora } from "./Paso3Hora";
import { Paso4Datos } from "./Paso4Datos";
import { Politica } from "./Politica";

/** Rutas del cliente (sin cuenta). Cada pantalla se llama igual que su archivo en `design/lienzo/`. */
export const rutasCliente: RouteObject[] = [
  { path: "/", element: <Inicio /> },
  { path: "/instalar-app", element: <InstalarApp /> },
  { path: "/politica", element: <Politica /> },

  // Agendar: el sobandero, el día y la hora viajan en la URL
  { path: "/agendar", element: <Paso1Sobandero /> },
  { path: "/agendar/listo/:token", element: <Confirmada /> },
  { path: "/agendar/:sobanderoId/dia", element: <Paso2Dia /> },
  { path: "/agendar/:sobanderoId/hora", element: <Paso3Hora /> },
  { path: "/agendar/:sobanderoId/datos", element: <Paso4Datos /> },

  // Ver, cambiar y cancelar con el enlace de WhatsApp
  { path: "/mi-cita/:token", element: <Gestionar /> },
  { path: "/mi-cita/:token/cambiar/dia", element: <Paso2Dia /> },
  { path: "/mi-cita/:token/cambiar/hora", element: <Paso3Hora /> },
  { path: "/mi-cita/:token/cancelar", element: <CancelarCliente /> },
  { path: "/mi-cita/:token/cancelada", element: <Cancelada /> },

  { path: "/encontrar-cita", element: <EncontrarCita /> },
  { path: "/encontrar-cita/enviado", element: <EnlaceEnviadoCliente /> },
];
