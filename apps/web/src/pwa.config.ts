import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** El manifiesto es JSON estático y no entiende variables CSS: se leen de tokens.css, la única fuente de colores. */
function token(nombre: string): string {
  const css = readFileSync(resolve(__dirname, "estilos/tokens.css"), "utf8");
  const valor = new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
  if (!valor) throw new Error(`Falta el token --${nombre} en tokens.css`);
  return valor.toLowerCase();
}

/** Configuración de la PWA. */
export const manifiesto = {
  name: "Sobandería",
  short_name: "Sobandería",
  description: "Agende su cita en la sobandería desde el celular.",
  lang: "es",
  dir: "ltr",
  display: "standalone",
  orientation: "portrait",
  start_url: "/",
  scope: "/",
  theme_color: token("brand"),
  background_color: token("surface-100"),
  icons: [
    { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} as const;

/**
 * Service worker: guarda solo el cascarón de la interfaz (HTML, JS, CSS, fuentes e íconos).
 * Nunca toca `/api`: ni lo guarda, ni responde navegaciones con el HTML de la app (un enlace a
 * `/api/...` debe llegar al servidor). Los datos de citas jamás quedan en el celular.
 */
export const workbox = {
  globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api(\/|$)/, /^\/openapi\.json$/],
  // Sin `runtimeCaching`: lo que no está en el precache siempre va a la red.
  runtimeCaching: [],
  cleanupOutdatedCaches: true,
  // La versión nueva se activa en la siguiente apertura; nunca recarga a mitad de un agendamiento.
  skipWaiting: false,
  clientsClaim: false,
} as const;
