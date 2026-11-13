import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import type { FilaActividad } from "./consultas";
import { ADMIN, pintarApp, ruta, RESUMEN, servidor } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const base = { "GET /auth/yo": ADMIN };

const NEGOCIO = { nombre: "Sobandería La Esperanza", direccion: "Carrera 7 # 12-34", telefono: "+573001112233", mensaje_bienvenida: "Agende su cita en un minuto." };

function registrar(respuesta: unknown, estado = 200) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    const texto = await p.text();
    cuerpos.push(texto ? JSON.parse(texto) : null);
    return { estado, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

describe("Resumen: enlaces", () => {
  it("lleva a Datos del negocio y al Registro de actividad", async () => {
    servidor({ ...base, "GET /admin/resumen": RESUMEN, "GET /admin/negocio": NEGOCIO, "GET /admin/actividad": [] });
    const { router } = pintarApp("/admin/hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Datos del negocio/ }));
    expect(ruta(router)).toBe("/admin/negocio");
    await router.navigate("/admin/hoy");
    await userEvent.click(await screen.findByRole("button", { name: /Registro de actividad/ }));
    expect(ruta(router)).toBe("/admin/actividad");
  });
});

describe("Datos del negocio", () => {
  it("muestra lo guardado con su etiqueta visible", async () => {
    servidor({ ...base, "GET /admin/negocio": NEGOCIO });
    const { container } = pintarApp("/admin/negocio");
    expect(await titulo("Datos del negocio")).toBeInTheDocument();
    expect(await screen.findByLabelText("Nombre")).toHaveValue("Sobandería La Esperanza");
    expect(screen.getByLabelText("Dirección")).toHaveValue("Carrera 7 # 12-34");
    expect(screen.getByLabelText("Teléfono")).toHaveValue("+573001112233");
    expect(screen.getByLabelText("Mensaje de bienvenida")).toHaveValue("Agende su cita en un minuto.");
    expect(screen.getByText("Se muestra en la pantalla de inicio.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("guarda, vuelve al Resumen con aviso y pone al día el Inicio del cliente", async () => {
    const { cuerpos, manejador } = registrar({ ...NEGOCIO, nombre: "Sobandería Nueva" });
    servidor({ ...base, "GET /admin/negocio": NEGOCIO, "PUT /admin/negocio": manejador, "GET /admin/resumen": RESUMEN });
    const { router, cliente } = pintarApp("/admin/negocio");
    cliente.setQueryData(["negocio"], NEGOCIO);
    const nombre = await screen.findByLabelText("Nombre");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "  Sobandería Nueva ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await titulo("Resumen del día")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ ...NEGOCIO, nombre: "Sobandería Nueva" }]);
    expect(ruta(router)).toBe("/admin/hoy");
    expect(screen.getByText("Datos del negocio guardados.")).toBeInTheDocument();
    expect(cliente.getQueryState(["negocio"])?.isInvalidated).toBe(true);
  });

  it("dice qué hacer en cada campo y no llama a la API si algo falta", async () => {
    const falso = servidor({ ...base, "GET /admin/negocio": NEGOCIO });
    pintarApp("/admin/negocio");
    for (const etiqueta of ["Nombre", "Dirección", "Mensaje de bienvenida"]) await userEvent.clear(await screen.findByLabelText(etiqueta));
    const telefono = screen.getByLabelText("Teléfono");
    await userEvent.clear(telefono);
    await userEvent.type(telefono, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Escriba el nombre del negocio.")).toBeInTheDocument();
    expect(screen.getByText("Escriba la dirección del local.")).toBeInTheDocument();
    expect(screen.getByText(/Escriba un teléfono válido/)).toBeInTheDocument();
    expect(screen.getByText("Escriba el mensaje de bienvenida.")).toBeInTheDocument();
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "PUT")).toHaveLength(0);
  });

  it("sin conexión conserva lo escrito y lo dice", async () => {
    servidor({ ...base, "GET /admin/negocio": NEGOCIO, "PUT /admin/negocio": () => { throw new TypeError("sin red"); } });
    pintarApp("/admin/negocio");
    const direccion = await screen.findByLabelText("Dirección");
    await userEvent.clear(direccion);
    await userEvent.type(direccion, "Calle nueva 1");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión. Revise su internet e inténtelo de nuevo.");
    expect(screen.getByLabelText("Dirección")).toHaveValue("Calle nueva 1");
  });
});

describe("Registro de actividad", () => {
  const fila = (id: number, texto: string, quien = "Marta", creado_en = "2020-03-04T20:30:00Z"): FilaActividad => ({ id, creado_en, quien, texto, accion: "x" });

  it("lista lo más reciente primero, con quién y cuándo", async () => {
    servidor({
      ...base,
      "GET /admin/actividad": [fila(3, "Dio de baja a Carlos y canceló 8 citas con aviso."), fila(2, "Cambió el horario de Marcela."), fila(1, "Creó la cuenta de Juliana.")],
    });
    const { container } = pintarApp("/admin/actividad");
    expect(await titulo("Registro de actividad")).toBeInTheDocument();
    const lista = await screen.findByRole("list", { name: "Actividad" });
    const filas = within(lista).getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual([
      "Dio de baja a Carlos y canceló 8 citas con aviso.Marta · Miércoles 4 de marzo · 3:30 p. m.",
      "Cambió el horario de Marcela.Marta · Miércoles 4 de marzo · 3:30 p. m.",
      "Creó la cuenta de Juliana.Marta · Miércoles 4 de marzo · 3:30 p. m.",
    ]);
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("«Ver más» pide las filas anteriores a la última vista", async () => {
    const pagina1 = Array.from({ length: 30 }, (_, i) => fila(100 - i, `Cambio ${100 - i}`));
    const pagina2 = [fila(70, "Cambio 70"), fila(69, "Cambio 69")];
    const falso = servidor({
      ...base,
      "GET /admin/actividad": (p: Request) => ({ cuerpo: new URL(p.url).searchParams.get("antes") === "71" ? pagina2 : pagina1 }),
    });
    pintarApp("/admin/actividad");
    await userEvent.click(await screen.findByRole("button", { name: "Ver más" }));
    expect(await screen.findByText("Cambio 69")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(32);
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
    const pedidas = falso.mock.calls.map(([p]) => new URL((p as Request).url)).filter((u) => u.pathname.endsWith("/admin/actividad"));
    expect(pedidas.map((u) => u.searchParams.get("antes"))).toEqual([null, "71"]);
  });

  it("sin actividad lo explica", async () => {
    servidor({ ...base, "GET /admin/actividad": [] });
    pintarApp("/admin/actividad");
    expect(await screen.findByText("Todavía no hay actividad")).toBeInTheDocument();
  });

  it("si falla «Ver más» conserva la lista y avisa", async () => {
    const pagina1 = Array.from({ length: 30 }, (_, i) => fila(100 - i, `Cambio ${100 - i}`));
    servidor({
      ...base,
      "GET /admin/actividad": (p: Request) => {
        if (new URL(p.url).searchParams.get("antes")) throw new TypeError("sin red");
        return { cuerpo: pagina1 };
      },
    });
    pintarApp("/admin/actividad");
    await userEvent.click(await screen.findByRole("button", { name: "Ver más" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión");
    expect(screen.getAllByRole("listitem")).toHaveLength(30);
  });

  it("sin conexión desde el inicio ofrece reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (p: Request) => {
        if (p.url.endsWith("/auth/yo")) return new Response(JSON.stringify(ADMIN), { status: 200 });
        throw new TypeError("sin red");
      }),
    );
    pintarApp("/admin/actividad");
    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });
});
