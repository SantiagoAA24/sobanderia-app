import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const base = readFileSync(join(__dirname, "base.css"), "utf8");

function css(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? css(ruta) : n.endsWith(".css") ? [ruta] : [];
  });
}

describe("reducir movimiento", () => {
  const inicio = base.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  const bloque = inicio >= 0 ? base.slice(inicio) : ""; // la regla es el último bloque de base.css

  it("base.css apaga animaciones, transiciones y desplazamiento suave para todo elemento", () => {
    expect(bloque).toMatch(/\*,\s*\*::before,\s*\*::after/);
    expect(bloque).toMatch(/animation:\s*none\s*!important/);
    expect(bloque).toMatch(/transition:\s*none\s*!important/);
    expect(bloque).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it("ninguna hoja de estilos del código vuelve a activar movimiento dentro de la regla", () => {
    const sospechosas = css(RAIZ)
      .filter((ruta) => !ruta.endsWith("base.css"))
      .filter((ruta) => /@media\s*\(prefers-reduced-motion:\s*no-preference\)/.test(readFileSync(ruta, "utf8")))
      .map((ruta) => relative(RAIZ, ruta));
    expect(sospechosas).toEqual([]);
  });

  it("el movimiento que se añada fuera de base.css queda cubierto por la regla global", () => {
    // Cualquier `animation`/`transition` de los componentes pierde con el `!important` de base.css,
    // salvo que se declare con `!important` propio: eso sí se prohíbe.
    const conImportant = css(RAIZ)
      .filter((ruta) => !ruta.endsWith("base.css"))
      .filter((ruta) => /(animation|transition)[^;{}]*!important/.test(readFileSync(ruta, "utf8")))
      .map((ruta) => relative(RAIZ, ruta));
    expect(conImportant).toEqual([]);
  });

  it("la página importa base.css (donde vive la regla)", () => {
    expect(readFileSync(join(RAIZ, "main.tsx"), "utf8")).toContain("./estilos/base.css");
  });
});
