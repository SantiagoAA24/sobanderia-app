// Se corre después de `vite build`: comprueba que el service worker generado no maneje /api
// y que el precache no incluya datos. Falla (código 1) si algo no cumple.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "../dist");
const falla = (m) => {
  console.error(`verificar-sw: ${m}`);
  process.exit(1);
};

if (!existsSync(resolve(dist, "sw.js"))) falla("no existe dist/sw.js");
const sw = readFileSync(resolve(dist, "sw.js"), "utf8");
const manifiesto = JSON.parse(readFileSync(resolve(dist, "manifest.webmanifest"), "utf8"));

if (/registerRoute\(\s*\/[^,]*api/.test(sw) || /registerRoute\([^)]*["'`]\/api/.test(sw)) falla("sw.js registra una ruta de caché para /api");
if (!/denylist/.test(sw) || !/\^\\\/api/.test(sw)) falla("sw.js no excluye /api de la navegación");
const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);
if (urls.some((u) => /(^|\/)api(\/|$)|openapi/.test(u))) falla("el precache incluye /api");
if (!urls.includes("index.html")) falla("el precache no incluye index.html");
if (!urls.some((u) => u.endsWith(".woff2"))) falla("el precache no incluye las fuentes");
if (manifiesto.display !== "standalone") falla("el manifiesto no es standalone");
if (readdirSync(dist).filter((f) => f.endsWith(".js")).length === 0 && !urls.some((u) => u.endsWith(".js"))) falla("sin JS en el precache");

console.log(`verificar-sw: correcto (${urls.length} archivos en el precache, ninguno de /api)`);
