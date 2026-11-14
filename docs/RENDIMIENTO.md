# Sobandería — Rendimiento, accesibilidad e instalación (Fase 9)

Mediciones del 14 de noviembre de 2026. Metas de la fase, en móvil: PWA instalable, accesibilidad ≥ 95 y rendimiento ≥ 85.

## Resumen

| Meta | Resultado | Estado |
| --- | --- | --- |
| PWA instalable | Chrome no informa ningún error de instalabilidad; el service worker controla la página | Cumplida |
| Accesibilidad (Lighthouse) ≥ 95 | 100 en las 4 rutas medidas | Cumplida |
| Rendimiento (Lighthouse) ≥ 85 | 98 a 100 en las 4 rutas medidas | Cumplida |
| `axe` sin errores graves | 0 violaciones, graves o leves, en las 52 rutas, con contraste real | Cumplida |
| Sin conexión muestra la pantalla correcta | Verificado en Chromium (ver más abajo) | Cumplida |
| Instalación desde un celular real | Pendiente: necesita la app desplegada con HTTPS (Fase 11) | **Sin verificar** |

Lo que esta medición **no** demuestra: se hizo con Chrome de escritorio emulando un celular, contra `localhost` y con la API simulada. No es un celular de gama media real ni la red del local. Hay que repetir la medición con la app desplegada (ver «Pendientes»).

## Cómo se midió

- **Lighthouse 13.6, perfil móvil por defecto:** emulación de Moto G, red 4G lenta simulada y CPU 4 veces más lenta. Categorías: rendimiento, accesibilidad, buenas prácticas y SEO.
- **Tres corridas por ruta**; se informa la mediana, porque Lighthouse varía entre corridas.
- **Build de producción** servida con `vite preview`. La API se simula con datos generados desde `api/openapi.json` (`src/pruebas/contrato.ts`), así que las pantallas muestran contenido real.
- **Rutas:** `/`, `/instalar`, `/agendar` e `/ingreso`. Son las que un cliente o un sobandero ve sin sesión.
- **PWA:** Lighthouse 12 en adelante ya no puntúa la categoría PWA. La instalabilidad se comprueba con el propio Chrome (`Page.getInstallabilityErrors`), que es lo que decide si aparece «Instalar».

Para repetirla:

```bash
cd apps/web
npm run lighthouse                 # compila y mide; guarda lighthouse-resultados.json (no se sube a git)
npm run a11y:navegador             # axe completo con contraste en Chromium, más toques de 48 px
```

`DIST`, `RUTAS` y `CORRIDAS` ajustan qué se mide. Si el puerto está ocupado, el script se detiene en vez de medir otra build.

## Resultados de Lighthouse

«Antes» es el último commit anterior a la Fase 9 (sin manifiesto ni service worker). «Después» es esta rama.

### Puntajes (mediana de 3 corridas)

| Ruta | Rendimiento antes | Rendimiento después | Accesibilidad | Buenas prácticas antes → después | SEO antes → después |
| --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 → 100 | 96 → 100 | 82 → 91 |
| `/instalar` (antes `/instalar-app`) | 100 | 100 | 100 → 100 | 96 → 100 | 82 → 91 |
| `/agendar` | 98 | 99 | 100 → 100 | 96 → 100 | 82 → 91 |
| `/ingreso` | 100 | 100 | 100 → 100 | 96 → 96 | 82 → 91 |

### Métricas (mediana, en milisegundos)

| Ruta | FCP antes → después | LCP antes → después | TBT antes → después | CLS después |
| --- | --- | --- | --- | --- |
| `/` | 1449 → 756 | 1449 → 756 | 5 → 10 | 0,030 |
| `/instalar` | 1449 → 753 | 1449 → 753 | 0 → 0 | 0 |
| `/agendar` | 1461 → 753 | 2234 → 2256 | 27 → 0 | 0 |
| `/ingreso` | 1514 → 754 | 1514 → 754 | 6 → 7 | 0,006 |

### Instalabilidad

| | Antes | Después |
| --- | --- | --- |
| Errores de instalabilidad de Chrome | `no-manifest` | ninguno |
| Manifiesto | no existe | `/manifest.webmanifest`, sin errores |
| Service worker controla la página | no | sí |

La comprobación sí detecta el fallo: sobre la build anterior informa `no-manifest`.

### Cómo leer las diferencias

- **FCP casi a la mitad.** Se debe a que las fuentes ahora son propias (`@fontsource`) y se sirven con la app, en lugar de pedirse a Google Fonts. **La comparación no es del todo justa:** desde el entorno de medición Google Fonts no era alcanzable, y por eso la build anterior registra un error de consola y 96 en buenas prácticas. En una red real la mejora existe, pero es menor que la que muestra la tabla.
- **`/agendar` LCP 2,2 s.** Es el mismo antes y después: la pantalla espera la lista de sobanderos de la API para pintar su contenido principal. Con la API real y la red del local será mayor; es el número que más hay que vigilar.
- **`/ingreso` 96 en buenas prácticas.** El único aviso es `errors-in-console`: la API responde 401 a `/auth/yo` cuando no hay sesión, y Chrome lo registra como error de recurso. Es el comportamiento esperado, no un fallo.
- **SEO 91.** Se subió de 82 al añadir `description`. Falta `robots.txt`; que la app se indexe o no es una decisión del negocio, así que no se añadió.

## Accesibilidad

### Pruebas automáticas (corren en `make check`)

- `src/rutas.axe.test.tsx` recorre `rutasApp` (52 pantallas) y corre `axe` en cada una. La lista de rutas sale del código, así que una pantalla nueva queda cubierta sola. El servidor falso sale del contrato de la API, de modo que cada pantalla se pinta con contenido real y no con un 404; la prueba falla si una ruta cae en «Sin conexión» o «No encontrada» sin que sea lo esperado.
- jsdom no calcula estilos, así que el contraste se prueba en `estilos/contraste.test.ts` (pares de colores de los tokens).
- `src/estilos/movimiento.test.ts` fija la regla de «reducir movimiento» (`prefers-reduced-motion: reduce` apaga animaciones, transiciones y desplazamiento suave) y prohíbe que otra hoja la contradiga con `!important`.
- Se comprobó que las pruebas detectan fallos reales: al quitar la etiqueta de un campo o la regla de movimiento, fallan.

### Revisión en Chromium real (`npm run a11y:navegador`, a mano)

`axe` completo, con contraste, a 390 px, sobre las 52 rutas. Esto encontró lo que jsdom no ve y se corrigió:

| Hallazgo | Gravedad | Corrección |
| --- | --- | --- |
| `label-content-name-mismatch` en los chips de día de «Semana»: el texto visible «L 9» no estaba dentro del nombre accesible «Lunes 9» | Grave | El nombre ahora empieza por lo visible: «L 9, Lunes». Quien maneja el celular por voz dice lo que lee (WCAG 2.5.3) |
| `region` en 15 rutas: las zonas de botones al pie quedaban fuera de cualquier landmark | Moderada | `<section aria-label="Acciones">` en lugar de `<div>`; el estilo no cambia |
| Casillas e interruptores: la etiqueta medía solo el alto de su texto, no los 48 px de la fila | Táctil | La etiqueta ocupa toda la altura de la fila; no cambia lo que se ve |

Resultado final: 0 violaciones de `axe` (graves y leves) en 52 rutas.

### Pendiente de decidir (diseño)

- **Chips de día de «Semana»: 45 px de ancho, no 48.** Siete chips caben en 350 px; para llegar a 48 habría que casi eliminar el espacio entre ellos o cambiar la tira. Es una medida del diseño y no se cambió; el script la lista como aviso. Decisión del diseño.
- **Casilla y interruptor.** El control en sí mide 28 px y 56 × 32 px; el área que se toca (la fila con su etiqueta) mide 48 px o más. Si se quiere que el control mismo llegue a 48 px, es una decisión de diseño.
- **Carga animada.** Sigue sin existir (el `Skeleton` es estático), así que «reducir movimiento» hoy no tiene nada que apagar salvo transiciones. Queda abierto en `docs/GUIA.md`.

## Sin conexión

- El service worker guarda solo la interfaz: HTML, JS, CSS, fuentes e íconos (20 archivos, 481 KiB). Nunca guarda `/api`.
- `scripts/verificar-sw.mjs` revisa `dist/sw.js` en cada build (y por tanto en `make check`): falla si el service worker registra una ruta de caché para `/api`, si no excluye `/api` de la navegación o si el precache incluye datos.
- Las consultas y las escrituras usan `networkMode: "always"`. Con el valor por defecto de TanStack Query, sin red las consultas se quedaban en «Cargando» para siempre y las escrituras se encolaban para enviarse al volver la red, contra la regla de no escribir sin conexión. Hay pruebas con la red caída (`api/sinConexion.test.tsx`).
- Verificación manual en Chromium (`scripts/probar-sin-conexion.mjs`): con la interfaz ya guardada y la red cortada, la app abre; `/agendar` muestra «Sin conexión» con «Intentar de nuevo»; `/instalar` abre porque no usa la API; la caché no contiene nada de `/api`.
- Una versión nueva de la app se activa la próxima vez que se abra, nunca a mitad de un agendamiento.

## Pendientes

1. **Instalar en un celular real, Android e iPhone.** La instalación es la prueba de aceptación de la fase y necesita la app desplegada con HTTPS (Fase 11). Aquí se verificó con Chrome: manifiesto, íconos y service worker válidos, y sin errores de instalabilidad. En iPhone la instalación es manual («Agregar a inicio»); la pantalla `/instalar` ya la explica.
2. **Repetir Lighthouse con la app desplegada** y, si es posible, en un celular de gama media con la red del local. Vigilar el LCP de `/agendar`.
3. **Encabezados HTTP al desplegar:** `sw.js`, `index.html` y `manifest.webmanifest` con `Cache-Control: no-cache`; si no, una versión nueva puede tardar días en llegar. Los archivos de `assets/` llevan hash y pueden cachearse por un año.
4. **Íconos.** La «S» sobre terracota se generó con una tipografía serif del sistema (`scripts/generar-iconos.py`), no con Fraunces. Si el diseño aprueba un ícono definitivo, se reemplazan los PNG y el SVG.
5. **Chips de día (45 px).** Ver «Pendiente de decidir».
