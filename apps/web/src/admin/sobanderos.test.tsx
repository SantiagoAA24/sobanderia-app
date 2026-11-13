import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { textoDias, resumenHorario } from "./formato";
import { ADMIN, pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";
import type { SobanderoAdmin } from "./consultas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const MANANA = [{ desde: "08:00", hasta: "12:00" }, { desde: "14:00", hasta: "17:00" }];

const sob = (cambios: Partial<SobanderoAdmin> = {}): SobanderoAdmin => ({
  id: 3,
  nombre: "Carlos Mejía",
  correo: "carlos@ejemplo.com",
  activo: true,
  recibe_citas: true,
  duracion_min: 30,
  baja_en: null,
  dias: [0, 1, 2, 3, 4, 5],
  citas_proximas: 8,
  ...cambios,
});

const HORARIO = {
  duracion_min: 30,
  dias: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia_semana: d, franjas: d < 5 ? MANANA : [] })),
};

/** Guarda el cuerpo de cada petición y responde `respuesta`. */
function registrar(respuesta: unknown, estado = 200) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    const texto = await p.text();
    cuerpos.push(texto ? JSON.parse(texto) : null);
    return { estado, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

const base = { "GET /auth/yo": ADMIN };

describe("textoDias y resumenHorario", () => {
  it("resume los días como en el lienzo", () => {
    expect(textoDias([0, 1, 2, 3, 4, 5])).toBe("Lun a sáb");
    expect(textoDias([0, 1, 2, 3, 4])).toBe("Lun a vie");
    expect(textoDias([1, 2, 3, 4, 5])).toBe("Mar a sáb");
    expect(textoDias([0, 2, 4])).toBe("Lun, mié y vie");
    expect(textoDias([0, 1])).toBe("Lun y mar");
    expect(textoDias([6])).toBe("Dom");
    expect(textoDias([])).toBe("Sin horario");
  });

  it("muestra las horas solo si todos los días son iguales", () => {
    expect(resumenHorario(HORARIO)).toBe("Lun a vie · 8:00 a. m. – 12:00 m. y 2:00 – 5:00 p. m.");
    const distinto = { ...HORARIO, dias: HORARIO.dias.map((d) => (d.dia_semana === 1 ? { ...d, franjas: [{ desde: "09:00", hasta: "10:00" }] } : d)) };
    expect(resumenHorario(distinto)).toBe("Lun a vie · Franjas distintas");
    expect(resumenHorario({ ...HORARIO, dias: HORARIO.dias.map((d) => ({ ...d, franjas: [] })) })).toBe("Sin horario");
  });
});

describe("Sobanderos", () => {
  const lista = [
    sob({ id: 3, nombre: "Carlos", dias: [0, 1, 2, 3, 4, 5] }),
    sob({ id: 4, nombre: "Marcela", dias: [0, 1, 2, 3, 4] }),
    sob({ id: 5, nombre: "Hernando", duracion_min: 45, dias: [1, 2, 3, 4, 5] }),
    sob({ id: 6, nombre: "Juliana", dias: [0, 2, 4], baja_en: "2030-01-01T15:00:00Z" }),
  ];

  it("lista a cada uno con sus días y duración", async () => {
    servidor({ ...base, "GET /admin/sobanderos": lista });
    const { container } = pintarApp("/admin/sobanderos");
    expect(await titulo("Sobanderos")).toBeInTheDocument();
    expect(await screen.findByText("4 sobanderos")).toBeInTheDocument();
    const filas = screen.getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("CarlosLun a sáb · 30 min"),
      expect.stringContaining("MarcelaLun a vie · 30 min"),
      expect.stringContaining("HernandoMar a sáb · 45 min"),
      expect.stringContaining("JulianaLun, mié y vie · 30 min · En baja"),
    ]);
    expect(screen.getByRole("button", { name: "Sobanderos" })).toHaveAttribute("aria-current", "page");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("abre la ficha y el formulario de uno nuevo", async () => {
    servidor({ ...base, "GET /admin/sobanderos": lista, "GET /admin/resumen": {}, "GET /admin/sobanderos/3": sob() });
    const { router } = pintarApp("/admin/sobanderos");
    await userEvent.click(await screen.findByRole("button", { name: /Marcela/ }));
    expect(ruta(router)).toBe("/admin/sobanderos/4");
    await router.navigate("/admin/sobanderos");
    await userEvent.click(await screen.findByRole("button", { name: "Agregar sobandero" }));
    expect(ruta(router)).toBe("/admin/sobanderos/nuevo");
  });

  it("sin sobanderos invita a agregar el primero", async () => {
    servidor({ ...base, "GET /admin/sobanderos": [] });
    pintarApp("/admin/sobanderos");
    expect(await screen.findByText("Todavía no hay sobanderos")).toBeInTheDocument();
    expect(screen.getByText("0 sobanderos")).toBeInTheDocument();
  });

  it("un sobandero no entra a esta área", async () => {
    servidor({ "GET /auth/yo": SOBANDERO });
    pintarApp("/admin/sobanderos");
    expect(await screen.findByRole("heading", { level: 1, name: /no encontr/i })).toBeInTheDocument();
  });
});

describe("Nuevo sobandero", () => {
  const llenar = async (nombre: string, correo: string, clave: string) => {
    if (nombre) await userEvent.type(screen.getByLabelText("Nombre completo"), nombre);
    if (correo) await userEvent.type(screen.getByLabelText("Correo"), correo);
    if (clave) await userEvent.type(screen.getByLabelText("Clave temporal"), clave);
  };

  it("pide cada dato y dice qué hacer, sin llamar a la API", async () => {
    const falso = servidor({ ...base });
    const { container } = pintarApp("/admin/sobanderos/nuevo");
    await titulo("Nuevo sobandero");
    await userEvent.click(screen.getByRole("button", { name: "Crear sobandero" }));
    expect(screen.getByText("Escriba el nombre completo.")).toBeInTheDocument();
    expect(screen.getByText(/Escriba un correo válido/)).toBeInTheDocument();
    expect(screen.getByText("Escriba al menos 8 caracteres.")).toBeInTheDocument();
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "POST")).toHaveLength(0);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("crea al sobandero, envía la clave temporal una sola vez y no la vuelve a mostrar", async () => {
    const { cuerpos, manejador } = registrar(sob({ id: 9, nombre: "Juliana Ríos", correo: "juliana@ejemplo.com", dias: [], citas_proximas: 0 }), 201);
    const falso = servidor({
      ...base,
      "POST /admin/sobanderos": manejador,
      "GET /admin/sobanderos/9": sob({ id: 9, nombre: "Juliana Ríos", correo: "juliana@ejemplo.com", dias: [], citas_proximas: 0 }),
      "GET /admin/sobanderos/9/horario": { duracion_min: 30, dias: HORARIO.dias.map((d) => ({ ...d, franjas: [] })) },
    });
    const { router } = pintarApp("/admin/sobanderos/nuevo");
    await titulo("Nuevo sobandero");
    await llenar("Juliana Ríos", "juliana@ejemplo.com", "temporal-123");
    await userEvent.click(screen.getByRole("button", { name: "Crear sobandero" }));

    expect(await titulo("Juliana Ríos")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ nombre: "Juliana Ríos", correo: "juliana@ejemplo.com", clave_temporal: "temporal-123", duracion_min: 30 }]);
    expect(ruta(router)).toBe("/admin/sobanderos/9");
    expect(screen.getByText("Sobandero creado. Entréguele la clave temporal: no se vuelve a mostrar.")).toBeInTheDocument();

    // La clave no queda en la pantalla, en el historial ni en otras peticiones.
    expect(document.body.textContent).not.toContain("temporal-123");
    expect(JSON.stringify(router.state)).not.toContain("temporal-123");
    const otras = falso.mock.calls.filter(([p]) => (p as Request).method !== "POST");
    for (const [p] of otras) expect((p as Request).url).not.toContain("temporal-123");
    expect(screen.queryByLabelText("Clave temporal")).not.toBeInTheDocument();
  });

  it("si el correo ya existe lo dice bajo el campo y conserva lo escrito", async () => {
    servidor({
      ...base,
      "POST /admin/sobanderos": { estado: 409, cuerpo: { codigo: "correo_en_uso", mensaje: "Ese correo ya está en uso. Escriba otro." } },
    });
    pintarApp("/admin/sobanderos/nuevo");
    await titulo("Nuevo sobandero");
    await llenar("Juliana Ríos", "juliana@ejemplo.com", "temporal-123");
    await userEvent.click(screen.getByRole("button", { name: "Crear sobandero" }));
    expect(await screen.findByText("Ese correo ya está en uso. Escriba otro.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Juliana Ríos");
    expect(screen.getByLabelText("Clave temporal")).toHaveValue("temporal-123");
  });

  it("sin conexión muestra el mensaje y no pierde los datos", async () => {
    servidor({ ...base, "POST /admin/sobanderos": () => { throw new TypeError("sin red"); } });
    pintarApp("/admin/sobanderos/nuevo");
    await titulo("Nuevo sobandero");
    await llenar("Juliana Ríos", "juliana@ejemplo.com", "temporal-123");
    await userEvent.click(screen.getByRole("button", { name: "Crear sobandero" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Algo salió mal|conexión/i);
    expect(screen.getByLabelText("Clave temporal")).toHaveValue("temporal-123");
  });
});

describe("Ficha del sobandero", () => {
  const ficha = { ...base, "GET /admin/sobanderos/3": sob(), "GET /admin/sobanderos/3/horario": HORARIO, "GET /admin/sobanderos": [sob()] };

  it("muestra correo, horario y duración, con un solo botón principal", async () => {
    servidor(ficha);
    const { container } = pintarApp("/admin/sobanderos/3");
    expect(await titulo("Carlos Mejía")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Recibe citas" })).toBeChecked();
    expect(screen.getByLabelText("Correo")).toHaveValue("carlos@ejemplo.com");
    expect(await screen.findByText("Lun a vie · 8:00 a. m. – 12:00 m. y 2:00 – 5:00 p. m.")).toBeInTheDocument();
    expect(screen.getByText("30 minutos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviarle enlace para cambiar su clave" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de baja a Carlos Mejía" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("guarda solo lo que cambió y vuelve a la lista con aviso", async () => {
    const { cuerpos, manejador } = registrar(sob({ correo: "nuevo@ejemplo.com", recibe_citas: false }));
    servidor({ ...ficha, "PATCH /admin/sobanderos/3": manejador });
    const { router } = pintarApp("/admin/sobanderos/3");
    await titulo("Carlos Mejía");
    await userEvent.click(screen.getByRole("switch", { name: "Recibe citas" }));
    const correo = screen.getByLabelText("Correo");
    await userEvent.clear(correo);
    await userEvent.type(correo, "nuevo@ejemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await titulo("Sobanderos")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ correo: "nuevo@ejemplo.com", recibe_citas: false }]);
    expect(ruta(router)).toBe("/admin/sobanderos");
    expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
  });

  it("un correo mal escrito no llama a la API; uno repetido lo dice bajo el campo", async () => {
    const { manejador } = registrar({ codigo: "correo_en_uso", mensaje: "Ese correo ya está en uso. Escriba otro." }, 409);
    const falso = servidor({ ...ficha, "PATCH /admin/sobanderos/3": manejador });
    pintarApp("/admin/sobanderos/3");
    await titulo("Carlos Mejía");
    const correo = screen.getByLabelText("Correo");
    await userEvent.clear(correo);
    await userEvent.type(correo, "sin-arroba");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText(/Escriba un correo válido/)).toBeInTheDocument();
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "PATCH")).toHaveLength(0);

    await userEvent.clear(correo);
    await userEvent.type(correo, "otro@ejemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Ese correo ya está en uso. Escriba otro.")).toBeInTheDocument();
  });

  it("envía el enlace para cambiar la clave", async () => {
    const { cuerpos, manejador } = registrar(null, 204);
    servidor({ ...ficha, "POST /admin/sobanderos/3/enlace-clave": manejador });
    pintarApp("/admin/sobanderos/3");
    await titulo("Carlos Mejía");
    await userEvent.click(screen.getByRole("button", { name: "Enviarle enlace para cambiar su clave" }));
    expect(await screen.findByText("Enviamos el enlace al correo de Carlos Mejía.")).toBeInTheDocument();
    expect(cuerpos).toHaveLength(1);
  });

  it("«Dar de baja» abre la pantalla de baja y la duración y el horario sus pantallas", async () => {
    servidor(ficha);
    const { router } = pintarApp("/admin/sobanderos/3");
    await titulo("Carlos Mejía");
    await userEvent.click(screen.getByRole("button", { name: /Duración de cada cita/ }));
    expect(ruta(router)).toBe("/admin/sobanderos/3/duracion");
    await router.navigate("/admin/sobanderos/3");
    await userEvent.click(await screen.findByRole("button", { name: /Horario semanal/ }));
    expect(ruta(router)).toBe("/admin/sobanderos/3/horario");
  });

  it("en baja avisa cuántas citas le quedan; dado de baja ya no se edita", async () => {
    servidor({ ...ficha, "GET /admin/sobanderos/3": sob({ baja_en: "2030-01-01T15:00:00Z", recibe_citas: false, citas_proximas: 2 }) });
    const { unmount } = pintarApp("/admin/sobanderos/3");
    expect(await screen.findByText("Está en baja")).toBeInTheDocument();
    expect(screen.getByText(/Le quedan 2 citas; al terminarlas, su cuenta se cierra sola/)).toBeInTheDocument();
    unmount();

    servidor({ ...ficha, "GET /admin/sobanderos/3": sob({ activo: false, recibe_citas: false, citas_proximas: 0 }) });
    pintarApp("/admin/sobanderos/3");
    expect(await screen.findByText("Está dado de baja")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dar de baja/ })).not.toBeInTheDocument();
  });

  it("un sobandero que no existe muestra «No encontrada»", async () => {
    servidor({ ...base });
    pintarApp("/admin/sobanderos/99");
    expect(await screen.findByRole("heading", { level: 1, name: /no encontr/i })).toBeInTheDocument();
  });
});

describe("Duración de cada cita", () => {
  const ficha = { ...base, "GET /admin/sobanderos/3": sob(), "GET /admin/sobanderos/3/horario": HORARIO };

  it("ofrece 20, 30, 45 y 60 minutos con la actual marcada y explica que aplica a citas nuevas", async () => {
    servidor(ficha);
    const { container } = pintarApp("/admin/sobanderos/3/duracion");
    expect(await titulo("Duración de cada cita")).toBeInTheDocument();
    expect(screen.getByText("Se aplica a las citas nuevas. Las ya agendadas no cambian.")).toBeInTheDocument();
    const opciones = screen.getAllByRole("button", { name: /minutos$/ });
    expect(opciones.map((o) => o.textContent)).toEqual(["20 minutos", "30 minutos", "45 minutos", "60 minutos"]);
    expect(screen.getByRole("button", { name: "30 minutos" })).toHaveAttribute("aria-pressed", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("guarda la nueva duración y vuelve a la ficha con aviso", async () => {
    const { cuerpos, manejador } = registrar(sob({ duracion_min: 45 }));
    servidor({ ...ficha, "PATCH /admin/sobanderos/3": manejador });
    const { router } = pintarApp("/admin/sobanderos/3/duracion");
    await titulo("Duración de cada cita");
    await userEvent.click(screen.getByRole("button", { name: "45 minutos" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await titulo("Carlos Mejía")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ duracion_min: 45 }]);
    expect(ruta(router)).toBe("/admin/sobanderos/3");
    expect(screen.getByText("Duración guardada. Las citas ya agendadas no cambian.")).toBeInTheDocument();
  });

  it("si no cambió nada no llama a la API", async () => {
    const falso = servidor(ficha);
    const { router } = pintarApp("/admin/sobanderos/3/duracion");
    await titulo("Duración de cada cita");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(ruta(router)).toBe("/admin/sobanderos/3");
    expect(falso.mock.calls.filter(([p]) => (p as Request).method === "PATCH")).toHaveLength(0);
  });
});

describe("Horario del sobandero", () => {
  const ficha = { ...base, "GET /admin/sobanderos/3": sob(), "GET /admin/sobanderos/3/horario": HORARIO };

  it("lista los siete días con sus franjas, sin bloquear horas ni barra inferior", async () => {
    servidor(ficha);
    const { container } = pintarApp("/admin/sobanderos/3/horario");
    expect(await titulo("Horario de Carlos Mejía")).toBeInTheDocument();
    expect(await screen.findAllByText("8:00 a. m. – 12:00 m. y 2:00 – 5:00 p. m.")).toHaveLength(5);
    expect(screen.getAllByText("No atiende")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Bloquear horas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("edita un día de ese sobandero y vuelve a su horario", async () => {
    const { cuerpos, manejador } = registrar(HORARIO);
    servidor({ ...ficha, "PUT /admin/sobanderos/3/horario": manejador });
    const { router } = pintarApp("/admin/sobanderos/3/horario");
    await userEvent.click(await screen.findByRole("button", { name: /Sábado/ }));
    expect(ruta(router)).toBe("/admin/sobanderos/3/horario/sabado");
    await titulo("Sábado");
    await userEvent.click(screen.getByRole("switch", { name: "Atiendo los sábado" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    expect(await titulo("Horario de Carlos Mejía")).toBeInTheDocument();
    expect(cuerpos).toEqual([{ dias: [{ dia_semana: 5, franjas: [{ desde: "08:00", hasta: "12:00" }] }] }]);
    expect(ruta(router)).toBe("/admin/sobanderos/3/horario");
  });

  it("un día que no existe vuelve al horario", async () => {
    servidor(ficha);
    const { router } = pintarApp("/admin/sobanderos/3/horario/feriado");
    expect(await titulo("Horario de Carlos Mejía")).toBeInTheDocument();
    expect(ruta(router)).toBe("/admin/sobanderos/3/horario");
  });

  it("la lista del panel del sobandero no cambió", async () => {
    servidor({ "GET /auth/yo": SOBANDERO, "GET /yo/horario": HORARIO, "GET /yo/bloqueos": [] });
    pintarApp("/panel/horario");
    expect(await titulo("Mi horario")).toBeInTheDocument();
    const lista = await screen.findAllByRole("listitem");
    expect(within(lista[0]!).getByText("Lunes")).toBeInTheDocument();
  });
});
