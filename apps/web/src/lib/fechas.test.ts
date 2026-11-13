import { describe, expect, it } from "vitest";

import {
  cuentaRegresiva,
  diaBogota,
  duracionCorta,
  etiquetaDia,
  fechaLarga,
  horaParaMostrar,
  iniciaEnBogota,
  rangoDiaUTC,
  saludo,
} from "./fechas";

describe("horaParaMostrar (UTC -> Bogotá, 12 horas)", () => {
  it.each([
    ["2026-11-13T15:30:00Z", "10:30", "a. m."],
    ["2026-11-13T17:00:00Z", "12:00", "p. m."],
    ["2026-11-13T05:00:00Z", "12:00", "a. m."],
    ["2026-11-13T05:05:00Z", "12:05", "a. m."],
    ["2026-11-13T23:45:00Z", "6:45", "p. m."],
    ["2026-11-13T04:59:00Z", "11:59", "p. m."],
  ])("%s -> %s %s", (iso, hora, meridiem) => {
    expect(horaParaMostrar(iso)).toEqual({ hora, meridiem });
  });
});

describe("diaBogota", () => {
  it("una hora de la noche en UTC cae aún en el día anterior de Bogotá", () => {
    expect(diaBogota("2026-11-14T03:00:00Z")).toBe("2026-11-13");
  });
  it("cambia de día a las 5:00 UTC", () => {
    expect(diaBogota("2026-11-14T05:00:00Z")).toBe("2026-11-14");
  });
});

describe("fechaLarga y etiquetaDia", () => {
  it("«Viernes 13 de noviembre»", () => {
    expect(fechaLarga("2026-11-13T15:30:00Z")).toBe("Viernes 13 de noviembre");
  });
  it("usa el día de Bogotá y no el de UTC", () => {
    expect(fechaLarga("2026-11-14T03:00:00Z")).toBe("Viernes 13 de noviembre");
  });
  it("acepta un día «AAAA-MM-DD»", () => {
    expect(fechaLarga("2026-01-01")).toBe("Jueves 1 de enero");
  });
  it("etiquetaDia da «Jueves 12»", () => {
    expect(etiquetaDia("2026-11-12")).toBe("Jueves 12");
  });
});

describe("rangoDiaUTC e iniciaEnBogota", () => {
  it("el día de Bogotá va de 05:00Z a 05:00Z del día siguiente", () => {
    expect(rangoDiaUTC("2026-11-13")).toEqual({ desde: "2026-11-13T05:00:00.000Z", hasta: "2026-11-14T05:00:00.000Z" });
  });
  it("fin de mes y de año", () => {
    expect(rangoDiaUTC("2026-12-31").hasta).toBe("2027-01-01T05:00:00.000Z");
  });
  it("convierte día y hora de Bogotá a UTC", () => {
    expect(iniciaEnBogota("2026-11-13", "10:30")).toBe("2026-11-13T15:30:00.000Z");
    expect(iniciaEnBogota("2026-11-13", "19:00")).toBe("2026-11-14T00:00:00.000Z");
  });
  it("es la inversa de horaParaMostrar y diaBogota", () => {
    const iso = iniciaEnBogota("2026-11-13", "19:00");
    expect(diaBogota(iso)).toBe("2026-11-13");
    expect(horaParaMostrar(iso)).toEqual({ hora: "7:00", meridiem: "p. m." });
  });
});

describe("duracionCorta, saludo y cuentaRegresiva", () => {
  it("duracionCorta", () => {
    expect(duracionCorta(30)).toBe("30 min");
    expect(duracionCorta(60)).toBe("60 min");
  });
  it.each([
    ["2026-11-13T12:00:00Z", "Buenos días"], // 7:00 a. m.
    ["2026-11-13T17:00:00Z", "Buenas tardes"], // 12:00 p. m.
    ["2026-11-14T01:00:00Z", "Buenas noches"], // 8:00 p. m.
  ])("saludo a las %s", (iso, esperado) => {
    expect(saludo(iso)).toBe(esperado);
  });
  it.each([
    ["2026-11-13T15:30:00Z", "2026-11-13T15:20:00Z", "En 10 min"],
    ["2026-11-13T16:35:00Z", "2026-11-13T15:30:00Z", "En 1 h 5 min"],
    ["2026-11-13T16:30:00Z", "2026-11-13T15:30:00Z", "En 1 h"],
    ["2026-11-13T15:30:00Z", "2026-11-13T15:30:00Z", "Ahora"],
    ["2026-11-13T15:30:00Z", "2026-11-13T15:40:00Z", "Ahora"],
  ])("cuentaRegresiva(%s, %s) -> %s", (inicio, ahora, esperado) => {
    expect(cuentaRegresiva(inicio, ahora)).toBe(esperado);
  });
});
