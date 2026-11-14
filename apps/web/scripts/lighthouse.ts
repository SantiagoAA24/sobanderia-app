/* global process, console */
/**
 * Lighthouse en móvil (emulación de Moto G con red 4G lenta y CPU 4× más lenta, lo que Lighthouse trae por defecto)
 * sobre la build de producción, con la API simulada con datos del contrato. Además comprueba la instalabilidad
 * con el propio Chrome (Page.getInstallabilityErrors), porque Lighthouse 12+ ya no puntúa la categoría PWA.
 *
 *   npm run build && npx vite-node scripts/lighthouse.ts
 *   DIST=/ruta/a/otra/dist RUTAS=/,/instalar-app CORRIDAS=3 npx vite-node scripts/lighthouse.ts
 *
 * Cada ruta se mide varias veces y se informa la mediana (Lighthouse varía entre corridas).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

import { respuestaDeContrato, USUARIOS } from "../src/pruebas/contrato";

const raiz = resolve(__dirname, "..");
const DIST = resolve(process.env.DIST ?? resolve(raiz, "dist"));
const RUTAS = (process.env.RUTAS ?? "/,/instalar,/agendar,/ingreso").split(",");
const CORRIDAS = Number(process.env.CORRIDAS ?? 3);
const SALIDA = process.env.SALIDA ?? resolve(raiz, "lighthouse-resultados.json");
const PUERTO_WEB = 4175;
const PUERTO_API = 8000;
const CHROME = ["/opt/pw-browsers/chromium/chrome-linux64/chrome", process.env.CHROME_PATH ?? ""].find((r) => r && existsSync(r));

// API simulada: la web la alcanza por el proxy de `vite preview` (/api → localhost:8000).
const api = createServer((req, res) => {
  const { estado, cuerpo } = respuestaDeContrato(req.method ?? "GET", (req.url ?? "/").split("?")[0]!, USUARIOS.anonimo);
  res.writeHead(estado, { "content-type": "application/json" });
  res.end(cuerpo === null ? "" : JSON.stringify(cuerpo));
});
await new Promise<void>((ok) => api.listen(PUERTO_API, ok));

const BASE = `http://localhost:${PUERTO_WEB}`;
// Un servidor viejo en el puerto haría medir otra build sin avisar: se exige el puerto libre.
if (await fetch(BASE).then(() => true, () => false)) throw new Error(`El puerto ${PUERTO_WEB} ya está en uso: cierre el servidor anterior (pkill -f "vite preview").`);
// Se ejecuta Vite directamente (no con npx) y en su propio grupo de procesos para poder terminarlo completo.
const preview = spawn(process.execPath, [resolve(raiz, "node_modules/vite/bin/vite.js"), "preview", "--port", String(PUERTO_WEB), "--strictPort", "--outDir", DIST], { cwd: raiz, stdio: "ignore", detached: true });
const cerrarTodo = () => {
  try {
    process.kill(-preview.pid!);
  } catch {
    /* ya terminó */
  }
};
process.on("exit", cerrarTodo);
for (let i = 0; !(await fetch(BASE).then((r) => r.ok, () => false)); i++) {
  if (i > 60) throw new Error("vite preview no arrancó");
  await new Promise((r) => setTimeout(r, 500));
}

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
interface Corrida { rendimiento: number; accesibilidad: number; buenasPracticas: number; seo: number; fcp: number; lcp: number; tbt: number; cls: number; si: number; fallos: string[] }
const resultados: Record<string, { corridas: Corrida[]; mediana: Corrida }> = {};

for (const ruta of RUTAS) {
  const corridas: Corrida[] = [];
  for (let i = 0; i < CORRIDAS; i++) {
    const chrome = await launch({ chromePath: CHROME, chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
    try {
      const r = await lighthouse(BASE + ruta, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
      const lhr = r!.lhr;
      const nota = (c: string) => Math.round((lhr.categories[c]!.score ?? 0) * 100);
      const valor = (a: string) => lhr.audits[a]!.numericValue ?? 0;
      corridas.push({
        rendimiento: nota("performance"),
        accesibilidad: nota("accessibility"),
        buenasPracticas: nota("best-practices"),
        seo: nota("seo"),
        fcp: valor("first-contentful-paint"),
        lcp: valor("largest-contentful-paint"),
        tbt: valor("total-blocking-time"),
        cls: valor("cumulative-layout-shift"),
        si: valor("speed-index"),
        fallos: Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual").map((a) => `${a.id} (${a.score})`),
      });
    } finally {
      await chrome.kill();
    }
  }
  const m = (k: keyof Omit<Corrida, "fallos">) => mediana(corridas.map((c) => c[k]));
  resultados[ruta] = {
    corridas,
    mediana: { rendimiento: m("rendimiento"), accesibilidad: m("accesibilidad"), buenasPracticas: m("buenasPracticas"), seo: m("seo"), fcp: m("fcp"), lcp: m("lcp"), tbt: m("tbt"), cls: m("cls"), si: m("si"), fallos: corridas[0]!.fallos },
  };
  console.log(`${ruta}: rendimiento ${corridas.map((c) => c.rendimiento).join("/")}  accesibilidad ${corridas.map((c) => c.accesibilidad).join("/")}`);
}

// Instalabilidad según el propio Chrome (la que usa el botón «Instalar»).
const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");
// El `chrome-headless-shell` de Playwright no calcula la instalabilidad: se usa Chrome completo en modo headless nuevo.
const navegador = await chromium.launch({ executablePath: CHROME, args: ["--headless=new", "--no-sandbox"], headless: false });
const pagina = await navegador.newPage();
await pagina.goto(BASE + "/");
// Sin service worker (p. ej. la build anterior a la Fase 9) `ready` nunca se resuelve: se espera como máximo 5 s.
await pagina.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 5000))]));
await pagina.reload();
const cdp = await pagina.context().newCDPSession(pagina);
await cdp.send("Page.enable");
await pagina.reload(); // Chrome calcula la instalabilidad al cargar, de forma asíncrona
await pagina.waitForLoadState("networkidle");
await new Promise((r) => setTimeout(r, 3000));
const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: Array<{ errorId: string }> };
const { url: urlManifiesto, errors } = (await cdp.send("Page.getAppManifest")) as { url: string; errors: Array<{ message: string }> };
const controlada = await pagina.evaluate(() => !!navigator.serviceWorker.controller);
await navegador.close();
const instalabilidad = { // `in-incognito` es del contexto de prueba de Playwright (ventana privada), no de la app.
  errores: installabilityErrors.map((e) => e.errorId).filter((id) => id !== "in-incognito"), manifiesto: urlManifiesto, erroresDelManifiesto: errors.map((e) => e.message), serviceWorkerControla: controlada };

writeFileSync(SALIDA, JSON.stringify({ dist: DIST, corridas: CORRIDAS, resultados, instalabilidad }, null, 2));
console.log("instalabilidad:", JSON.stringify(instalabilidad));
console.log("guardado en", SALIDA);
cerrarTodo();
api.close();
process.exit(0);
