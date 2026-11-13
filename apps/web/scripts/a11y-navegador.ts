/**
 * axe completo (incluido el contraste) en Chromium real, a 390 px, sobre TODAS las rutas de la app,
 * con la API interceptada con datos del contrato. Además mide los objetivos táctiles (mínimo 48 px).
 *
 *   npm run a11y:navegador            (compila, levanta `vite preview` y recorre las rutas)
 *   SOLO=/panel npm run a11y:navegador  (solo las rutas que empiezan así)
 *
 * Falla si hay violaciones graves o críticas de axe. Las leves y los toques pequeños se listan.
 * No corre en `make check` (necesita un navegador); la suite automatizada de extremo a extremo es de la Fase 10.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

import {
  aplanar,
  estadoDeCitaPara,
  respuestaDeContrato,
  SIN_DATOS,
  sesionPara,
  soloRutasDePantalla,
  TITULOS_DE_ERROR,
  urlDePrueba,
} from "../src/pruebas/contrato";

// `rutas.tsx` crea el router del navegador al importarse: se le da un DOM mínimo solo para leer la lista de rutas.
const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
for (const clave of ["window", "document", "location", "history"] as const) {
  Object.defineProperty(globalThis, clave, { value: dom.window[clave], configurable: true });
}
const { rutasApp } = await import("../src/rutas");

const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");
const URL_BASE = "http://localhost:4174";
const axeCore = readFileSync(resolve(__dirname, "../node_modules/axe-core/axe.min.js"), "utf8");
const MINIMO_TACTIL = 48;

const solo = process.env.SOLO ?? "";
const rutas = soloRutasDePantalla(aplanar(rutasApp.slice())).filter((r) => r.startsWith(solo));

const preview = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { cwd: resolve(__dirname, ".."), stdio: "ignore" });
const cerrar = () => preview.kill();
process.on("exit", cerrar);
for (let i = 0; ; i++) {
  if (await fetch(URL_BASE).then((r) => r.ok, () => false)) break;
  if (i > 60) throw new Error("vite preview no arrancó (¿corrió `npm run build`?)");
  await new Promise((r) => setTimeout(r, 500));
}

const navegador = await chromium.launch();
interface Hallazgo { ruta: string; regla: string; impacto: string; elementos: string[] }
const graves: Hallazgo[] = [];
const leves: Hallazgo[] = [];
const toques: string[] = [];
const sinContenido: string[] = [];

for (const ruta of rutas) {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const pagina = await contexto.newPage();
  await pagina.route("**/api/**", async (r) => {
    const { pathname } = new URL(r.request().url());
    const { estado, cuerpo } = respuestaDeContrato(r.request().method(), pathname.replace(/^\/api/, ""), sesionPara(ruta), estadoDeCitaPara(ruta));
    await r.fulfill({ status: estado, contentType: "application/json", body: cuerpo === null ? "" : JSON.stringify(cuerpo) });
  });
  await pagina.goto(URL_BASE + urlDePrueba(ruta));
  await pagina.waitForSelector("h1");
  await pagina.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await pagina.evaluate(() => document.fonts.ready);

  const titulo = (await pagina.locator("h1").first().textContent()) ?? "";
  if (!SIN_DATOS.has(ruta) && TITULOS_DE_ERROR.test(titulo)) sinContenido.push(`${ruta} → «${titulo}»`);

  await pagina.evaluate(axeCore);
  const resultado = await pagina.evaluate(() => (window as unknown as { axe: { run: () => Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }> }> } }).axe.run());
  for (const v of resultado.violations) {
    const h = { ruta, regla: v.id, impacto: v.impact, elementos: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) };
    (v.impact === "critical" || v.impact === "serious" ? graves : leves).push(h);
  }

  const pequenos = await pagina.evaluate((min) => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    return [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch]")]
      // Los enlaces que van dentro de un párrafo (p. ej. «política de datos») son texto corrido y se excluyen.
      .filter((e) => visible(e) && !(e.tagName === "A" && e.closest("p, label, li > span")))
      // Casillas e interruptores se tocan por su <label>, no por el input.
      .map((e) => ({ r: (e instanceof HTMLInputElement && (e.type === "checkbox" || e.type === "radio") ? e.labels?.[0] ?? e : e).getBoundingClientRect(), e }))
      .filter(({ r }) => r.height < min || r.width < min)
      .map(({ r, e }) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""} «${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
  }, MINIMO_TACTIL);
  for (const p of pequenos) toques.push(`${ruta}: ${p}`);
  await contexto.close();
}

await navegador.close();
cerrar();

const linea = (h: Hallazgo) => `  ${h.ruta}  ${h.regla} (${h.impacto})  ${h.elementos.join(" | ")}`;
console.log(`Rutas revisadas: ${rutas.length}`);
console.log(`Violaciones graves o críticas: ${graves.length}`);
graves.forEach((h) => console.log(linea(h)));
console.log(`Violaciones leves o moderadas: ${leves.length}`);
leves.forEach((h) => console.log(linea(h)));
console.log(`Objetivos táctiles menores de ${MINIMO_TACTIL} px: ${toques.length}`);
toques.forEach((t) => console.log("  " + t));
console.log(`Rutas que cayeron en un estado de error (datos de ejemplo insuficientes): ${sinContenido.length}`);
sinContenido.forEach((t) => console.log("  " + t));
process.exit(graves.length || sinContenido.length ? 1 : 0);
