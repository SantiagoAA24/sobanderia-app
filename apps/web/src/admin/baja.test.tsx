import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import type { SobanderoAdmin } from "./consultas";
import { ADMIN, pintarApp, ruta, servidor } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });

const sob = (cambios: Partial<SobanderoAdmin> = {}): SobanderoAdmin => ({
  id: 3,
  nombre: "Carlos",
  correo: "carlos@ejemplo.com",
  activo: true,
  recibe_citas: true,
  duracion_min: 30,
  baja_en: null,
  dias: [0, 1, 2, 3, 4, 5],
  citas_proximas: 8,
  ...cambios,
});

function registrar(respuesta: unknown, estado = 200) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    const texto = await p.text();
    cuerpos.push(texto ? JSON.parse(texto) : null);
    return { estado, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

const base = { "GET /auth/yo": ADMIN, "GET /admin/sobanderos/3": sob(), "GET /admin/sobanderos": [] };

describe("Dar de baja", () => {
  it("cuenta las citas próximas, ofrece las dos opciones y deja marcada «Dejarlas»", async () => {
    servidor(base);
    const { container } = pintarApp("/admin/sobanderos/3/baja");
    expect(await titulo("¿Dar de baja a Carlos?")).toBeInTheDocument();
    expect(screen.getByText("Tiene 8 citas próximas")).toBeInTheDocument();
    expect(screen.getByText("Elija qué pasa con ellas. Su historial se conserva.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dejarlas como están/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Cancelarlas y avisar/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "No, mantenerlo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sí, dar de baja" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("«No, mantenerlo» vuelve a la ficha sin cambiar nada", async () => {
    const falso = servidor(base);
    const { router } = pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    await userEvent.click(screen.getByRole("button", { name: "No, mantenerlo" }));
    expect(ruta(router)).toBe("/admin/sobanderos/3");
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "POST")).toHaveLength(0);
  });

  it("dejarlas como están: envía «dejar» y explica que la cuenta se cierra al terminar", async () => {
    const { cuerpos, manejador } = registrar({ sobandero: sob({ recibe_citas: false, baja_en: "2030-01-01T15:00:00Z" }), citas_canceladas: 0 });
    servidor({ ...base, "POST /admin/sobanderos/3/baja": manejador });
    const { router } = pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    await userEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));
    expect(await titulo("Sobanderos")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ citas: "dejar" }]);
    expect(ruta(router)).toBe("/admin/sobanderos");
    expect(screen.getByText("Carlos ya no recibe citas nuevas. Su cuenta se cerrará al terminar las 8 citas que le quedan.")).toBeInTheDocument();
  });

  it("cancelarlas y avisar: dice a cuántos clientes se escribirá y envía «cancelar»", async () => {
    const { cuerpos, manejador } = registrar({ sobandero: sob({ activo: false, recibe_citas: false, citas_proximas: 0 }), citas_canceladas: 8 });
    servidor({ ...base, "POST /admin/sobanderos/3/baja": manejador });
    const { router } = pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    await userEvent.click(screen.getByRole("button", { name: /Cancelarlas y avisar/ }));
    expect(screen.getByText("Se cancelarán 8 citas y sus clientes recibirán un WhatsApp.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));
    expect(await titulo("Sobanderos")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ citas: "cancelar" }]);
    expect(ruta(router)).toBe("/admin/sobanderos");
    expect(screen.getByText("Carlos quedó dado de baja. Cancelamos 8 citas y avisamos a los clientes.")).toBeInTheDocument();
  });

  it("con una sola cita usa el singular", async () => {
    servidor({ ...base, "GET /admin/sobanderos/3": sob({ citas_proximas: 1 }) });
    pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    expect(screen.getByText("Tiene 1 cita próxima")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Cancelarlas y avisar/ }));
    expect(screen.getByText("Se cancelará 1 cita y su cliente recibirá un WhatsApp.")).toBeInTheDocument();
  });

  it("sin citas próximas no pide elegir y la baja es inmediata", async () => {
    const { cuerpos, manejador } = registrar({ sobandero: sob({ activo: false, citas_proximas: 0 }), citas_canceladas: 0 });
    servidor({ ...base, "GET /admin/sobanderos/3": sob({ citas_proximas: 0 }), "POST /admin/sobanderos/3/baja": manejador });
    pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    expect(screen.getByText("No tiene citas próximas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dejarlas como están/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));
    expect(await screen.findByText("Carlos quedó dado de baja.")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ citas: "dejar" }]);
  });

  it("si falla conserva la elección y dice qué hacer", async () => {
    servidor({ ...base, "POST /admin/sobanderos/3/baja": () => { throw new TypeError("sin red"); } });
    const { router } = pintarApp("/admin/sobanderos/3/baja");
    await titulo("¿Dar de baja a Carlos?");
    await userEvent.click(screen.getByRole("button", { name: /Cancelarlas y avisar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión. Revise su internet e inténtelo de nuevo.");
    expect(screen.getByRole("button", { name: /Cancelarlas y avisar/ })).toHaveAttribute("aria-pressed", "true");
    expect(ruta(router)).toBe("/admin/sobanderos/3/baja");
  });

  it("si ya estaba dado de baja lo dice y no ofrece repetirlo", async () => {
    servidor({ ...base, "GET /admin/sobanderos/3": sob({ activo: false }) });
    pintarApp("/admin/sobanderos/3/baja");
    expect(await screen.findByText("Ya está dado de baja")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sí, dar de baja" })).not.toBeInTheDocument();
  });
});
