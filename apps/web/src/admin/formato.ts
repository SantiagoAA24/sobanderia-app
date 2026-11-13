import { textoFranjas } from "../panel/formato";
import type { HorarioSobandero } from "./consultas";

const ABREVIADOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const abreviado = (d: number) => ABREVIADOS[d]!.charAt(0).toUpperCase() + ABREVIADOS[d]!.slice(1);

/**
 * Los días de atención en una frase corta: «Lun a sáb» (si son seguidos y son tres o más),
 * «Lun, mié y vie» o «Sin horario».
 */
export function textoDias(dias: readonly number[]): string {
  const orden = [...new Set(dias)].sort((a, b) => a - b);
  if (orden.length === 0) return "Sin horario";
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1]! + 1);
  if (seguidos && orden.length >= 3) return `${abreviado(orden[0]!)} a ${ABREVIADOS[orden.at(-1)!]}`;
  const nombres = orden.map((d, i) => (i === 0 ? abreviado(d) : ABREVIADOS[d]!));
  if (nombres.length === 1) return nombres[0]!;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

/** «Lun a sáb · 8:00 a. m. – 5:00 p. m.»; si cada día tiene franjas distintas, solo los días. */
export function resumenHorario(h: HorarioSobandero): string {
  const conAtencion = h.dias.filter((d) => d.franjas.length > 0);
  const dias = textoDias(conAtencion.map((d) => d.dia_semana));
  if (conAtencion.length === 0) return dias;
  const primero = textoFranjas(conAtencion[0]!.franjas);
  return conAtencion.every((d) => textoFranjas(d.franjas) === primero) ? `${dias} · ${primero}` : `${dias} · Franjas distintas`;
}
