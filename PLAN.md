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
- [ ] Cambio de correo desde el perfil (pendiente: va con `PATCH /yo/perfil` en la Fase 6)

## Fase 3 — Horas libres y agendamiento
- [x] `horas_libres` y rutas públicas
- [x] Crear, reprogramar y cancelar citas; rutas del sobandero
- [x] Prueba de concurrencia (20 solicitudes, una cita)

## Fase 4 — Cimientos del frontend
- [ ] Tokens, 21 componentes y página `/ui`
- [ ] Router, guardias y cliente de API
- [ ] Pantallas transversales

## Fase 5 — Flujo del cliente
- [ ] Agendar, gestionar, cancelar y encontrar cita

## Fase 6 — Panel del sobandero
- [ ] Ingreso, Hoy, Semana, Cita, Horario, Clientes y Perfil

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
