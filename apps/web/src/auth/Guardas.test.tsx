import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { crearClienteDeConsultas } from "../api/consultas";
import type { Usuario } from "../api/sesion";
import { rutasApp } from "../rutas";

type Respuesta = Usuario | "sin-sesion" | "red";

function simularServidor(sesion: Respuesta) {
  const fetchFalso = vi.fn(async () => {
    if (sesion === "red") throw new TypeError("Failed to fetch");
    if (sesion === "sin-sesion") {
      return new Response(JSON.stringify({ codigo: "no_autorizado", mensaje: "Debe ingresar para continuar." }), { status: 401 });
    }
    return new Response(JSON.stringify(sesion), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

function abrir(ruta: string) {
  const cliente = crearClienteDeConsultas({ alVencerSesion: vi.fn(), alVencerEnlace: vi.fn() });
  cliente.setDefaultOptions({ queries: { retry: false } });
  const router = createMemoryRouter(rutasApp, { initialEntries: [ruta] });
  render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const sobandero: Usuario = { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: false };
const admin: Usuario = { nombre: "Marta", rol: "admin", debe_cambiar_clave: false };
const claveTemporal: Usuario = { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: true };

const titulo = (nombre: string) => screen.findByRole("heading", { level: 1, name: nombre });

afterEach(() => vi.unstubAllGlobals());

describe("guardas de ruta", () => {
  it("sin sesión, /panel lleva a /ingreso", async () => {
    simularServidor("sin-sesion");
    const router = abrir("/panel/hoy");
    expect(await titulo("Ingrese a su cuenta")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/ingreso");
  });

  it("sin sesión, /admin lleva a /ingreso", async () => {
    simularServidor("sin-sesion");
    abrir("/admin/sobanderos");
    expect(await titulo("Ingrese a su cuenta")).toBeInTheDocument();
  });

  it("mientras comprueba la sesión muestra «Cargando…»", async () => {
    simularServidor(sobandero);
    abrir("/panel/hoy");
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(await titulo("Hoy")).toBeInTheDocument();
  });

  it("un sobandero entra al panel", async () => {
    simularServidor(sobandero);
    abrir("/panel/semana");
    expect(await titulo("Semana")).toBeInTheDocument();
  });

  it("/panel lleva a Hoy", async () => {
    simularServidor(sobandero);
    const router = abrir("/panel");
    expect(await titulo("Hoy")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/panel/hoy");
  });

  it("un sobandero no ve /admin: recibe «No encontramos esa página»", async () => {
    simularServidor(sobandero);
    abrir("/admin/hoy");
    expect(await titulo("No encontramos esa página")).toBeInTheDocument();
  });

  it("el administrador entra a /admin y también al panel", async () => {
    simularServidor(admin);
    const primero = abrir("/admin/sobanderos");
    expect(await titulo("Admin-Sobanderos")).toBeInTheDocument();
    expect(primero.state.location.pathname).toBe("/admin/sobanderos");
  });

  it("con clave temporal, todo el panel redirige a /primera-clave", async () => {
    simularServidor(claveTemporal);
    const router = abrir("/panel/hoy");
    expect(await titulo("Cree su clave nueva")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/primera-clave");
  });

  it("con clave temporal, /admin también redirige", async () => {
    simularServidor({ ...claveTemporal, rol: "admin" });
    abrir("/admin/hoy");
    expect(await titulo("Cree su clave nueva")).toBeInTheDocument();
  });

  it("/primera-clave se abre sin entrar en bucle", async () => {
    simularServidor(claveTemporal);
    const router = abrir("/primera-clave");
    expect(await titulo("Cree su clave nueva")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/primera-clave");
  });

  it("sin sesión, /primera-clave lleva a /ingreso", async () => {
    simularServidor("sin-sesion");
    abrir("/primera-clave");
    expect(await titulo("Ingrese a su cuenta")).toBeInTheDocument();
  });

  it("si no hay red muestra «Sin conexión» y reintenta", async () => {
    const fetchFalso = simularServidor("red");
    abrir("/panel/hoy");
    expect(await titulo("Sin conexión")).toBeInTheDocument();
    fetchFalso.mockImplementation(async () => new Response(JSON.stringify(sobandero), { status: 200 }));
    await userEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(await titulo("Hoy")).toBeInTheDocument();
  });

  it("las rutas del cliente no piden sesión", async () => {
    const fetchFalso = simularServidor("sin-sesion");
    abrir("/");
    expect(await titulo("Agende su cita en un minuto")).toBeInTheDocument();
    // Inicio pide los datos del local (público), pero nunca la sesión.
    const urls = (fetchFalso.mock.calls as unknown as Array<[Request]>).map(([peticion]) => new URL(peticion.url).pathname);
    expect(urls).not.toContain("/api/auth/yo");
  });
});

describe("pantallas transversales en el router", () => {
  it("una ruta desconocida muestra «No encontramos esa página»", async () => {
    simularServidor("sin-sesion");
    abrir("/no-existe");
    expect(await titulo("No encontramos esa página")).toBeInTheDocument();
  });

  it("una ruta desconocida dentro de /panel también", async () => {
    simularServidor(sobandero);
    abrir("/panel/no-existe");
    expect(await titulo("No encontramos esa página")).toBeInTheDocument();
  });

  it("/enlace-vencido y /sesion-vencida existen", async () => {
    simularServidor("sin-sesion");
    abrir("/enlace-vencido");
    expect(await titulo("Este enlace ya no sirve")).toBeInTheDocument();
  });

  it("/sesion-vencida existe", async () => {
    simularServidor("sin-sesion");
    abrir("/sesion-vencida");
    expect(await titulo("Su sesión terminó")).toBeInTheDocument();
  });
});
