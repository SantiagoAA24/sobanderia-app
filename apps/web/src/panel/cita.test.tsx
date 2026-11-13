import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { cita } from "./datos";
import { textoHora } from "./formato";
import { pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const LUZ = cita({ id: 1, nombre: "Luz Dary Pineda", celular: "+573001234567", min: 600 });
const sesion = { "GET /auth/yo": SOBANDERO, "GET /yo/citas/1": LUZ, "GET /yo/citas": [] };

/** Registra el cuerpo de cada PATCH y responde con `respuesta`. */
function patch(respuesta: unknown = LUZ) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    cuerpos.push(await p.json());
    return typeof respuesta === "function" ? (respuesta as () => unknown)() : { cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

describe("Cita", () => {
  it("muestra los datos, llamar y WhatsApp como enlaces, y las acciones", async () => {
    servidor(sesion);
    const { container } = pintarApp("/panel/citas/1");
    expect(await titulo("Cita de Luz Dary Pineda")).toBeInTheDocument();
    expect(screen.getByText("300 123 4567")).toBeInTheDocument();
    expect(screen.getByText(/· 30 min$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+573001234567");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/573001234567");
    expect(screen.getByRole("link", { name: "Cambiar la hora" })).toHaveAttribute("href", "/panel/citas/1/cambiar");
    expect(screen.getByRole("link", { name: "No asistió" })).toHaveAttribute("href", "/panel/citas/1/no-asistio");
    expect(screen.getByRole("link", { name: "Cancelar la cita" })).toHaveAttribute("href", "/panel/citas/1/cancelar");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("marcar como atendida envía el estado y vuelve a Hoy", async () => {
    const p = patch({ ...LUZ, estado: "atendida" });
    servidor({ ...sesion, "PATCH /yo/citas/1": p.manejador });
    const { router } = pintarApp("/panel/citas/1");
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como atendida" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(p.cuerpos).toEqual([{ estado: "atendida", avisar: true }]);
  });

  it("una cita que ya empezó se puede marcar, pero no cambiar ni cancelar", async () => {
    servidor({ ...sesion, "GET /yo/citas/1": cita({ id: 1, min: -20 }) });
    pintarApp("/panel/citas/1");
    await titulo(/^Cita de/);
    expect(screen.getByRole("button", { name: "Marcar como atendida" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "No asistió" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cambiar la hora" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancelar la cita" })).not.toBeInTheDocument();
  });

  it("una cita cerrada solo muestra su estado y cómo contactar", async () => {
    servidor({ ...sesion, "GET /yo/citas/1": cita({ id: 1, min: -300, estado: "no_asistio" }) });
    pintarApp("/panel/citas/1");
    await titulo(/^Cita de/);
    expect(screen.getByText("No asistió", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como atendida" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Llamar" })).toBeInTheDocument();
  });

  it("si la API dice que ya no se puede, muestra su mensaje", async () => {
    servidor({
      ...sesion,
      "PATCH /yo/citas/1": { estado: 409, cuerpo: { codigo: "cita_no_modificable", mensaje: "Esta cita ya no se puede cambiar." } },
    });
    pintarApp("/panel/citas/1");
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como atendida" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta cita ya no se puede cambiar.");
  });

  it("la cita de otro sobandero responde como una que no existe", async () => {
    servidor({ ...sesion, "GET /yo/citas/1": { estado: 404, cuerpo: { codigo: "no_encontrado", mensaje: "No encontramos esa cita." } } });
    pintarApp("/panel/citas/1");
    expect(await titulo("No encontramos esa página")).toBeInTheDocument();
  });
});

describe("No asistió", () => {
  it("confirma, no avisa y vuelve a Hoy", async () => {
    const p = patch({ ...LUZ, estado: "no_asistio" });
    servidor({ ...sesion, "PATCH /yo/citas/1": p.manejador });
    const { router, container } = pintarApp("/panel/citas/1/no-asistio");
    expect(await titulo("¿Marcar que no asistió?")).toBeInTheDocument();
    expect(screen.getByText("Quedará en su historial. No se le avisa.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Sí, no asistió" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(p.cuerpos).toEqual([{ estado: "no_asistio", avisar: true }]);
  });

  it("Volver regresa a la cita sin cambiar nada", async () => {
    const falso = servidor(sesion);
    const { router } = pintarApp("/panel/citas/1/no-asistio");
    await userEvent.click(await screen.findByRole("link", { name: "Volver" }));
    expect(ruta(router)).toBe("/panel/citas/1");
    expect(falso.mock.calls.some(([q]) => (q as Request).method === "PATCH")).toBe(false);
  });
});

describe("Cancelar la cita", () => {
  const CANCELADA = { ...LUZ, estado: "cancelada", puede_modificar: false };

  it("la acción principal es conservar la cita", async () => {
    servidor(sesion);
    const { router, container } = pintarApp("/panel/citas/1/cancelar");
    expect(await titulo("¿Cancelar la cita de Luz Dary Pineda?")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Avisarle por WhatsApp y ofrecerle otra hora" })).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("link", { name: "No, conservar la cita" }));
    expect(ruta(router)).toBe("/panel/citas/1");
  });

  it("cancela con aviso y dice que la hora quedó libre", async () => {
    let estado = "agendada";
    const p = patch(() => {
      estado = "cancelada";
      return { cuerpo: CANCELADA };
    });
    servidor({ ...sesion, "GET /yo/citas/1": () => ({ cuerpo: estado === "cancelada" ? CANCELADA : LUZ }), "PATCH /yo/citas/1": p.manejador });
    const { router, container } = pintarApp("/panel/citas/1/cancelar");
    await userEvent.click(await screen.findByRole("button", { name: "Sí, cancelar la cita" }));
    expect(await titulo("Cita cancelada")).toBeInTheDocument();
    expect(ruta(router)).toBe("/panel/citas/1/cancelada");
    expect(p.cuerpos).toEqual([{ estado: "cancelada", avisar: true }]);
    expect(screen.getByText(`Le avisamos a Luz Dary Pineda por WhatsApp. La hora de las ${textoHora(LUZ.inicio)} quedó libre.`)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByRole("link", { name: "Volver a Hoy" })).toHaveAttribute("href", "/panel/hoy");
    expect(screen.getByRole("link", { name: "Darle otra hora" })).toHaveAttribute("href", "/panel/nueva-cita");
  });

  it("sin la casilla de avisar, no avisa y lo dice", async () => {
    let estado = "agendada";
    const p = patch(() => {
      estado = "cancelada";
      return { cuerpo: CANCELADA };
    });
    servidor({ ...sesion, "GET /yo/citas/1": () => ({ cuerpo: estado === "cancelada" ? CANCELADA : LUZ }), "PATCH /yo/citas/1": p.manejador });
    pintarApp("/panel/citas/1/cancelar");
    await userEvent.click(await screen.findByRole("checkbox", { name: /Avisarle por WhatsApp/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, cancelar la cita" }));
    expect(await titulo("Cita cancelada")).toBeInTheDocument();
    expect(p.cuerpos).toEqual([{ estado: "cancelada", avisar: false }]);
    expect(screen.getByText(/^No se le avisó a Luz Dary Pineda\./)).toBeInTheDocument();
  });

  it("una cita que ya no se puede cancelar lleva de vuelta a su detalle", async () => {
    servidor({ ...sesion, "GET /yo/citas/1": cita({ id: 1, min: -20 }) });
    const { router } = pintarApp("/panel/citas/1/cancelar");
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/citas/1"));
  });
});

describe("Cambiar la hora", () => {
  const MANANA = "2099-11-13";
  const HORAS = [`${MANANA}T14:00:00Z`, `${MANANA}T15:30:00Z`, `${MANANA}T19:00:00Z`];
  const base = () => ({
    ...sesion,
    "GET /yo/dias": { dias: ["2099-11-12", MANANA] },
    "GET /yo/horas": (p: Request) => ({ cuerpo: { dia: new URL(p.url).searchParams.get("dia"), duracion_min: 30, horas: HORAS } }),
  });

  it("elige día y hora, y guarda avisando por WhatsApp", async () => {
    const p = patch({ ...LUZ, id: 2, inicio: HORAS[1] });
    const falso = servidor({ ...base(), "PATCH /yo/citas/1": p.manejador });
    const { router, container } = pintarApp("/panel/citas/1/cambiar");
    expect(await titulo("Cambiar la hora")).toBeInTheDocument();
    const guardar = screen.getByRole("button", { name: "Guardar cambio" });
    expect(guardar).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Hora" })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: /Viernes 13/ }));
    const hora = await screen.findByRole("region", { name: "Hora" });
    expect(hora).toBeInTheDocument();
    // Pide las horas de ese día liberando la de esta misma cita.
    const llamada = falso.mock.calls.map(([q]) => new URL((q as Request).url)).find((u) => u.pathname.endsWith("/yo/horas"))!;
    expect(llamada.searchParams.get("dia")).toBe(MANANA);
    expect(llamada.searchParams.get("excluir_cita")).toBe("1");
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: "10:30 a. m." }));
    expect(guardar).toBeEnabled();
    await userEvent.click(guardar);
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(p.cuerpos).toEqual([{ inicio: HORAS[1], avisar: true }]);
  });

  it("sin la casilla de avisar, no avisa", async () => {
    const p = patch({ ...LUZ, id: 2 });
    servidor({ ...base(), "PATCH /yo/citas/1": p.manejador });
    pintarApp("/panel/citas/1/cambiar");
    await userEvent.click(await screen.findByRole("button", { name: /Viernes 13/ }));
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Avisarle por WhatsApp" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambio" }));
    await vi.waitFor(() => expect(p.cuerpos).toHaveLength(1));
    expect(p.cuerpos[0]).toEqual({ inicio: HORAS[0], avisar: false });
  });

  it("si la hora se ocupó, lo dice, quita la elección y conserva la cita", async () => {
    servidor({
      ...base(),
      "PATCH /yo/citas/1": { estado: 409, cuerpo: { codigo: "hora_ocupada", mensaje: "Esa hora ya se ocupó.", alternativas: [] } },
    });
    const { router } = pintarApp("/panel/citas/1/cambiar");
    await userEvent.click(await screen.findByRole("button", { name: /Viernes 13/ }));
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esa hora ya se ocupó. Elija otra, por favor.");
    expect(screen.getByRole("button", { name: "Guardar cambio" })).toBeDisabled();
    expect(ruta(router)).toBe("/panel/citas/1/cambiar");
  });

  it("el botón Atrás vuelve a la cita", async () => {
    servidor(base());
    const { router } = pintarApp("/panel/citas/1/cambiar");
    await userEvent.click(await screen.findByRole("button", { name: "Atrás" }));
    expect(ruta(router)).toBe("/panel/citas/1");
  });
});

