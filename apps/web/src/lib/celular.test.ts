import { describe, expect, it } from "vitest";

import { enmascarar, formatearCelular, normalizarCelular } from "./celular";

describe("normalizarCelular (igual que la API)", () => {
  it.each([
    ["300 123 4567", "+573001234567"],
    ["3001234567", "+573001234567"],
    ["+57 300 123 4567", "+573001234567"],
    ["573001234567", "+573001234567"],
    ["(300) 123-4567", "+573001234567"],
    ["+1 415 555 0132", "+14155550132"],
  ])("%s -> %s", (entrada, esperado) => {
    expect(normalizarCelular(entrada)).toBe(esperado);
  });

  it.each(["", "300 123", "2001234567", "30012345678", "abc", "+0123456789"])("rechaza «%s»", (entrada) => {
    expect(normalizarCelular(entrada)).toBeNull();
  });
});

describe("formatearCelular", () => {
  it("da «300 123 4567» para un celular colombiano", () => {
    expect(formatearCelular("+573001234567")).toBe("300 123 4567");
  });
  it("deja otros países como llegan", () => {
    expect(formatearCelular("+14155550132")).toBe("+14155550132");
  });
});

describe("enmascarar", () => {
  it("oculta el centro: «300 *** 4567»", () => {
    expect(enmascarar("+573001234567")).toBe("300 *** 4567");
  });
  it("otros países solo muestran los últimos 4", () => {
    expect(enmascarar("+14155550132")).toBe("*** 0132");
  });
});
