/**
 * Estado del flujo de agendar y de cambiar una cita.
 *
 * Qué va en la URL: sobandero (ruta), día y hora (`?dia=AAAA-MM-DD&hora=HH:MM`, en Bogotá), para que
 * recargar o volver con «Atrás» no pierda nada. Qué NO va en la URL: el nombre y el celular, que se
 * guardan solo en la pestaña (sessionStorage) y se borran al confirmar.
 */

import { esDiaValido, iniciaEnBogota } from "../lib/fechas";

export const RUTA_AGENDAR = "/agendar";

export const rutaAgendar = {
  sobandero: RUTA_AGENDAR,
  dia: (id: number | string, dia?: string) => `${RUTA_AGENDAR}/${id}/dia${consulta({ dia })}`,
  hora: (id: number | string, dia: string, hora?: string) =>
    `${RUTA_AGENDAR}/${id}/hora${consulta({ dia, hora })}`,
  datos: (id: number | string, dia: string, hora: string) =>
    `${RUTA_AGENDAR}/${id}/datos${consulta({ dia, hora })}`,
  listo: (token: string) => `${RUTA_AGENDAR}/listo/${encodeURIComponent(token)}`,
};

export const rutaCita = {
  ver: (token: string) => `/mi-cita/${encodeURIComponent(token)}`,
  dia: (token: string, dia?: string) => `${rutaCita.ver(token)}/cambiar/dia${consulta({ dia })}`,
  hora: (token: string, dia: string, hora?: string) =>
    `${rutaCita.ver(token)}/cambiar/hora${consulta({ dia, hora })}`,
  cancelar: (token: string) => `${rutaCita.ver(token)}/cancelar`,
  cancelada: (token: string) => `${rutaCita.ver(token)}/cancelada`,
};

function consulta(valores: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) if (valor) p.set(clave, valor);
  const texto = p.toString();
  return texto ? `?${texto}` : "";
}

/** `?dia=` bien formado, o null. */
export function leerDia(params: URLSearchParams): string | null {
  const dia = params.get("dia");
  return esDiaValido(dia) ? dia : null;
}

/** `?hora=HH:MM` bien formada (00:00 a 23:59), o null. */
export function leerHora(params: URLSearchParams): string | null {
  const hora = params.get("hora");
  return hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : null;
}

/** Id de sobandero de la ruta: solo enteros positivos. */
export function leerId(texto: string | undefined): number | null {
  return texto && /^\d+$/.test(texto) && Number(texto) > 0 ? Number(texto) : null;
}

/** Día y hora de la URL -> momento UTC que espera la API. */
export function inicioDe(dia: string, hora: string): string {
  return iniciaEnBogota(dia, hora);
}

// --- Borrador de datos (nombre y celular) -------------------------------------------------

const CLAVE_BORRADOR = "sobanderia:borrador";

export interface Borrador {
  nombre: string;
  celular: string;
  acepta: boolean;
}

const VACIO: Borrador = { nombre: "", celular: "", acepta: false };

/** El almacenamiento puede no existir (ventana privada, bloqueado): nunca debe romper el flujo. */
export function leerBorrador(): Borrador {
  try {
    const crudo = globalThis.sessionStorage?.getItem(CLAVE_BORRADOR);
    if (!crudo) return VACIO;
    const v = JSON.parse(crudo) as Partial<Borrador>;
    return {
      nombre: typeof v.nombre === "string" ? v.nombre : "",
      celular: typeof v.celular === "string" ? v.celular : "",
      acepta: v.acepta === true,
    };
  } catch {
    return VACIO;
  }
}

export function guardarBorrador(borrador: Borrador): void {
  try {
    globalThis.sessionStorage?.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
  } catch {
    /* sin almacenamiento: el formulario sigue funcionando, solo no sobrevive a recargar */
  }
}

export function borrarBorrador(): void {
  try {
    globalThis.sessionStorage?.removeItem(CLAVE_BORRADOR);
  } catch {
    /* nada que borrar */
  }
}
