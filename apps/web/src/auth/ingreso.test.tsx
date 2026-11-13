import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { ADMIN, CLAVE_TEMPORAL, pintarApp, ruta, servidor, SIN_SESION, SOBANDERO } from "../panel/pruebas";
import { leerClaveTemporal } from "./claveTemporal";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string) => screen.findByRole("heading", { level: 1, name: nombre });
const escribir = async (campo: string, texto: string) => userEvent.type(screen.getByLabelText(campo), texto);
const CORREO_MAL = { estado: 401, cuerpo: { codigo: "no_autorizado", mensaje: "Correo o clave incorrectos." } };

describe("Ingreso", () => {
  it("pide correo y clave, con enlaces a recuperar clave y a agendar", async () => {
    servidor({ "GET /auth/yo": SIN_SESION });
    const { container } = pintarApp("/ingreso");
    expect(await titulo("Ingrese a su cuenta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "¿Olvidó su clave?" })).toHaveAttribute("href", "/olvide-clave");
    expect(screen.getByRole("link", { name: "Agende aquí" })).toHaveAttribute("href", "/agendar");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("no envía nada si faltan campos y dice qué escribir", async () => {
    const falso = servidor({ "GET /auth/yo": SIN_SESION });
    pintarApp("/ingreso");
    await userEvent.click(await screen.findByRole("button", { name: "Entrar" }));
    expect(screen.getByText("Escriba su correo.")).toBeInTheDocument();
    expect(screen.getByText("Escriba su clave.")).toBeInTheDocument();
    expect(falso.mock.calls.some(([p]) => (p as Request).method === "POST")).toBe(false);
  });

  it("una clave incorrecta se explica bajo el campo y se queda en la pantalla", async () => {
    servidor({ "GET /auth/yo": SIN_SESION, "POST /auth/ingreso": CORREO_MAL });
    const { router, container } = pintarApp("/ingreso");
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "carlos@ejemplo.com");
    await escribir("Clave", "clave12");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o clave incorrectos. Revise e inténtelo de nuevo.");
    expect(ruta(router)).toBe("/ingreso");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("muestra el mensaje del límite de intentos y el de sin conexión", async () => {
    const falso = servidor({
      "GET /auth/yo": SIN_SESION,
      "POST /auth/ingreso": { estado: 429, cuerpo: { codigo: "demasiados_intentos", mensaje: "Hubo muchos intentos. Espere unos minutos e intente de nuevo." } },
    });
    pintarApp("/ingreso");
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "carlos@ejemplo.com");
    await escribir("Clave", "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Hubo muchos intentos. Espere unos minutos e intente de nuevo.")).toBeInTheDocument();

    falso.mockImplementation(async (p: Request) => {
      if (p.method === "POST") throw new TypeError("Failed to fetch");
      return new Response("{}", { status: 401 });
    });
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("No hay conexión. Revise su internet e inténtelo de nuevo.")).toBeInTheDocument();
  });

  it("un sobandero entra a Hoy y un administrador a su panel", async () => {
    servidor({ "GET /auth/yo": SIN_SESION, "POST /auth/ingreso": SOBANDERO });
    const a = pintarApp("/ingreso");
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "carlos@ejemplo.com");
    await escribir("Clave", "clave-larga-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(ruta(a.router)).toBe("/panel/hoy"));
    a.unmount();

    servidor({ "GET /auth/yo": SIN_SESION, "POST /auth/ingreso": ADMIN });
    const b = pintarApp("/ingreso");
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "marta@ejemplo.com");
    await escribir("Clave", "clave-larga-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(ruta(b.router)).toBe("/admin/hoy"));
  });

  it("vuelve a la página que se pedía antes de ingresar, pero solo si es de su área", async () => {
    servidor({ "GET /auth/yo": SIN_SESION, "POST /auth/ingreso": SOBANDERO });
    const a = pintarApp({ pathname: "/ingreso", state: { desde: "/panel/semana" } });
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "c@e.co");
    await escribir("Clave", "clave-larga-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(ruta(a.router)).toBe("/panel/semana"));
    a.unmount();

    servidor({ "GET /auth/yo": SIN_SESION, "POST /auth/ingreso": SOBANDERO });
    const b = pintarApp({ pathname: "/ingreso", state: { desde: "/admin/hoy" } });
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "c@e.co");
    await escribir("Clave", "clave-larga-1");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await vi.waitFor(() => expect(ruta(b.router)).toBe("/panel/hoy"));
  });

  it("quien ya tiene sesión pasa directo a su panel", async () => {
    servidor({ "GET /auth/yo": SOBANDERO });
    const { router } = pintarApp("/ingreso");
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
  });
});

describe("Primer ingreso", () => {
  it("con clave temporal va a «Cree su clave nueva» y la usa como clave actual sin volver a pedirla", async () => {
    let cuerpo: unknown;
    servidor({
      "GET /auth/yo": SIN_SESION,
      "POST /auth/ingreso": CLAVE_TEMPORAL,
      "POST /auth/cambiar-clave": async (p: Request) => {
        cuerpo = await p.json();
        return { estado: 204, cuerpo: null };
      },
    });
    const { router, container } = pintarApp("/ingreso");
    await titulo("Ingrese a su cuenta");
    await escribir("Correo", "carlos@ejemplo.com");
    await escribir("Clave", "temporal-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await titulo("Cree su clave nueva")).toBeInTheDocument();
    expect(ruta(router)).toBe("/primera-clave");
    expect(screen.queryByLabelText("Clave temporal")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    await escribir("Clave nueva", "mi-clave-nueva");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(cuerpo).toEqual({ clave_actual: "temporal-123", clave_nueva: "mi-clave-nueva" });
    expect(leerClaveTemporal()).toBeNull();
  });

  it("una clave de menos de 8 caracteres se explica y no se envía", async () => {
    const falso = servidor({ "GET /auth/yo": CLAVE_TEMPORAL });
    const { container } = pintarApp("/primera-clave");
    await titulo("Cree su clave nueva");
    await escribir("Clave temporal", "temporal-123");
    await escribir("Clave nueva", "abc12");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    expect(screen.getByText("Escriba al menos 8 caracteres.")).toBeInTheDocument();
    expect(falso.mock.calls.some(([p]) => (p as Request).method === "POST")).toBe(false);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("si se recargó la página pide también la clave temporal; una equivocada no cierra la sesión", async () => {
    servidor({
      "GET /auth/yo": CLAVE_TEMPORAL,
      "POST /auth/cambiar-clave": { estado: 401, cuerpo: { codigo: "clave_incorrecta", mensaje: "La clave actual no es correcta." } },
    });
    const { router } = pintarApp("/primera-clave");
    await titulo("Cree su clave nueva");
    await escribir("Clave temporal", "equivocada");
    await escribir("Clave nueva", "mi-clave-nueva");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    expect(await screen.findByText("Esa no es la clave temporal. Revise e inténtelo de nuevo.")).toBeInTheDocument();
    expect(ruta(router)).toBe("/primera-clave");
  });

  it("muestra el mensaje de la API si la clave nueva no sirve", async () => {
    servidor({
      "GET /auth/yo": CLAVE_TEMPORAL,
      "POST /auth/cambiar-clave": { estado: 422, cuerpo: { codigo: "validacion", mensaje: "La clave nueva debe ser distinta de la actual." } },
    });
    pintarApp("/primera-clave");
    await titulo("Cree su clave nueva");
    await escribir("Clave temporal", "temporal-123");
    await escribir("Clave nueva", "temporal-123");
    await userEvent.click(screen.getByRole("button", { name: "Guardar y entrar" }));
    expect(await screen.findByText("La clave nueva debe ser distinta de la actual.")).toBeInTheDocument();
  });
});

describe("Recuperar clave", () => {
  it("pide el correo y confirma a cuál lo envió", async () => {
    let cuerpo: unknown;
    servidor({
      "GET /auth/yo": SIN_SESION,
      "POST /auth/recuperar": async (p: Request) => {
        cuerpo = await p.json();
        return { cuerpo: { mensaje: "Si el correo está registrado, le enviamos un enlace." } };
      },
    });
    const { router, container } = pintarApp("/olvide-clave");
    expect(await titulo("Recupere su clave")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await escribir("Correo", "carlos@ejemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await titulo("Revise su correo")).toBeInTheDocument();
    expect(cuerpo).toEqual({ correo: "carlos@ejemplo.com" });
    expect(ruta(router)).toBe("/olvide-clave/enviado");
    expect(screen.getByText(/carlos@ejemplo.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Volver a ingresar" }));
    expect(ruta(router)).toBe("/ingreso");
  });

  it("crea la clave nueva con el enlace y vuelve al ingreso con un aviso", async () => {
    let cuerpo: unknown;
    servidor({
      "GET /auth/yo": SIN_SESION,
      "POST /auth/restablecer": async (p: Request) => {
        cuerpo = await p.json();
        return { estado: 204, cuerpo: null };
      },
    });
    const { router } = pintarApp("/restablecer/abc123");
    await titulo("Cree su clave nueva");
    await escribir("Clave nueva", "otra-clave-larga");
    await userEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/ingreso"));
    expect(cuerpo).toEqual({ token: "abc123", clave_nueva: "otra-clave-larga" });
    expect(await screen.findByText("Su clave cambió. Ingrese con la clave nueva.")).toBeInTheDocument();
  });

  it("un enlace vencido se explica aquí, con salida a pedir otro del personal", async () => {
    servidor({
      "GET /auth/yo": SIN_SESION,
      "POST /auth/restablecer": { estado: 410, cuerpo: { codigo: "enlace_vencido", mensaje: "Este enlace ya no sirve. Pida uno nuevo." } },
    });
    const { router, container } = pintarApp("/restablecer/viejo");
    await titulo("Cree su clave nueva");
    await escribir("Clave nueva", "otra-clave-larga");
    await userEvent.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(await titulo("Este enlace ya no sirve")).toBeInTheDocument();
    expect(ruta(router)).toBe("/restablecer/viejo"); // no lo manda al «Enlace vencido» del cliente
    expect(screen.getByRole("link", { name: "Pedir enlace nuevo" })).toHaveAttribute("href", "/olvide-clave");
    expect(await axe(container)).toHaveNoViolations();
  });
});
