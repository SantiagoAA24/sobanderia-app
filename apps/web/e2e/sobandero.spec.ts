import { expect } from "@playwright/test";

import {
  buscarCitaAgendada,
  citasDeHoy,
  crearCitaPorApi,
  diaHabil,
  elemento,
  horasLibres,
  idDeCita,
  ingresarPorApi,
  ingresarPorPantalla,
  nuevaApi,
  sobanderosPublicos,
  test,
} from "./ayudas";

const CORREO = "sobandero1@sobanderia.test";

/** Recorrido 3: un sobandero opera su día desde el celular. */
test("el sobandero atiende, marca inasistencia, cambia, cancela, agenda y bloquea", async ({ page }) => {
  const publica = await nuevaApi();
  const uno = elemento(await sobanderosPublicos(publica), 0, "sobandero");
  expect(uno.nombre).toBe("Sobandero Uno");

  // Datos de partida: dos citas de hoy y dos de un día futuro
  const delDia = citasDeHoy(1, 2);
  const atender = elemento(delDia, 0, "cita de hoy");
  const faltar = elemento(delDia, 1, "cita de hoy");
  const { fecha: dia } = diaHabil(6);
  const libres = await horasLibres(publica, uno.id, dia);
  const nombreCambiar = `Cliente Para Cambiar ${Date.now()}`;
  const nombreCancelar = `Cliente Para Cancelar ${Date.now()}`;
  await crearCitaPorApi(publica, uno.id, elemento(libres, 0, "hora libre"), nombreCambiar);
  await crearCitaPorApi(publica, uno.id, elemento(libres, 1, "hora libre"), nombreCancelar);

  // Una sesión de API aparte, solo para comprobar el estado real en el servidor
  const api = await nuevaApi();
  await ingresarPorApi(api, CORREO);
  const cambiar = { id: await idDeCita(api, dia, nombreCambiar) };
  const cancelar = { id: await idDeCita(api, dia, nombreCancelar) };
  const estado = async (id: number) => ((await (await api.get(`/yo/citas/${id}`)).json()) as { estado: string }).estado;

  await ingresarPorPantalla(page, CORREO);
  await expect(page).toHaveURL(/\/panel\/hoy/);

  // Marcar como atendida
  await page.getByRole("link", { name: new RegExp(`Ver la cita de Cliente Hoy ${atender}`) }).click();
  await expect(page.getByRole("heading", { name: `Cita de Cliente Hoy ${atender}` })).toBeVisible();
  await page.getByRole("button", { name: "Marcar como atendida" }).click();
  await expect(page).toHaveURL(/\/panel\/hoy/);
  expect(await estado(atender)).toBe("atendida");

  // No asistió: pide confirmar
  await page.getByRole("link", { name: new RegExp(`Ver la cita de Cliente Hoy ${faltar}`) }).click();
  await page.getByRole("link", { name: "No asistió" }).click();
  await expect(page.getByRole("heading", { name: "¿Marcar que no asistió?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, no asistió" }).click();
  await expect(page).toHaveURL(/\/panel\/hoy/);
  expect(await estado(faltar)).toBe("no_asistio");

  // Cambiar la hora de una cita futura, avisando por WhatsApp
  await page.goto(`/panel/citas/${cambiar.id}`);
  await page.getByRole("link", { name: "Cambiar la hora" }).click();
  await expect(page.getByRole("heading", { name: "Cambiar la hora" })).toBeVisible();
  await page.getByRole("region", { name: "Día" }).getByRole("button").first().click();
  await page.getByRole("region", { name: "Hora" }).getByRole("button").last().click();
  await expect(page.getByRole("checkbox", { name: "Avisarle por WhatsApp" })).toBeChecked();
  const antes = (await (await api.get(`/yo/citas/${cambiar.id}`)).json()) as { inicio: string };
  await page.getByRole("button", { name: "Guardar cambio" }).click();
  await expect(page).toHaveURL(/\/panel\/hoy/);
  // Cambiar la hora crea la cita nueva y cancela la vieja, en una sola operación
  expect(await estado(cambiar.id)).toBe("cancelada");
  const nueva = await buscarCitaAgendada(api, nombreCambiar);
  expect(nueva, "la cita nueva existe").toBeTruthy();
  expect(nueva!.inicio).not.toBe(antes.inicio);
  cambiar.id = nueva!.id;

  // Cancelar con aviso
  await page.goto(`/panel/citas/${cancelar.id}`);
  await page.getByRole("link", { name: "Cancelar la cita" }).click();
  await expect(page.getByRole("heading", { name: `¿Cancelar la cita de ${nombreCancelar}?` })).toBeVisible();
  await page.getByRole("button", { name: "Sí, cancelar la cita" }).click();
  await expect(page.getByRole("heading", { name: "Cita cancelada" })).toBeVisible();
  await expect(page.getByText(`Le avisamos a ${nombreCancelar} por WhatsApp.`)).toBeVisible();
  expect(await estado(cancelar.id)).toBe("cancelada");

  // Nueva cita manual
  await page.getByRole("link", { name: "Volver a Hoy" }).click();
  await page.getByRole("link", { name: "Nueva cita" }).or(page.getByRole("button", { name: "Nueva cita" })).first().click();
  await expect(page.getByRole("heading", { name: "Nueva cita" })).toBeVisible();
  await page.getByLabel("Nombre completo").fill("Cliente Manual");
  await page.getByLabel("Número de celular").fill("3205550101");
  await page.getByRole("region", { name: "Día" }).getByRole("button").first().click();
  await page.getByRole("region", { name: "Hora" }).getByRole("button").first().click();
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(/\/panel\/hoy|\/panel\/citas\//);

  // Bloquear horas: las citas ya agendadas no se cancelan
  await page.goto("/panel/bloquear");
  await expect(page.getByRole("heading", { name: "Bloquear horas" })).toBeVisible();
  const dias = page.getByRole("region", { name: "Día" }).getByRole("button");
  for (let i = 0; i < (await dias.count()); i++) {
    await dias.nth(i).click();
    if (await page.getByRole("region", { name: "Desde" }).isVisible()) break;
  }
  await page.getByRole("region", { name: "Desde" }).getByRole("button").first().click();
  await page.getByRole("region", { name: "Hasta" }).getByRole("button").last().click();
  await page.getByLabel("Motivo (opcional)").fill("Una diligencia");
  await page.getByRole("button", { name: "Bloquear horas" }).click();
  await expect(page.getByText("Bloqueó esas horas")).toBeVisible();
  const bloqueos = (await (await api.get("/yo/bloqueos")).json()) as { id: number }[];
  expect(bloqueos.length).toBeGreaterThan(0);
  expect(await estado(cambiar.id)).toBe("agendada");
  for (const b of bloqueos) await api.delete(`/yo/bloqueos/${b.id}`); // deja la base limpia para la siguiente corrida

  // Cerrar sesión
  await page.goto("/panel/perfil");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/ingreso/);
  await page.goto("/panel/hoy");
  await expect(page).toHaveURL(/\/ingreso|\/sesion-vencida/);
  await api.dispose();
  await publica.dispose();
});
