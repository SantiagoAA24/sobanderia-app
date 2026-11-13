import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { manifiesto } from "./pwa.config";

const raiz = resolve(__dirname, "..");
const tokens = readFileSync(resolve(__dirname, "estilos/tokens.css"), "utf8");
const token = (nombre: string) => new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens)?.[1]?.toLowerCase();

describe("Manifiesto", () => {
  it("cumple lo que Chrome exige para instalar", () => {
    expect(manifiesto.name).toBe("Sobandería");
    expect(manifiesto.lang).toBe("es");
    expect(manifiesto.display).toBe("standalone");
    expect(manifiesto.start_url).toBe("/");
    expect(manifiesto.scope).toBe("/");
    const tamanos = manifiesto.icons.map((i) => `${i.sizes}:${i.purpose ?? "any"}`);
    expect(tamanos).toContain("192x192:any");
    expect(tamanos).toContain("512x512:any");
    expect(tamanos).toContain("512x512:maskable");
  });

  it("usa los colores de tokens.css", () => {
    expect(manifiesto.theme_color).toBe(token("brand"));
    expect(manifiesto.background_color).toBe(token("surface-100"));
  });

  it("cada ícono declarado existe en public/", () => {
    for (const icono of manifiesto.icons) {
      const png = readFileSync(resolve(raiz, "public", icono.src.replace(/^\//, "")));
      const [ancho, alto] = [png.readUInt32BE(16), png.readUInt32BE(20)];
      expect(`${ancho}x${alto}`).toBe(icono.sizes);
    }
    expect(() => readFileSync(resolve(raiz, "public/iconos/apple-touch-icon.png"))).not.toThrow();
  });

  it("index.html enlaza el ícono de iOS y declara el color del tema", () => {
    const html = readFileSync(resolve(raiz, "index.html"), "utf8");
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain(`content="${token("brand")}"`);
  });
});

import { workbox } from "./pwa.config";

describe("Service worker", () => {
  it("responde navegaciones con la interfaz, salvo las de /api", () => {
    expect(workbox.navigateFallback).toBe("/index.html");
    const bloqueada = (ruta: string) => workbox.navigateFallbackDenylist.some((r) => r.test(ruta));
    expect(bloqueada("/api/citas")).toBe(true);
    expect(bloqueada("/api")).toBe(true);
    expect(bloqueada("/openapi.json")).toBe(true);
    expect(bloqueada("/mi-cita/abc")).toBe(false);
    expect(bloqueada("/apiario")).toBe(false);
  });

  it("no define reglas de caché en tiempo de ejecución, así que ningún dato se guarda", () => {
    expect(workbox.runtimeCaching).toEqual([]);
  });

  it("no cambia de versión a mitad de un agendamiento", () => {
    expect(workbox.skipWaiting).toBe(false);
  });

  it("guarda las fuentes, los íconos y el código de la interfaz", () => {
    expect(workbox.globPatterns.join()).toMatch(/woff2/);
    expect(workbox.globPatterns.join()).toMatch(/png/);
    expect(workbox.globPatterns.join()).toMatch(/js/);
  });
});
