/** Consultas y cambios del panel del administrador. Todo pasa por el cliente tipado de la API. */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import type { components } from "../api/esquema";

type Esquemas = components["schemas"];
export type ResumenAdmin = Esquemas["ResumenOut"];
export type CitaAgenda = Esquemas["CitaAgendaOut"];
export type SobanderoAdmin = Esquemas["SobanderoAdminOut"];
export type HorarioSobandero = Esquemas["HorarioOut"];
export type DiaHorarioAdmin = Esquemas["DiaHorarioIO"];
export type NuevoSobandero = Esquemas["NuevoSobanderoIn"];
export type ReporteSemanal = Esquemas["ReporteOut"];
export type DatosNegocio = Esquemas["NegocioIn"];
export type FilaActividad = Esquemas["ActividadOut"];
export type CambioSobandero = Esquemas["CambioSobanderoIn"];

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

export const useSobanderos = () =>
  useQuery({
    queryKey: [ADMIN, "sobanderos"],
    queryFn: async () => datos(await api.GET("/admin/sobanderos")),
  });

export const useSobandero = (id: number) =>
  useQuery({
    queryKey: [ADMIN, "sobandero", id],
    enabled: Number.isInteger(id),
    queryFn: async () => datos(await api.GET("/admin/sobanderos/{sobandero_id}", { params: { path: { sobandero_id: id } } })),
  });

/** La clave temporal viaja una sola vez en esta petición; la respuesta no la repite. */
export const useCrearSobandero = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: NuevoSobandero) => datos(await api.POST("/admin/sobanderos", { body: cuerpo })),
    onSuccess: (sobandero) => {
      cliente.setQueryData([ADMIN, "sobandero", sobandero.id], sobandero);
      void cliente.invalidateQueries({ queryKey: [ADMIN] });
    },
  });
};

export const useEditarSobandero = (id: number) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: CambioSobandero) =>
      datos(await api.PATCH("/admin/sobanderos/{sobandero_id}", { params: { path: { sobandero_id: id } }, body: cuerpo })),
    onSuccess: (sobandero) => {
      cliente.setQueryData([ADMIN, "sobandero", id], sobandero);
      void cliente.invalidateQueries({ queryKey: [ADMIN] });
    },
  });
};

export const useHorarioSobandero = (id: number) =>
  useQuery({
    queryKey: [ADMIN, "horario", id],
    enabled: Number.isInteger(id),
    queryFn: async () => datos(await api.GET("/admin/sobanderos/{sobandero_id}/horario", { params: { path: { sobandero_id: id } } })),
  });

/** Guarda las franjas de los días enviados. Las citas ya agendadas no cambian. */
export const useGuardarHorarioSobandero = (id: number) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (dias: DiaHorarioAdmin[]) =>
      datos(await api.PUT("/admin/sobanderos/{sobandero_id}/horario", { params: { path: { sobandero_id: id } }, body: { dias } })),
    onSuccess: (horario) => {
      cliente.setQueryData([ADMIN, "horario", id], horario);
      void cliente.invalidateQueries({ queryKey: [ADMIN] });
    },
  });
};

export const useEnviarEnlaceClave = (id: number) =>
  useMutation({
    mutationFn: async () => {
      await api.POST("/admin/sobanderos/{sobandero_id}/enlace-clave", { params: { path: { sobandero_id: id } } });
    },
  });

export type QueHacerConLasCitas = components["schemas"]["BajaIn"]["citas"];

/** Da de baja y, según `citas`, deja las citas próximas o las cancela con aviso por WhatsApp. */
export const useDarDeBaja = (id: number) => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (citas: QueHacerConLasCitas) =>
      datos(await api.POST("/admin/sobanderos/{sobandero_id}/baja", { params: { path: { sobandero_id: id } }, body: { citas } })),
    onSuccess: (resultado) => {
      cliente.setQueryData([ADMIN, "sobandero", id], resultado.sobandero);
      void cliente.invalidateQueries({ queryKey: [ADMIN] });
    },
  });
};

export const useDatosNegocio = () =>
  useQuery({
    queryKey: [ADMIN, "negocio"],
    queryFn: async () => datos(await api.GET("/admin/negocio")),
  });

/** Lo que guarda el administrador es lo que ve el cliente en Inicio: se pone al día también esa consulta. */
export const useGuardarNegocio = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: DatosNegocio) => datos(await api.PUT("/admin/negocio", { body: cuerpo })),
    onSuccess: (negocio) => {
      cliente.setQueryData([ADMIN, "negocio"], negocio);
      void cliente.invalidateQueries({ queryKey: [ADMIN] });
      void cliente.invalidateQueries({ queryKey: ["negocio"] });
    },
  });
};

export const FILAS_POR_PAGINA = 30;

/** Lo más reciente primero; cada página pide las anteriores a la última fila vista. */
export const useActividad = () =>
  useInfiniteQuery({
    queryKey: [ADMIN, "actividad"],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => datos(await api.GET("/admin/actividad", { params: { query: { limite: FILAS_POR_PAGINA, antes: pageParam } } })),
    getNextPageParam: (ultima) => (ultima.length === FILAS_POR_PAGINA ? ultima.at(-1)?.id : undefined),
  });

/** Semana de hoy (lunes a domingo): el servidor la calcula en hora de Bogotá. */
export const useReporte = () =>
  useQuery({
    queryKey: [ADMIN, "reporte"],
    queryFn: async () => datos(await api.GET("/admin/reporte", { params: { query: {} } })),
  });
