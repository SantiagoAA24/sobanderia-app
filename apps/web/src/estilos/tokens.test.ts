import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const EXCLUIDOS = [/tokens\.css$/, /\.test\.tsx?$/, /esquema\.d\.ts$/, /test-setup\.ts$/];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(css|tsx?)$/.test(nombre) && !EXCLUIDOS.some((e) => e.test(ruta)) ? [ruta] : [];
  });
}

function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const REGLAS: Array<[string, RegExp]> = [
  ["color hexadecimal", /(?<![\w&])#[0-9a-fA-F]{3,8}\b(?![\w-])/g],
  ["color rgb/hsl", /\b(?:rgba?|hsla?)\(/g],
  ["tamaño en px", /(?<![\w.-])\d*\.?\d+px\b/g],
];

describe("tokens de diseño", () => {
  const lista = archivos(RAIZ);

  it("encuentra los archivos de código a revisar", () => {
    expect(lista.length).toBeGreaterThan(0);
  });

  for (const [nombre, regla] of REGLAS) {
    it(`no hay ${nombre} fuera de tokens.css`, () => {
      const hallazgos = lista.flatMap((ruta) =>
        (sinComentarios(readFileSync(ruta, "utf8")).match(regla) ?? []).map(
          (m) => `${relative(RAIZ, ruta)}: ${m}`,
        ),
      );
      expect(hallazgos).toEqual([]);
    });
  }
});
