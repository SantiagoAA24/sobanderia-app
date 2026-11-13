import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { diaBogota, sumarDias } from "../lib/fechas";
import { cita } from "./datos";
import { pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const HOY = diaBogota(new Date());
const LUZ = { id: 1, nombre: "Luz Dary Pineda", celular: "+573001234567", ultima_cita: new Date().toISOString(), total: 12 };
const HERNAN = { id: 2, nombre: "Hernán Castaño", celular: "+573109876543", ultima_cita: `${sumarDias(HOY, -8)}T15:00:00Z`, total: 3 };
const NUEVO = { id: 3, nombre: "Pedro Pérez", celular: "+573205550000", ultima_cita: null, total: 0 };

describe("Clientes", () => {
  it("lista los clientes con su última cita y el total en el encabezado", async () => {
    servidor({ "GET /auth/yo": SOBANDERO, "GET /yo/clientes": [LUZ, HERNAN, NUEVO] });
    const { container } = pintarApp("/panel/clientes");
    expect(await titulo("Sus clientes")).toBeInTheDocument();
    expect(await screen.findByText("3 clientes")).toBeInTheDocument();
    expect(screen.getByText("Última cita: hoy")).toBeInTheDocument();
    expect(screen.getByText(/^Última cita: \d+ de [a-z]+$/)).toBeInTheDocument();
    expect(screen.getByText("Sin citas anteriores")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("busca por nombre o celular, sin pedir en cada tecla, y cuenta los resultados", async () => {
    const falso = servidor({
      "GET /auth/yo": SOBANDERO,
      "GET /yo/clientes": (p: Request) => ({ cuerpo: new URL(p.url).searchParams.get("q") === "luz" ? [LUZ] : [LUZ, HERNAN] }),
    });
    pintarApp("/panel/clientes");
    await screen.findByText("Hernán Castaño");
    await userEvent.type(screen.getByLabelText("Buscar"), "luz");
    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
    expect(screen.queryByText("Hernán Castaño")).not.toBeInTheDocument();
    const pedidos = falso.mock.calls.map(([p]) => new URL((p as Request).url)).filter((u) => u.pathname.endsWith("/yo/clientes"));
    expect(pedidos.map((u) => u.searchParams.get("q"))).toEqual(["", "luz"]); // no «l», «lu»
  });

  it("sin resultados lo dice, y sin clientes también", async () => {
    servidor({ "GET /auth/yo": SOBANDERO, "GET /yo/clientes": [] });
    const a = pintarApp("/panel/clientes");
    expect(await screen.findByText("Todavía no tiene clientes")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Buscar"), "zzz");
    expect(await screen.findByText("No encontramos a nadie")).toBeInTheDocument();
    a.unmount();
  });

  it("tocar un cliente abre su ficha", async () => {
    servidor({ "GET /auth/yo": SOBANDERO, "GET /yo/clientes": [LUZ] });
    const { router } = pintarApp("/panel/clientes");
    await userEvent.click(await screen.findByRole("button", { name: /Luz Dary Pineda/ }));
    expect(ruta(router)).toBe("/panel/clientes/1");
  });
});

describe("Ficha del cliente", () => {
  const proxima = cita({ id: 7, nombre: "Luz Dary Pineda", celular: "+573001234567", min: 3000 });
  const FICHA = {
    id: 1,
    nombre: "Luz Dary Pineda",
    celular: "+573001234567",
    cliente_desde: "2026-03-10T15:00:00Z",
    total: 12,
    proximas: [proxima],
    historial: [
      cita({ id: 5, nombre: "Luz Dary Pineda", inicio: "2026-11-05T14:30:00Z", estado: "atendida" }),
      cita({ id: 4, nombre: "Luz Dary Pineda", inicio: "2026-10-08T15:00:00Z", estado: "no_asistio" }),
    ],
  };
  const sesion = { "GET /auth/yo": SOBANDERO, "GET /yo/clientes/1": FICHA };

  it("muestra sus datos, la próxima cita y el historial con este sobandero", async () => {
    servidor(sesion);
    const { container } = pintarApp("/panel/clientes/1");
    expect(await titulo("Luz Dary Pineda")).toBeInTheDocument();
    expect(screen.getByText("300 123 4567")).toBeInTheDocument();
    expect(screen.getByText("Cliente desde marzo de 2026")).toBeInTheDocument();
    expect(screen.getByText("12 citas en total")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+573001234567");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/573001234567");
    expect(within(screen.getByRole("region", { name: "Próxima cita" })).getByRole("link")).toHaveAttribute("href", "/panel/citas/7");
    const anteriores = screen.getByRole("region", { name: "Citas anteriores" });
    expect(within(anteriores).getByText("5 de noviembre")).toBeInTheDocument();
    expect(within(anteriores).getByText("9:30 a. m. · Atendida")).toBeInTheDocument();
    expect(within(anteriores).getByText("10:00 a. m. · No asistió")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("«Agendar nueva cita» lleva a Nueva cita con sus datos", async () => {
    servidor({ ...sesion, "GET /yo/dias": { dias: [] } });
    const { router } = pintarApp("/panel/clientes/1");
    await userEvent.click(await screen.findByRole("button", { name: "Agendar nueva cita" }));
    expect(ruta(router)).toBe("/panel/nueva-cita");
    expect(await screen.findByLabelText("Nombre completo")).toHaveValue("Luz Dary Pineda");
  });

  it("un cliente de otro sobandero responde como uno que no existe", async () => {
    servidor({ ...sesion, "GET /yo/clientes/1": { estado: 404, cuerpo: { codigo: "no_encontrado", mensaje: "No encontramos a ese cliente." } } });
    pintarApp("/panel/clientes/1");
    expect(await titulo("No encontramos esa página")).toBeInTheDocument();
  });

  it("sin próximas citas ni historial solo muestra los datos", async () => {
    servidor({ ...sesion, "GET /yo/clientes/1": { ...FICHA, proximas: [], historial: [], total: 1 } });
    pintarApp("/panel/clientes/1");
    await titulo("Luz Dary Pineda");
    expect(screen.getByText("1 cita en total")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Próxima cita" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Citas anteriores" })).not.toBeInTheDocument();
  });
});
