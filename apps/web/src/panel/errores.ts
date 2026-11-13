import { esErrorApi } from "../api/errores";

export const SIN_CONEXION = "No hay conexión. Revise su internet e inténtelo de nuevo.";

/** Mensaje para mostrar: el de la API si respondió; si no, el de «sin conexión». */
export const textoDeError = (e: unknown) => (esErrorApi(e) ? e.message : SIN_CONEXION);
