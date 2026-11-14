import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Recorridos de extremo a extremo a 390×844. Levantan SU PROPIA API y su propia base (`sobanderia_e2e`),
 * que se reinicia al arrancar; nunca tocan la base de desarrollo.
 *
 *   make e2e            (compila la web y corre los recorridos)
 *   E2E_REPETIR=3 make e2e
 */
const PUERTO_API = 8101;
const PUERTO_WEB = 4175;
const RAIZ_API = resolve(import.meta.dirname, "../api");
const CARPETA_REGISTRO = resolve(import.meta.dirname, "e2e/.registro");
const ARCHIVO_CORREO = resolve(CARPETA_REGISTRO, "correo.log");

const URL_BASE_E2E =
  process.env.E2E_DATABASE_URL ?? "postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia_e2e";

// El correo de recuperación sale al registro (CorreoFalso): se anexa a un archivo para que la prueba lo lea.
mkdirSync(CARPETA_REGISTRO, { recursive: true });
const archivoLog = resolve(CARPETA_REGISTRO, "uvicorn-log.json");
writeFileSync(
  archivoLog,
  JSON.stringify({
    version: 1,
    disable_existing_loggers: false,
    formatters: { solo: { format: "%(message)s" } },
    handlers: { correo: { class: "logging.FileHandler", filename: ARCHIVO_CORREO, formatter: "solo", encoding: "utf-8" } },
    loggers: { "sobanderia.correo": { handlers: ["correo"], level: "INFO", propagate: false } },
  }),
);

const entornoApi = `DATABASE_URL=${URL_BASE_E2E} ENTORNO=pruebas ORIGEN_WEB=http://localhost:${PUERTO_WEB} PROVEEDOR_WHATSAPP=falso`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // una prueba que solo pasa al reintentar es un fallo
  repeatEach: Number(process.env.E2E_REPETIR ?? 1),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `sh -c "${entornoApi} python -m herramientas.e2e_preparar && ${entornoApi} uvicorn app.main:app --port ${PUERTO_API} --log-config ${archivoLog}"`,
      cwd: RAIZ_API,
      url: `http://localhost:${PUERTO_API}/salud`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: `npx vite preview --port ${PUERTO_WEB} --strictPort`,
      url: `http://localhost:${PUERTO_WEB}`,
      env: { VITE_API_URL: `http://localhost:${PUERTO_API}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
