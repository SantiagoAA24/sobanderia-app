/** Ingreso, salida y claves. Todo pasa por el cliente tipado de la API. */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, datos } from "../api/cliente";
import { CLAVES, type Usuario } from "../api/sesion";
import { guardarClaveTemporal, olvidarClaveTemporal } from "./claveTemporal";

export const useIngresar = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: { correo: string; clave: string }) => {
      const usuario = datos(await api.POST("/auth/ingreso", { body: cuerpo }));
      return { usuario, clave: cuerpo.clave };
    },
    onSuccess: ({ usuario, clave }) => {
      if (usuario.debe_cambiar_clave) guardarClaveTemporal(clave);
      else olvidarClaveTemporal();
      cliente.setQueryData<Usuario | null>(CLAVES.sesion, usuario);
    },
  });
};

/** Cierra la sesión y borra todo lo que la caché tenía de esa persona. */
export const useSalir = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.POST("/auth/salida");
    },
    onSettled: () => {
      olvidarClaveTemporal();
      cliente.clear();
      cliente.setQueryData<Usuario | null>(CLAVES.sesion, null);
    },
  });
};

export const useCambiarClave = () => {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cuerpo: { clave_actual: string; clave_nueva: string }) => {
      await api.POST("/auth/cambiar-clave", { body: cuerpo });
    },
    onSuccess: () => {
      olvidarClaveTemporal();
      cliente.setQueryData<Usuario | null>(CLAVES.sesion, (u) => (u ? { ...u, debe_cambiar_clave: false } : u));
    },
  });
};

export const useRecuperarClave = () =>
  useMutation({
    mutationFn: async (correo: string) => datos(await api.POST("/auth/recuperar", { body: { correo } })),
  });

export const useRestablecerClave = () =>
  useMutation({
    meta: { atiendeEnlaceVencido: true },
    mutationFn: async (cuerpo: { token: string; clave_nueva: string }) => {
      await api.POST("/auth/restablecer", { body: cuerpo });
    },
  });
