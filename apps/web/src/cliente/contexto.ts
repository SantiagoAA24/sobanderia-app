import type { UseQueryResult } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { leerId, rutaAgendar, rutaCita } from "./estadoAgendar";
import { useCita, useSobanderos } from "./consultas";

/**
 * Los pasos 2 y 3 sirven para agendar (`/agendar/:sobanderoId/...`) y para cambiar una cita
 * (`/mi-cita/:token/cambiar/...`). Este gancho dice en cuál de los dos están y de dónde sale el sobandero.
 */
export function useContextoPaso() {
  const { token, sobanderoId } = useParams();
  const id = leerId(sobanderoId);
  const sobanderos = useSobanderos(token === undefined);
  const cita = useCita(token);
  if (token !== undefined) {
    return {
      modo: "cambiar" as const,
      token,
      consulta: cita as UseQueryResult<unknown>,
      cita: cita.data,
      sobandero: cita.data?.sobandero,
      rutaDia: (dia?: string) => rutaCita.dia(token, dia),
      rutaHora: (dia: string, hora?: string) => rutaCita.hora(token, dia, hora),
      rutaVolver: rutaCita.ver(token),
    };
  }
  return {
    modo: "agendar" as const,
    token: undefined,
    consulta: sobanderos as UseQueryResult<unknown>,
    cita: undefined,
    sobandero: sobanderos.data?.find((s) => s.id === id),
    rutaDia: (dia?: string) => rutaAgendar.dia(id ?? 0, dia),
    rutaHora: (dia: string, hora?: string) => rutaAgendar.hora(id ?? 0, dia, hora),
    rutaVolver: rutaAgendar.sobandero,
  };
}

export type ContextoPaso = ReturnType<typeof useContextoPaso>;
