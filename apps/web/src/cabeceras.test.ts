import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CABECERAS_WEB, CSP } from "../cabeceras";

const caddy = readFileSync(resolve(__dirname, "../../../deploy/Caddyfile.cabeceras"), "utf8");

describe("cabeceras de seguridad de la web", () => {
  it("el fragmento de Caddy repite exactamente cada cabecera de cabeceras.ts", () => {
    for (const [nombre, valor] of Object.entries(CABECERAS_WEB)) {
      expect(caddy, nombre).toContain(`${nombre} "${valor}"`);
    }
  });

  it("Caddy agrega HSTS (solo tiene sentido con HTTPS)", () => {
    expect(caddy).toMatch(/Strict-Transport-Security "max-age=\d+/);
  });

  it("la CSP no admite scripts en línea, de otros orígenes, objetos ni marcos ajenos", () => {
    const directivas = Object.fromEntries(CSP.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
    expect(directivas["script-src"]).toEqual(["'self'"]);
    expect(directivas["object-src"]).toEqual(["'none'"]);
    expect(directivas["frame-ancestors"]).toEqual(["'none'"]);
    expect(directivas["default-src"]).toEqual(["'self'"]);
    expect(CSP).not.toMatch(/unsafe-eval|https?:|\*/);
  });
});
