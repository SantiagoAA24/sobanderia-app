/** Consultas y cambios del panel del sobandero. Todo pasa por el cliente tipado de la API. */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import type { components } from "../api/esquema";
import { CLAVES, type Usuario } from "../api/sesion";

type Esquemas = components["schemas"];
export type CitaPanel = Esquemas["CitaSobanderoOut"];
/** `avisar` es opcional: la API lo toma como verdadero si no llega. */
export type Horario = Esquemas["HorarioOut"];
export type DiaHorario = Esquemas["DiaHorarioIO"];
export type Bloqueo = Esquemas["BloqueoOut"];

export type ClienteLista = Esquemas["ClienteListaOut"];
export type FichaCliente = Esquemas["FichaClienteOut"];
export type Perfil = Esquemas["PerfilOut"];

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

/** Cita manual de quien llamó por teléfono. */
export const useCrearCitaManual = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: { nombre: string; celular: string; inicio: string }) =>
      datos(await api.POST("/yo/citas", { body: cuerpo })),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: [PANEL] }),
  });
};

export const useHorario = () =>
  useQuery({
    queryKey: [PANEL, "horario"],
    queryFn: async () => datos(await api.GET("/yo/horario")),
  });

/** Guarda las franjas de los días enviados; cambia las horas libres, así que se pone al día todo el panel. */
export const useGuardarHorario = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (dias: DiaHorario[]) => datos(await api.PUT("/yo/horario", { body: { dias } })),
    onSuccess: (horario) => {
      cliente.setQueryData([PANEL, "horario"], horario);
      void cliente.invalidateQueries({ queryKey: [PANEL] });
    },
  });
};

export const useBloqueos = () =>
  useQuery({
    queryKey: [PANEL, "bloqueos"],
    queryFn: async () => datos(await api.GET("/yo/bloqueos")),
  });

export const useCrearBloqueo = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: { inicio: string; fin: string; motivo?: string | null }) =>
      datos(await api.POST("/yo/bloqueos", { body: cuerpo })),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: [PANEL] }),
  });
};

export const useQuitarBloqueo = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.DELETE("/yo/bloqueos/{bloqueo_id}", { params: { path: { bloqueo_id: id } } });
    },
    onSuccess: () => void cliente.invalidateQueries({ queryKey: [PANEL] }),
  });
};

/** Clientes de este sobandero; `q` busca por nombre o celular. Mientras llega otra búsqueda, deja la lista anterior. */
export const useClientes = (q: string) =>
  useQuery({
    queryKey: [PANEL, "clientes", q],
    placeholderData: keepPreviousData,
    queryFn: async () => datos(await api.GET("/yo/clientes", { params: { query: { q } } })),
  });

export const useFichaCliente = (id: number) =>
  useQuery({
    queryKey: [PANEL, "cliente", id],
    enabled: Number.isInteger(id),
    queryFn: async () => datos(await api.GET("/yo/clientes/{cliente_id}", { params: { path: { cliente_id: id } } })),
  });

export const usePerfil = () =>
  useQuery({
    queryKey: [PANEL, "perfil"],
    queryFn: async () => datos(await api.GET("/yo/perfil")),
  });

/** Nombre o correo (el correo pide la clave actual). Deja el perfil y la sesión al día con el nombre nuevo. */
export const useCambiarPerfil = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: { nombre?: string; correo?: string; clave_actual?: string }) =>
      datos(await api.PATCH("/yo/perfil", { body: cuerpo })),
    onSuccess: (perfil) => {
      cliente.setQueryData([PANEL, "perfil"], perfil);
      cliente.setQueryData<Usuario | null>(CLAVES.sesion, (u) => (u ? { ...u, nombre: perfil.nombre } : u));
    },
  });
};
