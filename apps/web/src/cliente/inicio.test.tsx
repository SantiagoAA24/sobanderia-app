import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { NEGOCIO, pintar, ruta, servidor } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

describe("Inicio", () => {
  it("muestra la bienvenida, el teléfono y la dirección del local", async () => {
    servidor({ "GET /publico/negocio": NEGOCIO });
    const { container } = pintar("/");
    expect(screen.getByRole("heading", { level: 1, name: "Agende su cita en un minuto" })).toBeInTheDocument();
    expect(screen.getByText("Escoja con quién y cuándo. No necesita crear cuenta.")).toBeInTheDocument();
    expect(await screen.findByText("300 111 2233")).toBeInTheDocument();
    expect(screen.getByText("Calle 1 # 2-3")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sirve aunque los datos del local no carguen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    pintar("/");
    expect(screen.getByRole("link", { name: "Agendar mi cita" })).toHaveAttribute("href", "/agendar");
    expect(screen.getByRole("link", { name: "Ya tengo una cita" })).toHaveAttribute("href", "/encontrar-cita");
  });

  it("lleva a Instalar la app y de vuelta", async () => {
    servidor({ "GET /publico/negocio": NEGOCIO });
    const { router, container } = pintar("/");
    await userEvent.click(screen.getByRole("button", { name: /Tenga la app a la mano/ }));
    expect(ruta(router)).toBe("/instalar");
    expect(screen.getByRole("heading", { level: 1, name: "Tenga la app a la mano" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("link", { name: "Listo" }));
    expect(ruta(router)).toBe("/");
  });
});

describe("Política de datos (provisional)", () => {
  it("se abre desde Paso 4 y avisa que es un borrador", async () => {
    pintar("/politica");
    expect(screen.getByRole("heading", { level: 1, name: "Política de datos" })).toBeInTheDocument();
    expect(screen.getByText("Borrador pendiente de revisión legal.")).toBeInTheDocument();
  });
});

describe("Encontrar mi cita", () => {
  it("pide el celular, lo valida y responde igual exista o no la cita", async () => {
    let cuerpo: unknown = null;
    const falso = servidor({
      "POST /publico/mi-cita/enlace": async (p: Request) => {
        cuerpo = await p.json();
        return { estado: 202, cuerpo: { enviado: true } };
      },
    });
    const { router, container } = pintar("/encontrar-cita");
    expect(screen.getByRole("heading", { level: 1, name: "Encuentre su cita" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.type(screen.getByLabelText("Número de celular"), "300 12");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByText("Escriba los 10 dígitos de su celular.")).toBeInTheDocument();
    expect(falso).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText("Número de celular"));
    await userEvent.type(screen.getByLabelText("Número de celular"), "300 123 4567");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Revise su WhatsApp" })).toBeInTheDocument();
    expect(ruta(router)).toBe("/encontrar-cita/enviado");
    expect(cuerpo).toEqual({ celular: "+573001234567" });
    expect(screen.getByText(/Si ese número tiene una cita/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });

  it("si hubo demasiados intentos, dice qué hacer", async () => {
    servidor({
      "POST /publico/mi-cita/enlace": {
        estado: 429,
        cuerpo: { codigo: "demasiados_intentos", mensaje: "Hubo muchos intentos. Espere unos minutos e intente de nuevo." },
      },
    });
    pintar("/encontrar-cita");
    await userEvent.type(screen.getByLabelText("Número de celular"), "3001234567");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hubo muchos intentos. Espere unos minutos e intente de nuevo.");
  });
});
