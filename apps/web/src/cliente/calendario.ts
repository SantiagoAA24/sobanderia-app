/** «Agregar al calendario»: un archivo .ics armado en el navegador, sin enviar nada a ningún servidor. */

import { fechaLarga } from "../lib/fechas";

export interface DatosEvento {
  /** Identificador estable: el mismo evento no se duplica si se agrega dos veces. */
  uid: string;
  inicio: string;
  fin: string;
  sobandero: string;
  lugar?: string;
}

const ics = (momento: string) => new Date(momento).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function construirIcs({ uid, inicio, fin, sobandero, lugar }: DatosEvento): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sobanderia//Cita//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@sobanderia`,
    `DTSTAMP:${ics(new Date().toISOString())}`,
    `DTSTART:${ics(inicio)}`,
    `DTEND:${ics(fin)}`,
    `SUMMARY:${escapar(`Cita con ${sobandero}`)}`,
    `DESCRIPTION:${escapar(`${fechaLarga(inicio)}. Si no puede asistir, avise con tiempo.`)}`,
    ...(lugar ? [`LOCATION:${escapar(lugar)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Su cita es en una hora",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.join("\r\n") + "\r\n";
}

/** Descarga el archivo. Devuelve false si el navegador no permite crearlo. */
export function descargarIcs(evento: DatosEvento): boolean {
  try {
    const url = URL.createObjectURL(new Blob([construirIcs(evento)], { type: "text/calendar;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "cita-sobanderia.ics";
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
