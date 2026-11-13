import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { diaBogota, sumarDias } from "../lib/fechas";
import { pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const escribir = (campo: string, texto: string) => userEvent.type(screen.getByLabelText(campo), texto);
const HOY = diaBogota(new Date());
const OTRO = sumarDias(HOY, 3);

function registrar(respuesta: unknown, estado = 200) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    cuerpos.push(await p.json());
    return { estado, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

describe("Nueva cita", () => {
  const horas = [`${OTRO}T14:00:00Z`, `${OTRO}T15:30:00Z`];
  const base = () => ({
    "GET /auth/yo": SOBANDERO,
    "GET /yo/citas": [],
    "GET /yo/dias": { dias: [HOY, OTRO] },
    "GET /yo/horas": (p: Request) => ({ cuerpo: { dia: new URL(p.url).searchParams.get("dia"), duracion_min: 30, horas } }),
  });

  it("pide nombre, celular, día y hora; el botón espera la hora", async () => {
    servidor(base());
    const { container } = pintarApp("/panel/nueva-cita");
    expect(await titulo("Nueva cita")).toBeInTheDocument();
    expect(screen.getByText("Le enviaremos la confirmación por WhatsApp.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cita" })).toBeDisabled();
    expect(await screen.findByRole("button", { name: /^Hoy, / })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("guarda la cita con el celular normalizado y lleva a la semana de ese día", async () => {
    const r = registrar({ id: 9 }, 201);
    servidor({ ...base(), "POST /yo/citas": r.manejador });
    const { router } = pintarApp("/panel/nueva-cita");
    await titulo("Nueva cita");
    await escribir("Nombre completo", "María Gómez");
    await escribir("Número de celular", "300 123 4567");
    await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${new Intl.DateTimeFormat("es", { weekday: "long", timeZone: "America/Bogota" }).format(new Date(`${OTRO}T12:00:00Z`)).slice(0, 3)}`, "i") }));
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    await vi.waitFor(() => expect(ruta(router)).toBe(`/panel/semana?dia=${OTRO}`));
    expect(r.cuerpos).toEqual([{ nombre: "María Gómez", celular: "+573001234567", inicio: horas[0] }]);
  });

  it("si es para hoy, vuelve a Hoy", async () => {
    const r = registrar({ id: 9 }, 201);
    servidor({ ...base(), "POST /yo/citas": r.manejador });
    const { router } = pintarApp(`/panel/nueva-cita?dia=${HOY}`);
    await titulo("Nueva cita");
    await escribir("Nombre completo", "María Gómez");
    await escribir("Número de celular", "3001234567");
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
  });

  it("explica qué falta y no envía nada", async () => {
    const r = registrar({}, 201);
    servidor({ ...base(), "POST /yo/citas": r.manejador });
    pintarApp(`/panel/nueva-cita?dia=${OTRO}`);
    await titulo("Nueva cita");
    await escribir("Número de celular", "30012");
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    expect(screen.getByText("Escriba el nombre del cliente.")).toBeInTheDocument();
    expect(screen.getByText("Escriba los 10 dígitos del celular.")).toBeInTheDocument();
    expect(r.cuerpos).toHaveLength(0);
  });

  it("trae el nombre y el celular que dejó otra pantalla", async () => {
    servidor(base());
    pintarApp({ pathname: "/panel/nueva-cita", state: { nombre: "Luz Dary Pineda", celular: "+573001234567" } });
    await titulo("Nueva cita");
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Luz Dary Pineda");
    expect(screen.getByLabelText("Número de celular")).toHaveValue("+573001234567");
  });

  it("si la hora se ocupó, lo dice, conserva lo escrito y quita la hora elegida", async () => {
    const r = registrar({ codigo: "hora_ocupada", mensaje: "Esa hora ya se ocupó.", alternativas: [] }, 409);
    servidor({ ...base(), "POST /yo/citas": r.manejador });
    pintarApp(`/panel/nueva-cita?dia=${OTRO}`);
    await titulo("Nueva cita");
    await escribir("Nombre completo", "María Gómez");
    await escribir("Número de celular", "3001234567");
    await userEvent.click(await screen.findByRole("button", { name: "9:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cita" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esa hora ya se ocupó. Elija otra, por favor.");
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("María Gómez");
    expect(screen.getByRole("button", { name: "Guardar cita" })).toBeDisabled();
  });
});

describe("Bloquear horas", () => {
  const JUEVES = "2099-11-12";
  const DOMINGO = "2099-11-15";
  const horario = {
    duracion_min: 30,
    dias: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dia_semana: d,
      franjas: d === 6 ? [] : [{ desde: "08:00", hasta: "12:00" }, { desde: "14:00", hasta: "17:00" }],
    })),
  };
  const base = () => ({ "GET /auth/yo": SOBANDERO, "GET /yo/horario": horario, "GET /yo/citas": [] });

  it("pide día, desde, hasta y motivo; «Hasta» solo ofrece horas después de «Desde»", async () => {
    servidor(base());
    const { container } = pintarApp(`/panel/bloquear?dia=${JUEVES}`);
    expect(await titulo("Bloquear horas")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Desde" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Hasta" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bloquear horas" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "11:30 a. m." }));
    const hasta = screen.getByRole("region", { name: "Hasta" });
    expect(within(hasta).getByRole("button", { name: "12:00 m." })).toBeInTheDocument();
    expect(within(hasta).queryByRole("button", { name: "11:30 a. m." })).not.toBeInTheDocument();
    expect(within(hasta).queryByRole("button", { name: "8:30 a. m." })).not.toBeInTheDocument();
    expect(screen.getByText("Las citas que ya tiene agendadas en ese rango no se cancelan.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("bloquea el rango en hora de Bogotá, con motivo, y Hoy avisa de las citas que siguen agendadas", async () => {
    const cuerpos: unknown[] = [];
    servidor({
      ...base(),
      "POST /yo/bloqueos": async (p: Request) => {
        cuerpos.push(await p.json());
        return { estado: 201, cuerpo: { id: 1, inicio: "2099-11-12T16:00:00Z", fin: "2099-11-12T17:00:00Z", motivo: "Una diligencia", citas_afectadas: 2 } };
      },
    });
    const { router } = pintarApp(`/panel/bloquear?dia=${JUEVES}`);
    await titulo("Bloquear horas");
    await userEvent.click(await screen.findByRole("button", { name: "11:00 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "12:00 m." }));
    await userEvent.type(screen.getByLabelText("Motivo (opcional)"), "Una diligencia");
    await userEvent.click(screen.getByRole("button", { name: "Bloquear horas" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/hoy"));
    expect(cuerpos).toEqual([{ inicio: "2099-11-12T16:00:00.000Z", fin: "2099-11-12T17:00:00.000Z", motivo: "Una diligencia" }]);
    expect(await screen.findByText("Bloqueó esas horas. Tiene 2 citas agendadas en ese rango: ábralas para cambiarlas o cancelarlas.")).toBeInTheDocument();
  });

  it("un día en el que no atiende no ofrece horas", async () => {
    servidor(base());
    pintarApp(`/panel/bloquear?dia=${DOMINGO}`);
    await titulo("Bloquear horas");
    expect(await screen.findByText("No atiende ese día, así que no hay horas para bloquear.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Desde" })).not.toBeInTheDocument();
  });

  it("muestra el mensaje de la API si el rango ya pasó", async () => {
    servidor({
      ...base(),
      "POST /yo/bloqueos": { estado: 422, cuerpo: { codigo: "validacion", mensaje: "Ese rango ya pasó. Elija una hora que no haya pasado." } },
    });
    pintarApp(`/panel/bloquear?dia=${JUEVES}`);
    await titulo("Bloquear horas");
    await userEvent.click(await screen.findByRole("button", { name: "8:00 a. m." }));
    await userEvent.click(within(screen.getByRole("region", { name: "Hasta" })).getByRole("button", { name: "8:30 a. m." }));
    await userEvent.click(screen.getByRole("button", { name: "Bloquear horas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ese rango ya pasó. Elija una hora que no haya pasado.");
  });
});
