import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test as base, expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const URL_API = "http://localhost:8101";
export const CLAVE = process.env.E2E_CLAVE ?? "clave-e2e-1234";
export const CORREO_ADMIN = "admin@sobanderia.test";
const RAIZ_API = resolve(import.meta.dirname, "../../api");
const ARCHIVO_CORREO = resolve(import.meta.dirname, ".registro/correo.log");

/** Un contexto HTTP hacia la API, con la cabecera que exigen las rutas que cambian datos. */
export async function nuevaApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: URL_API, extraHTTPHeaders: { "X-Sobanderia": "1" } });
}

export async function ingresarPorApi(api: APIRequestContext, correo: string, clave = CLAVE): Promise<void> {
  const r = await api.post("/auth/ingreso", { data: { correo, clave } });
  expect(r.ok(), `ingreso de ${correo}`).toBeTruthy();
}

/** «AAAA-MM-DD» de hoy más `dias`, en hora de Bogotá, y su día de la semana (0 = domingo). */
export function diaBogota(dias = 0): { fecha: string; semana: number } {
  const t = new Date(Date.now() + dias * 86_400_000);
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(t);
  const semana = new Date(`${fecha}T12:00:00-05:00`).getUTCDay();
  return { fecha, semana };
}

/** Primer día de lunes a viernes que esté al menos `desde` días adelante (y dentro de los 14 que se ofrecen). */
export function proximoDiaHabil(desde = 3): string {
  return diaHabil(desde).fecha;
}

/** Igual, pero con su posición en la lista de 14 días de la pantalla «Elija el día». */
export function diaHabil(desde = 3): { fecha: string; indice: number } {
  for (let i = desde; i < 14; i++) {
    const { fecha, semana } = diaBogota(i);
    if (semana >= 1 && semana <= 5) return { fecha, indice: i };
  }
  throw new Error("No hay día hábil en la ventana");
}

export async function sobanderosPublicos(api: APIRequestContext): Promise<{ id: number; nombre: string }[]> {
  const r = await api.get("/publico/sobanderos");
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as { id: number; nombre: string }[];
}

export async function horasLibres(api: APIRequestContext, sobanderoId: number, dia: string): Promise<string[]> {
  const r = await api.get(`/publico/sobanderos/${sobanderoId}/horas`, { params: { dia } });
  expect(r.ok()).toBeTruthy();
  return ((await r.json()) as { horas: string[] }).horas;
}

/** Celular colombiano de 10 dígitos, distinto en cada llamada. */
export function celularNuevo(): string {
  return `320${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
}

export async function crearCitaPorApi(
  api: APIRequestContext,
  sobanderoId: number,
  inicio: string,
  nombre = "Cliente de prueba",
): Promise<{ token: string }> {
  const r = await api.post("/publico/citas", {
    data: { sobandero_id: sobanderoId, inicio, nombre, celular: `+57${celularNuevo()}`, consentimiento: true },
  });
  expect(r.status(), await r.text()).toBe(201);
  return { token: ((await r.json()) as { token: string }).token };
}

/** El cliente no ve el id de su cita; el sobandero la encuentra en su lista del día por el nombre. */
export async function idDeCita(apiSobandero: APIRequestContext, dia: string, nombre: string): Promise<number> {
  const r = await apiSobandero.get("/yo/citas", { params: { dia } });
  expect(r.ok()).toBeTruthy();
  const cita = ((await r.json()) as { id: number; estado: string; cliente: { nombre: string } }[]).find(
    (c) => c.cliente.nombre === nombre && c.estado === "agendada",
  );
  expect(cita, `cita de ${nombre} el ${dia}`).toBeTruthy();
  return cita!.id;
}

/** Citas de hoy (madrugada, ya pasadas casi siempre) para marcar atendida / no asistió. */
export function citasDeHoy(numeroSobandero: number, cuantas: number): number[] {
  const salida = execFileSync("python", ["-m", "herramientas.e2e_citas_hoy", String(numeroSobandero), String(cuantas)], {
    cwd: RAIZ_API,
    env: { ...process.env, ENTORNO: "pruebas", DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql+psycopg://sobanderia:sobanderia@localhost:5432/sobanderia_e2e" },
    encoding: "utf8",
  });
  return (JSON.parse(salida.trim().split("\n").pop()!) as { ids: number[] }).ids;
}

export async function ingresarPorPantalla(page: Page, correo: string, clave = CLAVE): Promise<void> {
  await page.goto("/ingreso");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Clave").fill(clave);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Tamaño actual del registro de correo: llamar antes de pedir el correo y pasarlo a `esperarCorreo`. */
export function marcaDeCorreo(): number {
  return existsSync(ARCHIVO_CORREO) ? readFileSync(ARCHIVO_CORREO, "utf8").length : 0;
}

/** Espera el correo (falso) que salió después de `desde` y devuelve la primera URL del cuerpo. */
export async function esperarEnlaceDeCorreo(desde: number, asunto: RegExp): Promise<string> {
  let encontrado: string | undefined;
  await expect
    .poll(
      () => {
        const nuevo = existsSync(ARCHIVO_CORREO) ? readFileSync(ARCHIVO_CORREO, "utf8").slice(desde) : "";
        encontrado = nuevo.split("\n").find((l) => asunto.test(l) && /https?:\/\/\S+/.test(l));
        return encontrado !== undefined;
      },
      { message: "el correo de recuperación no llegó al registro", timeout: 10_000 },
    )
    .toBe(true);
  return /https?:\/\/\S+/.exec(encontrado!)![0];
}

/** Busca la cita agendada de un cliente en los próximos 14 días (el sobandero la ve por nombre). */
export async function buscarCitaAgendada(
  apiSobandero: APIRequestContext,
  nombre: string,
): Promise<{ id: number; inicio: string } | undefined> {
  for (let i = 0; i < 14; i++) {
    const r = await apiSobandero.get("/yo/citas", { params: { dia: diaBogota(i).fecha } });
    const lista = (await r.json()) as { id: number; inicio: string; estado: string; cliente: { nombre: string } }[];
    const cita = lista.find((c) => c.cliente.nombre === nombre && c.estado === "agendada");
    if (cita) return cita;
  }
  return undefined;
}

/** Elemento `i` de una lista, o un error claro si no existe (en vez de `undefined` silencioso). */
export function elemento<T>(lista: readonly T[], i: number, que = "elemento"): T {
  const valor = lista[i];
  if (valor === undefined) throw new Error(`Falta el ${que} ${i} (la lista tiene ${lista.length})`);
  return valor;
}

/**
 * `test` con una vigilancia automática: si el navegador bloquea algo por la política de seguridad de
 * contenido (CSP) en cualquier página de la prueba, la prueba falla. `vigilar(pagina)` añade las
 * páginas que se abren en otros contextos.
 */
export const test = base.extend<{ vigilar: (pagina: Page) => void }>({
  vigilar: [
    async ({ page }, usar) => {
      const violaciones: string[] = [];
      const vigilar = (pagina: Page) => {
        pagina.on("console", (m) => {
          if (/Content Security Policy|violates the following/i.test(m.text())) violaciones.push(m.text());
        });
      };
      vigilar(page);
      await usar(vigilar);
      expect(violaciones, "El navegador bloqueó algo por la CSP").toEqual([]);
    },
    { auto: true },
  ],
});
