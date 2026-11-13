import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./cliente";
import { crearClienteDeConsultas, debeReintentar } from "./consultas";
import { ErrorApi, ErrorRed, esErrorDeRed, esHoraOcupada } from "./errores";
import { CLAVES, pedirSesion } from "./sesion";

function responder(estado: number, cuerpo: unknown = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(estado === 204 ? null : JSON.stringify(cuerpo), { status: estado })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("cliente de la API", () => {
  it("envía la cabecera anti-CSRF y las cookies", async () => {
    responder(200, { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: false });
    await api.GET("/auth/yo");
    const peticion = vi.mocked(fetch).mock.calls[0]?.[0] as Request;
    expect(peticion.headers.get("X-Sobanderia")).toBe("1");
    expect(peticion.credentials).toBe("include");
    expect(new URL(peticion.url).pathname).toBe("/api/auth/yo");
  });

  it("convierte una respuesta con error en ErrorApi con su código", async () => {
    responder(409, { codigo: "hora_ocupada", mensaje: "Esa hora ya se ocupó.", alternativas: ["2026-11-13T15:30:00Z"] });
    const error = await api.GET("/auth/yo").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(esHoraOcupada(error)).toBe(true);
    expect((error as ErrorApi).extra.alternativas).toEqual(["2026-11-13T15:30:00Z"]);
  });

  it("convierte la falta de respuesta en ErrorRed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await api.GET("/auth/yo").catch((e: unknown) => e);
    expect(esErrorDeRed(error)).toBe(true);
  });

  it("tolera un cuerpo que no es JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    const error = (await api.GET("/auth/yo").catch((e: unknown) => e)) as ErrorApi;
    expect(error.estado).toBe(500);
    expect(error.codigo).toBe("desconocido");
  });
});

describe("pedirSesion", () => {
  it("devuelve el usuario", async () => {
    responder(200, { nombre: "Carlos", rol: "admin", debe_cambiar_clave: false });
    expect(await pedirSesion()).toEqual({ nombre: "Carlos", rol: "admin", debe_cambiar_clave: false });
  });
  it("sin sesión (401) devuelve null y no lanza", async () => {
    responder(401, { codigo: "no_autorizado", mensaje: "Debe ingresar para continuar." });
    expect(await pedirSesion()).toBeNull();
  });
  it("otros errores sí se propagan", async () => {
    responder(500, { codigo: "error", mensaje: "x" });
    await expect(pedirSesion()).rejects.toBeInstanceOf(ErrorApi);
  });
});

describe("manejo central de errores", () => {
  const nuevo = () => {
    const manejadores = { alVencerSesion: vi.fn(), alVencerEnlace: vi.fn() };
    return { ...manejadores, cliente: crearClienteDeConsultas(manejadores) };
  };
  const fallar = (cliente: ReturnType<typeof nuevo>["cliente"], error: Error) =>
    cliente.fetchQuery({ queryKey: ["x"], queryFn: () => Promise.reject(error), retry: false }).catch(() => undefined);

  it("401 con sesión activa: limpia la sesión y lleva a «Sesión vencida»", async () => {
    const { cliente, alVencerSesion } = nuevo();
    cliente.setQueryData(CLAVES.sesion, { nombre: "Carlos", rol: "sobandero", debe_cambiar_clave: false });
    await fallar(cliente, new ErrorApi(401, "no_autorizado", "Debe ingresar."));
    expect(alVencerSesion).toHaveBeenCalledTimes(1);
    expect(cliente.getQueryData(CLAVES.sesion)).toBeNull();
  });

  it("401 sin sesión previa (clave incorrecta) lo deja a la pantalla", async () => {
    const { cliente, alVencerSesion } = nuevo();
    await fallar(cliente, new ErrorApi(401, "no_autorizado", "Correo o clave incorrectos."));
    expect(alVencerSesion).not.toHaveBeenCalled();
  });

  it("410 enlace_vencido lleva a «Enlace vencido»", async () => {
    const { cliente, alVencerEnlace } = nuevo();
    await fallar(cliente, new ErrorApi(410, "enlace_vencido", "Este enlace ya no sirve."));
    expect(alVencerEnlace).toHaveBeenCalledTimes(1);
  });

  it("409 y errores de red no redirigen", async () => {
    const { cliente, alVencerSesion, alVencerEnlace } = nuevo();
    await fallar(cliente, new ErrorApi(409, "hora_ocupada", "Esa hora ya se ocupó."));
    await fallar(cliente, new ErrorRed());
    expect(alVencerSesion).not.toHaveBeenCalled();
    expect(alVencerEnlace).not.toHaveBeenCalled();
  });

  it("solo reintenta cuando no hubo respuesta, hasta dos veces", () => {
    expect(debeReintentar(0, new ErrorRed())).toBe(true);
    expect(debeReintentar(2, new ErrorRed())).toBe(false);
    expect(debeReintentar(0, new ErrorApi(404, "no_encontrado", "x"))).toBe(false);
  });
});
