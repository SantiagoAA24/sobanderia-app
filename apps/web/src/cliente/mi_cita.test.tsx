import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { CARLOS, CITA, NEGOCIO, pintar, ruta, servidor } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const DIA = "2099-11-13";
const CANCELADA = { ...CITA, estado: "cancelada", puede_modificar: false };
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const manana = () => new Date(Date.parse(`${hoy()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

describe("Gestionar mi cita", () => {
  it("muestra la cita y ofrece cambiarla o cancelarla", async () => {
    servidor({ "GET /mi-cita/tok": CITA });
    const { container, router } = pintar("/mi-cita/tok");
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita" })).toBeInTheDocument();
    expect(screen.getByText("Con Carlos")).toBeInTheDocument();
    expect(screen.getByText("Viernes 13 de noviembre")).toBeInTheDocument();
    expect(screen.getByText("10:30 a. m. · 30 min")).toBeInTheDocument();
    expect(screen.getByText("Si no puede asistir, avísenos con tiempo para ofrecer su hora a otra persona.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar mi cita" }));
    expect(ruta(router)).toBe("/mi-cita/tok/cancelar");
  });

  it("una cita que ya pasó no se puede cambiar", async () => {
    servidor({ "GET /mi-cita/tok": { ...CITA, puede_modificar: false, estado: "atendida" } });
    pintar("/mi-cita/tok");
    expect(await screen.findByText("Esta cita ya no se puede cambiar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar mi cita" })).not.toBeInTheDocument();
  });

  it("un enlace vencido (410) muestra «Este enlace ya no sirve»", async () => {
    servidor({ "GET /mi-cita/viejo": { estado: 410, cuerpo: { codigo: "enlace_vencido", mensaje: "Este enlace ya no sirve. Pida uno nuevo." } } });
    pintar("/mi-cita/viejo");
    expect(await screen.findByRole("heading", { level: 1, name: "Este enlace ya no sirve" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir enlace nuevo" })).toHaveAttribute("href", "/encontrar-cita");
  });

  it("una cita cancelada muestra «Su cita fue cancelada»", async () => {
    servidor({ "GET /mi-cita/tok": CANCELADA });
    pintar("/mi-cita/tok");
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita fue cancelada" })).toBeInTheDocument();
  });
});

describe("Cancelar mi cita", () => {
  it("la acción principal es conservar la cita", async () => {
    servidor({ "GET /mi-cita/tok": CITA });
    const { container, router } = pintar("/mi-cita/tok/cancelar");
    expect(await screen.findByRole("heading", { level: 1, name: "¿Quiere cancelar su cita?" })).toBeInTheDocument();
    expect(screen.getByText("Le avisaremos a Carlos para que ofrezca esa hora a otra persona.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "No, conservar mi cita" }));
    expect(ruta(router)).toBe("/mi-cita/tok");
  });

  it("confirmar cancela la cita y muestra «Su cita fue cancelada»", async () => {
    let estado = "agendada";
    servidor({
      "GET /mi-cita/tok": () => ({ cuerpo: estado === "cancelada" ? CANCELADA : CITA }),
      "POST /mi-cita/tok/cancelar": () => {
        estado = "cancelada";
        return { cuerpo: CANCELADA };
      },
    });
    const { router, container } = pintar("/mi-cita/tok/cancelar");
    await userEvent.click(await screen.findByRole("button", { name: "Sí, cancelar mi cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita fue cancelada" })).toBeInTheDocument();
    expect(ruta(router)).toBe("/mi-cita/tok/cancelada");
    expect(screen.getByText("Ya le avisamos a Carlos. Cuando quiera, puede agendar otra cita.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agendar otra cita" })).toHaveAttribute("href", "/agendar");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("si la cita ya no se puede cancelar, muestra el mensaje de la API", async () => {
    servidor({
      "GET /mi-cita/tok": CITA,
      "POST /mi-cita/tok/cancelar": { estado: 409, cuerpo: { codigo: "cita_no_modificable", mensaje: "Esta cita ya no se puede cambiar." } },
    });
    pintar("/mi-cita/tok/cancelar");
    await userEvent.click(await screen.findByRole("button", { name: "Sí, cancelar mi cita" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta cita ya no se puede cambiar.");
  });

  it("/cancelada con una cita activa vuelve a Gestionar", async () => {
    servidor({ "GET /mi-cita/tok": CITA });
    const { router } = pintar("/mi-cita/tok/cancelada");
    await screen.findByRole("heading", { level: 1, name: "Su cita" });
    expect(ruta(router)).toBe("/mi-cita/tok");
  });
});

describe("Cambiar día u hora (reutiliza los pasos 2 y 3)", () => {
  const horas = { dia: DIA, duracion_min: 30, horas: ["2099-11-13T13:00:00Z", "2099-11-13T16:00:00Z"] };

  it("no muestra pasos ni «Cambiar» de sobandero: el sobandero es el de la cita", async () => {
    servidor({ "GET /mi-cita/tok": CITA, "GET /publico/sobanderos/3/dias": { dias: [manana()] } });
    const { container } = pintar("/mi-cita/tok/cambiar/dia");
    expect(await screen.findByRole("heading", { level: 1, name: "Elija el día" })).toBeInTheDocument();
    expect(screen.queryByText(/Paso \d de 4/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("elegir día y hora reprograma la cita y vuelve a Gestionar con la hora nueva", async () => {
    const nueva = { ...CITA, inicio: "2099-11-13T16:00:00Z", fin: "2099-11-13T16:30:00Z" };
    let cuerpo: unknown = null;
    let actual = CITA;
    servidor({
      "GET /mi-cita/tok": () => ({ cuerpo: actual }),
      "GET /publico/sobanderos/3/horas": horas,
      "POST /mi-cita/tok/reprogramar": async (p: Request) => {
        cuerpo = await p.json();
        actual = nueva;
        return { cuerpo: nueva };
      },
    });
    const { router } = pintar(`/mi-cita/tok/cambiar/hora?dia=${DIA}`);
    await userEvent.click(await screen.findByRole("button", { name: /^11:00/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita" })).toBeInTheDocument();
    expect(ruta(router)).toBe("/mi-cita/tok");
    expect(cuerpo).toEqual({ inicio: "2099-11-13T16:00:00.000Z" });
    expect(screen.getByText("11:00 a. m. · 30 min")).toBeInTheDocument();
  });

  it("si la hora nueva se ocupó, muestra Hora ocupada y la cita vieja sigue en pie", async () => {
    servidor({
      "GET /mi-cita/tok": CITA,
      "GET /publico/sobanderos/3/horas": horas,
      "POST /mi-cita/tok/reprogramar": {
        estado: 409,
        cuerpo: { codigo: "hora_ocupada", mensaje: "Esa hora ya se ocupó.", alternativas: ["2099-11-13T13:00:00Z"] },
      },
    });
    const { router } = pintar(`/mi-cita/tok/cambiar/hora?dia=${DIA}`);
    await userEvent.click(await screen.findByRole("button", { name: /^11:00/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Esa hora ya se ocupó" })).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Otras horas libres con Carlos" });
    await userEvent.click(within(region).getByRole("button", { name: /^8:00/ }));
    expect(ruta(router)).toBe(`/mi-cita/tok/cambiar/hora?dia=${DIA}&hora=08%3A00`);
    expect(screen.getByRole("button", { name: /^8:00/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Recorrido completo: agendar, ver, cambiar y cancelar", () => {
  it("una persona sin cuenta agenda, cambia la hora y cancela", async () => {
    const dia = manana();
    let cita = { ...CITA, inicio: `${dia}T15:30:00Z`, fin: `${dia}T16:00:00Z` };
    servidor({
      "GET /publico/negocio": NEGOCIO,
      "GET /publico/sobanderos": [CARLOS],
      "GET /publico/sobanderos/3/dias": { dias: [dia] },
      "GET /publico/sobanderos/3/horas": { dia, duracion_min: 30, horas: [`${dia}T15:30:00Z`, `${dia}T16:00:00Z`] },
      "POST /publico/citas": { estado: 201, cuerpo: { token: "tok", cita } },
      "GET /mi-cita/tok": () => ({ cuerpo: cita }),
      "POST /mi-cita/tok/reprogramar": async (p: Request) => {
        const { inicio } = (await p.json()) as { inicio: string };
        cita = { ...cita, inicio, fin: new Date(Date.parse(inicio) + 30 * 60_000).toISOString() };
        return { cuerpo: cita };
      },
      "POST /mi-cita/tok/cancelar": () => {
        cita = { ...cita, estado: "cancelada", puede_modificar: false };
        return { cuerpo: cita };
      },
    });
    const { router } = pintar("/");

    await userEvent.click(screen.getByRole("link", { name: "Agendar mi cita" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Carlos/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Hay cupos/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(await screen.findByRole("button", { name: /^10:30/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.type(await screen.findByLabelText("Nombre completo"), "María Gómez");
    await userEvent.type(screen.getByLabelText("Número de celular"), "300 123 4567");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita quedó agendada" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cambiar o cancelar la cita" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar día u hora" }));
    await userEvent.click(await screen.findByRole("button", { name: /Hay cupos/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(await screen.findByRole("button", { name: /^11:00/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi cita" }));
    expect(await screen.findByText("11:00 a. m. · 30 min")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar mi cita" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sí, cancelar mi cita" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Su cita fue cancelada" })).toBeInTheDocument();
    expect(ruta(router)).toBe("/mi-cita/tok/cancelada");
  });
});
