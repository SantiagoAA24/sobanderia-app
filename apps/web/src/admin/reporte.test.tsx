import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import type { ReporteSemanal } from "./consultas";
import { ADMIN, pintarApp, ruta, RESUMEN, servidor } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const base = { "GET /auth/yo": ADMIN };

const REPORTE: ReporteSemanal = {
  desde: "2026-11-09",
  hasta: "2026-11-15",
  atendidas: 96,
  no_asistieron: 6,
  canceladas: 9,
  por_sobandero: [
    { id: 3, nombre: "Carlos", atendidas: 28, no_asistieron: 2, canceladas: 3 },
    { id: 4, nombre: "Marcela", atendidas: 24, no_asistieron: 1, canceladas: 2 },
    { id: 5, nombre: "Hernando", atendidas: 1, no_asistieron: 0, canceladas: 0 },
  ],
};

describe("Resumen semanal", () => {
  it("muestra la semana, el total y cada sobandero como en el lienzo", async () => {
    servidor({ ...base, "GET /admin/reporte": REPORTE });
    const { container } = pintarApp("/admin/reporte");
    expect(await titulo("Resumen semanal")).toBeInTheDocument();
    expect(await screen.findByText("Semana del 9 al 15 de noviembre")).toBeInTheDocument();
    const total = screen.getByRole("region", { name: "Total de la semana" });
    expect(within(total).getByText("96 citas atendidas")).toBeInTheDocument();
    expect(within(total).getByText("6 no asistieron")).toBeInTheDocument();
    expect(within(total).getByText("9 canceladas")).toBeInTheDocument();
    const filas = within(screen.getByRole("region", { name: "Por sobandero" })).getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("Carlos28 atendidas · 2 no asistieron"),
      expect.stringContaining("Marcela24 atendidas · 1 no asistió"),
      expect.stringContaining("Hernando1 atendida · 0 no asistieron"),
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("usa el singular en el total", async () => {
    servidor({ ...base, "GET /admin/reporte": { ...REPORTE, atendidas: 1, no_asistieron: 1, canceladas: 1 } });
    pintarApp("/admin/reporte");
    const total = await screen.findByRole("region", { name: "Total de la semana" });
    expect(within(total).getAllByText(/^1 /).map((e) => e.textContent)).toEqual(["1 cita atendida", "1 no asistió", "1 cancelada"]);
  });

  it("se abre desde el Resumen y «Atrás» vuelve a él", async () => {
    servidor({ ...base, "GET /admin/resumen": RESUMEN, "GET /admin/reporte": REPORTE });
    const { router } = pintarApp("/admin/hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Resumen de la semana/ }));
    expect(ruta(router)).toBe("/admin/reporte");
    await titulo("Resumen semanal");
    await userEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(await titulo("Resumen del día")).toBeInTheDocument();
  });

  it("sin conexión ofrece reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (p: Request) => {
        if (p.url.endsWith("/auth/yo")) return new Response(JSON.stringify(ADMIN), { status: 200 });
        throw new TypeError("sin red");
      }),
    );
    pintarApp("/admin/reporte");
    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });
});
