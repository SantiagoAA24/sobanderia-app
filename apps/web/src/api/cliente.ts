import createClient from "openapi-fetch";

import { ErrorApi, ErrorRed } from "./errores";
import type { paths } from "./esquema";

/** Cabecera propia que exige la API en rutas que cambian datos (defensa contra CSRF). */
export const CABECERA_CSRF = { "X-Sobanderia": "1" } as const;

/**
 * `fetch` que convierte fallos en errores tipados, para que TanStack Query los reciba como rechazos:
 * sin respuesta -> ErrorRed; respuesta no exitosa -> ErrorApi con el código estable de la API.
 */
export async function fetchDeLaApi(peticion: Request): Promise<Response> {
  let respuesta: Response;
  try {
    respuesta = await globalThis.fetch(peticion);
  } catch {
    throw new ErrorRed();
  }
  if (respuesta.ok) return respuesta;
  const cuerpo: unknown = await respuesta.json().catch(() => ({}));
  const { codigo, mensaje, ...extra } = (cuerpo && typeof cuerpo === "object" ? cuerpo : {}) as Record<string, unknown>;
  throw new ErrorApi(
    respuesta.status,
    typeof codigo === "string" ? codigo : "desconocido",
    typeof mensaje === "string" ? mensaje : "Algo salió mal. Intente de nuevo.",
    extra,
  );
}

/** Cliente tipado: cualquier cambio en la API que rompa un uso falla al compilar. */
export const api = createClient<paths>({
  baseUrl: `${globalThis.location?.origin ?? "http://localhost"}/api`,
  headers: CABECERA_CSRF,
  credentials: "include",
  fetch: fetchDeLaApi,
});

/** Devuelve `data` de una respuesta exitosa (las no exitosas ya lanzaron ErrorApi). */
export function datos<T>(resultado: { data?: T }): T {
  return resultado.data as T;
}
