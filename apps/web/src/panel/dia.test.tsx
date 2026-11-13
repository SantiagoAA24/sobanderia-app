import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { diaBogota, etiquetaDia } from "../lib/fechas";
import { llamar, abrirWhatsapp } from "../lib/contacto";
import { pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";
import { textoHora } from "./formato";
import { cita } from "./datos";

vi.mock("../lib/contacto", async (original) => ({
  ...(await original<typeof import("../lib/contacto")>()),
  llamar: vi.fn(),
  abrirWhatsapp: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const sesion = { "GET /auth/yo": SOBANDERO };

describe("Hoy", () => {
  const citas = [
    cita({ id: 1, nombre: "Luz Dary Pineda", min: 10 }),
    cita({ id: 2, nombre: "Hernán Castaño", min: 70 }),
    cita({ id: 3, nombre: "Álvaro Ruiz", min: 130 }),
    cita({ id: 4, nombre: "Rosa Elvira Torres", min: -120, estado: "atendida" }),
    cita({ id: 5, nombre: "Marta Gómez", min: -90, estado: "atendida" }),
  ];

  it("muestra la siguiente cita en terracota, las de más tarde y las atendidas", async () => {
    const falso = servidor({ ...sesion, "GET /yo/citas": citas });
    const { container } = pintarApp("/panel/hoy");
    expect(await titulo(/^(Buenos días|Buenas tardes|Buenas noches), Carlos$/)).toBeInTheDocument();

    const siguiente = await screen.findByRole("region", { name: "Siguiente cita" });
    expect(within(siguiente).getByText("Luz Dary Pineda")).toBeInTheDocument();
    expect(within(siguiente).getByText("Sesión de 30 minutos")).toBeInTheDocument();
    expect(within(siguiente).getByText(/^En \d+ min$/)).toBeInTheDocument();

    const mas = screen.getByRole("region", { name: "Más tarde hoy" });
    expect(within(mas).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      `Ver la cita de Hernán Castaño, ${textoHora(citas[1]!.inicio)}`,
      `Ver la cita de Álvaro Ruiz, ${textoHora(citas[2]!.inicio)}`,
    ]);
    expect(screen.getByText("2 citas atendidas hoy")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sin marcar" })).not.toBeInTheDocument();

    // Pide solo el día de hoy, en hora de Bogotá.
    const url = new URL((falso.mock.calls.find(([p]) => (p as Request).url.includes("/yo/citas"))![0] as Request).url);
    expect(url.searchParams.get("dia")).toBe(diaBogota(new Date()));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("llamar y WhatsApp usan el celular de la siguiente cita", async () => {
    servidor({ ...sesion, "GET /yo/citas": citas });
    pintarApp("/panel/hoy");
    const siguiente = await screen.findByRole("region", { name: "Siguiente cita" });
    await userEvent.click(within(siguiente).getByRole("button", { name: "Llamar" }));
    await userEvent.click(within(siguiente).getByRole("button", { name: "WhatsApp" }));
    expect(llamar).toHaveBeenCalledWith(citas[0]!.cliente.celular);
    expect(abrirWhatsapp).toHaveBeenCalledWith(citas[0]!.cliente.celular);
  });

  it("abre la cita desde el enlace de la tarjeta y desde una fila", async () => {
    servidor({ ...sesion, "GET /yo/citas": citas });
    const { router } = pintarApp("/panel/hoy");
    await userEvent.click(await screen.findByRole("link", { name: "Ver la cita de Luz Dary Pineda" }));
    expect(ruta(router)).toBe("/panel/citas/1");
  });

  it("sin citas pendientes lo dice; con atendidas, felicita", async () => {
    servidor({ ...sesion, "GET /yo/citas": [] });
    const a = pintarApp("/panel/hoy");
    expect(await screen.findByText("No tiene citas hoy")).toBeInTheDocument();
    a.unmount();
    servidor({ ...sesion, "GET /yo/citas": [cita({ id: 9, nombre: "Ana", min: -60, estado: "atendida" })] });
    pintarApp("/panel/hoy");
    expect(await screen.findByText("No le quedan citas hoy")).toBeInTheDocument();
    expect(screen.getByText("1 cita atendida hoy")).toBeInTheDocument();
  });

  it("una cita que ya terminó y sigue sin marcar aparece en «Sin marcar»", async () => {
    servidor({ ...sesion, "GET /yo/citas": [cita({ id: 7, nombre: "Pedro Pérez", min: -90 })] });
    pintarApp("/panel/hoy");
    const region = await screen.findByRole("region", { name: "Sin marcar" });
    expect(within(region).getByText("Pedro Pérez")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Siguiente cita" })).not.toBeInTheDocument();
  });

  it("las acciones del pie y la barra inferior llevan a su pantalla", async () => {
    servidor({ ...sesion, "GET /yo/citas": [] });
    const { router } = pintarApp("/panel/hoy");
    await screen.findByText("No tiene citas hoy");
    await userEvent.click(screen.getByRole("button", { name: "Nueva cita" }));
    expect(ruta(router)).toBe("/panel/nueva-cita");
    await router.navigate("/panel/hoy");
    await userEvent.click(await screen.findByRole("button", { name: "Bloquear horas" }));
    expect(ruta(router)).toBe("/panel/bloquear");
    await router.navigate("/panel/hoy");
    await userEvent.click(await screen.findByRole("button", { name: "Mi perfil" }));
    expect(ruta(router)).toBe("/panel/perfil");
    await router.navigate("/panel/hoy");
    await userEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(ruta(router)).toBe("/panel/semana");
  });

  it("sin conexión ofrece reintentar", async () => {
    const falso = servidor(sesion);
    falso.mockImplementation(async (p: Request) => {
      if (p.url.includes("/auth/yo")) return new Response(JSON.stringify(SOBANDERO), { status: 200 });
      throw new TypeError("Failed to fetch");
    });
    pintarApp("/panel/hoy");
    expect(await titulo("Sin conexión")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });
});

describe("Semana", () => {
  const JUEVES = "2099-11-12";
  const VIERNES = "2099-11-13";
  const del = (dia: string, id: number, nombre: string, hora: string) =>
    cita({ id, nombre, inicio: `${dia}T${hora}:00Z` });
  const semana = [
    del(JUEVES, 1, "Luz Dary Pineda", "14:30"),
    del(JUEVES, 2, "Hernán Castaño", "15:30"),
    del(VIERNES, 3, "Rosa Elvira Torres", "14:00"),
    del(VIERNES, 4, "Álvaro Ruiz", "15:00"),
    del(VIERNES, 5, "Marta Gómez", "16:00"),
  ];

  it("muestra los siete días y las citas del día elegido", async () => {
    const falso = servidor({ ...sesion, "GET /yo/citas": semana });
    const { container } = pintarApp(`/panel/semana?dia=${JUEVES}`);
    expect(await titulo("Su semana")).toBeInTheDocument();
    expect(screen.getByText("Semana del 9 al 15 de noviembre")).toBeInTheDocument();
    const dias = within(screen.getByRole("navigation", { name: "Días de la semana" })).getAllByRole("button");
    expect(dias).toHaveLength(7);
    expect(screen.getByRole("button", { name: etiquetaDia(JUEVES) })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { level: 2, name: "Jueves 12 · 2 citas" })).toBeInTheDocument();
    expect(screen.getByText("Hernán Castaño")).toBeInTheDocument();
    expect(screen.queryByText("Marta Gómez")).not.toBeInTheDocument();
    expect(screen.getByText("Viernes 13 tiene 3 citas")).toBeInTheDocument();

    const url = new URL((falso.mock.calls.find(([p]) => (p as Request).url.includes("/yo/citas"))![0] as Request).url);
    expect(url.searchParams.get("semana")).toBe("2099-11-09"); // el lunes de esa semana
    expect(await axe(container)).toHaveNoViolations();
  });

  it("tocar un día lo pone en la URL y cambia la lista sin volver a pedir la semana", async () => {
    const falso = servidor({ ...sesion, "GET /yo/citas": semana });
    const { router } = pintarApp(`/panel/semana?dia=${JUEVES}`);
    await screen.findByText("Hernán Castaño");
    await userEvent.click(screen.getByRole("button", { name: etiquetaDia(VIERNES) }));
    expect(ruta(router)).toBe(`/panel/semana?dia=${VIERNES}`);
    expect(await screen.findByRole("heading", { level: 2, name: "Viernes 13 · 3 citas" })).toBeInTheDocument();
    expect(falso.mock.calls.filter(([p]) => (p as Request).url.includes("/yo/citas"))).toHaveLength(1);
  });

  it("un día sin citas ofrece nueva cita y bloquear horas para ese día", async () => {
    servidor({ ...sesion, "GET /yo/citas": semana });
    const { router, container } = pintarApp("/panel/semana?dia=2099-11-14");
    expect(await screen.findByText("No tiene citas este día")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Nueva cita" }));
    expect(ruta(router)).toBe("/panel/nueva-cita?dia=2099-11-14");
    await router.navigate("/panel/semana?dia=2099-11-14");
    await userEvent.click(await screen.findByRole("button", { name: "Bloquear horas" }));
    expect(ruta(router)).toBe("/panel/bloquear?dia=2099-11-14");
  });

  it("sin día en la URL, o con uno inválido, abre la semana de hoy", async () => {
    servidor({ ...sesion, "GET /yo/citas": [] });
    pintarApp("/panel/semana?dia=basura");
    const hoy = diaBogota(new Date());
    expect(await screen.findByRole("button", { name: etiquetaDia(hoy) })).toHaveAttribute("aria-pressed", "true");
  });
});

