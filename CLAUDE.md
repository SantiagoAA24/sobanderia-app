# Sobandería

App de citas para una sobandería familiar (4 sobanderos, citas de ~30 min). PWA móvil en español, trato de "usted", pensada también para clientes mayores. Los clientes no tienen cuenta; sobanderos y administrador ingresan con correo y clave.

## Fuente de verdad
- Arquitectura, modelo de datos, API y plan por fases: `docs/ARQUITECTURA.md`
- Pantallas, componentes, reglas de negocio y plantillas de WhatsApp: `docs/GUIA.md`
- Diseño visual: `design/lienzo/` (una pantalla por archivo `.dc.html`) y `design/sistema/` (componentes y tokens)
- Si el código contradice el diseño o la arquitectura, pregunta antes de cambiar el diseño.
- Seguimiento del trabajo: `PLAN.md` (casillas por fase). Márcalo al terminar cada paso.

## Stack
- `apps/web`: React 18, TypeScript estricto, Vite, vite-plugin-pwa, React Router, TanStack Query. Cliente de la API generado desde `/openapi.json`.
- `apps/api`: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, pytest.
- PostgreSQL 16 con `btree_gist`. Todo se guarda en UTC; se muestra en `America/Bogota`.
- Worker de WhatsApp: mismo código de `apps/api`, distinto comando; lee la tabla `notificaciones`.

## Reglas que no se rompen
- La restricción de exclusión `citas_sin_cruce` en la tabla `citas` es la única garantía contra el doble agendamiento. El código solo traduce su error a `hora_ocupada` (409).
- El servidor calcula las horas libres; el frontend solo las muestra.
- Cada cambio de una cita crea su fila en `notificaciones` dentro de la misma transacción.
- Tokens (enlaces de cita, sesiones, recuperación) se guardan solo como hash. Claves con argon2id. Única excepción aceptada (H-04, `docs/SEGURIDAD.md`): el token de un enlace de cita vive en claro en `notificaciones.variables` hasta que el worker envía el mensaje; ahí se borra.
- Nunca guardar ni registrar celulares completos en logs (enmascarar: `300 *** 4567`).
- El rol se verifica en el servidor en cada ruta, no solo ocultando botones.
- Las pruebas de reglas de negocio corren contra PostgreSQL real, nunca SQLite.
- Sin secretos en el repositorio: solo variables de entorno (`.env` fuera de git, `.env.example` dentro).

## Reglas de interfaz
- Todo el texto de la interfaz en español, frases cortas, sin emojis.
- Un solo botón principal por pantalla; un solo momento terracota por pantalla.
- Objetivos táctiles de al menos 48 px, contraste 4.5:1, foco visible de 3 px, respetar `prefers-reduced-motion`.
- Usar los componentes de `apps/web/src/componentes/ui` y las variables de `estilos/tokens.css`. No crear estilos sueltos con colores fijos.
- Nombrar cada pantalla igual que su archivo en `design/lienzo/` (por ejemplo `Paso3-Hora`, `Cita`).

## Comandos
- Todo junto (lint, tipos y pruebas): `make check`
- Levantar el entorno local: `make dev`
- Pruebas: `make test` (API: `cd apps/api && pytest`; web: `cd apps/web && npm test`)
- Migraciones: `make migrate`; datos de ejemplo (solo desarrollo): `make seed`

## Forma de trabajar
- Un paso del plan por vez. Empieza en modo plan: lista los archivos que vas a tocar y las pruebas antes de escribir.
- Escribe primero la prueba cuando haya una regla de negocio.
- Al terminar un paso: ejecuta `make check`, marca la casilla en `PLAN.md` y haz commit con un mensaje claro en español.
- No avances al siguiente paso si `make check` falla.
- Si un paso resulta muy grande, divídelo y avísame.
- Detente y pregúntame si algo falla dos veces, si falta una decisión de negocio, o antes de ejecutar cualquier comando contra producción.
- No cambies el diseño ni las reglas de negocio por tu cuenta; propón el cambio y espera mi respuesta.
