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
- [x] 6.3 Hoy, Semana, Día vacío, Cita, Cambiar la hora, No asistió y Cancelar con aviso
- [x] 6.4 Nueva cita, Bloquear horas (con «Horas bloqueadas» para quitarlas), Horario y Horario del día
- [x] 6.5 Clientes, Ficha, Mi perfil, Cambiar correo, Cambiar clave y Clave cambiada
- [x] 6.6 Recorrido de un día completo en el navegador (390 px, API y base locales con el seed): ingreso con clave temporal, primera clave, atender, no asistió, cambiar hora con aviso, cancelar con aviso, nueva cita, bloquear (2 citas siguen agendadas), quitar el bloqueo, editar horario, clientes y ficha, perfil y cerrar sesión
  - Notificaciones comprobadas en la base: cita_cambiada, cita_cancelada_sobandero y cita_confirmada una vez cada una, y dos recordatorios; atender y no asistió no crean ninguna.
  - Pendiente de decisión de diseño: ver otras semanas en Semana (hoy solo la actual, o cualquier día por `?dia=`).

## Fase 7 — Panel del administrador (completa)
- [x] 7.1 API del administrador: `/admin/resumen`, `/agenda`, `/sobanderos` (crear con clave temporal, editar, horario, enlace de clave, baja), `/negocio` y `/actividad`, solo rol admin
  - Decisión: «Dejarlas como están» pone `recibe_citas = false` y `baja_en`; la cuenta sigue activa y se desactiva sola al cerrar la última cita agendada (migración 0003). «Cancelar y avisar» desactiva y cierra sesiones al instante; las citas quedan `cancelada_por = 'admin'` con la plantilla `cita_cancelada_sobandero`.
  - Decisión: el registro de actividad usa la tabla `auditoria`; la pantalla `Admin-Actividad` es nueva (no estaba en el lienzo) y se enlaza desde el Resumen.
- [x] 7.2 Base del admin (barra de tres elementos), Resumen y Agenda
  - Nota: la Agenda muestra solo el día de hoy, como el lienzo. El administrador no tiene pantalla de perfil ni cerrar sesión en el lienzo; queda pendiente de decisión de diseño.
- [x] 7.3 Sobanderos: lista, Nuevo, Ficha, Duración y Horario
  - La clave temporal solo vive en el campo de «Nuevo sobandero»: se envía una vez y no pasa por la URL, el historial ni la respuesta.
  - Horario del sobandero reutiliza `ListaDias` y `FormularioDia` del panel (sin duplicar código).
  - Diferencia con el lienzo: en «Nuevo sobandero» la duración queda en 30 minutos (fila informativa); se cambia después en la ficha.
- [x] 7.4 Dar de baja (pantalla `Admin-Baja`: dejar o cancelar con aviso, con el número de clientes que recibirán WhatsApp)
- [x] 7.5 Datos del negocio y Registro de actividad (pantalla nueva `Admin-Actividad`, con «Ver más»; ambas se abren desde el Resumen)
- [x] 7.6 Resumen semanal (`GET /admin/reporte` y pantalla `Admin-Reporte`; solo la semana actual, como el lienzo)
- [x] 7.7 Recorrido en el navegador (390 px, API y base locales aparte, 39 comprobaciones): el administrador crea un sobandero con clave temporal; este entra, la cambia y no puede abrir `/admin`; baja con «cancelar y avisar» (2 citas canceladas, 2 avisos, sesiones cerradas, ya no ingresa) y baja con «dejarlas» (citas intactas, sin avisos, en baja); negocio, resumen semanal y actividad sin claves ni celulares.
  - Pendientes de decisión de diseño: el administrador no tiene perfil ni cerrar sesión; la Agenda solo muestra hoy; elegir la duración al crear un sobandero.
  - El cierre automático de la cuenta tras la última cita «dejada» está probado en pytest (`test_admin_baja.py`), no en el navegador.

## Fase 8 — WhatsApp y recordatorios
- [x] Proveedor falso y Cloud API, worker, disparadores y webhook
  - Hecho: `app/whatsapp/` (proveedores y catálogo de seis plantillas), `servicios/bandeja.py` y `app/worker.py`, webhook con firma, API de Admin-Mensajes y `mensajes_fallidos` en el Resumen, `docs/WHATSAPP.md`.
  - Pendiente de diseño: la pantalla `Admin-Mensajes` y el aviso de fallidos en la pantalla Resumen (no existen en `design/lienzo/`). La API ya está lista.
  - Pendiente de negocio: quitar o parametrizar «30 minutos» en `cita_confirmada`; enviar las seis plantillas a Meta y probar con un número real.
  - Nota de la Fase 3: `notificaciones.variables.token` guarda el token en claro (solo en `cita_confirmada` y `cita_cambiada`); el worker debe borrarlo al enviar.

## Fase 9 — PWA, sin conexión y accesibilidad
- [x] 9.1 Manifiesto e íconos
- [x] 9.2 Service worker que solo guarda la interfaz (nunca `/api`)
- [x] 9.3 Sin conexión de extremo a extremo
- [x] 9.4 Pantalla `/instalar` (iPhone y Android)
- [x] 9.5 «Reducir movimiento» y `axe` en todas las rutas
- [x] 9.6 Lighthouse y `docs/RENDIMIENTO.md`

## Fase 10 — Seguridad, datos y extremo a extremo
- [x] 10.1 Recorridos con Playwright a 390×844 (`make e2e`, base propia `sobanderia_e2e`): cliente agenda, reagenda y cancela; dos clientes pelean la misma hora; sobandero opera su día; admin crea y da de baja; recuperación de clave
  - Pasan 3 veces seguidas en local (cada una con la base reiniciada) y 15 de 15 con `E2E_REPETIR=3`. La CI tiene el trabajo `e2e` con tres corridas; su primera ejecución en GitHub está pendiente.
  - Las herramientas `herramientas/e2e_*.py` se niegan a correr si la base no termina en `_e2e`.
- [x] 10.2 Revisión de seguridad ruta por ruta: `docs/SEGURIDAD.md` (49 endpoints, comparada con el código por `test_seguridad_rutas.py`) y pruebas de acceso indebido (401, 403, 404, CSRF, enumeración, límites, CORS, cookies, webhook, registros)
  - Resultado: los controles de acceso funcionan; 9 hallazgos abiertos (H-01 a H-09), reportados sin arreglar. Ocho tienen prueba `xfail(strict=True)`.
- [ ] 10.2b Arreglar los hallazgos H-01 a H-09 según lo que decida el responsable (ver `docs/SEGURIDAD.md`)
- [x] 10.3 Ruta `/politica` con aviso visible «Texto pendiente de revisión legal» (versión `borrador-1`) y comando `python -m app.cli_datos exportar|anonimizar` (`docs/DATOS_PERSONALES.md`)
  - Anonimizar conserva las citas (decisión acordada). Además del cliente limpia el nombre y el token de `notificaciones.variables`, revoca los enlaces y borra los intentos de «Encontrar mi cita». Con citas futuras se detiene salvo `--cancelar-citas-futuras`, que cancela sin avisar.
  - Pendiente de negocio: el texto legal definitivo.
- [x] 10.4 Respaldo y restauración probados en una base vacía (`scripts/respaldo.sh`, `restaurar.sh`, `make probar-respaldo`, `docs/RESPALDO.md`)
  - Probado: 14 tablas idénticas fila por fila tras restaurar en una base vacía, `citas_sin_cruce` sigue rechazando cruces, retención de 14 días, y se niega a restaurar encima de una base con datos.
  - Pendiente (Fase 11): programar la rutina diaria, sacar las copias del servidor y probar una restauración con una copia real de producción.
- [x] 10.5 La app se niega a arrancar en producción con configuración de desarrollo (`app/config.py`; API, worker, alembic y seed)
  - Reglas en producción: base con credenciales de ejemplo o local, `ORIGEN_WEB` sin https o local, `PROVEEDOR_WHATSAPP=falso`, faltan las variables de WhatsApp, o correo que no es real. `ENTORNO` solo admite `desarrollo`, `pruebas` o `produccion`. Un servidor previo al lanzamiento también debe llamarse `produccion`.
  - También rechaza `ENTORNO=desarrollo` si `ORIGEN_WEB` es una dirección pública con https (caso de olvidar la variable). `cloudapi` en desarrollo sí se permite, para probar con el número de prueba de Meta.
  - **Consecuencia a tener presente:** mientras no exista un proveedor de correo real (H-01), ninguna configuración de producción arranca.
  - `SECRETO_APP` se quitó de `.env.example` (nada la usaba).

## Fase 11 — Despliegue, piloto y lanzamiento
- [ ] Infraestructura, despliegue automático, piloto y lanzamiento
