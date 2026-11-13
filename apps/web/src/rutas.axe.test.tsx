/**
 * `axe` en TODAS las rutas de la app. La lista sale de `rutasApp`, así que una pantalla nueva queda
 * cubierta sola. El servidor falso se arma desde `api/openapi.json` (pruebas/contrato.ts): cada
 * pantalla se pinta con datos de ejemplo con la forma real del contrato, no con un 404.
 * jsdom no calcula estilos: el contraste se prueba en estilos/contraste.test.ts y, en un navegador
 * real, con `npm run a11y:navegador`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "./lib/axe";
import {
  aplanar,
  estadoDeCitaPara,
  respuestaDeContrato,
  SIN_DATOS,
  sesionPara,
  soloRutasDePantalla,
  TITULOS_DE_ERROR,
  urlDePrueba,
} from "./pruebas/contrato";
import { rutasApp } from "./rutas";

const rutas = soloRutasDePantalla(aplanar(rutasApp));

function servidorFalso(ruta: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (peticion: Request) => {
      const { pathname } = new URL(peticion.url);
      const { estado, cuerpo } = respuestaDeContrato(peticion.method, pathname.replace(/^\/api/, ""), sesionPara(ruta), estadoDeCitaPara(ruta));
      return new Response(cuerpo === null ? null : JSON.stringify(cuerpo), { status: estado });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("axe en todas las rutas", () => {
  it("encuentra las rutas de las tres áreas", () => {
    expect(rutas.length).toBeGreaterThan(50);
    for (const prefijo of ["/agendar", "/mi-cita", "/panel", "/admin", "/ingreso", "/instalar"]) {
      expect(rutas.some((r) => r.startsWith(prefijo))).toBe(true);
    }
  });

  for (const ruta of rutas) {
    it(ruta, async () => {
      servidorFalso(ruta);
      const router = createMemoryRouter(rutasApp, { initialEntries: [urlDePrueba(ruta)] });
      const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      const { container } = render(
        <QueryClientProvider client={cliente}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
      await waitFor(() => {
        expect(container.querySelector('[aria-busy="true"]')).toBeNull();
        expect(container.querySelector("h1")).not.toBeNull();
      });

      if (!SIN_DATOS.has(ruta)) {
        // Si cayó en un estado de error, el servidor falso no la alimentó: no se estaría probando su contenido.
        expect(container.querySelector("h1")?.textContent ?? "", `${ruta} mostró un estado de error`).not.toMatch(TITULOS_DE_ERROR);
      }
      expect(await axe(container)).toHaveNoViolations();
    });
  }
});
