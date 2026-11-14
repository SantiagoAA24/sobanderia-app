import { expect } from "@playwright/test";

import { celularNuevo, elemento, diaHabil, horasLibres, nuevaApi, sobanderosPublicos, test } from "./ayudas";

/** Recorrido 1: una persona sin cuenta agenda, cambia la hora y cancela, todo desde el celular. */
test("el cliente agenda, reagenda y cancela su cita", async ({ page }) => {
  const api = await nuevaApi();
  const dos = elemento(await sobanderosPublicos(api), 1, "sobandero");
  const { fecha: dia, indice } = diaHabil(3);
  const elegirDia = () => page.getByRole("list", { name: "Días" }).getByRole("listitem").nth(indice).getByRole("button").click();
  const libres = await horasLibres(api, dos.id, dia);
  expect(libres.length).toBeGreaterThan(2);

  // Agendar: sobandero -> día -> hora -> datos
  await page.goto("/agendar");
  await page.getByRole("button", { name: new RegExp(dos.nombre) }).last().click();
  await expect(page.getByRole("heading", { name: "Elija el día" })).toBeVisible();
  await elegirDia();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elija la hora" })).toBeVisible();
  await page.getByRole("region", { name: "Mañana" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Sus datos" })).toBeVisible();
  await page.getByLabel("Nombre completo").fill("Rosa Elena Prueba");
  await page.getByLabel("Número de celular").fill(celularNuevo());
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.getByText("necesitamos que lo acepte")).toBeVisible();
  await page.getByRole("checkbox", { name: /Acepto el tratamiento/ }).check();
  await page.getByRole("button", { name: "Confirmar cita" }).click();

  // Confirmada: el enlace de la cita queda en la URL
  await expect(page.getByRole("heading", { name: "Su cita quedó agendada" })).toBeVisible();
  const urlConfirmada = page.url();
  expect(urlConfirmada).toMatch(/\/agendar\/listo\/[\w-]{20,}/);
  const token = urlConfirmada.split("/").pop()!;
  await expect(page.getByText("Con Sobandero Dos", { exact: false })).toBeVisible();

  // Recargar no pierde la cita
  await page.reload();
  await expect(page.getByRole("heading", { name: "Su cita quedó agendada" })).toBeVisible();

  // Reagendar a otra hora del mismo día
  await page.getByRole("button", { name: "Cambiar o cancelar la cita" }).click();
  await expect(page.getByRole("heading", { name: "Su cita" })).toBeVisible();
  const antes = await page.getByRole("main").innerText();
  await page.getByRole("button", { name: "Cambiar día u hora" }).click();
  await expect(page.getByRole("heading", { name: "Elija el día" })).toBeVisible();
  await elegirDia();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Elija la hora" })).toBeVisible();
  await page.getByRole("region", { name: "Mañana" }).getByRole("button").last().click();
  await page.getByRole("button", { name: "Cambiar mi cita" }).click();
  await expect(page.getByRole("heading", { name: "Su cita" })).toBeVisible();
  expect(await page.getByRole("main").innerText()).not.toBe(antes);

  // Cancelar: primero «No, conservar», luego «Sí, cancelar»
  await page.getByRole("button", { name: "Cancelar mi cita" }).click();
  await expect(page.getByRole("heading", { name: "¿Quiere cancelar su cita?" })).toBeVisible();
  await page.getByRole("button", { name: "No, conservar mi cita" }).click();
  await expect(page.getByRole("heading", { name: "Su cita" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar mi cita" }).click();
  await page.getByRole("button", { name: "Sí, cancelar mi cita" }).click();
  await expect(page.getByRole("heading", { name: "Su cita fue cancelada" })).toBeVisible();

  // El enlace sigue mostrando que está cancelada y la hora vuelve a quedar libre
  await page.goto(`/mi-cita/${token}`);
  await expect(page.getByRole("heading", { name: "Su cita fue cancelada" })).toBeVisible();
  expect((await horasLibres(api, dos.id, dia)).length).toBe(libres.length);
  await api.dispose();
});
