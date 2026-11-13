import { QueryClientProvider, onlineManager, useMutation, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Cargable } from "../cliente/Disposicion";
import { api, datos } from "./cliente";
import { crearClienteDeConsultas } from "./consultas";

/**
 * Sin red el navegador marca `navigator.onLine = false`. Con la configuración por defecto de TanStack Query
 * las consultas se PAUSAN (la pantalla quedaría en «Cargando» para siempre) y las escrituras se ENCOLAN y se
 * envían al volver la red. La app necesita lo contrario: intentar, fallar y mostrar «Sin conexión».
 */
function Pantalla() {
  const consulta = useQuery({ queryKey: ["negocio"], queryFn: async () => datos(await api.GET("/publico/negocio")) });
  return <Cargable consulta={consulta}>{(n) => <p>Hola desde {n.nombre}</p>}</Cargable>;
}

function pintar(ui: React.ReactElement) {
  const cliente = crearClienteDeConsultas({ alVencerSesion: vi.fn(), alVencerEnlace: vi.fn() });
  cliente.setDefaultOptions({
    ...cliente.getDefaultOptions(),
    queries: { ...cliente.getDefaultOptions().queries, retry: false },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={cliente}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
  return cliente;
}

beforeEach(() => onlineManager.setOnline(false));
afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe("sin conexión", () => {
  it("muestra «Sin conexión» en vez de quedarse cargando, y reintentar funciona al volver la red", async () => {
    const fetchSimulado = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchSimulado);
    pintar(<Pantalla />);

    expect(await screen.findByRole("heading", { level: 1, name: "Sin conexión" })).toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalled();

    onlineManager.setOnline(true);
    fetchSimulado.mockImplementation(async () => new Response(JSON.stringify({ nombre: "Sobandería Doña Rosa" }), { status: 200 }));
    await userEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(await screen.findByText("Hola desde Sobandería Doña Rosa")).toBeInTheDocument();
  });

  it("una escritura sin red falla enseguida y no queda en cola para enviarse después", async () => {
    const fetchSimulado = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchSimulado);
    let estado = "";
    function Boton() {
      const m = useMutation({ mutationFn: async () => datos(await api.POST("/auth/salida")) });
      estado = m.status;
      return <button onClick={() => m.mutate()}>Enviar</button>;
    }
    pintar(<Boton />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(estado).toBe("error"));

    // Al volver la red no se envía nada por su cuenta.
    fetchSimulado.mockClear();
    onlineManager.setOnline(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});
