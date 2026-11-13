/** Ayudantes de las pruebas del flujo del cliente: un servidor falso y el router en memoria. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi } from "vitest";

import { rutasCliente } from "./rutas";

export type Manejador = unknown | ((peticion: Request) => { estado?: number; cuerpo: unknown } | Promise<{ estado?: number; cuerpo: unknown }>);

/** `{ "GET /publico/negocio": {...} }`; `{ estado, cuerpo }` fija el código. Lo que no esté declarado responde 404. */
export function servidor(rutas: Record<string, Manejador>) {
  const falso = vi.fn(async (peticion: Request) => {
    const { pathname } = new URL(peticion.url);
    const clave = `${peticion.method} ${pathname.replace(/^\/api/, "")}`;
    const m = rutas[clave];
    if (m === undefined) return new Response(JSON.stringify({ codigo: "no_encontrado", mensaje: "No encontrado." }), { status: 404 });
    const completa = typeof m === "object" && m !== null && "estado" in m && "cuerpo" in m;
    const r = typeof m === "function" ? await (m as (p: Request) => unknown)(peticion.clone()) : completa ? m : { cuerpo: m };
    const { estado = 200, cuerpo } = r as { estado?: number; cuerpo: unknown };
    return new Response(JSON.stringify(cuerpo), { status: estado });
  });
  vi.stubGlobal("fetch", falso);
  return falso;
}

export function pintar(entrada: string) {
  const router = createMemoryRouter(rutasCliente, { initialEntries: [entrada] });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const vista = render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, cliente, ...vista };
}

export const ruta = (router: { state: { location: { pathname: string; search: string } } }) =>
  router.state.location.pathname + router.state.location.search;

// --- Datos de ejemplo (Bogotá = UTC-5) -----------------------------------------------------
export const CARLOS = { id: 3, nombre: "Carlos", duracion_min: 30, proximo_cupo: "2099-01-05T13:30:00Z" };
export const MARCELA = { id: 4, nombre: "Marcela", duracion_min: 30, proximo_cupo: "2099-01-05T19:00:00Z" };
export const NEGOCIO = { nombre: "Sobandería", direccion: "Calle 1 # 2-3", telefono: "+573001112233", mensaje_bienvenida: "Bienvenido." };

/** Cita del viernes 13 de noviembre de 2099 a las 10:30 a. m. (15:30 UTC) con Carlos. */
export const CITA = {
  estado: "agendada",
  inicio: "2099-11-13T15:30:00Z",
  fin: "2099-11-13T16:00:00Z",
  duracion_min: 30,
  sobandero: { id: 3, nombre: "Carlos", duracion_min: 30 },
  cliente_nombre: "María Gómez",
  puede_modificar: true,
};
