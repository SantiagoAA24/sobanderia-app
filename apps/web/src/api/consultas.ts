import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ErrorRed, esErrorApi } from "./errores";
import { CLAVES, type Usuario } from "./sesion";

export interface ManejadoresGlobales {
  /** Había sesión y la API respondió 401: la sesión terminó. */
  alVencerSesion: () => void;
  /** Un enlace de cita ya no sirve (410). */
  alVencerEnlace: () => void;
}

const MAX_REINTENTOS_RED = 2;

/** Solo se reintenta cuando no hubo respuesta; un 4xx no mejora por repetirse. */
export function debeReintentar(intentos: number, error: unknown): boolean {
  return error instanceof ErrorRed && intentos < MAX_REINTENTOS_RED;
}

export function crearClienteDeConsultas({ alVencerSesion, alVencerEnlace }: ManejadoresGlobales): QueryClient {
  // `cliente` se usa dentro de los manejadores, que solo corren después de crearlo.
  const alFallar = (error: unknown, propio = false) => {
    if (!esErrorApi(error)) return; // ErrorRed: la pantalla muestra «Sin conexión»
    if (error.estado === 401 && error.codigo === "clave_incorrecta") {
      // La clave actual escrita para confirmar un cambio no coincide: lo explica la pantalla, la sesión sigue.
    } else if (error.estado === 401) {
      // Sin sesión previa (p. ej. clave incorrecta en el ingreso) el 401 lo atiende la pantalla.
      const habiaSesion = cliente.getQueryData<Usuario | null>(CLAVES.sesion);
      if (habiaSesion) {
        cliente.setQueryData(CLAVES.sesion, null);
        alVencerSesion();
      }
    } else if (error.estado === 410 && error.codigo === "enlace_vencido" && !propio) {
      alVencerEnlace();
    }
    // 409 hora_ocupada y el resto los maneja la pantalla, que conserva lo escrito.
  };

  const cliente: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => alFallar(error) }),
    // Una mutación con `meta.atiendeEnlaceVencido` muestra ella misma el 410 (p. ej. el enlace de recuperar clave).
    mutationCache: new MutationCache({
      onError: (error, _variables, _contexto, mutacion) => alFallar(error, mutacion.meta?.atiendeEnlaceVencido === true),
    }),
    defaultOptions: {
      // `networkMode: "always"`: con la red caída se intenta igual y falla con ErrorRed («Sin conexión»).
      // Por defecto TanStack pausa las consultas (pantalla en «Cargando» para siempre) y encola las
      // escrituras para enviarlas al volver la red: la app no escribe nada sin conexión.
      queries: { retry: debeReintentar, refetchOnWindowFocus: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return cliente;
}

