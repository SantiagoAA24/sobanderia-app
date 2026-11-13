import { diaBogota, fechaLarga, horaParaMostrar, sumarDias } from "../lib/fechas";

/** «Luz Dary Pineda» -> «Luz». */
export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

/** «Carlos Mejía» -> «C». */
export const inicialDe = (nombre: string) => nombre.trim().charAt(0).toUpperCase();

/** 15:30Z -> «10:30 a. m.» */
export function textoHora(momento: string | Date): string {
  const { hora, meridiem } = horaParaMostrar(momento);
  return `${hora} ${meridiem}`;
}

/** Minutos entre dos momentos: la duración de una cita. */
export const minutosEntre = (inicio: string, fin: string) => Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000);

/** «Hoy, jueves 12», «Mañana, viernes 13» o «Sábado 14 de noviembre». */
export function rotuloDia(dia: string, hoy: string): string {
  const [, , d] = dia.split("-");
  const larga = fechaLarga(dia);
  const nombre = larga.split(" ")[0]!.toLowerCase();
  if (dia === hoy) return `Hoy, ${nombre} ${Number(d)}`;
  if (dia === sumarDias(hoy, 1)) return `Mañana, ${nombre} ${Number(d)}`;
  return larga;
}

/** «Hoy · 9:30 a. m.» o «Viernes 13 de noviembre · 9:30 a. m.». */
export function diaYHora(momento: string, hoy: string): string {
  const dia = diaBogota(momento);
  const cuando = dia === hoy ? "Hoy" : fechaLarga(dia);
  return `${cuando} · ${textoHora(momento)}`;
}

export const citasTexto = (n: number) => `${n} ${n === 1 ? "cita" : "citas"}`;

/** Lunes y domingo («AAAA-MM-DD») de la semana que contiene `dia`. */
export function semanaDe(dia: string): { lunes: string; domingo: string; dias: string[] } {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const desfase = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = sumarDias(dia, -desfase);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  return { lunes, domingo: dias[6]!, dias };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «Semana del 9 al 15 de noviembre» o «Semana del 30 de noviembre al 6 de diciembre». */
export function rangoSemana(lunes: string, domingo: string): string {
  const [, m1, d1] = lunes.split("-").map(Number) as [number, number, number];
  const [, m2, d2] = domingo.split("-").map(Number) as [number, number, number];
  return m1 === m2
    ? `Semana del ${d1} al ${d2} de ${MESES[m2 - 1]}`
    : `Semana del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}
