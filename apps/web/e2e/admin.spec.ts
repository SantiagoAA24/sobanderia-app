import { expect, test } from "@playwright/test";

import {
  CORREO_ADMIN,
  crearCitaPorApi,
  diaHabil,
  elemento,
  horasLibres,
  ingresarPorApi,
  ingresarPorPantalla,
  nuevaApi,
} from "./ayudas";

/** Recorrido 4: el administrador crea un sobandero, este entra por primera vez y luego lo da de baja. */
test("el administrador crea un sobandero y lo da de baja", async ({ page, browser }) => {
  const sufijo = Date.now();
  const correo = `nuevo${sufijo}@sobanderia.test`;
  const temporal = `temporal-${sufijo}`;
  const definitiva = `definitiva-${sufijo}`;

  // El administrador crea al sobandero con una clave temporal
  await ingresarPorPantalla(page, CORREO_ADMIN);
  await expect(page).toHaveURL(/\/admin\/hoy/);
  await page.getByRole("link", { name: "Sobanderos" }).or(page.getByRole("button", { name: "Sobanderos" })).first().click();
  await page.getByRole("button", { name: "Agregar sobandero" }).click();
  await expect(page.getByRole("heading", { name: "Nuevo sobandero" })).toBeVisible();
  await page.getByLabel("Nombre completo").fill(`Sobandero Nuevo ${sufijo}`);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Clave temporal").fill(temporal);
  await page.getByRole("button", { name: /Guardar|Crear|Agregar/ }).last().click();
  await expect(page.getByText("Sobandero creado")).toBeVisible();

  // Un sobandero nuevo entra por primera vez: debe cambiar la clave temporal
  const suContexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: "http://localhost:4175" });
  const suPagina = await suContexto.newPage();
  await ingresarPorPantalla(suPagina, correo, temporal);
  await expect(suPagina).toHaveURL(/\/primera-clave/);
  await expect(suPagina.getByRole("heading", { name: "Cree su clave nueva" })).toBeVisible();
  // La clave temporal con la que entró queda en memoria: la pantalla no la vuelve a pedir
  await expect(suPagina.getByLabel("Clave temporal")).toHaveCount(0);
  await suPagina.getByLabel("Clave nueva").fill(definitiva);
  await suPagina.getByRole("button", { name: /Guardar|Continuar|Crear/ }).click();
  await expect(suPagina).toHaveURL(/\/panel\/hoy/);

  // No puede abrir el área del administrador
  await suPagina.goto("/admin/hoy");
  await expect(suPagina.getByRole("heading", { name: "No encontramos esa página" })).toBeVisible();
  await expect(suPagina.getByRole("heading", { name: "Resumen del día" })).toHaveCount(0);

  // El administrador le da horario y un cliente agenda con él (por API, para tener citas próximas)
  const admin = await nuevaApi();
  await ingresarPorApi(admin, CORREO_ADMIN);
  const lista = (await (await admin.get("/admin/sobanderos")).json()) as { id: number; nombre: string }[];
  const suId = lista.find((s) => s.nombre === `Sobandero Nuevo ${sufijo}`)!.id;
  const dias = [0, 1, 2, 3, 4].map((d) => ({ dia_semana: d, franjas: [{ desde: "08:00", hasta: "12:00" }] }));
  const h = await admin.put(`/admin/sobanderos/${suId}/horario`, { data: { dias } });
  expect(h.ok(), await h.text()).toBeTruthy();
  const publica = await nuevaApi();
  const dia = diaHabil(3).fecha;
  const libres = await horasLibres(publica, suId, dia);
  await crearCitaPorApi(publica, suId, elemento(libres, 0, "hora libre"), "Cliente Del Nuevo Uno");
  await crearCitaPorApi(publica, suId, elemento(libres, 1, "hora libre"), "Cliente Del Nuevo Dos");

  // Dar de baja: cancelar las citas próximas y avisar
  await page.goto(`/admin/sobanderos/${suId}`);
  await page.getByRole("button", { name: /Dar de baja a/ }).click();
  await expect(page.getByRole("heading", { name: /¿Dar de baja a/ })).toBeVisible();
  await expect(page.getByText("Tiene 2 citas próximas")).toBeVisible();
  await page.getByRole("button", { name: /Cancelarlas y avisar/ }).click();
  await expect(page.getByText("Se cancelarán 2 citas y sus clientes recibirán un WhatsApp.")).toBeVisible();
  await page.getByRole("button", { name: "Sí, dar de baja" }).click();
  await expect(page).toHaveURL(/\/admin\/sobanderos/);

  // Efectos: sesión cerrada al instante, no ingresa y ya no se ofrece a los clientes
  await suPagina.goto("/panel/hoy");
  await expect(suPagina).toHaveURL(/\/ingreso|\/sesion-vencida/);
  const ingreso = await publica.post("/auth/ingreso", { data: { correo, clave: definitiva } });
  expect(ingreso.status()).toBe(401);
  const ofrecidos = (await (await publica.get("/publico/sobanderos")).json()) as { id: number }[];
  expect(ofrecidos.map((s) => s.id)).not.toContain(suId);

  // El historial se conserva: la ficha sigue existiendo y dice que está dado de baja
  await page.goto(`/admin/sobanderos/${suId}`);
  await expect(page.getByText("Está dado de baja")).toBeVisible();

  await suContexto.close();
  await admin.dispose();
  await publica.dispose();
});
