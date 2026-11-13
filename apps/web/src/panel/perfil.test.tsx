import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { pintarApp, ruta, servidor, SIN_SESION, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const escribir = (campo: string, texto: string) => userEvent.type(screen.getByLabelText(campo), texto);
const PERFIL = { nombre: "Carlos Mejía", correo: "carlos@ejemplo.com", duracion_min: 30 };
const sesion = { "GET /auth/yo": SOBANDERO, "GET /yo/perfil": PERFIL, "GET /yo/citas": [] };

function registrar(respuesta: unknown, estado = 200) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    cuerpos.push(await p.json());
    return { estado, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

describe("Mi perfil", () => {
  it("muestra nombre, correo y las opciones", async () => {
    servidor(sesion);
    const { container, router } = pintarApp("/panel/perfil");
    expect(await titulo("Mi perfil")).toBeInTheDocument();
    expect(await screen.findByLabelText("Nombre")).toHaveValue("Carlos Mejía");
    expect(screen.getByText("carlos@ejemplo.com")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: /^Mi correo/ }));
    expect(ruta(router)).toBe("/panel/perfil/correo");
    await router.navigate("/panel/perfil");
    await userEvent.click(await screen.findByRole("button", { name: "Cambiar mi clave" }));
    expect(ruta(router)).toBe("/panel/perfil/clave");
  });

  it("guarda el nombre y vuelve a Hoy, que ya saluda con el nombre nuevo", async () => {
    const r = registrar({ ...PERFIL, nombre: "Carlos Andrés" });
    servidor({ ...sesion, "PATCH /yo/perfil": r.manejador });
    const { router } = pintarApp("/panel/perfil");
    const campo = await screen.findByLabelText("Nombre");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Carlos Andrés");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(r.cuerpos).toEqual([{ nombre: "Carlos Andrés" }]);
    expect(await screen.findByRole("heading", { level: 1, name: /, Carlos$/ })).toBeInTheDocument();
  });

  it("sin cambios no pide nada; un nombre vacío se explica", async () => {
    const r = registrar(PERFIL);
    servidor({ ...sesion, "PATCH /yo/perfil": r.manejador });
    const { router } = pintarApp("/panel/perfil");
    const campo = await screen.findByLabelText("Nombre");
    await userEvent.clear(campo);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText("Escriba su nombre.")).toBeInTheDocument();
    await userEvent.type(campo, "Carlos Mejía");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(r.cuerpos).toHaveLength(0);
  });

  it("cerrar sesión llama a la API y lleva al ingreso", async () => {
    let cerrada = false;
    servidor({
      ...sesion,
      "POST /auth/salida": () => {
        cerrada = true;
        return { estado: 204, cuerpo: null };
      },
    });
    const { router } = pintarApp("/panel/perfil");
    await userEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/ingreso"));
    expect(cerrada).toBe(true);
  });
});

describe("Cambiar mi correo", () => {
  it("pide el correo nuevo y la clave actual, y vuelve al perfil avisando", async () => {
    let actual = PERFIL;
    const cuerpos: unknown[] = [];
    servidor({
      ...sesion,
      "GET /yo/perfil": () => ({ cuerpo: actual }),
      "PATCH /yo/perfil": async (p: Request) => {
        cuerpos.push(await p.json());
        actual = { ...PERFIL, correo: "nuevo@ejemplo.com" };
        return { cuerpo: actual };
      },
    });
    const { router, container } = pintarApp("/panel/perfil/correo");
    expect(await titulo("Cambiar mi correo")).toBeInTheDocument();
    expect(screen.getByText("Para su seguridad, escriba su clave actual.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await escribir("Correo nuevo", "nuevo@ejemplo.com");
    await escribir("Clave actual", "mi-clave-actual");
    await userEvent.click(screen.getByRole("button", { name: "Guardar correo" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/perfil"));
    expect(cuerpos).toEqual([{ correo: "nuevo@ejemplo.com", clave_actual: "mi-clave-actual" }]);
    expect(await screen.findByText("Su correo cambió.")).toBeInTheDocument();
    expect(screen.getByText("nuevo@ejemplo.com")).toBeInTheDocument();
  });

  it("explica qué falta y no envía nada", async () => {
    const r = registrar(PERFIL);
    servidor({ ...sesion, "PATCH /yo/perfil": r.manejador });
    pintarApp("/panel/perfil/correo");
    await titulo("Cambiar mi correo");
    await escribir("Correo nuevo", "sin-arroba");
    await userEvent.click(screen.getByRole("button", { name: "Guardar correo" }));
    expect(screen.getByText("Escriba un correo completo, por ejemplo nombre@correo.com.")).toBeInTheDocument();
    expect(screen.getByText("Escriba su clave actual.")).toBeInTheDocument();
    expect(r.cuerpos).toHaveLength(0);
  });

  it("una clave equivocada o un correo ya usado se explican sin cerrar la sesión", async () => {
    const falso = servidor({
      ...sesion,
      "PATCH /yo/perfil": { estado: 401, cuerpo: { codigo: "clave_incorrecta", mensaje: "La clave actual no es correcta." } },
    });
    const { router } = pintarApp("/panel/perfil/correo");
    await titulo("Cambiar mi correo");
    await escribir("Correo nuevo", "nuevo@ejemplo.com");
    await escribir("Clave actual", "equivocada");
    await userEvent.click(screen.getByRole("button", { name: "Guardar correo" }));
    expect(await screen.findByText("Esa no es su clave actual. Revise e inténtelo de nuevo.")).toBeInTheDocument();
    expect(ruta(router)).toBe("/panel/perfil/correo");

    falso.mockImplementation(async (p: Request) => {
      if (p.method === "PATCH") return new Response(JSON.stringify({ codigo: "correo_en_uso", mensaje: "Ese correo ya está en uso. Escriba otro." }), { status: 409 });
      return new Response(JSON.stringify(p.url.includes("/auth/yo") ? SOBANDERO : PERFIL), { status: 200 });
    });
    await userEvent.click(screen.getByRole("button", { name: "Guardar correo" }));
    expect(await screen.findByText("Ese correo ya está en uso. Escriba otro.")).toBeInTheDocument();
  });
});

describe("Cambiar mi clave", () => {
  it("cambia la clave y muestra «Su clave cambió» con el correo del aviso", async () => {
    const r = registrar(null, 204);
    servidor({ ...sesion, "POST /auth/cambiar-clave": r.manejador });
    const { router, container } = pintarApp("/panel/perfil/clave");
    expect(await titulo("Cambiar mi clave")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await escribir("Clave actual", "mi-clave-actual");
    await escribir("Clave nueva", "mi-clave-nueva");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi clave" }));
    expect(await titulo("Su clave cambió")).toBeInTheDocument();
    expect(ruta(router)).toBe("/panel/perfil/clave-cambiada");
    expect(r.cuerpos).toEqual([{ clave_actual: "mi-clave-actual", clave_nueva: "mi-clave-nueva" }]);
    expect(screen.getByText("Le enviamos un aviso a carlos@ejemplo.com. Si no fue usted, escríbale al administrador.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("link", { name: "Volver a mi perfil" }));
    expect(ruta(router)).toBe("/panel/perfil");
  });

  it("una clave nueva de menos de 8 caracteres no se envía", async () => {
    const r = registrar(null, 204);
    servidor({ ...sesion, "POST /auth/cambiar-clave": r.manejador });
    pintarApp("/panel/perfil/clave");
    await titulo("Cambiar mi clave");
    await escribir("Clave actual", "mi-clave-actual");
    await escribir("Clave nueva", "abc12");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi clave" }));
    expect(screen.getByText("Escriba al menos 8 caracteres.")).toBeInTheDocument();
    expect(r.cuerpos).toHaveLength(0);
  });

  it("una clave actual equivocada se explica y la sesión sigue", async () => {
    servidor({
      ...sesion,
      "POST /auth/cambiar-clave": { estado: 401, cuerpo: { codigo: "clave_incorrecta", mensaje: "La clave actual no es correcta." } },
    });
    const { router } = pintarApp("/panel/perfil/clave");
    await titulo("Cambiar mi clave");
    await escribir("Clave actual", "equivocada");
    await escribir("Clave nueva", "mi-clave-nueva");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar mi clave" }));
    expect(await screen.findByText("Esa no es su clave actual. Revise e inténtelo de nuevo.")).toBeInTheDocument();
    expect(ruta(router)).toBe("/panel/perfil/clave");
  });
});

describe("Sesión vencida en el panel", () => {
  it("si una consulta responde 401 con sesión abierta, lleva a «Su sesión terminó»", async () => {
    servidor({ ...sesion, "GET /yo/clientes": SIN_SESION });
    const { router } = pintarApp("/panel/clientes");
    expect(await titulo("Su sesión terminó")).toBeInTheDocument();
    expect(ruta(router)).toBe("/sesion-vencida");
  });
});
