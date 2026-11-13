import { describe, expect, it } from "vitest";

import { construirIcs } from "./calendario";

describe("construirIcs", () => {
  const ics = construirIcs({
    uid: "abc",
    inicio: "2026-11-13T15:30:00Z",
    fin: "2026-11-13T16:00:00Z",
    sobandero: "Carlos",
    lugar: "Calle 1, Medellín",
  });

  it("guarda las horas en UTC y el título con el sobandero", () => {
    expect(ics).toContain("DTSTART:20261113T153000Z");
    expect(ics).toContain("DTEND:20261113T160000Z");
    expect(ics).toContain("SUMMARY:Cita con Carlos");
  });

  it("escapa las comas del lugar y usa saltos de línea CRLF", () => {
    expect(ics).toContain("LOCATION:Calle 1\\, Medellín");
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });

  it("no incluye el celular ni el nombre del cliente", () => {
    expect(ics).not.toMatch(/\+57|3\d{9}/);
  });
});
