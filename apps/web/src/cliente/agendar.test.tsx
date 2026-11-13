import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { borrarBorrador } from "./estadoAgendar";
import { CARLOS, CITA, MARCELA, NEGOCIO, pintar, ruta, servidor } from "./pruebas";

beforeEach(() => borrarBorrador());
afterEach(() => vi.unstubAllGlobals());

// Viernes 13 de noviembre de 2099 (Bogotá): 8:00, 8:30, 10:30 y 14:00.
const DIA = "2099-11-13";
const HORAS = ["2099-11-13T13:00:00Z", "2099-11-13T13:30:00Z", "2099-11-13T15:30:00Z", "2099-11-13T19:00:00Z"];
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const sumar = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const API_BASE = {
  "GET /publico/negocio": NEGOCIO,
  "GET /publico/sobanderos": [CARLOS, MARCELA],
  "GET /publico/sobanderos/3/horas": { dia: DIA, duracion_min: 30, horas: HORAS },
};

describe("Paso 1 · Elegir sobandero", () => {
  it("muestra el primer turno y a cada sobandero con su próximo cupo", async () => {
    servidor(API_BASE);
    const { container, router } = pintar("/agendar");
    expect(await screen.findByRole("heading", { level: 1, name: "Elija con quién" })).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Primer turno disponible/ })).toHaveTextContent("con Carlos");
    expect(screen.getByRole("button", { name: /Marcela/ })).toHaveTextContent("Próximo cupo:");
    expect(screen.getByRole("link", { name: "Llamar a la sobandería" })).toHaveAttribute("href", "tel:+573001112233");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /Marcela/ }));
    expect(ruta(router)).toBe("/agendar/4/dia");
  });

  it("«Primer turno disponible» lleva al sobandero con el cupo más cercano y a su día", async () => {
    servidor(API_BASE);
    const { router } = pintar("/agendar");
    await userEvent.click(await screen.findByRole("button", { name: /Primer turno disponible/ }));
    expect(ruta(router)).toBe("/agendar/3/dia?dia=2099-01-05");
  });

  it("un sobandero sin cupos no se puede elegir", async () => {
    servidor({ ...API_BASE, "GET /publico/sobanderos": [{ ...CARLOS, proximo_cupo: null }] });
    pintar("/agendar");
    expect(await screen.findByRole("button", { name: /Carlos/ })).toBeDisabled();
    expect(screen.queryByText("Primer turno disponible")).not.toBeInTheDocument();
  });

  it("sin conexión muestra la pantalla para reintentar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    pintar("/agendar");
    expect(await screen.findByRole("heading", { level: 1, name: "Sin conexión" })).toBeInTheDocument();
  });
});

describe("Paso 2 · Elegir día", () => {
  const manana = () => sumar(hoy(), 1);
  const api = () => servidor({ ...API_BASE, "GET /publico/sobanderos/3/dias": { dias: [manana()] } });

  it("apaga los días sin cupos y guarda el día elegido en la URL", async () => {
    api();
    const { container, router } = pintar("/agendar/3/dia");
    expect(await screen.findByRole("heading", { level: 1, name: "Elija el día" })).toBeInTheDocument();
    expect(screen.getByText("Paso 2 de 4")).toBeInTheDocument();
    expect(screen.getByText("Con Carlos")).toBeInTheDocument();
    const continuar = screen.getByRole("button", { name: "Continuar" });
    expect(continuar).toBeDisabled();
    for (const apagado of screen.getAllByRole("button", { name: /Sin cupos/ })) expect(apagado).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /Mañana · Hay cupos/ }));
    expect(ruta(router)).toBe(`/agendar/3/dia?dia=${manana()}`);
    await userEvent.click(continuar);
    expect(ruta(router)).toBe(`/agendar/3/hora?dia=${manana()}`);
  });

  it("recargar con el día en la URL lo deja elegido", async () => {
    api();
    pintar(`/agendar/3/dia?dia=${manana()}`);
    const fila = await screen.findByRole("button", { name: /Mañana · Hay cupos/ });
    expect(fila).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("«Cambiar» vuelve al Paso 1 y «Atrás» también", async () => {
    api();
    const { router } = pintar("/agendar/3/dia");
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar" }));
    expect(ruta(router)).toBe("/agendar");
  });

  it("un sobandero que no existe da «No encontramos esa página»", async () => {
    servidor(API_BASE);
    pintar("/agendar/99/dia");
    expect(await screen.findByRole("heading", { level: 1, name: "No encontramos esa página" })).toBeInTheDocument();
  });
});

describe("Paso 3 · Elegir hora", () => {
  it("separa mañana y tarde, guarda la hora en la URL y avanza al Paso 4", async () => {
    servidor(API_BASE);
    const { container, router } = pintar(`/agendar/3/hora?dia=${DIA}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Elija la hora" })).toBeInTheDocument();
    expect(screen.getByText("Viernes 13 de noviembre")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Mañana" })).getAllByRole("button")).toHaveLength(3);
    expect(within(screen.getByRole("region", { name: "Tarde" })).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Cada cita dura 30 minutos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /^10:30/ }));
    expect(ruta(router)).toBe(`/agendar/3/hora?dia=${DIA}&hora=10%3A30`);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(ruta(router)).toBe(`/agendar/3/datos?dia=${DIA}&hora=10%3A30`);
  });

  it("recargar con día y hora en la URL deja la hora marcada", async () => {
    servidor(API_BASE);
    pintar(`/agendar/3/hora?dia=${DIA}&hora=10:30`);
    expect(await screen.findByRole("button", { name: /^10:30/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("sin día válido en la URL vuelve al Paso 2", async () => {
    servidor({ ...API_BASE, "GET /publico/sobanderos/3/dias": { dias: [] } });
    const { router } = pintar("/agendar/3/hora?dia=hoy");
    await screen.findByRole("heading", { level: 1, name: "Elija el día" });
    expect(ruta(router)).toBe("/agendar/3/dia");
  });

  it("Sin horas libres: lo explica y ofrece otro día u otro sobandero", async () => {
    servidor({ ...API_BASE, "GET /publico/sobanderos/3/horas": { dia: DIA, duracion_min: 30, horas: [] } });
    const { container, router } = pintar(`/agendar/3/hora?dia=${DIA}`);
    expect(await screen.findByText("Carlos no tiene horas libres ese día")).toBeInTheDocument();
    expect(screen.getByText("Pruebe con otro día o con otro sobandero.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Elegir otro sobandero" }));
    expect(ruta(router)).toBe("/agendar");
  });
});

describe("Paso 4 · Sus datos", () => {
  const DATOS = `/agendar/3/datos?dia=${DIA}&hora=10:30`;
  const creada = { token: "tok-123", cita: CITA };

  async function llenar(nombre = "María Gómez", celular = "300 123 4567", acepta = true) {
    await userEvent.type(await screen.findByLabelText("Nombre completo"), nombre);
    await userEvent.type(screen.getByLabelText("Número de celular"), celular);
    if (acepta) await userEvent.click(screen.getByRole("checkbox"));
  }

  it("resume la cita y ofrece ver la política", async () => {
    servidor(API_BASE);
    const { container } = pintar(DATOS);
    expect(await screen.findByRole("heading", { level: 1, name: "Sus datos" })).toBeInTheDocument();
    expect(screen.getByText("Paso 4 de 4")).toBeInTheDocument();
    expect(screen.getByText("Con Carlos")).toBeInTheDocument();
    expect(screen.getByText("Viernes 13 de noviembre")).toBeInTheDocument();
    expect(screen.getByText("10:30 a. m. · 30 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver política" })).toHaveAttribute("href", "/politica");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra los errores como Paso4-Errores y no envía nada", async () => {
    const falso = servidor({ ...API_BASE, "POST /publico/citas": { estado: 201, cuerpo: creada } });
    pintar(DATOS);
    await llenar("María Gómez", "300 12", false);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));
    expect(await screen.findByText("Escriba los 10 dígitos de su celular.")).toBeInTheDocument();
    expect(screen.getByText("Para agendar, necesitamos que lo acepte.")).toBeInTheDocument();
    expect(falso.mock.calls.some(([p]) => (p as Request).method === "POST")).toBe(false);
  });

  it("confirma: envía el celular normalizado y pasa a Cita confirmada", async () => {
    let cuerpo: Record<string, unknown> = {};
    servidor({
      ...API_BASE,
      "POST /publico/citas": async (p: Request) => {
        cuerpo = (await p.json()) as Record<string, unknown>;
        return { estado: 201, cuerpo: creada };
      },
      "GET /mi-cita/tok-123": CITA,
    });
    const { router } = pintar(DATOS);
    await llenar();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita quedó agendada" })).toBeInTheDocument();
    expect(ruta(router)).toBe("/agendar/listo/tok-123");
    expect(cuerpo).toEqual({
      sobandero_id: 3,
      inicio: "2099-11-13T15:30:00.000Z",
      nombre: "María Gómez",
      celular: "+573001234567",
      consentimiento: true,
    });
  });

  it("recargar no pierde el nombre ni el celular", async () => {
    servidor(API_BASE);
    const primera = pintar(DATOS);
    await llenar();
    primera.unmount();
    pintar(DATOS);
    expect(await screen.findByLabelText("Nombre completo")).toHaveValue("María Gómez");
    expect(screen.getByLabelText("Número de celular")).toHaveValue("300 123 4567");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("sin la hora en la URL vuelve al Paso 3", async () => {
    servidor(API_BASE);
    const { router } = pintar(`/agendar/3/datos?dia=${DIA}`);
    await screen.findByRole("heading", { level: 1, name: "Elija la hora" });
    expect(ruta(router)).toBe(`/agendar/3/hora?dia=${DIA}`);
  });
});

describe("Hora ocupada (409 al confirmar)", () => {
  const DATOS = `/agendar/3/datos?dia=${DIA}&hora=10:30`;
  const alternativas = ["2099-11-13T16:00:00Z", "2099-11-13T19:00:00Z", "2099-11-14T13:00:00Z"];
  const ocupada = { estado: 409, cuerpo: { codigo: "hora_ocupada", mensaje: "Esa hora ya se ocupó.", alternativas } };

  async function chocar() {
    servidor({ ...API_BASE, "POST /publico/citas": ocupada });
    const vista = pintar(DATOS);
    await userEvent.type(await screen.findByLabelText("Nombre completo"), "María Gómez");
    await userEvent.type(screen.getByLabelText("Número de celular"), "300 123 4567");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));
    return vista;
  }

  it("dice que la hora se ocupó y ofrece las alternativas de la API", async () => {
    const { container } = await chocar();
    expect(await screen.findByRole("heading", { level: 1, name: "Esa hora ya se ocupó" })).toBeInTheDocument();
    expect(screen.getByText("Alguien agendó las 10:30 a. m.")).toBeInTheDocument();
    expect(screen.getByText(/sus datos se conservan/)).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Otras horas libres con Carlos" });
    expect(within(region).getAllByRole("button")).toHaveLength(3);
    expect(within(region).getByText("Sábado 14 de noviembre")).toBeInTheDocument(); // alternativa de otro día
    expect(await axe(container)).toHaveNoViolations();
  });

  it("al elegir otra hora vuelve al Paso 4 con los datos intactos y la hora nueva", async () => {
    const { router } = await chocar();
    const region = await screen.findByRole("region", { name: "Otras horas libres con Carlos" });
    await userEvent.click(within(region).getByRole("button", { name: /^11:00/ }));
    expect(ruta(router)).toBe(`/agendar/3/datos?dia=${DIA}&hora=11%3A00`);
    expect(await screen.findByRole("heading", { level: 1, name: "Sus datos" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("María Gómez");
    expect(screen.getByLabelText("Número de celular")).toHaveValue("300 123 4567");
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("11:00 a. m. · 30 min")).toBeInTheDocument();
  });

  it("«Ver todas las horas» lleva al Paso 3 del mismo día", async () => {
    const { router } = await chocar();
    await userEvent.click(await screen.findByRole("button", { name: "Ver todas las horas" }));
    await waitFor(() => expect(ruta(router)).toBe(`/agendar/3/hora?dia=${DIA}`));
  });

  it("si la segunda persona se demora, la primera conserva la cita (un solo POST por intento)", async () => {
    const falso = servidor({ ...API_BASE, "POST /publico/citas": ocupada });
    pintar(DATOS);
    await userEvent.type(await screen.findByLabelText("Nombre completo"), "María Gómez");
    await userEvent.type(screen.getByLabelText("Número de celular"), "300 123 4567");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));
    await screen.findByText("Esa hora ya se ocupó");
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "POST")).toHaveLength(1);
  });
});

describe("Cita confirmada", () => {
  it("muestra la hora grande, el aviso de WhatsApp y lleva a Gestionar", async () => {
    servidor({ ...API_BASE, "GET /mi-cita/tok-123": CITA });
    const { container, router } = pintar("/agendar/listo/tok-123");
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita quedó agendada" })).toBeInTheDocument();
    const tarjeta = screen.getByRole("region", { name: "Su cita" });
    expect(tarjeta).toHaveTextContent("10:30 a. m.");
    expect(tarjeta).toHaveTextContent("Viernes 13 de noviembre");
    expect(tarjeta).toHaveTextContent("Con Carlos · Sesión de 30 minutos");
    expect(screen.getByText("Confirmación enviada por WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Le recordaremos su cita un día antes.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Cambiar o cancelar la cita" }));
    expect(ruta(router)).toBe("/mi-cita/tok-123");
  });
});
