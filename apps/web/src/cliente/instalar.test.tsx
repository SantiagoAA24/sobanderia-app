import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { axe } from "../lib/axe";
import { pintar, ruta } from "./pruebas";

describe("Instalar la app (/instalar)", () => {
  it("explica cómo instalarla en iPhone y en Android, cada uno en su lista de pasos", async () => {
    const { container } = pintar("/instalar");
    expect(screen.getByRole("heading", { level: 1, name: "Tenga la app a la mano" })).toBeInTheDocument();

    const iphone = screen.getByRole("list", { name: "Pasos en iPhone" });
    expect(within(iphone).getAllByRole("listitem")).toHaveLength(3);
    expect(within(iphone).getByText("Abra esta página en Safari")).toBeInTheDocument();
    expect(within(iphone).getByText("Elija «Agregar a inicio»")).toBeInTheDocument();

    const android = screen.getByRole("list", { name: "Pasos en Android" });
    expect(within(android).getAllByRole("listitem")).toHaveLength(3);
    expect(within(android).getByText("Abra esta página en Chrome")).toBeInTheDocument();
    expect(within(android).getByText("Toque el menú de los tres puntos")).toBeInTheDocument();
    expect(within(android).getByText("Elija «Instalar app»")).toBeInTheDocument();

    // Cada lista tiene su encabezado y el orden de lectura es iPhone, luego Android.
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(["En iPhone", "En Android"]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("tiene un solo botón principal y «Ahora no» como salida", async () => {
    const { router } = pintar("/instalar");
    expect(screen.getByRole("link", { name: "Listo" })).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("link", { name: "Ahora no" }));
    expect(ruta(router)).toBe("/");
  });

  it("no pide datos del negocio ni de la API: funciona sin conexión", () => {
    pintar("/instalar");
    expect(screen.queryByText(/Cargando|Sin conexión/)).not.toBeInTheDocument();
  });

  it("la ruta anterior /instalar-app redirige a /instalar", () => {
    const { router } = pintar("/instalar-app");
    expect(ruta(router)).toBe("/instalar");
    expect(screen.getByRole("heading", { level: 1, name: "Tenga la app a la mano" })).toBeInTheDocument();
  });
});
