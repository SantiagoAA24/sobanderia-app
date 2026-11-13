import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react()],
    define: {
      // `/ui` (catálogo de componentes) solo se incluye fuera de producción, o con VITE_MOSTRAR_UI=1.
      __MOSTRAR_UI__: JSON.stringify(mode !== "production" || env.VITE_MOSTRAR_UI === "1"),
    },
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
    },
  };
});
