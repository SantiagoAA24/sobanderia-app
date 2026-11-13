import type { Usuario } from "../api/sesion";

/** Dónde empieza cada rol. El administrador usa su propio panel (Fase 7). */
export const inicioDe = (usuario: Pick<Usuario, "rol">) => (usuario.rol === "admin" ? "/admin/hoy" : "/panel/hoy");

/**
 * Adónde ir después de ingresar: la página que se pedía si pertenece al área del rol; si no, su inicio.
 * Solo se aceptan rutas internas de esas áreas, nunca una dirección que venga de fuera.
 */
export function destinoTras(usuario: Pick<Usuario, "rol">, desde: unknown): string {
  const area = usuario.rol === "admin" ? "/admin" : "/panel";
  if (typeof desde === "string" && (desde === area || desde.startsWith(`${area}/`))) return desde;
  return inicioDe(usuario);
}
