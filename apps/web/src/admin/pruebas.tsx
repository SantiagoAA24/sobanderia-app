/** Datos de ejemplo de las pruebas del administrador. */
import type { CitaAgenda, ResumenAdmin } from "./consultas";

export { ADMIN, pintarApp, ruta, servidor, SOBANDERO } from "../panel/pruebas";

export const RESUMEN: ResumenAdmin = {
  dia: "2030-01-07",
  citas_total: 22,
  sobanderos_atendiendo: 3,
  mensajes_fallidos: 0,
  por_sobandero: [
    { id: 3, nombre: "Carlos", citas: 6, siguiente: "2099-01-05T14:30:00Z" },
    { id: 4, nombre: "Marcela", citas: 1, siguiente: "2099-01-05T15:00:00Z" },
    { id: 5, nombre: "Hernando", citas: 15, siguiente: null },
    { id: 6, nombre: "Juliana", citas: 0, siguiente: null },
  ],
};

export const agenda = (id: number, nombre: string, sobandero: string, inicio: string): CitaAgenda => ({
  id,
  estado: "agendada",
  inicio,
  fin: new Date(new Date(inicio).getTime() + 30 * 60_000).toISOString(),
  cliente_nombre: nombre,
  sobandero: { id: 3, nombre: sobandero },
});
