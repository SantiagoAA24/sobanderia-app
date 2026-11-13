import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { diaBogota, fechaLarga } from "../lib/fechas";
import { ADMIN, agenda, pintarApp, ruta, RESUMEN, servidor, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const sesion = { "GET /auth/yo": ADMIN };

describe("Resumen", () => {
  it("muestra el total del día y una fila por sobandero", async () => {
    const falso = servidor({ ...sesion, "GET /admin/resumen": RESUMEN });
    const { container } = pintarApp("/admin/hoy");
    expect(await titulo("Resumen del día")).toBeInTheDocument();
    expect(await screen.findByText("22 citas hoy en total")).toBeInTheDocument();
    expect(screen.getByText("3 sobanderos atendiendo")).toBeInTheDocument();

    const lista = screen.getByRole("region", { name: "Por sobandero" });
    const filas = within(lista).getAllByRole("button");
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("Carlos6 citas hoy · Siguiente 9:30 a. m."),
      expect.stringContaining("Marcela1 cita hoy · Siguiente 10:00 a. m."),
      expect.stringContaining("Hernando15 citas hoy"),
      expect.stringContaining("JulianaSin citas hoy"),
    ]);

    // Pide el día de hoy en hora de Bogotá.
    const url = new URL((falso.mock.calls.find(([p]) => (p as Request).url.includes("/admin/resumen"))![0] as Request).url);
    expect(url.searchParams.get("dia")).toBe(diaBogota(new Date()));
    expect(screen.getByText(fechaLarga(diaBogota(new Date())))).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("tiene la barra de tres elementos y navega entre ellos", async () => {
    servidor({ ...sesion, "GET /admin/resumen": RESUMEN, "GET /admin/agenda": [] });
    const { router } = pintarApp("/admin/hoy");
    await titulo("Resumen del día");
    const barra = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(within(barra).getAllByRole("button").map((b) => b.textContent)).toEqual(["Hoy", "Sobanderos", "Agenda"]);
    expect(within(barra).getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(barra).getByRole("button", { name: "Agenda" }));
    expect(await titulo("Agenda de todos")).toBeInTheDocument();
    expect(ruta(router)).toBe("/admin/agenda");
  });

  it("al tocar un sobandero abre su ficha", async () => {
    servidor({ ...sesion, "GET /admin/resumen": RESUMEN });
    const { router } = pintarApp("/admin/hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Marcela/ }));
    expect(ruta(router)).toBe("/admin/sobanderos/4");
  });

  it("sin conexión ofrece reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (p: Request) => {
        if (p.url.endsWith("/auth/yo")) return new Response(JSON.stringify(ADMIN), { status: 200 });
        throw new TypeError("sin red");
      }),
    );
    pintarApp("/admin/hoy");
    expect(await screen.findByRole("button", { name: /Reintentar|Intentar/ })).toBeInTheDocument();
  });

  it("un sobandero no ve el área del administrador", async () => {
    servidor({ "GET /auth/yo": SOBANDERO });
    pintarApp("/admin/hoy");
    expect(await screen.findByRole("heading", { level: 1, name: /no encontr/i })).toBeInTheDocument();
    expect(screen.queryByText("Resumen del día")).not.toBeInTheDocument();
  });
});

describe("Agenda", () => {
  it("lista las citas del día con su sobandero, sin celulares", async () => {
    const citas = [
      agenda(1, "Luz Dary Pineda", "Carlos", "2099-01-05T14:30:00Z"),
      agenda(2, "Marta Lucía Gómez", "Marcela", "2099-01-05T14:30:00Z"),
      agenda(3, "Jorge Ramírez", "Hernando", "2099-01-05T15:00:00Z"),
    ];
    const falso = servidor({ ...sesion, "GET /admin/agenda": citas });
    const { container } = pintarApp("/admin/agenda");
    expect(await titulo("Agenda de todos")).toBeInTheDocument();
    const seccion = await screen.findByRole("region", { name: "3 citas" });
    const filas = within(seccion).getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual([
      "9:30 a. m. · Luz Dary PinedaCon Carlos",
      "9:30 a. m. · Marta Lucía GómezCon Marcela",
      "10:00 a. m. · Jorge RamírezCon Hernando",
    ]);
    const url = new URL((falso.mock.calls.find(([p]) => (p as Request).url.includes("/admin/agenda"))![0] as Request).url);
    expect(url.searchParams.get("dia")).toBe(diaBogota(new Date()));
    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute("aria-current", "page");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin citas explica qué pasa", async () => {
    servidor({ ...sesion, "GET /admin/agenda": [] });
    pintarApp("/admin/agenda");
    expect(await screen.findByText("No hay citas hoy")).toBeInTheDocument();
  });

  it("una sola cita usa el singular", async () => {
    servidor({ ...sesion, "GET /admin/agenda": [agenda(1, "Luz Dary Pineda", "Carlos", "2099-01-05T14:30:00Z")] });
    pintarApp("/admin/agenda");
    expect(await screen.findByRole("region", { name: "1 cita" })).toBeInTheDocument();
  });
});
