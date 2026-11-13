/**
 * Única utilidad de fechas de la app. Todo llega y se envía en UTC (ISO 8601);
 * todo se muestra en America/Bogota (UTC-5, sin horario de verano).
 * Ninguna pantalla formatea fechas por su cuenta.
 */

export const ZONA = "America/Bogota";

/** Colombia no cambia de hora: Bogotá siempre va 5 horas detrás de UTC. */
const DESFASE_HORAS = 5;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

type Momento = string | Date;

const formato = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

interface Partes {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

function partes(momento: Momento): Partes {
  const fecha = typeof momento === "string" ? new Date(momento) : momento;
  if (Number.isNaN(fecha.getTime())) throw new RangeError(`Fecha no válida: ${String(momento)}`);
  const v: Record<string, number> = {};
  for (const p of formato.formatToParts(fecha)) {
    if (p.type !== "literal") v[p.type] = Number(p.value);
  }
  return { anio: v.year ?? 0, mes: v.month ?? 0, dia: v.day ?? 0, hora: v.hour ?? 0, minuto: v.minute ?? 0 };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Día de la semana (0 = domingo) de un «AAAA-MM-DD», sin depender de la zona del equipo. */
function diaSemana(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** «AAAA-MM-DD» del momento, en hora de Bogotá. */
export function diaBogota(momento: Momento): string {
  const p = partes(momento);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

/** 15:30Z -> { hora: "10:30", meridiem: "a. m." } (12 horas, con «a. m.» separado). */
export function horaParaMostrar(momento: Momento): { hora: string; meridiem: "a. m." | "p. m." } {
  const { hora, minuto } = partes(momento);
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return { hora: `${h12}:${dos(minuto)}`, meridiem: hora < 12 ? "a. m." : "p. m." };
}

/** 15:30Z -> «10:30» (24 horas): es el formato de la hora en la URL del flujo de agendar. */
export function horaBogota24(momento: Momento): string {
  const { hora, minuto } = partes(momento);
  return `${dos(hora)}:${dos(minuto)}`;
}

/** Suma días a un «AAAA-MM-DD». */
export function sumarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

/** Es un «AAAA-MM-DD» que existe en el calendario. */
export function esDiaValido(dia: string | null | undefined): dia is string {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  return sumarDias(dia, 0) === dia;
}

/** «hoy», «mañana» o el día de la semana en minúscula, respecto a `hoy` («AAAA-MM-DD»). */
export function diaRelativo(dia: string, hoy: string): string {
  if (dia === hoy) return "hoy";
  if (dia === sumarDias(hoy, 1)) return "mañana";
  return fechaLarga(dia).toLowerCase();
}

/** «Viernes 13 de noviembre». Acepta un momento UTC o un día «AAAA-MM-DD». */
export function fechaLarga(entrada: Momento): string {
  const dia = typeof entrada === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entrada) ? entrada : diaBogota(entrada);
  const [, m, d] = dia.split("-").map(Number) as [number, number, number];
  return `${DIAS[diaSemana(dia)]} ${d} de ${MESES[m - 1]}`;
}

/** «Jueves 12»: etiqueta accesible de un día en la tira de la semana. */
export function etiquetaDia(dia: string): string {
  const d = Number(dia.split("-")[2]);
  return `${DIAS[diaSemana(dia)]} ${d}`;
}

/** Inicio y fin (UTC) de un día de Bogotá, para pedir citas de ese día. */
export function rangoDiaUTC(dia: string): { desde: string; hasta: string } {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return {
    desde: new Date(Date.UTC(a, m - 1, d, DESFASE_HORAS)).toISOString(),
    hasta: new Date(Date.UTC(a, m - 1, d + 1, DESFASE_HORAS)).toISOString(),
  };
}

/** Día y hora de Bogotá («2026-11-13», «10:30») -> momento UTC para enviar a la API. */
export function iniciaEnBogota(dia: string, hora: string): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const [h, min] = hora.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(a, m - 1, d, h + DESFASE_HORAS, min)).toISOString();
}

/** 30 -> «30 min». */
export function duracionCorta(minutos: number): string {
  return `${minutos} min`;
}

/** «Buenos días», «Buenas tardes» o «Buenas noches» según la hora de Bogotá. */
export function saludo(momento: Momento): string {
  const { hora } = partes(momento);
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** «En 10 min», «En 1 h 5 min», «En 1 h» o «Ahora» (si ya empezó). */
export function cuentaRegresiva(inicio: Momento, ahora: Momento): string {
  const ms = new Date(inicio).getTime() - new Date(ahora).getTime();
  const min = Math.ceil(ms / 60000);
  if (min <= 0) return "Ahora";
  if (min < 60) return `En ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `En ${h} h` : `En ${h} h ${resto} min`;
}
