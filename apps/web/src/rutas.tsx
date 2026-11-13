import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { GuardaAdmin, GuardaPanel, GuardaPrimeraClave } from "./auth/Guardas";
import { Ingreso } from "./auth/Ingreso";
import { PrimeraClave } from "./auth/PrimeraClave";
import { ClaveEnviada, OlvideClave, RestablecerClave } from "./auth/RecuperarClave";
import { rutasCliente } from "./cliente/rutas";
import { Marcador } from "./Marcador";
import { rutasPanel } from "./panel/rutas";
import { Cargando } from "./transversales/Cargando";
import { EnlaceVencido } from "./transversales/EnlaceVencido";
import { NoEncontrada } from "./transversales/NoEncontrada";
import { SesionVencida } from "./transversales/SesionVencida";

/** `/ui` solo existe fuera de producción (o con VITE_MOSTRAR_UI=1): el catálogo no se publica a los clientes. */
const Catalogo = __MOSTRAR_UI__ ? lazy(() => import("./ui/Catalogo")) : null;

const m = (nombre: string) => <Marcador nombre={nombre} />;

export const rutasApp: RouteObject[] = [
  // Cliente: sin cuenta
  ...rutasCliente,

  // Ingreso con correo y clave
  { path: "/ingreso", element: <Ingreso /> },
  { path: "/olvide-clave", element: <OlvideClave /> },
  { path: "/olvide-clave/enviado", element: <ClaveEnviada /> },
  { path: "/restablecer/:token", element: <RestablecerClave /> },
  { element: <GuardaPrimeraClave />, children: [{ path: "/primera-clave", element: <PrimeraClave /> }] },

  // Sobandero y administrador
  {
    path: "/panel",
    element: <GuardaPanel />,
    children: [
      { index: true, element: <Navigate to="hoy" replace /> },
      ...rutasPanel,
      { path: "*", element: <NoEncontrada /> },
    ],
  },

  // Solo administrador
  {
    path: "/admin",
    element: <GuardaAdmin />,
    children: [
      { index: true, element: <Navigate to="hoy" replace /> },
      { path: "hoy", element: m("Admin-Hoy") },
      { path: "sobanderos", element: m("Admin-Sobanderos") },
      { path: "agenda", element: m("Admin-Agenda") },
      { path: "*", element: <NoEncontrada /> },
    ],
  },

  // Transversales
  { path: "/enlace-vencido", element: <EnlaceVencido /> },
  { path: "/sesion-vencida", element: <SesionVencida /> },
  ...(Catalogo
    ? [
        {
          path: "/ui",
          element: (
            <Suspense fallback={<Cargando />}>
              <Catalogo />
            </Suspense>
          ),
        } satisfies RouteObject,
      ]
    : []),
  { path: "*", element: <NoEncontrada /> },
];

export const router = createBrowserRouter(rutasApp);
