import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { axe } from "../lib/axe";
import { rutasApp } from "../rutas";

const COMPONENTES = [
  "Icon",
  "Button",
  "IconButton",
  "AppointmentRow",
  "NextAppointmentCard",
  "StatusNote",
  "ScreenHeader",
  "BottomNav",
  "StepHeader",
  "OptionRow",
  "TimeSlot",
  "TextField",
  "CheckboxField",
  "SummaryCard",
  "ConfirmationCard",
  "BackHeader",
  "DayChip",
  "EmptyState",
  "Switch",
  "PasswordField",
  "Skeleton",
];

async function abrirUi() {
  const router = createMemoryRouter(rutasApp, { initialEntries: ["/ui"] });
  const vista = render(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1, name: "Componentes" });
  return vista;
}

describe("/ui", () => {
  it("muestra los 21 componentes del sistema, cada uno en su sección", async () => {
    await abrirUi();
    expect(COMPONENTES).toHaveLength(21);
    for (const nombre of COMPONENTES) {
      const seccion = screen.getByRole("region", { name: nombre });
      expect(within(seccion).getByRole("heading", { level: 2, name: nombre })).toBeInTheDocument();
    }
  });

  it("muestra los estados clave: error, deshabilitado, elegido y vacío", async () => {
    await abrirUi();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole("button", { name: "Continuar" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: /Carlos/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "J 12, Jueves", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^10:30 a\. m\./, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sábado 14 de noviembre/ })).toBeDisabled();
  });

  it("no tiene violaciones de accesibilidad", async () => {
    const { container } = await abrirUi();
    expect(await axe(container)).toHaveNoViolations();
  });
});
