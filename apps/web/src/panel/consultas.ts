/** Consultas y cambios del panel del sobandero. Todo pasa por el cliente tipado de la API. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import type { components } from "../api/esquema";

type Esquemas = components["schemas"];
export type CitaPanel = Esquemas["CitaSobanderoOut"];
/** `avisar` es opcional: la API lo toma como verdadero si no llega. */
export type CambioCita = Omit<Esquemas["CambioCitaIn"], "avisar"> & { avisar?: boolean };

/** Todo lo del panel cuelga de esta clave: un cambio la invalida y las pantallas se ponen al día. */
export const PANEL = "panel";
const CADA_MINUTO = 60_000;

export const useCitasDia = (dia: string) =>
  useQuery({
    queryKey: [PANEL, "citas", "dia", dia],
    refetchInterval: CADA_MINUTO,
    queryFn: async () => datos(await api.GET("/yo/citas", { params: { query: { dia } } })),
  });

/** Las citas de la semana (lunes a domingo) que contiene `dia`. */
export const useCitasSemana = (dia: string) =>
  useQuery({
    queryKey: [PANEL, "citas", "semana", dia],
    refetchInterval: CADA_MINUTO,
    queryFn: async () => datos(await api.GET("/yo/citas", { params: { query: { semana: dia } } })),
  });

export const useCitaPanel = (id: number) =>
  useQuery({
    queryKey: [PANEL, "cita", id],
    enabled: Number.isInteger(id),
    queryFn: async () => datos(await api.GET("/yo/citas/{cita_id}", { params: { path: { cita_id: id } } })),
  });

export const useDiasLibres = () =>
  useQuery({
    queryKey: [PANEL, "dias"],
    queryFn: async () => datos(await api.GET("/yo/dias")),
  });

/** Horas libres del día. Al cambiar una cita, `excluirCita` libera su propia hora. */
export const useHorasLibres = (dia: string | null, excluirCita?: number) =>
  useQuery({
    queryKey: [PANEL, "horas", dia, excluirCita ?? null],
    enabled: dia !== null,
    queryFn: async () => datos(await api.GET("/yo/horas", { params: { query: { dia: dia!, excluir_cita: excluirCita } } })),
  });

/** Atendida, no asistió, cancelar o cambiar la hora. Devuelve la cita resultante (con otro id si cambió la hora). */
export const useCambiarCita = (id: number) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: CambioCita) =>
      datos(await api.PATCH("/yo/citas/{cita_id}", { params: { path: { cita_id: id } }, body: { avisar: true, ...cuerpo } })),
    onSuccess: (resultado) => {
      // La cita resultante queda en la caché ya actualizada: la pantalla siguiente no ve un instante la vieja.
      cliente.setQueryData([PANEL, "cita", resultado.id], resultado);
      void cliente.invalidateQueries({ queryKey: [PANEL] });
    },
  });
};
