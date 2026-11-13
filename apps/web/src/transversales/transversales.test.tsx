import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { axe } from "../lib/axe";
import { Cargando } from "./Cargando";
import { EnlaceVencido } from "./EnlaceVencido";
import { NoEncontrada } from "./NoEncontrada";
import { SesionVencida } from "./SesionVencida";
import { SinConexion } from "./SinConexion";

const pintar = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Enlace vencido", () => {
  it("explica y ofrece pedir uno nuevo o ir al inicio", async () => {
    const { container } = pintar(<EnlaceVencido />);
    expect(screen.getByRole("heading", { level: 1, name: "Este enlace ya no sirve" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir enlace nuevo" })).toHaveAttribute("href", "/encontrar-cita");
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Sesión vencida", () => {
  it("dice que las citas siguen igual y lleva al ingreso", async () => {
    const { container } = pintar(<SesionVencida />);
    expect(screen.getByRole("heading", { level: 1, name: "Su sesión terminó" })).toBeInTheDocument();
    expect(screen.getByText(/sus citas siguen igual/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar de nuevo" })).toHaveAttribute("href", "/ingreso");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Página no encontrada", () => {
  it("lleva al inicio", async () => {
    const { container } = pintar(<NoEncontrada />);
    expect(screen.getByRole("heading", { level: 1, name: "No encontramos esa página" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Sin conexión y Cargando", () => {
  it("Sin conexión permite reintentar", async () => {
    const reintentar = vi.fn();
    const { container } = pintar(<SinConexion onRetry={reintentar} />);
    await userEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(reintentar).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Cargando muestra un texto visible junto a los bloques", async () => {
    const { container } = pintar(<Cargando texto="Buscando horas libres…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Buscando horas libres…");
    expect(await axe(container)).toHaveNoViolations();
  });
});
