import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

import { CABECERAS_WEB } from "./cabeceras";
import { manifiesto, workbox } from "./src/pwa.config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), VitePWA({ manifest: { ...manifiesto, icons: [...manifiesto.icons] }, registerType: "prompt", injectRegister: false, workbox: { ...workbox, navigateFallbackDenylist: [...workbox.navigateFallbackDenylist], globPatterns: [...workbox.globPatterns], runtimeCaching: [] }, includeAssets: ["iconos/apple-touch-icon.png", "iconos/icono.svg"] })],
    define: {
      // `/ui` (catálogo de componentes) solo se incluye fuera de producción, o con VITE_MOSTRAR_UI=1.
      __MOSTRAR_UI__: JSON.stringify(mode !== "production" || env.VITE_MOSTRAR_UI === "1"),
    },
    // Con las cabeceras de seguridad reales: así los recorridos de Playwright corren bajo la CSP.
    preview: { headers: CABECERAS_WEB },
    server: {
      proxy: {
        "/api": {
          target: process.env.VITE_API_URL ?? "http://localhost:8000",
          changeOrigin: true,
          rewrite: (ruta: string) => ruta.replace(/^\/api/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      exclude: ["**/node_modules/**", "e2e/**"], // los recorridos de Playwright no son pruebas de Vitest
    },
  };
});
