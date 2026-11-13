import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { pintarApp, ruta, servidor, SOBANDERO } from "./pruebas";

afterEach(() => vi.unstubAllGlobals());

const titulo = (nombre: string | RegExp) => screen.findByRole("heading", { level: 1, name: nombre });
const MANANA = [{ desde: "08:00", hasta: "12:00" }, { desde: "14:00", hasta: "17:00" }];
const HORARIO = {
  duracion_min: 30,
  dias: [
    { dia_semana: 0, franjas: MANANA },
    { dia_semana: 1, franjas: MANANA },
    { dia_semana: 2, franjas: [] },
    { dia_semana: 3, franjas: MANANA },
    { dia_semana: 4, franjas: MANANA },
    { dia_semana: 5, franjas: [{ desde: "08:00", hasta: "12:00" }] },
    { dia_semana: 6, franjas: [] },
  ],
};
const sesion = { "GET /auth/yo": SOBANDERO, "GET /yo/horario": HORARIO, "GET /yo/bloqueos": [], "GET /yo/citas": [] };

/** Registra el cuerpo de cada petición con `metodo` y responde `respuesta`. */
function registrar(respuesta: unknown) {
  const cuerpos: unknown[] = [];
  const manejador = async (p: Request) => {
    cuerpos.push(await p.json());
    return typeof respuesta === "function" ? (respuesta as () => unknown)() : { estado: 200, cuerpo: respuesta };
  };
  return { cuerpos, manejador };
}

describe("Horario", () => {
  it("lista los siete días con sus franjas y la duración de cada cita", async () => {
    servidor(sesion);
    const { container } = pintarApp("/panel/horario");
    expect(await titulo("Mi horario")).toBeInTheDocument();
    expect(await screen.findAllByText("8:00 a. m. – 12:00 m. y 2:00 – 5:00 p. m.")).toHaveLength(4);
    expect(screen.getAllByText("No atiende")).toHaveLength(2);
    expect(screen.getByText("8:00 a. m. – 12:00 m.")).toBeInTheDocument(); // sábado
    expect(screen.getByText("30 minutos. La cambia el administrador.")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("tocar un día abre su horario", async () => {
    servidor(sesion);
    const { router } = pintarApp("/panel/horario");
    await userEvent.click(await screen.findByRole("button", { name: /^Lunes/ }));
    expect(ruta(router)).toBe("/panel/horario/lunes");
  });

  it("muestra las horas bloqueadas y permite quitarlas", async () => {
    let vigentes = [
      { id: 5, inicio: "2099-11-13T15:00:00Z", fin: "2099-11-13T17:00:00Z", motivo: "Una diligencia", citas_afectadas: 1 },
    ];
    const quitados: string[] = [];
    servidor({
      ...sesion,
      "GET /yo/bloqueos": () => ({ cuerpo: vigentes }),
      "DELETE /yo/bloqueos/5": () => {
        quitados.push("5");
        vigentes = [];
        return { estado: 204, cuerpo: null };
      },
    });
    pintarApp("/panel/horario");
    const region = await screen.findByRole("region", { name: "Horas bloqueadas" });
    expect(within(region).getByText("Viernes 13 de noviembre, 10:00 a. m. a 12:00 p. m.")).toBeInTheDocument();
    expect(within(region).getByText("Una diligencia")).toBeInTheDocument();
    expect(within(region).getByText("1 cita agendada en este rango")).toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: /^Quitar el bloqueo de Viernes 13/ }));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Horas bloqueadas" })).not.toBeInTheDocument());
    expect(quitados).toEqual(["5"]);
  });
});

describe("Horario del día", () => {
  it("muestra si atiende y sus franjas", async () => {
    servidor(sesion);
    const { container } = pintarApp("/panel/horario/lunes");
    expect(await titulo("Lunes")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Atiendo los lunes" })).toBeChecked();
    const franja2 = screen.getByRole("group", { name: "Franja 2" });
    expect(within(franja2).getByLabelText("Desde")).toHaveValue("14:00");
    expect(within(franja2).getByLabelText("Hasta")).toHaveValue("17:00");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("cambia una hora y guarda solo ese día", async () => {
    const r = registrar(HORARIO);
    servidor({ ...sesion, "PUT /yo/horario": r.manejador });
    const { router } = pintarApp("/panel/horario/lunes");
    await titulo("Lunes");
    await userEvent.selectOptions(within(screen.getByRole("group", { name: "Franja 1" })).getByLabelText("Desde"), "07:30");
    await userEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/horario"));
    expect(r.cuerpos).toEqual([{ dias: [{ dia_semana: 0, franjas: [{ desde: "07:30", hasta: "12:00" }, MANANA[1]] }] }]);
  });

  it("agrega y quita franjas; hasta cuatro", async () => {
    servidor(sesion);
    pintarApp("/panel/horario/lunes");
    await titulo("Lunes");
    await userEvent.click(screen.getByRole("button", { name: "Agregar otra franja" }));
    const tercera = screen.getByRole("group", { name: "Franja 3" });
    expect(within(tercera).getByLabelText("Desde")).toHaveValue("17:00"); // donde terminó la anterior
    expect(within(tercera).getByLabelText("Hasta")).toHaveValue("19:00");
    await userEvent.click(screen.getByRole("button", { name: "Agregar otra franja" }));
    expect(screen.queryByRole("button", { name: "Agregar otra franja" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar la franja 1" }));
    expect(screen.queryByRole("group", { name: "Franja 4" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar otra franja" })).toBeInTheDocument();
  });

  it("apagar el día guarda sin franjas; encenderlo propone una mañana", async () => {
    const r = registrar(HORARIO);
    servidor({ ...sesion, "PUT /yo/horario": r.manejador });
    pintarApp("/panel/horario/lunes");
    await titulo("Lunes");
    await userEvent.click(screen.getByRole("switch", { name: "Atiendo los lunes" }));
    expect(screen.getByText("No atiende este día. Las citas ya agendadas no cambian.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    await vi.waitFor(() => expect(r.cuerpos).toHaveLength(1));
    expect(r.cuerpos[0]).toEqual({ dias: [{ dia_semana: 0, franjas: [] }] });
  });

  it("un miércoles apagado se enciende con una franja de 8:00 a 12:00", async () => {
    servidor(sesion);
    pintarApp("/panel/horario/miercoles");
    await titulo("Miércoles");
    const interruptor = screen.getByRole("switch", { name: "Atiendo los miércoles" });
    expect(interruptor).not.toBeChecked();
    await userEvent.click(interruptor);
    expect(within(screen.getByRole("group", { name: "Franja 1" })).getByLabelText("Hasta")).toHaveValue("12:00");
  });

  it("una franja que termina antes de empezar no se envía", async () => {
    const r = registrar(HORARIO);
    servidor({ ...sesion, "PUT /yo/horario": r.manejador });
    pintarApp("/panel/horario/lunes");
    await titulo("Lunes");
    await userEvent.selectOptions(within(screen.getByRole("group", { name: "Franja 1" })).getByLabelText("Hasta"), "07:00");
    await userEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Cada franja debe terminar después de empezar.");
    expect(r.cuerpos).toHaveLength(0);
  });

  it("muestra el mensaje de la API si las franjas se cruzan", async () => {
    servidor({
      ...sesion,
      "PUT /yo/horario": { estado: 422, cuerpo: { codigo: "validacion", mensaje: "Las franjas de un mismo día no pueden cruzarse." } },
    });
    pintarApp("/panel/horario/lunes");
    await titulo("Lunes");
    await userEvent.selectOptions(within(screen.getByRole("group", { name: "Franja 2" })).getByLabelText("Desde"), "11:00");
    await userEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Las franjas de un mismo día no pueden cruzarse.");
  });

  it("un día que no existe vuelve a Mi horario", async () => {
    servidor(sesion);
    const { router } = pintarApp("/panel/horario/festivo");
    await vi.waitFor(() => expect(ruta(router)).toBe("/panel/horario"));
  });
});
