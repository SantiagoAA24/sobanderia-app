import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("abre en el inicio del cliente, sin pedir sesión", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Inicio" })).toBeInTheDocument();
  });
});
