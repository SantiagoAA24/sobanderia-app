import { expect } from "@playwright/test";

import { celularNuevo, elemento, horasLibres, nuevaApi, proximoDiaHabil, sobanderosPublicos, test } from "./ayudas";

/** Recorrido 2: dos clientes llegan a la misma hora; solo uno la consigue y el otro no pierde sus datos. */
test("dos clientes pelean la misma hora", async ({ browser, vigilar }) => {
  const api = await nuevaApi();
  const uno = elemento(await sobanderosPublicos(api), 0, "sobandero");
  const dia = proximoDiaHabil(4);
  const libres = await horasLibres(api, uno.id, dia);
  const pedida = elemento(libres, libres.length - 1, "hora libre"); // hora (UTC) que ambos quieren
  const hora24 = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(pedida));
  const url = `/agendar/${uno.id}/datos?dia=${dia}&hora=${hora24}`;

  const contexto = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-CO", baseURL: "http://localhost:4175" };
  const ana = await (await browser.newContext(contexto)).newPage();
  const beto = await (await browser.newContext(contexto)).newPage();
  vigilar(ana);
  vigilar(beto);

  async function llenar(pagina: typeof ana, nombre: string, celular: string) {
    await pagina.goto(url);
    await expect(pagina.getByRole("heading", { name: "Sus datos" })).toBeVisible();
    await pagina.getByLabel("Nombre completo").fill(nombre);
    await pagina.getByLabel("Número de celular").fill(celular);
    await pagina.getByRole("checkbox", { name: /Acepto el tratamiento/ }).check();
  }
  const celularBeto = celularNuevo();
  await llenar(ana, "Ana Primera", celularNuevo());
  await llenar(beto, "Beto Segundo", celularBeto);

  // Ana confirma primero y se queda con la hora
  await ana.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(ana.getByRole("heading", { name: "Su cita quedó agendada" })).toBeVisible();

  // Beto confirma después: la base le dice que no
  await beto.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(beto.getByRole("heading", { name: "Esa hora ya se ocupó" })).toBeVisible();
  await expect(beto.getByText("sus datos se conservan", { exact: false })).toBeVisible();

  // Escoge otra hora ofrecida y los datos siguen escritos
  await beto.getByRole("region", { name: /Otras horas libres/ }).getByRole("button").first().click();
  await expect(beto.getByRole("heading", { name: "Sus datos" })).toBeVisible();
  await expect(beto.getByLabel("Nombre completo")).toHaveValue("Beto Segundo");
  await expect(beto.getByLabel("Número de celular")).toHaveValue(celularBeto);
  await beto.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(beto.getByRole("heading", { name: "Su cita quedó agendada" })).toBeVisible();

  // La hora disputada ya no se ofrece
  expect(await horasLibres(api, uno.id, dia)).not.toContain(pedida);
  await api.dispose();
});
