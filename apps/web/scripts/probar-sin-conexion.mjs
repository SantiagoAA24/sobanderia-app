/* global navigator, caches, URL */
// Prueba manual en Chromium real (no corre en `make check`; la automatizada de extremo a extremo es de la Fase 10).
// Uso: npm run build && npx vite preview --port 4173 & node scripts/probar-sin-conexion.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const base = process.env.URL ?? "http://localhost:4173";
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
const pagina = await contexto.newPage();
const peticionesApi = [];
pagina.on("request", (r) => new URL(r.url()).pathname.startsWith("/api") && peticionesApi.push(r.url()));

await pagina.goto(base);
await pagina.evaluate(() => navigator.serviceWorker.ready);
await pagina.reload(); // ya controlada por el service worker
const controlada = await pagina.evaluate(() => !!navigator.serviceWorker.controller);
const cache = await pagina.evaluate(async () => Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)])));
const enCacheApi = cache.flatMap(([, urls]) => urls).filter((u) => u.startsWith("/api") || u.includes("openapi"));

await contexto.setOffline(true);
await pagina.goto(`${base}/agendar`); // pantalla que necesita datos de la API
const h1 = await pagina.getByRole("heading", { level: 1 }).first().textContent({ timeout: 15000 });
const hayReintento = await pagina.getByRole("button", { name: "Intentar de nuevo" }).isVisible();
await pagina.screenshot({ path: process.env.CAPTURA ?? "sin-conexion.png" });
const rutaProfunda = await pagina.goto(`${base}/instalar-app`).then(() => pagina.getByRole("heading", { level: 1 }).first().textContent()).catch((e) => `ERROR ${e.message}`);

console.log(JSON.stringify({ controlada, archivosEnCache: cache.reduce((n, [, u]) => n + u.length, 0), enCacheApi, tituloAgendarSinRed: h1, hayReintento, instalarSinRed: rutaProfunda }, null, 2));
await navegador.close();
if (!controlada || enCacheApi.length || h1?.trim() !== "Sin conexión" || !hayReintento || rutaProfunda?.trim() !== "Tenga la app a la mano") process.exit(1);
