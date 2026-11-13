/** Consultas y cambios del flujo del cliente. Todo pasa por el cliente tipado de la API. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import type { components } from "../api/esquema";

type Esquemas = components["schemas"];
export type Negocio = Esquemas["NegocioOut"];
export type SobanderoPublico = Esquemas["SobanderoPublicoOut"];
export type CitaCliente = Esquemas["CitaClienteOut"];
export type CrearCita = Esquemas["CrearCitaIn"];

export const useNegocio = () =>
  useQuery({
    queryKey: ["negocio"],
    queryFn: async () => datos(await api.GET("/publico/negocio")),
    staleTime: 10 * 60_000,
  });

export const useSobanderos = (habilitado = true) =>
  useQuery({
    queryKey: ["sobanderos"],
    enabled: habilitado,
    queryFn: async () => datos(await api.GET("/publico/sobanderos")),
  });

export const useDias = (sobanderoId: number | null) =>
  useQuery({
    queryKey: ["dias", sobanderoId],
    enabled: sobanderoId !== null,
    queryFn: async () =>
      datos(await api.GET("/publico/sobanderos/{sobandero_id}/dias", { params: { path: { sobandero_id: sobanderoId! } } })),
  });

export const useHoras = (sobanderoId: number | null, dia: string | null) =>
  useQuery({
    queryKey: ["horas", sobanderoId, dia],
    enabled: sobanderoId !== null && dia !== null,
    queryFn: async () =>
      datos(
        await api.GET("/publico/sobanderos/{sobandero_id}/horas", {
          params: { path: { sobandero_id: sobanderoId! }, query: { dia: dia! } },
        }),
      ),
  });

export const useCita = (token: string | undefined) =>
  useQuery({
    queryKey: ["cita", token],
    enabled: Boolean(token),
    queryFn: async () => datos(await api.GET("/mi-cita/{token}", { params: { path: { token: token! } } })),
  });

export const useCrearCita = () =>
  useMutation({ mutationFn: async (body: CrearCita) => datos(await api.POST("/publico/citas", { body })) });

/** La respuesta trae la cita ya actualizada: se deja en la caché para que Gestionar la muestre al volver. */
export const useReprogramar = (token: string) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (inicio: string) =>
      datos(await api.POST("/mi-cita/{token}/reprogramar", { params: { path: { token } }, body: { inicio } })),
    onSuccess: (cita) => {
      cliente.setQueryData(["cita", token], cita);
      void cliente.invalidateQueries({ queryKey: ["horas"] });
      void cliente.invalidateQueries({ queryKey: ["dias"] });
    },
  });
};

export const useCancelarCita = (token: string) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async () => datos(await api.POST("/mi-cita/{token}/cancelar", { params: { path: { token } } })),
    onSuccess: (cita) => {
      cliente.setQueryData(["cita", token], cita);
      void cliente.invalidateQueries({ queryKey: ["horas"] });
      void cliente.invalidateQueries({ queryKey: ["dias"] });
    },
  });
};

export const usePedirEnlace = () =>
  useMutation({
    mutationFn: async (celular: string) => datos(await api.POST("/publico/mi-cita/enlace", { body: { celular } })),
  });
