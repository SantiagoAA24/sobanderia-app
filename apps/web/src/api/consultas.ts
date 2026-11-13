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
  const alFallar = (error: unknown) => {
    if (!esErrorApi(error)) return; // ErrorRed: la pantalla muestra «Sin conexión»
    if (error.estado === 401) {
      // Sin sesión previa (p. ej. clave incorrecta en el ingreso) el 401 lo atiende la pantalla.
      const habiaSesion = cliente.getQueryData<Usuario | null>(CLAVES.sesion);
      if (habiaSesion) {
        cliente.setQueryData(CLAVES.sesion, null);
        alVencerSesion();
      }
    } else if (error.estado === 410 && error.codigo === "enlace_vencido") {
      alVencerEnlace();
    }
    // 409 hora_ocupada y el resto los maneja la pantalla, que conserva lo escrito.
  };

  const cliente: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: alFallar }),
    mutationCache: new MutationCache({ onError: alFallar }),
    defaultOptions: {
      queries: { retry: debeReintentar, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return cliente;
}

