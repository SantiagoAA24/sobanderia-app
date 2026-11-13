/**
 * Datos de prueba derivados del contrato de la API (`api/openapi.json`) y datos de las rutas de la app.
 * Lo comparten `rutas.axe.test.tsx` (jsdom) y `scripts/a11y-navegador.ts` (Chromium real).
 * No entra en la app: solo lo importan pruebas y scripts.
 */
import type { RouteObject } from "react-router-dom";

import openapi from "../api/openapi.json";

type Esquema = Record<string, unknown>;
const esquemas = (openapi as unknown as { components: { schemas: Record<string, Esquema> } }).components.schemas;
const rutasApi = Object.entries((openapi as unknown as { paths: Record<string, Record<string, Esquema>> }).paths);

const POR_NOMBRE: Record<string, unknown> = { duracion_min: 30, dia_semana: 0, id: 1 };

function ejemplo(esquema: Esquema | undefined, nombre: string, estado: string): unknown {
  if (!esquema) return null;
  if (typeof esquema.$ref === "string") return ejemplo(esquemas[esquema.$ref.split("/").pop()!], nombre, estado);
  if (Array.isArray(esquema.allOf)) return ejemplo(esquema.allOf[0] as Esquema, nombre, estado);
  const alternativas = (esquema.anyOf ?? esquema.oneOf) as Esquema[] | undefined;
  if (alternativas) return ejemplo(alternativas.find((a) => a.type !== "null") ?? alternativas[0], nombre, estado);
  if (Array.isArray(esquema.enum)) return esquema.enum[0];
  switch (esquema.type) {
    case "string":
      // `estado` es texto libre en el contrato; las pantallas «cancelada» solo se ven con una cita cancelada.
      if (nombre === "estado") return estado;
      if (esquema.format === "date-time") return "2099-01-05T15:30:00Z";
      if (esquema.format === "date") return "2099-01-05";
      return nombre.includes("correo") ? "carlos@ejemplo.co" : nombre.includes("celular") ? "3001112233" : "Ejemplo";
    case "integer":
    case "number":
      return nombre in POR_NOMBRE ? POR_NOMBRE[nombre] : 1;
    case "boolean":
      return true; // p. ej. `puede_modificar`: con `false` varias pantallas redirigen y no se revisarían
    case "array":
      return [ejemplo(esquema.items as Esquema, nombre, estado)];
    default: {
      const propiedades = (esquema.properties ?? {}) as Record<string, Esquema>;
      return Object.fromEntries(Object.entries(propiedades).map(([k, v]) => [k, ejemplo(v, k, estado)]));
    }
  }
}

const plantilla = (ruta: string) => new RegExp(`^${ruta.replace(/\{[^}]+\}/g, "[^/]+")}$`);

export const USUARIOS = {
  admin: { nombre: "Ana", rol: "admin", debe_cambiar_clave: false },
  temporal: { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: true },
  anonimo: null,
} as const;
export type Sesion = (typeof USUARIOS)[keyof typeof USUARIOS];

export interface RespuestaFalsa {
  estado: number;
  cuerpo: unknown;
}

/** Respuesta de la API para `método ruta` (la ruta sin el prefijo `/api`), con la forma del contrato. */
export function respuestaDeContrato(metodo: string, ruta: string, sesion: Sesion, estadoCita = "agendada"): RespuestaFalsa {
  if (ruta === "/auth/yo") {
    return sesion
      ? { estado: 200, cuerpo: sesion }
      : { estado: 401, cuerpo: { codigo: "no_autenticado", mensaje: "Ingrese." } };
  }
  const m = metodo.toLowerCase();
  const [, operaciones] = rutasApi.find(([p, ops]) => plantilla(p).test(ruta) && m in ops) ?? [];
  const operacion = operaciones?.[m] as { responses: Record<string, Esquema> } | undefined;
  const exito = operacion && Object.keys(operacion.responses).find((c) => c.startsWith("2"));
  if (!operacion || !exito) return { estado: 404, cuerpo: { codigo: "no_encontrado", mensaje: "No encontrado." } };
  const contenido = (operacion.responses[exito] as { content?: { "application/json"?: { schema: Esquema } } }).content;
  const esquema = contenido?.["application/json"]?.schema;
  return { estado: Number(exito), cuerpo: esquema ? ejemplo(esquema, "", estadoCita) : null };
}

// --- Rutas -------------------------------------------------------------------------------------
export function aplanar(rutas: RouteObject[], base = ""): string[] {
  return rutas.flatMap((r) => {
    const completa = r.path ? `${base}/${r.path}`.replace(/\/+/g, "/") : base;
    const propias = r.path && !r.children && r.element ? [completa] : [];
    return [...propias, ...(r.children ? aplanar(r.children, completa) : [])];
  });
}

/** Rutas que se revisan: sin el catálogo `/ui` (tiene su propia prueba) ni los comodines. */
export const soloRutasDePantalla = (rutas: string[]) => rutas.filter((r) => r !== "/ui" && !r.includes("*"));

const VALORES: Record<string, string> = { id: "1", token: "token-de-ejemplo", sobanderoId: "1", dia: "lunes" };
const CONSULTAS: Record<string, string> = {
  "/agendar/:sobanderoId/hora": "?dia=2099-01-05",
  "/agendar/:sobanderoId/datos": "?dia=2099-01-05&hora=10:30",
  "/mi-cita/:token/cambiar/hora": "?dia=2099-01-05",
};

/** URL concreta para abrir una ruta con parámetros (`/panel/citas/:id` → `/panel/citas/1`). */
export const urlDePrueba = (ruta: string) =>
  ruta.replace(/:(\w+)/g, (_, p: string) => VALORES[p] ?? "1") + (CONSULTAS[ruta] ?? "");

export const sesionPara = (ruta: string): Sesion =>
  ruta.startsWith("/panel") || ruta.startsWith("/admin") ? USUARIOS.admin : ruta === "/primera-clave" ? USUARIOS.temporal : USUARIOS.anonimo;

export const estadoDeCitaPara = (ruta: string) => (ruta.endsWith("/cancelada") ? "cancelada" : "agendada");

/** Pantallas que, por diseño, no muestran datos: se permite que su título sea de «enlace vencido», etc. */
export const SIN_DATOS = new Set(["/enlace-vencido", "/sesion-vencida", "/olvide-clave", "/olvide-clave/enviado"]);

/** Títulos de pantallas de error: si una ruta con datos cae aquí, el servidor falso no la alimentó. */
export const TITULOS_DE_ERROR = /^(Sin conexión|No encontramos esa página|Este enlace ya no sirve)$/;
