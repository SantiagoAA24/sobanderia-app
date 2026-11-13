/** Consultas y cambios del panel del administrador. Todo pasa por el cliente tipado de la API. */

import { useQuery } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import type { components } from "../api/esquema";

type Esquemas = components["schemas"];
export type ResumenAdmin = Esquemas["ResumenOut"];
export type CitaAgenda = Esquemas["CitaAgendaOut"];

/** Todo lo del administrador cuelga de esta clave: un cambio la invalida y las pantallas se ponen al día. */
export const ADMIN = "admin";
const CADA_MINUTO = 60_000;

export const useResumen = (dia: string) =>
  useQuery({
    queryKey: [ADMIN, "resumen", dia],
    refetchInterval: CADA_MINUTO,
    queryFn: async () => datos(await api.GET("/admin/resumen", { params: { query: { dia } } })),
  });

export const useAgenda = (dia: string) =>
  useQuery({
    queryKey: [ADMIN, "agenda", dia],
    refetchInterval: CADA_MINUTO,
    queryFn: async () => datos(await api.GET("/admin/agenda", { params: { query: { dia } } })),
  });
