import { expect } from "@playwright/test";

import { CLAVE, CORREO_ADMIN, esperarEnlaceDeCorreo, ingresarPorApi, marcaDeCorreo, nuevaApi, test } from "./ayudas";

/** Recorrido 5: quien olvidó su clave la recupera con un enlace de un solo uso. */
test("recuperación de clave con enlace de un solo uso", async ({ page }) => {
  // Cuenta propia de esta prueba, ya activada, para no cambiar la clave de las demás
  const sufijo = Date.now();
  const correo = `recupera${sufijo}@sobanderia.test`;
  const original = `original-${sufijo}`;
  const nueva = `nueva-clave-${sufijo}`;
  const admin = await nuevaApi();
  await ingresarPorApi(admin, CORREO_ADMIN, CLAVE);
  const creado = await admin.post("/admin/sobanderos", {
    data: { nombre: `Recupera ${sufijo}`, correo, clave_temporal: original },
  });
  expect(creado.status(), await creado.text()).toBe(201);
  const otraSesion = await nuevaApi(); // una sesión abierta que debe cerrarse al cambiar la clave
  await ingresarPorApi(otraSesion, correo, original);
  const cambio = await otraSesion.post("/auth/cambiar-clave", { data: { clave_actual: original, clave_nueva: `activa-${sufijo}` } });
  expect(cambio.ok()).toBeTruthy();
  const claveActiva = `activa-${sufijo}`;
  expect((await otraSesion.get("/auth/yo")).ok()).toBeTruthy();

  // Pide el enlace desde la pantalla
  const desde = marcaDeCorreo();
  await page.goto("/ingreso");
  await page.getByRole("link", { name: "¿Olvidó su clave?" }).click();
  await expect(page.getByRole("heading", { name: "Recupere su clave" })).toBeVisible();
  await page.getByLabel("Correo").fill(correo);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revise su correo" })).toBeVisible();
  const enlace = await esperarEnlaceDeCorreo(desde, /Recupere su clave/);

  // Con un correo que no existe, la pantalla responde igual
  await page.goto("/olvide-clave");
  await page.getByLabel("Correo").fill(`no-existe${sufijo}@sobanderia.test`);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revise su correo" })).toBeVisible();

  // El enlace permite crear la clave nueva
  await page.goto(new URL(enlace).pathname);
  await expect(page.getByRole("heading", { name: "Cree su clave nueva" })).toBeVisible();
  await page.getByLabel("Clave nueva").fill("corta");
  await page.getByRole("button", { name: "Guardar clave" }).click();
  await expect(page.getByText("Escriba al menos 8 caracteres.")).toBeVisible();
  await page.getByLabel("Clave nueva").fill(nueva);
  await page.getByRole("button", { name: "Guardar clave" }).click();
  await expect(page).toHaveURL(/\/ingreso/);
  await expect(page.getByText("Su clave cambió. Ingrese con la clave nueva.")).toBeVisible();

  // Sirve una sola vez
  await page.goto(new URL(enlace).pathname);
  await page.getByLabel("Clave nueva").fill(`otra-${sufijo}`);
  await page.getByRole("button", { name: "Guardar clave" }).click();
  await expect(page.getByRole("heading", { name: "Este enlace ya no sirve" })).toBeVisible();

  // La sesión abierta se cerró, la clave vieja no entra y la nueva sí
  expect((await otraSesion.get("/auth/yo")).status()).toBe(401);
  const vieja = await (await nuevaApi()).post("/auth/ingreso", { data: { correo, clave: claveActiva } });
  expect(vieja.status()).toBe(401);
  await page.goto("/ingreso");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Clave").fill(nueva);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel\/hoy/);

  await admin.dispose();
  await otraSesion.dispose();
});
