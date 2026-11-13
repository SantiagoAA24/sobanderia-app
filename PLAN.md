# Plan de construcción

Seguimiento de `docs/ARQUITECTURA.md`. Se marca cada casilla al terminar el paso, con `make check` en verde.

## Fase 0 — Preparación
- [x] Monorepo con `apps/web`, `apps/api`, `design/` y `docs/`
- [x] `CLAUDE.md` y `Makefile` con `check`, `dev` y `test`
- [x] `docker-compose.yml` con PostgreSQL 16, api, worker y web
- [x] Esqueletos: FastAPI con `/salud` y Vite con «Sobandería»; pytest y Vitest con una prueba
- [x] GitHub Actions que corre `make check` en cada pull request

## Fase 1 — Base de datos
- [x] Modelos, migración con las doce tablas y restricción `citas_sin_cruce`
- [x] `make seed` con datos de ejemplo
- [x] Pruebas de cruce contra PostgreSQL real

## Fase 2 — Ingreso y roles
- [x] Argon2id, sesiones y cookie
- [x] Ingreso, salida, roles, primer ingreso, recuperación y cambio de clave
- [x] Cambio de correo desde el perfil (`PATCH /yo/perfil`, Fase 6.1)

## Fase 3 — Horas libres y agendamiento
- [x] `horas_libres` y rutas públicas
- [x] Crear, reprogramar y cancelar citas; rutas del sobandero
- [x] Prueba de concurrencia (20 solicitudes, una cita)

## Fase 4 — Cimientos del frontend
- [x] Tokens, 21 componentes y página `/ui`
- [x] Router, guardias y cliente de API (`make cliente`)
- [x] Pantallas transversales (Enlace vencido, Sesión vencida, No encontrada; además Sin conexión y Cargando genéricas)

## Fase 5 — Flujo del cliente
- [x] API pública: `GET /publico/negocio`, `proximo_cupo` en `/publico/sobanderos` y `POST /publico/mi-cita/enlace`
  - Nota: «Encontrar mi cita» rota el enlace de la cita y encola `cita_confirmada` con el token nuevo (no hay sexta plantilla). El horario del local no está en la tabla `negocio`; Inicio muestra dirección y teléfono.
- [x] Inicio e Instalar la app
- [x] Agendar: Paso 1 a 3 y Sin horas
- [x] Agendar: Paso 4, errores, Hora ocupada, Confirmada y Política
- [x] Gestionar, cambiar, cancelar y Cancelada
- [x] Encontrar mi cita y Enlace enviado
- [x] Recorrido completo en el navegador (agendar, cambiar, cancelar y hora ocupada contra la API local)

## Fase 6 — Panel del sobandero
- [x] 6.1 API del sobandero: `GET /yo/citas/{id}`, `/yo/dias`, `/yo/horas`, `/yo/horario` (GET y PUT), `/yo/bloqueos`, `/yo/clientes` y `/yo/perfil`, con permisos por sobandero
  - Nota: una clave actual incorrecta responde 401 con código `clave_incorrecta` (antes `no_autorizado`), para que el panel no lo confunda con una sesión vencida.
  - Nota del entorno: si `mypy` falla con «No module named pydantic», ponga `/usr/local/bin` primero en el PATH.
- [x] 6.2 Ingreso, primer ingreso (clave temporal en memoria), recuperar clave y base del panel
- [ ] 6.3 Hoy, Semana, Día vacío, Cita, Cambiar la hora, No asistió y Cancelar con aviso
- [ ] 6.4 Nueva cita, Bloquear horas (con «Horas bloqueadas» para quitarlas), Horario y Horario del día
- [ ] 6.5 Clientes, Ficha, Mi perfil, Cambiar correo, Cambiar clave y Clave cambiada
- [ ] 6.6 Recorrido de un día completo en el navegador

## Fase 7 — Panel del administrador
- [ ] Resumen, Agenda, Sobanderos, baja y Datos del negocio

## Fase 8 — WhatsApp y recordatorios
- [ ] Proveedor falso y Cloud API, worker, disparadores y webhook
  - Nota de la Fase 3: `notificaciones.variables.token` guarda el token en claro (solo en `cita_confirmada` y `cita_cambiada`); el worker debe borrarlo al enviar.

## Fase 9 — PWA, sin conexión y accesibilidad
- [ ] Manifiesto, service worker, Sin conexión, `axe` y Lighthouse

## Fase 10 — Seguridad, datos y extremo a extremo
- [ ] Playwright, revisión de seguridad, política de datos y copias

## Fase 11 — Despliegue, piloto y lanzamiento
- [ ] Infraestructura, despliegue automático, piloto y lanzamiento
