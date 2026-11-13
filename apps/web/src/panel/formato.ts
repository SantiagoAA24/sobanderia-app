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

// --- Horas de pared de Bogotá en «HH:MM» (como las guarda el horario) -------------------------

/** «14:00» -> { hora: "2:00", meridiem: "p. m." }. El mediodía en punto es «m.». */
export function hora12(hhmm: string): { hora: string; meridiem: string } {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const meridiem = h === 12 && m === 0 ? "m." : h < 12 ? "a. m." : "p. m.";
  return { hora: `${h12}:${String(m).padStart(2, "0")}`, meridiem };
}

/** «14:00» -> «2:00 p. m.» */
export function textoHhmm(hhmm: string): string {
  const { hora, meridiem } = hora12(hhmm);
  return `${hora} ${meridiem}`;
}

/** «08:00», «12:00» -> «8:00 a. m. – 12:00 m.»; «14:00», «17:00» -> «2:00 – 5:00 p. m.». */
export function textoFranja(desde: string, hasta: string): string {
  const a = hora12(desde);
  const b = hora12(hasta);
  return a.meridiem === b.meridiem ? `${a.hora} – ${b.hora} ${b.meridiem}` : `${a.hora} ${a.meridiem} – ${b.hora} ${b.meridiem}`;
}

/** Franjas de un día en una línea, o «No atiende». */
export function textoFranjas(franjas: { desde: string; hasta: string }[]): string {
  if (franjas.length === 0) return "No atiende";
  return franjas.map((f) => textoFranja(f.desde, f.hasta)).join(" y ");
}

export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
export const nombreDiaSemana = (indice: number) => {
  const nombre = DIAS_SEMANA[indice] ?? "lunes";
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
};

const aMinutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const aHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Horas «HH:MM» de `desde` a `hasta` (ambas incluidas) cada `paso` minutos. */
export function opcionesDeHora(desde: string, hasta: string, paso = 30): string[] {
  const lista: string[] = [];
  for (let m = aMinutos(desde); m <= aMinutos(hasta); m += paso) lista.push(aHhmm(m));
  return lista;
}

/** Los inicios y finales posibles de un bloqueo dentro de las franjas de un día, cada `paso` minutos. */
export function pasosDeFranjas(franjas: { desde: string; hasta: string }[], paso = 30): { inicios: string[]; finales: string[] } {
  const inicios: string[] = [];
  const finales: string[] = [];
  for (const f of franjas) {
    const opciones = opcionesDeHora(f.desde, f.hasta, paso);
    inicios.push(...opciones.slice(0, -1));
    finales.push(...opciones.slice(1));
  }
  return { inicios, finales };
}

export const mayorQue = (a: string, b: string) => aMinutos(a) > aMinutos(b);
export { aMinutos, aHhmm };
