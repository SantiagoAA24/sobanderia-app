import { afterEach, describe, expect, it, vi } from "vitest";

import {
  borrarBorrador,
  guardarBorrador,
  inicioDe,
  leerBorrador,
  leerDia,
  leerHora,
  leerId,
  rutaAgendar,
  rutaCita,
} from "./estadoAgendar";

afterEach(() => {
  borrarBorrador();
  vi.unstubAllGlobals();
});

describe("rutas del flujo", () => {
  it("el estado va en la URL: sobandero, día y hora", () => {
    expect(rutaAgendar.dia(3)).toBe("/agendar/3/dia");
    expect(rutaAgendar.dia(3, "2026-11-13")).toBe("/agendar/3/dia?dia=2026-11-13");
    expect(rutaAgendar.hora(3, "2026-11-13")).toBe("/agendar/3/hora?dia=2026-11-13");
    expect(rutaAgendar.datos(3, "2026-11-13", "10:30")).toBe("/agendar/3/datos?dia=2026-11-13&hora=10%3A30");
  });

  it("las rutas de la cita cuelgan del token", () => {
    expect(rutaCita.ver("abc")).toBe("/mi-cita/abc");
    expect(rutaCita.hora("abc", "2026-11-13", "10:30")).toBe("/mi-cita/abc/cambiar/hora?dia=2026-11-13&hora=10%3A30");
    expect(rutaCita.cancelada("abc")).toBe("/mi-cita/abc/cancelada");
  });
});

describe("leer la URL", () => {
  it("acepta solo días y horas bien formados", () => {
    expect(leerDia(new URLSearchParams("dia=2026-11-13"))).toBe("2026-11-13");
    expect(leerDia(new URLSearchParams("dia=2026-02-31"))).toBeNull();
    expect(leerDia(new URLSearchParams("dia=hoy"))).toBeNull();
    expect(leerHora(new URLSearchParams("hora=10:30"))).toBe("10:30");
    expect(leerHora(new URLSearchParams("hora=25:00"))).toBeNull();
    expect(leerHora(new URLSearchParams(""))).toBeNull();
    expect(leerId("3")).toBe(3);
    expect(leerId("0")).toBeNull();
    expect(leerId("3abc")).toBeNull();
    expect(leerId(undefined)).toBeNull();
  });

  it("convierte día y hora de Bogotá en el momento UTC de la API", () => {
    expect(inicioDe("2026-11-13", "10:30")).toBe("2026-11-13T15:30:00.000Z");
  });
});

describe("borrador de datos", () => {
  it("se conserva al recargar y se borra al confirmar", () => {
    expect(leerBorrador()).toEqual({ nombre: "", celular: "", acepta: false });
    guardarBorrador({ nombre: "María Gómez", celular: "300 123 4567", acepta: true });
    expect(leerBorrador()).toEqual({ nombre: "María Gómez", celular: "300 123 4567", acepta: true });
    borrarBorrador();
    expect(leerBorrador().nombre).toBe("");
  });

  it("no rompe si el almacenamiento no está disponible", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(() => guardarBorrador({ nombre: "A", celular: "", acepta: false })).not.toThrow();
    expect(leerBorrador().nombre).toBe("");
    expect(() => borrarBorrador()).not.toThrow();
  });
});
