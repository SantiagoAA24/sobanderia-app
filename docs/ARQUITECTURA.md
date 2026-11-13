# Sobandería — Arquitectura y plan de implementación con Claude Code

Nov 12, 2026 · @Santiago Acevedo

La app se construye como un monolito sencillo: una PWA en React que habla con una sola API en FastAPI sobre PostgreSQL, con un proceso aparte que envía los mensajes de WhatsApp. Es lo más simple que cubre las 53 pantallas, los cuatro roles de uso (cliente, sobandero, administrador y sistema) y la regla que más importa: nadie puede reservar la misma hora de un sobandero dos veces.

## Decisiones de arquitectura

| Pieza | Decisión | Por qué |
| --- | --- | --- |
| Frontend | React 18 + TypeScript + Vite, PWA con `vite-plugin-pwa`, React Router, TanStack Query | Es tu stack, instalable en el celular, y TanStack Query maneja cargas, errores y reintentos que el diseño ya contempla |
| API | FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic | Tipos claros, OpenAPI automático (el frontend genera su cliente de ahí) y migraciones versionadas |
| Base de datos | PostgreSQL 16 con `btree_gist` | Una restricción de exclusión sobre rangos de tiempo impide el doble agendamiento aunque dos personas toquen la misma hora a la vez |
| Tiempo | Todo en UTC en la base; Bogotá (`America/Bogota`, sin horario de verano) solo al mostrar y al calcular franjas | Evita errores de zona horaria |
| Sesiones | Cookie `HttpOnly` + `SameSite=Lax` con sesión guardada en la base (token guardado como hash) | Se puede cerrar al instante cuando el administrador da de baja a alguien; no hay JWT que invalidar |
| Clientes | Sin cuenta: acceso a su cita por enlace firmado de un solo uso por cita, enviado a su WhatsApp | El diseño promete «no necesita crear cuenta» |
| Mensajes | WhatsApp Cloud API (Meta) con plantillas aprobadas; los envíos salen de una tabla `notificaciones` que un worker revisa | Sin Redis ni colas externas; si Meta falla, el envío se reintenta y no se pierde |
| Recordatorios | El worker programa el recordatorio del día anterior en el servidor | No depende del celular del cliente |
| Despliegue | Contenedores Docker: `web` (archivos estáticos), `api`, `worker`, `db` | Mismo montaje en local, pruebas y producción |
| Repositorio | Monorepo: `apps/web`, `apps/api`, `design/` | Un solo lugar para Claude Code, con el diseño a mano como referencia |

Tres reglas que gobiernan todo lo demás:

1. **La base de datos manda.** La restricción de exclusión decide quién se queda con una hora; el código solo traduce el error a la pantalla «Ésa hora ya se ocupó».
2. **El servidor calcula las horas libres**, nunca el celular. El frontend solo las muestra.
3. **Cada acción que cambia una cita crea una notificación en la misma transacción.** Así nunca hay una cita cambiada sin su aviso, ni un aviso de una cita que no existe.

&#91;embedded content: arquitectura · 3 roles, 4 procesos, 1 base de datos\]

La PWA solo habla con la API; la API es la única que toca la base de datos; el worker lee la bandeja de notificaciones, envía por WhatsApp y Meta responde por el webhook de la API.

## Modelo de datos

Son doce tablas en PostgreSQL; la que sostiene el negocio es `citas`, con una restricción que impide que dos citas activas del mismo sobandero se crucen.

| Tabla | Para qué sirve | Campos clave |
| --- | --- | --- |
| `negocio` | Una sola fila con lo que muestra la pantalla de inicio | nombre, dirección, teléfono, mensaje de bienvenida |
| `usuarios` | Quien ingresa con correo y clave | correo único, `clave_hash` (argon2id), rol (`admin` o `sobandero`), activo, `debe_cambiar_clave` |
| `sobanderos` | Perfil de atención, uno por usuario sobandero | usuario, recibe\_citas, `duracion_min` (20, 30, 45 o 60) |
| `horario_semanal` | Franjas de atención por día; un día puede tener varias | sobandero, día de la semana, desde, hasta |
| `bloqueos` | Horas que el sobandero no atiende | sobandero, rango de tiempo, motivo |
| `clientes` | Quien agenda, sin cuenta | nombre, celular en formato E.164 (único), fecha y versión de la política aceptada |
| `citas` | El agendamiento | sobandero, cliente, rango de tiempo, estado, origen, quién canceló |
| `enlaces_cita` | Acceso del cliente a su cita | cita, hash del token, vence |
| `notificaciones` | Bandeja de salida de WhatsApp | cita, tipo, plantilla, variables, enviar\_en, estado, intentos |
| `sesiones` | Sesión de usuarios | usuario, hash del token, vence, último uso |
| `tokens_recuperacion` | Enlace para crear clave nueva | usuario, hash, vence, usado |
| `intentos_ingreso` | Límite de intentos fallidos | correo, IP, momento |

**Estados de una cita:** `agendada`, `atendida`, `no_asistio`, `cancelada`. Origen: `cliente` o `sobandero`. Las citas canceladas no se borran: el historial se conserva.

**La restricción que evita el doble agendamiento** (migración de Alembic):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE citas ADD CONSTRAINT citas_sin_cruce
  EXCLUDE USING gist (sobandero_id WITH =, rango WITH &&)
  WHERE (estado <> 'cancelada');
```

Reglas del modelo:

- La duración se guarda en cada cita (`rango`), así que cambiar `duracion_min` solo afecta las citas nuevas, como dice la pantalla.
- Las horas libres de un día = franjas del horario semanal, menos bloqueos, menos citas activas, cortadas cada `duracion_min` y sin horas pasadas.
- Dar de baja a un sobandero pone `activo = false` y cierra sus sesiones; nunca se borra la fila.
- Los tokens (enlaces, sesiones, recuperación) se guardan solo como hash; el valor real viaja una vez en el enlace.

## API

La API tiene tres zonas con permisos distintos: pública (cliente), sobandero y administrador; el rol se verifica en el servidor en cada ruta, nunca solo escondiendo botones.

| Zona | Endpoint | Qué hace |
| --- | --- | --- |
| Pública | `GET /publico/negocio` | Datos de la pantalla de inicio |
| Pública | `GET /publico/sobanderos` | Sobanderos que reciben citas |
| Pública | `GET /publico/sobanderos/{id}/dias` | Días con horas libres (pantalla Paso 2) |
| Pública | `GET /publico/sobanderos/{id}/horas?dia=` | Horas libres de un día (Paso 3) |
| Pública | `POST /publico/citas` | Crea la cita con nombre, celular y aceptación de datos; responde 409 si la hora se ocupó |
| Pública | `POST /publico/mi-cita/enlace` | «Encontrar mi cita»: envía el enlace por WhatsApp; responde igual exista o no la cita |
| Con enlace | `GET /mi-cita/{token}` | Ver la cita (o 410 si el enlace venció) |
| Con enlace | `POST /mi-cita/{token}/reprogramar` | Cambia día u hora; libera la vieja solo si la nueva se confirma |
| Con enlace | `POST /mi-cita/{token}/cancelar` | Cancela y avisa al sobandero |
| Sesión | `POST /auth/ingreso`, `/auth/salida` | Ingreso y cierre de sesión |
| Sesión | `POST /auth/recuperar`, `/auth/restablecer` | Enlace de un solo uso y clave nueva |
| Sesión | `POST /auth/cambiar-clave` | Clave nueva en el primer ingreso o desde el perfil |
| Sobandero | `GET /yo/citas?dia=·semana=` | Hoy y Semana |
| Sobandero | `POST /yo/citas` | Nueva cita manual |
| Sobandero | `PATCH /yo/citas/{id}` | Atendida, no asistió, cambiar hora o cancelar (con aviso opcional) |
| Sobandero | `GET/PUT /yo/horario`, `POST/DELETE /yo/bloqueos` | Horario semanal y bloqueos |
| Sobandero | `GET /yo/clientes`, `GET /yo/clientes/{id}` | Lista y ficha con historial |
| Sobandero | `PATCH /yo/perfil` | Nombre, correo (pide clave actual) |
| Admin | `GET /admin/resumen`, `/admin/agenda`, `/admin/reporte` | Resumen del día, agenda de todos y resumen semanal |
| Admin | `GET/POST/PATCH /admin/sobanderos` | Crear, editar duración y horario, dar de baja con elección sobre las citas próximas |
| Admin | `PUT /admin/negocio` | Datos del negocio |
| WhatsApp | `GET/POST /webhooks/whatsapp` | Verificación de Meta, estados de entrega y respuestas «Sí, asistiré» / «Necesito cambiarla» |

Reglas transversales:

- **Errores con código estable.** `hora_ocupada` (409), `enlace_vencido` (410), `no_autorizado` (401), `sin_permiso` (403), `validacion` (422), cada uno con un mensaje en español pensado para la pantalla que lo muestra.
- **Límite de intentos** en ingreso, recuperar clave y «Encontrar mi cita», para que nadie adivine claves ni use la app para enviar WhatsApp a números ajenos.
- **Enlaces de cita:** 32 bytes aleatorios, guardados como hash, válidos hasta el día siguiente de la cita; el celular nunca aparece en la URL.
- **Cliente nuevo o conocido:** se busca por celular normalizado; si ya existe, se reutiliza y no se pisa su nombre.
- **OpenAPI como contrato.** El frontend genera su cliente TypeScript desde `/openapi.json`, así un cambio en la API rompe la compilación y no la pantalla de un cliente.

## Frontend (PWA)

El frontend es una sola app con tres áreas de rutas (cliente, sobandero, administrador) que comparten el mismo sistema de diseño; las 53 pantallas del lienzo se convierten en rutas y las 21 piezas del sistema de diseño en componentes TSX.

**Estructura de `apps/web/src`:**

```text
componentes/ui/     los 21 componentes del sistema de diseño (TSX + CSS con tokens)
estilos/            tokens.css (colores, espacios, radios) y tipografía
cliente/            rutas y pantallas del flujo del cliente
panel/              pantallas del sobandero
admin/              pantallas del administrador
auth/               ingreso, recuperar clave, primer ingreso, guardas de ruta
api/                cliente generado desde OpenAPI + hooks de TanStack Query
lib/                fechas en Bogotá, formato de celular, utilidades
```

**Rutas y pantallas del diseño:**

| Ruta | Pantallas del lienzo |
| --- | --- |
| `/` | Inicio, Instalar la app |
| `/agendar/...` | Main (sobandero), Paso 2 día, Paso 3 hora, Paso 4 datos y sus errores, Sin horas, Hora ocupada, Confirmada |
| `/mi-cita/:token` | Gestionar, Cambiar día u hora, Cancelar, Cancelada, Enlace vencido |
| `/encontrar-cita` | Encontrar mi cita, Enlace enviado |
| `/ingreso`, `/olvide-clave`, `/restablecer/:token`, `/primera-clave` | Ingreso (y error), Olvidé mi clave, Clave enviada, Clave nueva (y error) |
| `/panel/hoy`, `/panel/semana`, `/panel/horario`, `/panel/clientes`, `/panel/perfil` | Hoy, Semana, Horario, Horario del día, Bloquear, Clientes, Ficha, Mi perfil y sus tres cambios, Cita, Cambiar la hora, No asistió, Nueva cita, Día vacío |
| `/admin/...` | Resumen, Sobanderos, Ficha, Nuevo, Duración, Dar de baja, Agenda, Resumen semanal, Datos del negocio |
| Transversales | Cargando, Sin conexión, Sesión vencida, Clave cambiada, Página no encontrada |

Decisiones de código:

- **Un guardia por área.** `/panel` exige sesión de sobandero o administrador; `/admin` exige administrador; si la sesión vence, cualquier llamada con 401 lleva a «Sesión vencida». Si `debe_cambiar_clave` es verdadero, todo redirige a `/primera-clave`.
- **El flujo de agendar guarda su estado en la URL** (sobandero, día y hora), así el botón Atrás y recargar la página no pierden nada.
- **Los estados de las pantallas salen de TanStack Query:** `isPending` muestra Cargando (Skeleton), `isError` de red muestra Sin conexión, y un 409 en crear cita muestra Hora ocupada conservando los datos escritos.
- **PWA:** el service worker guarda solo el cascarón de la app (HTML, JS, CSS, fuentes e íconos). Los datos de citas nunca se guardan sin conexión ni se escriben offline: sin internet se muestra «Sin conexión» con un botón de reintentar.
- **Accesibilidad del diseño:** objetivos táctiles de 48 px, contraste 4.5:1, foco de 3 px y `prefers-reduced-motion` para la carga animada; pruebas automáticas con `axe` en cada ruta.
- **Fechas:** una sola utilidad convierte entre UTC y Bogotá; ninguna pantalla formatea fechas por su cuenta.

## WhatsApp, seguridad y despliegue

### Mensajes y recordatorios

- Cada cambio de una cita inserta una fila en `notificaciones` dentro de la misma transacción; el recordatorio queda programado para el día anterior a la cita.
- El `worker` consulta la tabla cada pocos segundos con `SELECT ... FOR UPDATE SKIP LOCKED`, envía por la WhatsApp Cloud API y marca `enviada` o reintenta con espera creciente hasta cuatro veces; después queda `fallida` y se ve en el resumen del administrador.
- Si la cita se cancela o cambia antes del recordatorio, la notificación pendiente se cancela.
- Las cinco plantillas ya están definidas en la guía de pantallas (`cita_confirmada`, `recordatorio_cita`, `cita_cambiada`, `cita_cancelada`, `cita_cancelada_sobandero`). **Hay que enviarlas a Meta ya**: la aprobación tarda y bloquea las pruebas reales. Mientras tanto el código usa un `ProveedorWhatsApp` falso que escribe los mensajes en el registro.
- El webhook valida la firma de Meta, guarda los estados de entrega y procesa las respuestas rápidas: «Sí, asistiré» confirma, «Necesito cambiarla» responde con el enlace de la cita.

### Seguridad

- Claves con argon2id, mínimo ocho caracteres, límite de intentos por correo y por IP, y la misma respuesta si el correo existe o no.
- Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; las rutas que cambian datos exigen además un encabezado propio (defensa contra CSRF).
- Enlace de recuperación de un solo uso que vence a las pocas horas; al cambiar la clave se cierran las demás sesiones y se avisa por correo.
- CORS cerrado al dominio de la app, cabeceras de seguridad (CSP, `X-Content-Type-Options`, `Referrer-Policy`) y HTTPS obligatorio.
- Variables secretas solo en el entorno del servidor; nunca en el repositorio.

### Datos personales (Ley 1581 de 2012)

- Se guarda solo nombre y celular del cliente, con la fecha y la versión de la política que aceptó.
- Los registros no incluyen el celular completo; se enmascara (`300 *** 4567`).
- Copias de seguridad diarias de la base con retención de 14 días y una prueba de restauración antes del lanzamiento.
- Falta el texto final de la política, que debe revisar un abogado.

### Despliegue y observabilidad

- Una imagen Docker para `api` y `worker` (mismo código, distinto comando) y otra para `web`.
- Recomendación: Azure Container Apps con Azure Database for PostgreSQL (servidor flexible), porque ya lo manejas; la alternativa más barata es una sola máquina virtual con Docker Compose y Caddy para HTTPS.
- GitHub Actions: lint, pruebas y construcción en cada pull request; migraciones automáticas al desplegar.
- Registros en JSON, un endpoint `/salud` y alertas por correo si el worker deja de enviar o si hay más de una notificación `fallida`.

## Cómo trabajar con Claude Code

Claude Code rinde mejor con tareas pequeñas, un archivo de reglas claro y una forma de comprobar su propio trabajo; el plan de abajo está cortado en pasos de ese tamaño.

**Antes del paso 1:**

1. Crea el repositorio y copia el diseño a `design/`: descarga el sistema de diseño y el lienzo de pantallas desde sus artefactos, y agrega esta guía y la de pantallas como `design/GUIA.md` y `docs/ARQUITECTURA.md`. Claude Code los lee como fuente de verdad.
2. Escribe `CLAUDE.md` en la raíz con las reglas fijas. Base sugerida:

```markdown
# Sobandería
App de citas para una sobandería familiar (4 sobanderos). PWA en español, trato de "usted".

## Fuente de verdad
- Pantallas y flujos: design/ (lienzo) y docs/ARQUITECTURA.md
- Si el código contradice el diseño, preguntar antes de cambiar el diseño.

## Stack
- apps/web: React 18, TypeScript estricto, Vite, TanStack Query, React Router
- apps/api: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, pytest
- PostgreSQL 16 (btree_gist). Todo en UTC; mostrar en America/Bogota.

## Reglas
- La restricción de exclusión en `citas` es la única garantía contra doble agendamiento.
- Cada cambio de cita crea su notificación en la misma transacción.
- Nunca guardar ni registrar celulares completos en logs; tokens solo como hash.
- Texto de la interfaz en español, frases cortas, sin emojis. Un solo botón principal por pantalla.
- Objetivos táctiles >= 48 px, contraste 4.5:1, foco visible.
- Componentes de apps/web/src/componentes/ui; no crear estilos sueltos con colores fijos.

## Comandos
- Pruebas API: cd apps/api && pytest
- Pruebas web: cd apps/web && npm test
- Tipos y lint: npm run check (web), ruff check && mypy (api)
- Todo junto: make check

## Forma de trabajar
- Un paso del plan por vez; commit al terminar con mensaje claro.
- Escribir primero la prueba cuando haya una regla de negocio.
- No avanzar al siguiente paso si `make check` falla.
```

3. Haz que `make check` corra lint, tipos y pruebas de ambos lados, y confíguralo como hook para que Claude Code lo ejecute antes de dar un paso por terminado.

**Ritmo de trabajo en cada paso:**

1. Empieza en modo plan: pide a Claude Code que lea el paso y proponga archivos y pruebas antes de escribir nada; corrígelo si se desvía.
2. Aprueba y deja que implemente; que ejecute `make check` y arregle lo que falle.
3. Revisa el cambio (`git diff`) y pide una segunda revisión a un subagente con el criterio de aceptación del paso.
4. Prueba a mano la pantalla en el celular o en el modo móvil del navegador, contra el lienzo.
5. Commit y siguiente paso. Si un paso sale enorme, pídele partirlo.

Para las pantallas, abre el lienzo al lado y dale a Claude Code el nombre del archivo (`Paso3-Hora`, `Cita`, etc.): cada pantalla se nombra igual en el diseño, en las rutas y en las pruebas.

## Plan de construcción paso a paso

Son doce fases que van del servidor hacia las pantallas: primero la base y la regla del doble agendamiento, después la API, y solo entonces las pantallas, de modo que cada fase termina con algo que se puede probar.

| Fase | Resultado | Depende de |
| --- | --- | --- |
| 0 | Repositorio, reglas de Claude Code, base local y revisión automática | — |
| 1 | Base de datos con migraciones y la restricción anti-cruce | 0 |
| 2 | Ingreso, roles, primer ingreso y recuperación de clave | 1 |
| 3 | Horas libres y agendamiento, con pruebas de concurrencia | 1 |
| 4 | Cimientos del frontend: tokens, 21 componentes, rutas y cliente de API | 0 |
| 5 | Flujo del cliente completo (agendar, gestionar, cancelar, encontrar) | 3, 4 |
| 6 | Panel del sobandero | 2, 3, 4 |
| 7 | Panel del administrador | 6 |
| 8 | WhatsApp, bandeja de salida y recordatorios | 3 |
| 9 | PWA instalable, sin conexión y accesibilidad | 5, 6 |
| 10 | Seguridad, datos personales y pruebas de extremo a extremo | 5 a 8 |
| 11 | Despliegue, piloto con la familia y lanzamiento | todas |

Las fases 1–3 (servidor) y la 4 (frontend) pueden avanzar en paralelo si trabajas en dos sesiones de Claude Code; en una sola sesión, sigue el orden numérico. **En paralelo desde ya, fuera del código:** enviar las cinco plantillas a Meta, conseguir la revisión legal de la política de datos y definir dirección, teléfono y horario reales.

### Fase 0 — Preparación

1. Crear el repositorio con `apps/web`, `apps/api`, `design/` y `docs/`; agregar el diseño y las dos guías.
2. Escribir `CLAUDE.md` (base en la sección anterior) y un `Makefile` con `check`, `dev` y `test`.
3. `docker-compose.yml` con PostgreSQL 16 y las dos apps en modo desarrollo.
4. Esqueletos mínimos: FastAPI con `/salud` y Vite con una página que dice «Sobandería»; pytest y Vitest con una prueba de ejemplo.
5. GitHub Actions que corre `make check` en cada pull request.

```text
Lee CLAUDE.md y docs/ARQUITECTURA.md. Ejecuta la Fase 0: crea el monorepo, el docker-compose con PostgreSQL 16, los esqueletos de api y web, el Makefile con check/dev/test y el flujo de GitHub Actions. Entra en modo plan primero y muéstrame la lista de archivos antes de escribir.
```

**Listo cuando:** `make dev` levanta todo, `make check` pasa en verde y el flujo de CI corre en un pull request de prueba.

### Fase 1 — Base de datos

1. Modelos de SQLAlchemy y la primera migración de Alembic con las doce tablas y los enums de la sección Modelo de datos.
2. La restricción `citas_sin_cruce` con `btree_gist`, en la misma migración.
3. Script de datos de ejemplo (`make seed`): el negocio, un administrador, cuatro sobanderos con horario, y unos clientes y citas.
4. Pruebas: dos citas cruzadas del mismo sobandero fallan; una cancelada no estorba; dos sobanderos distintos sí pueden tener la misma hora.

```text
Ejecuta la Fase 1. Primero escribe las pruebas de la restricción anti-cruce (cruce total, cruce parcial, cita cancelada, otro sobandero) y comprueba que fallan; luego crea los modelos, la migración y el seed hasta que pasen.
```

**Listo cuando:** `alembic upgrade head` crea el esquema desde cero, `make seed` carga datos y las pruebas de cruce pasan contra PostgreSQL real (no SQLite).

### Fase 2 — Ingreso y roles

1. Hash argon2id y funciones de clave; tabla de sesiones y cookie `HttpOnly`.
2. `POST /auth/ingreso` y `/auth/salida`, con límite de intentos y el mismo mensaje para correo o clave incorrectos.
3. Dependencias de FastAPI `requiere_sobandero` y `requiere_admin`; usuarios inactivos no ingresan y sus sesiones se cierran.
4. Primer ingreso: si `debe_cambiar_clave`, solo se permite `/auth/cambiar-clave`.
5. Recuperación: `/auth/recuperar` (siempre responde igual) y `/auth/restablecer` con token de un solo uso; por ahora el correo se escribe en el registro.
6. Cambio de clave y de correo desde el perfil, pidiendo la clave actual.

```text
Ejecuta la Fase 2 siguiendo la sección Seguridad de docs/ARQUITECTURA.md. Pruebas primero para: intentos fallidos bloqueados, usuario inactivo, token de recuperación reutilizado, cambio de clave que cierra las otras sesiones y acceso de un sobandero a una ruta de admin (403).
```

**Listo cuando:** un sobandero no puede abrir rutas `/admin`, un token usado dos veces falla y todas las pruebas de autenticación pasan.

### Fase 3 — Horas libres y agendamiento

1. Servicio `horas_libres(sobandero, día)`: horario semanal menos bloqueos menos citas activas, cortado cada `duracion_min`, sin horas pasadas y en hora de Bogotá.
2. `GET /publico/sobanderos`, `/dias` y `/horas`.
3. `POST /publico/citas`: normaliza el celular, crea o reutiliza el cliente, exige aceptación de datos, inserta la cita y crea el enlace; si la restricción falla devuelve `hora_ocupada` (409) con otras horas libres.
4. Rutas con enlace: ver, reprogramar (crea la nueva y libera la vieja en una sola transacción) y cancelar.
5. Rutas del sobandero para citas: listar, crear manual, marcar atendida o no asistió, cambiar hora y cancelar.
6. Prueba de concurrencia: 20 solicitudes simultáneas a la misma hora dejan exactamente una cita y 19 respuestas 409.

```text
Ejecuta la Fase 3. Empieza por las pruebas de horas_libres con casos de borde (franja partida, bloqueo a mitad de día, día sin horario, hora pasada, cambio de duración) y la prueba de concurrencia con 20 hilos. Luego implementa servicios y rutas. Cada cambio de cita debe insertar su fila en notificaciones en la misma transacción.
```

**Listo cuando:** la prueba de concurrencia pasa de forma repetible (corrida 20 veces seguidas) y reprogramar no deja nunca al cliente sin cita si la hora nueva se ocupó.

### Fase 4 — Cimientos del frontend

1. `estilos/tokens.css` con los colores, espacios, radios y tipografía del sistema de diseño (Fraunces para títulos, Nunito Sans para texto).
2. Portar los 21 componentes a TSX con los mismos nombres y props: `Button`, `OptionRow`, `TimeSlot`, `TextField`, `PasswordField`, `BottomNav`, etc. Una página de vista previa (`/ui`) los muestra todos.
3. Router con las tres áreas y los guardias de ruta (aún con datos falsos).
4. Cliente TypeScript generado desde el OpenAPI de la API y los hooks base de TanStack Query, con el manejo central de 401 (Sesión vencida), red caída (Sin conexión) y 409.
5. Pantallas transversales: Cargando, Sin conexión, Sesión vencida y Página no encontrada.

```text
Ejecuta la Fase 4. El sistema de diseño está en design/sistema/ (bundle.js, README de cada componente). Porta cada componente a TSX conservando nombre y props, usando solo variables CSS de tokens.css. Crea /ui con todos los componentes en sus variantes y añade una prueba con axe por componente.
```

**Listo cuando:** `/ui` se ve igual que la vista previa del sistema de diseño en un celular y las pruebas de `axe` pasan.

### Fase 5 — Flujo del cliente

1. Inicio e Instalar la app, con los datos del negocio desde `GET /publico/negocio`.
2. Agendar: sobandero, día, hora y datos, con el estado en la URL; errores de formulario (celular de 10 dígitos, casilla de datos obligatoria) como en `Paso4-Errores`.
3. Casos especiales: Sin horas, Hora ocupada (con otras horas sugeridas y datos conservados) y Confirmada.
4. `/mi-cita/:token`: Gestionar, Cambiar día u hora (reutiliza los pasos 2 y 3), Cancelar y Cancelada; Enlace vencido ante un 410.
5. Encontrar mi cita y Enlace enviado.

```text
Ejecuta la Fase 5 pantalla por pantalla, comparando cada una con su archivo del lienzo (Main, Paso2-Dia, Paso3-Hora, Paso4-Datos, Paso4-Errores, Sin-horas, Hora-ocupada, Confirmada, Gestionar, Cancelar-cliente, Cancelada, Inicio, Encontrar-cita, Enlace-enviado-cliente, Enlace-vencido). Después de cada pantalla, ejecuta make check y muéstrame una captura a 390 px.
```

**Listo cuando:** una persona sin cuenta agenda, ve, cambia y cancela su cita de punta a punta en el celular, y si dos personas eligen la misma hora la segunda ve «Esa hora ya se ocupó» sin perder sus datos.

### Fase 6 — Panel del sobandero

1. Ingreso, Ingreso con error, Olvidé mi clave, Clave enviada, Clave nueva y sus errores.
2. Hoy (siguiente cita en terracota), Semana, Cita, Cambiar la hora y No asistió.
3. Nueva cita manual y Día vacío.
4. Horario semanal, Horario del día y Bloquear horas.
5. Clientes y Ficha del cliente con historial.
6. Mi perfil, Cambiar correo, Cambiar clave y Clave cambiada.
7. Estados: Cancelar (con casilla de avisar), Cita cancelada y Sesión vencida.

```text
Ejecuta la Fase 6 en el orden de la lista, una pantalla por vez, contra su archivo del lienzo (Hoy, Semana, Cita, Reprogramar, No-asistio, Nueva-cita, Horario, Horario-dia, Bloquear, Clientes, Cliente, Perfil, Perfil-correo, Perfil-clave, Clave-cambiada, Cancelar-sobandero, Cita-cancelada, Dia-vacio). Conecta cada acción a su endpoint /yo/... y añade una prueba de extremo a extremo por flujo.
```

**Listo cuando:** un sobandero con la clave del seed ve su día, atiende, marca inasistencia, cambia una hora, bloquea un rango y cierra sesión, todo desde el celular.

### Fase 7 — Panel del administrador

1. Rutas `/admin` y la barra inferior propia del administrador.
2. Resumen del día, Agenda de todos y Resumen semanal (`/admin/resumen`, `/agenda`, `/reporte`).
3. Sobanderos: lista, Ficha, Nuevo (con clave temporal y `debe_cambiar_clave`), Duración y Horario.
4. Dar de baja: elegir qué pasa con las citas próximas, desactivar y cerrar sesiones, conservando el historial.
5. Datos del negocio.

```text
Ejecuta la Fase 7 contra los archivos Admin-Hoy, Admin-Agenda, Admin-Reporte, Admin-Sobanderos, Admin-Sobandero, Admin-Nuevo, Duracion, Admin-Baja y Admin-Negocio. Pruebas primero para la baja: citas próximas dejadas como están y citas canceladas con aviso, y sesiones cerradas al instante.
```

**Listo cuando:** el administrador crea un sobandero, este entra por primera vez y cambia su clave, y luego lo da de baja sin perder su historial.

### Fase 8 — WhatsApp y recordatorios

1. Interfaz `ProveedorWhatsApp` con dos implementaciones: `Falso` (escribe en el registro, para desarrollo y pruebas) y `CloudApi` (Meta).
2. Worker que lee `notificaciones` con `FOR UPDATE SKIP LOCKED`, envía, marca estado y reintenta con espera creciente (máximo cuatro intentos).
3. Disparadores: cita creada → `cita_confirmada`; cambio de hora → `cita_cambiada`; cancelación por el cliente o por el sobandero → la plantilla que corresponda; recordatorio programado el día anterior, cancelado si la cita cambia.
4. Webhook con validación de firma, estados de entrega y respuestas rápidas.
5. «Encontrar mi cita» envía el enlace por WhatsApp, con límite de envíos por celular.
6. Aviso de notificaciones fallidas en el Resumen del administrador.

```text
Ejecuta la Fase 8 con el proveedor Falso por defecto. Pruebas primero: una cita nueva crea exactamente una notificación; cancelar la cita cancela su recordatorio pendiente; un error de Meta reintenta y al cuarto intento queda fallida; dos workers a la vez nunca envían el mismo mensaje.
```

**Listo cuando:** con el proveedor falso, todo el ciclo de vida de una cita deja los mensajes correctos en el registro; con las plantillas aprobadas y un número de prueba, llegan a un WhatsApp real.

### Fase 9 — PWA, sin conexión y accesibilidad

1. Manifiesto (nombre, íconos, colores crema y terracota, `display: standalone`) y service worker con el cascarón de la app.
2. Pantalla Sin conexión funcional con reintento; sin escrituras offline.
3. Carga animada que respeta `prefers-reduced-motion`.
4. Pasada de accesibilidad: `axe` en todas las rutas, orden de tabulación, etiquetas de formularios, tamaños de letra y toques de 48 px para clientes mayores.
5. Prueba con Lighthouse (PWA, accesibilidad, rendimiento) en un celular de gama media.

```text
Ejecuta la Fase 9. Configura vite-plugin-pwa, el manifiesto y los iconos, y la pantalla Sin conexión. Luego corre axe y Lighthouse sobre todas las rutas y arregla lo que falle; reporta las puntuaciones antes y después.
```

**Listo cuando:** la app se instala desde Chrome y desde Safari (Agregar a inicio), Lighthouse da 90 o más en accesibilidad y PWA, y no queda ninguna violación de `axe`.

### Fase 10 — Seguridad, datos y pruebas de extremo a extremo

1. Playwright con los recorridos principales: agendar, reprogramar, cancelar, encontrar cita, ingreso, atender, bloquear horas, crear y dar de baja a un sobandero.
2. Revisión de seguridad: límites de intentos, cookies, CORS, CSP, que ningún registro tenga celulares completos y que un sobandero no pueda leer citas de otro por el identificador.
3. Texto final de la política de datos (revisado por el abogado) y enlace desde Paso 4.
4. Copias de seguridad y una restauración de prueba.
5. Datos de ejemplo fuera de producción; el seed nunca corre en producción.

```text
Ejecuta la Fase 10. Escribe los recorridos de Playwright y haz una revisión de seguridad ruta por ruta: para cada endpoint lista quién puede llamarlo y añade una prueba de acceso indebido. Reporta cualquier hallazgo antes de arreglarlo.
```

**Listo cuando:** los recorridos pasan en CI, la revisión no deja hallazgos abiertos y la restauración de la copia se probó con éxito.

### Fase 11 — Despliegue, piloto y lanzamiento

1. Infraestructura (Azure Container Apps y PostgreSQL, o la máquina virtual con Compose), dominio y HTTPS.
2. Despliegue automático desde `main`, con migraciones y verificación de `/salud`.
3. Variables secretas, número de WhatsApp Business con plantillas aprobadas y alerta si el worker se detiene.
4. Piloto de una a dos semanas: solo los cuatro sobanderos y unos pocos clientes de confianza; se anotan fallos y confusiones.
5. Ajustes del piloto y lanzamiento: el enlace de la app se comparte con los clientes (código QR en el local).

```text
Ejecuta la Fase 11. Prepara los Dockerfiles de producción, el flujo de despliegue y una lista de comprobación de lanzamiento (variables, dominio, copias, plantillas, alertas). No ejecutes nada contra producción sin mostrarme el comando.
```

**Listo cuando:** la familia usa la app durante el piloto sin ayuda, no hay citas duplicadas ni mensajes perdidos y las copias diarias se están generando.

## Pruebas, riesgos y decisiones abiertas

La prueba que más importa es la de concurrencia de la Fase 3; el resto de la estrategia se reparte por capas y el riesgo mayor está fuera del código: la aprobación de las plantillas de Meta.

**Pruebas por capa**

| Capa | Herramienta | Qué cubre |
| --- | --- | --- |
| Reglas de negocio | pytest contra PostgreSQL real | horas libres, cruce de citas, reprogramar, baja de sobandero, notificaciones |
| API | pytest + cliente HTTP | permisos por rol, errores con código estable, límites de intentos |
| Componentes | Vitest + Testing Library + `axe` | los 21 componentes y sus estados |
| Pantallas | Vitest con la API simulada | cargando, error, vacío y éxito de cada pantalla |
| Extremo a extremo | Playwright (celular 390 px) | los recorridos completos de cada rol |

**Riesgos**

| Riesgo | Efecto | Qué hacer |
| --- | --- | --- |
| Meta tarda en aprobar las plantillas | No hay avisos reales al lanzar | Enviarlas esta semana; usar el proveedor falso mientras tanto; tener un plan manual (que el sobandero escriba) |
| Un cliente no recibe el WhatsApp | No ve su enlace | «Encontrar mi cita» lo reenvía; el sobandero ve la cita en su panel y puede llamar |
| Clientes mayores no instalan la app | Menos uso | La app funciona en el navegador sin instalar; el QR del local lleva a Inicio |
| Doble agendamiento por un error de código | Dos clientes a la misma hora | La restricción de la base lo impide aunque el código falle |
| Política de datos sin revisar | Riesgo legal (Ley 1581) | Revisión del abogado antes del piloto |
| Un paso de Claude Code sale demasiado grande | Código difícil de revisar | Partir el paso, pedir plan primero y no avanzar con `make check` en rojo |

**Decisiones que faltan** (ninguna bloquea las fases 0–4):

- Nombre, dirección, teléfono y horario reales de la sobandería.
- Hosting definitivo: Azure Container Apps o una máquina virtual con Compose.
- Dominio de la app y número de WhatsApp Business que se usará.
- Qué tanto antes del recordatorio se avisa (la propuesta es el día anterior).
- Texto final de la política de datos y de los mensajes de las plantillas.
