import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

function color(nombre: string): [number, number, number] {
  const m = new RegExp(`--${nombre}:\\s*#([0-9a-f]{6})`, "i").exec(css);
  if (!m?.[1]) throw new Error(`Falta el token ${nombre}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(color(a)), luminancia(color(b))].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Pares texto/fondo que usan los componentes (README de cada uno en design/sistema). */
const PARES: Array<[string, string]> = [
  ["ink", "surface-100"],
  ["ink", "surface-raised"],
  ["ink", "surface-sand"],
  ["ink-muted", "surface-100"],
  ["ink-muted", "surface-raised"],
  ["ink-muted", "surface-sand"],
  ["brand-deep", "surface-raised"],
  ["brand-deep", "surface-sand"],
  ["brand-deep", "surface-clay-tint"],
  ["brand-deep", "surface-100"],
  ["brand-ink", "surface-avatar"],
  ["on-brand", "brand"],
  ["on-brand", "brand-deep"],
  ["brand-deep", "on-brand"],
  ["success", "surface-100"],
  ["surface-100", "ink"],
];

describe("contraste de los tokens (mínimo 4.5:1)", () => {
  it.each(PARES)("%s sobre %s", (texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it("el anillo de foco supera 3:1 sobre los fondos", () => {
    for (const fondo of ["surface-100", "surface-raised", "surface-sand"]) {
      expect(contraste("focus-ring", fondo)).toBeGreaterThanOrEqual(3);
    }
  });
});
