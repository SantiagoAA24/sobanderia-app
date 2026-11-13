/** Datos de ejemplo de las pruebas del panel. */
import type { CitaPanel } from "./consultas";

const MIN = 60_000;

/** Un momento ISO a `min` minutos de ahora, redondeado al minuto. */
export const enMin = (min: number) => new Date(Math.floor((Date.now() + min * MIN) / MIN) * MIN).toISOString();

export interface DatosCita {
  id: number;
  nombre?: string;
  celular?: string;
  /** Minutos desde ahora hasta el inicio, o `inicio` exacto. */
  min?: number;
  inicio?: string;
  duracion?: number;
  estado?: CitaPanel["estado"];
}

export function cita({ id, nombre = "Luz Dary Pineda", celular, min = 10, inicio, duracion = 30, estado = "agendada" }: DatosCita): CitaPanel {
  const desde = inicio ?? enMin(min);
  const fin = new Date(new Date(desde).getTime() + duracion * MIN).toISOString();
  return {
    id,
    estado,
    origen: "cliente",
    inicio: desde,
    fin,
    cliente: { id: id + 100, nombre, celular: celular ?? `+57300123${String(1000 + id).slice(-4)}` },
    puede_modificar: estado === "agendada" && new Date(desde).getTime() > Date.now(),
  };
}
