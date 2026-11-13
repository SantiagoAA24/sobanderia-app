import { useQuery } from "@tanstack/react-query";

import { api, datos } from "./cliente";
import { esErrorApi } from "./errores";
import type { components } from "./esquema";

export type Usuario = components["schemas"]["UsuarioOut"];
export type Rol = Usuario["rol"];

export const CLAVES = {
  sesion: ["sesion"] as const,
};

/** Sin sesión (401) no es un error: es `null`. Así las guardas deciden sin pasar por «Sesión vencida». */
export async function pedirSesion(): Promise<Usuario | null> {
  try {
    return datos(await api.GET("/auth/yo"));
  } catch (e) {
    if (esErrorApi(e) && e.estado === 401) return null;
    throw e;
  }
}

export function useSesion() {
  return useQuery({ queryKey: CLAVES.sesion, queryFn: pedirSesion, staleTime: 5 * 60_000 });
}
