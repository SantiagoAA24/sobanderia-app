/** Ayudantes de las pruebas del panel y del ingreso: la app completa con un servidor falso. */
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";

import { crearClienteDeConsultas } from "../api/consultas";
import type { Usuario } from "../api/sesion";
import { olvidarClaveTemporal } from "../auth/claveTemporal";
import { rutasApp } from "../rutas";

export { ruta, servidor } from "../cliente/pruebas";

export const SOBANDERO: Usuario = { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: false };
export const ADMIN: Usuario = { nombre: "Marta", rol: "admin", debe_cambiar_clave: false };
export const CLAVE_TEMPORAL: Usuario = { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: true };

export const SIN_SESION = {
  estado: 401,
  cuerpo: { codigo: "no_autorizado", mensaje: "Debe ingresar para continuar." },
};

/** La app completa en memoria, con los mismos manejadores globales que la real (401 -> Sesión vencida). */
export function pintarApp(entrada: string | { pathname: string; state?: unknown }) {
  olvidarClaveTemporal();
  const router = createMemoryRouter(rutasApp, { initialEntries: [entrada] });
  const cliente = crearClienteDeConsultas({
    alVencerSesion: () => void router.navigate("/sesion-vencida", { replace: true }),
    alVencerEnlace: () => void router.navigate("/enlace-vencido", { replace: true }),
  });
  cliente.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const vista = render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, cliente, ...vista, ahora: vi.fn() };
}
