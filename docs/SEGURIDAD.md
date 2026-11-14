# Sobandería — Revisión de seguridad (Fase 10.2)

Revisión del 14 de noviembre de 2026 sobre la rama de trabajo, endpoint por endpoint. Cada fila de la tabla se comprueba contra el código: `tests/test_seguridad_rutas.py` falla si falta un endpoint, si sobra uno o si la columna «Quién» no coincide con las dependencias reales de la ruta.

Estado: **9 hallazgos abiertos** (H-01 con una mitigación parcial desde 10.5) (2 altos, 3 medios, 4 bajos). Se reportan sin arreglar, a la espera de su decisión. Ocho tienen una prueba `xfail(strict=True)` que hoy falla y pasará sola cuando se corrija (al pasar, `strict` avisa y se quita la marca). H-09 no la tiene porque aún no existe la función de limpieza que probar.

## Cómo leer la tabla

- **Quién**: «Público» no pide nada; «Enlace de cita» exige el token de 256 bits de la URL; «Cualquier sesión» exige cookie válida; «Sobandero» y «Administrador» exigen además ese rol. Un administrador solo entra a `/yo/*` si tiene perfil de sobandero.
- **CSRF**: la ruta exige la cabecera `X-Sobanderia: 1` en POST, PUT, PATCH y DELETE (las lecturas no).
- **Pruebas**: `R` es `tests/test_seguridad_rutas.py`, que recorre las 49 rutas reales: sin sesión da 401, sin cabecera da 403, un rol equivocado da 403 y con clave temporal pendiente da 403. `A` es `tests/test_seguridad_abuso.py`. Una prueba nombrada es la específica de esa ruta.
- **Límite**: tope de intentos por correo, celular (guardado como hash) o IP. Hoy solo ingreso, recuperar clave y «Encontrar mi cita» lo tienen.

## Tabla de endpoints

| Endpoint | Quién | CSRF | Límite | Qué expone o protege | Pruebas |
| --- | --- | --- | --- | --- | --- |
| `GET /salud` | Público | — | — | Solo `{"estado":"ok"}`. | `A` (CORS, cabeceras: H-02) |
| `GET /publico/negocio` | Público | — | — | Nombre, dirección, teléfono y bienvenida del negocio (datos que ya son públicos). | `R` |
| `GET /publico/sobanderos` | Público | — | — | Nombre, duración y próximo cupo de quienes reciben citas. Sin correo ni identificador de usuario. | `A` sin celulares |
| `GET /publico/sobanderos/{sobandero_id}/dias` | Público | — | — | Días con horas libres. | `R` |
| `GET /publico/sobanderos/{sobandero_id}/horas` | Público | — | — | Horas libres de un día, calculadas por el servidor. | `A` |
| `POST /publico/citas` | Público | Sí | **Ninguno (H-05)** | Crea cliente y cita; la restricción de la base decide la hora (409 `hora_ocupada`). Exige aceptar el tratamiento de datos. Devuelve el token una sola vez. | `A` `test_un_mismo_celular_no_puede_reservar_sin_limite` (xfail) |
| `POST /publico/mi-cita/enlace` | Público | Sí | 5 por celular (hash) y 20 por IP cada 15 min | Siempre 202 con el mismo cuerpo, exista o no la cita. **Rota el enlace vigente (H-08).** | `A` igualdad, límite, no guarda el celular |
| `GET /mi-cita/{token}` | Enlace de cita | — | — | La cita sin celular. 410 idéntico si el enlace no existe o venció. | `A` enlace inventado = vencido, sin celular |
| `POST /mi-cita/{token}/reprogramar` | Enlace de cita | Sí | — | Crea la nueva y libera la vieja en una transacción; solo citas agendadas y futuras. | `R` CSRF |
| `POST /mi-cita/{token}/cancelar` | Enlace de cita | Sí | — | Cancela y avisa al sobandero; 409 si ya no se puede. | `R` CSRF |
| `POST /auth/ingreso` | Público | Sí | 5 fallos por correo y 20 por IP cada 15 min (429 con `Retry-After`) | Mensaje único «Correo o clave incorrectos»; verifica contra un hash falso si el correo no existe. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` fuera de desarrollo. | `A` enumeración, límites, cookie |
| `POST /auth/salida` | Público | Sí | — | Borra la fila de sesión del token que traiga; el token robado deja de servir. | `A` `test_cerrar_sesion_borra_la_cookie_y_la_fila` |
| `GET /auth/yo` | Cualquier sesión (aun con clave temporal) | — | — | Nombre, rol y si debe cambiar la clave. | `R` |
| `POST /auth/cambiar-clave` | Cualquier sesión (aun con clave temporal) | Sí | **Ninguno (H-06)** | Pide la clave actual; cierra las demás sesiones y avisa por correo. | `A` `test_cambiar_la_clave_cierra_las_demas_sesiones` |
| `POST /auth/recuperar` | Público | Sí | 5 por correo y 20 por IP cada 15 min | Misma respuesta exista, esté inactivo o no exista el correo. Enlace de un solo uso, vence en 2 h. **El enlace queda en el registro (H-01).** | `A` enumeración, límite, hash |
| `POST /auth/restablecer` | Público | Sí | Token de 256 bits | Gasta el token en una sola sentencia; cierra todas las sesiones; avisa por correo. | `A` hash; e2e `recuperacion.spec.ts` |
| `GET /yo/citas` | Sobandero | — | — | Solo sus citas (`Cita.sobandero_id = yo`). | `A`/`R` `test_dos_sobanderos_con_sesion_abierta_a_la_vez_no_se_mezclan` |
| `POST /yo/citas` | Sobandero | Sí | — | Cita manual en su propia agenda. | `R` CSRF |
| `GET /yo/citas/{cita_id}` | Sobandero | — | — | Una cita propia; la ajena responde 404 igual que la inexistente. | `R` `test_un_sobandero_no_lee_ni_cambia_citas_de_otro` |
| `PATCH /yo/citas/{cita_id}` | Sobandero | Sí | — | Atendida, no asistió, cambiar hora o cancelar, solo en citas propias (404 si no). | `R` mismo |
| `GET /yo/clientes` | Sobandero | — | — | Solo clientes que han tenido citas con quien consulta. | `R` `test_un_sobandero_no_ve_la_ficha_de_un_cliente_de_otro` |
| `GET /yo/clientes/{cliente_id}` | Sobandero | — | — | Ficha e historial con él; sin citas propias con ese cliente responde 404. | `R` mismo |
| `GET /yo/bloqueos` | Sobandero | — | — | Solo sus bloqueos. | `R` `test_un_sobandero_no_quita_bloqueos_de_otro` |
| `POST /yo/bloqueos` | Sobandero | Sí | — | Bloquea su propia agenda; no cancela citas ya agendadas. | `R` CSRF |
| `DELETE /yo/bloqueos/{bloqueo_id}` | Sobandero | Sí | — | Solo bloqueos propios (404 si no). | `R` mismo |
| `GET /yo/dias` | Sobandero | — | — | Sus días con horas libres. | `R` |
| `GET /yo/horas` | Sobandero | — | — | Sus horas libres. | `R` |
| `GET /yo/horario` | Sobandero | — | — | Su horario semanal. | `R` |
| `PUT /yo/horario` | Sobandero | Sí | — | Cambia su propio horario. | `R` CSRF |
| `GET /yo/perfil` | Sobandero | — | — | Su nombre, correo y duración. | `R` |
| `PATCH /yo/perfil` | Sobandero | Sí | **Ninguno (H-06)** | Cambiar el correo pide la clave actual y avisa al correo anterior. | `R` CSRF |
| `GET /admin/resumen` | Administrador | — | — | Totales del día y mensajes fallidos. | `R` |
| `GET /admin/agenda` | Administrador | — | — | Citas del día de todos, sin celulares y sin canceladas. | `R` |
| `GET /admin/reporte` | Administrador | — | — | Resumen semanal con cifras. | `R` |
| `GET /admin/actividad` | Administrador | — | — | Registro de actividad; el detalle nunca lleva celulares ni claves. | `R` |
| `GET /admin/mensajes` | Administrador | — | — | Estado de los mensajes de WhatsApp con el celular enmascarado (`300 *** 4567`). | `R` |
| `POST /admin/mensajes/{mensaje_id}/reenviar` | Administrador | Sí | — | Solo mensajes fallidos (409 si no). | `R` CSRF |
| `GET /admin/negocio` | Administrador | — | — | Datos del negocio. | `R` |
| `PUT /admin/negocio` | Administrador | Sí | — | Cambia los datos del negocio y deja registro. | `R` CSRF |
| `GET /admin/sobanderos` | Administrador | — | — | Lista de sobanderos con citas próximas. | `R` |
| `POST /admin/sobanderos` | Administrador | Sí | — | Crea la cuenta con clave temporal (mínimo 8) que no se devuelve y obliga a cambiarla. | `R` CSRF; e2e `admin.spec.ts` |
| `GET /admin/sobanderos/{sobandero_id}` | Administrador | — | — | Ficha del sobandero. | `R` |
| `PATCH /admin/sobanderos/{sobandero_id}` | Administrador | Sí | — | Nombre, correo, recibe citas y duración; el correo anterior recibe aviso. | `R` CSRF |
| `POST /admin/sobanderos/{sobandero_id}/baja` | Administrador | Sí | — | Dejar o cancelar con aviso; cierra sesiones al cancelar; conserva el historial. | `R` CSRF; e2e `admin.spec.ts` |
| `POST /admin/sobanderos/{sobandero_id}/enlace-clave` | Administrador | Sí | — | Envía el enlace de un solo uso al correo del sobandero, nunca al administrador. | `R` CSRF |
| `GET /admin/sobanderos/{sobandero_id}/horario` | Administrador | — | — | Horario del sobandero. | `R` |
| `PUT /admin/sobanderos/{sobandero_id}/horario` | Administrador | Sí | — | Reemplaza franjas; no toca citas agendadas. | `R` CSRF |
| `GET /webhooks/whatsapp` | Meta (token de verificación) | — | — | Responde el reto solo con `hub.verify_token` correcto, comparado en tiempo constante. Oculto del OpenAPI. | `A` `test_la_verificacion_del_webhook_exige_el_token_correcto` |
| `POST /webhooks/whatsapp` | Meta (firma HMAC-SHA256) | No aplica (no usa cookie) | — | Rechaza sin firma, con firma mala, con cuerpo alterado y sin secreto configurado. | `A` `test_el_webhook_rechaza_sin_firma_con_firma_mala_y_sin_secreto` |

## Controles transversales verificados

| Control | Resultado | Prueba |
| --- | --- | --- |
| Sin sesión, 401 en las 33 rutas que piden sesión (y con cookie inventada) | Cumple | `R` |
| CSRF: las 22 escrituras con cookie o públicas exigen `X-Sobanderia: 1`; la única excepción de las 23 escrituras es el webhook firmado | Cumple | `R` |
| Rol verificado en el servidor: un sobandero en `/admin/*` da 403; un administrador sin perfil en `/yo/*` da 403 | Cumple | `R` |
| Clave temporal pendiente: todo da 403 `debe_cambiar_clave` salvo `/auth/yo` y `/auth/cambiar-clave` | Cumple | `R` |
| Cuenta dada de baja: la sesión muere al instante | Cumple | `R`; e2e `admin.spec.ts` |
| Un sobandero no lee ni cambia citas, clientes o bloqueos de otro por el identificador (404 igual que inexistente) | Cumple | `R` |
| Enumeración: ingreso, recuperar, «Encontrar mi cita» y enlace inventado/vencido responden igual | Cumple | `A` |
| Límite de intentos en ingreso, recuperar y «Encontrar mi cita» | Cumple | `A` |
| Claves con argon2id; tokens de sesión, cita y recuperación solo como hash (con la excepción H-04) | Cumple | `A` |
| CORS cerrado al dominio de la app, con cabecera propia permitida y sin comodines | Cumple | `A` |
| Cookie `HttpOnly`, `SameSite=Lax`, `Secure` fuera de desarrollo | Cumple | `A` |
| Errores de validación no devuelven lo que escribió la persona | Cumple | `A` |
| Registros sin celulares completos, sin tokens de cita ni de sesión, sin claves | Cumple (salvo H-01) | `A` |
| Cabeceras de seguridad (CSP, `X-Content-Type-Options`, `Referrer-Policy`) | **No cumple (H-02)** | `A` xfail |
| HTTPS obligatorio | Pendiente de despliegue (Fase 11) | — |

## Hallazgos abiertos

Ordenados por gravedad. «Decisión» es lo que necesito de usted antes de arreglarlo.

### H-01 · Alto · El correo de recuperación nunca sale y su enlace queda en el registro

`obtener_enviador()` siempre devuelve `CorreoFalso`, la única implementación: escribe el cuerpo completo (con el enlace de restablecer) en el registro.
- **Efecto en producción**: la recuperación de clave no funciona (no llega ningún correo) y quien lea los registros puede tomar cualquier cuenta, incluida la del administrador: pide la recuperación de su correo, que es público, y copia el enlace del registro.
- **Evidencia**: `test_el_registro_no_trae_el_enlace_de_recuperacion` (xfail). Con el registro capturado aparece `.../restablecer/kFU-...`.
- **Propuesta**: (1) una implementación real de `EnviadorCorreo` (SMTP o el servicio del hosting), elegida por variable de entorno; (2) `CorreoFalso` solo escribe el cuerpo si `ENTORNO` es `desarrollo` o `pruebas`; (3) el paso 10.5 hace que la app no arranque en producción con el correo falso.
- **Mitigación ya hecha (10.5)**: la app no arranca en producción con `CORREO_PROVEEDOR=falso`, así que el enlace nunca llega a un registro de producción. A cambio, **hoy ninguna configuración de producción es válida**: no puede desplegarse hasta que exista un proveedor real (`PROVEEDORES_CORREO_REALES` en `app/config.py`). La prueba `xfail` sigue abierta porque el comportamiento de `CorreoFalso` no cambió.
- **Decisión**: ¿qué proveedor de correo? Sin él, en producción solo queda el enlace manual del administrador (`enlace-clave`), que tampoco se puede entregar. Hasta decidirlo propongo hacer solo (2) y (3).

### H-05 · Alto · Reservar no tiene límite ni prueba de que el celular es de quien reserva

`POST /publico/citas` acepta cualquier celular sin tope por celular ni por IP, y cada cita envía un WhatsApp de confirmación a ese número.
- **Efecto**: alguien puede llenar la agenda de un sobandero con nombres falsos, o hacer que el número del negocio escriba a terceros (costo por conversación y riesgo de que Meta bloquee el número por spam).
- **Evidencia**: `test_un_mismo_celular_no_puede_reservar_sin_limite` (xfail): 16 reservas seguidas con el mismo celular, todas aceptadas.
- **Propuesta**: (a) tope de citas agendadas a la vez por celular y (b) límite de reservas por IP por hora, reutilizando la tabla `intentos_ingreso` con tipo `reservar`.
- **Decisión de negocio**: ¿cuántas citas agendadas a la vez puede tener un mismo celular? Propongo 2 (una persona que viene con un familiar). Probar la posesión del número (que el cliente confirme desde el WhatsApp) cambia el flujo del diseño: no lo hago sin su visto bueno.

### H-02 · Medio · Faltan las cabeceras de seguridad y el `Cache-Control`

La arquitectura promete CSP, `X-Content-Type-Options` y `Referrer-Policy`; ni la API ni la web las envían, y las respuestas con sesión no llevan `Cache-Control: no-store`.
- **Evidencia**: `test_la_api_envia_cabeceras_de_seguridad` y `test_las_respuestas_con_sesion_no_se_guardan_en_cache` (xfail): las cabeceras de `/salud` son solo `content-length`, `content-type` y `vary`.
- **Propuesta**: un middleware en la API con `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` y `Cache-Control: no-store` en toda respuesta con sesión o con enlace de cita. Para la web (CSP estricta con `default-src 'self'`, HSTS) no hay servidor todavía: queda como lista de comprobación de la Fase 11.

### H-07 · Medio · El límite por IP usa la IP del proxy (se rompe al desplegar)

`_ip()` toma `request.client.host`. Detrás de Caddy o del ingreso de Azure todas las peticiones parecen venir de una misma IP.
- **Efecto**: 20 fallos de una persona bloquean el ingreso de todos durante 15 minutos (y el límite por IP deja de proteger).
- **Evidencia**: `test_el_limite_por_ip_distingue_a_clientes_detras_de_un_proxy` (xfail).
- **Propuesta**: leer `X-Forwarded-For` solo si la petición viene de un proxy de confianza, configurado con una variable de entorno (`PROXY_CONFIABLE`). Depende del hosting elegido, así que lo dejo para la Fase 11 salvo que prefiera hacerlo ahora.

### H-03 · Medio · `/docs`, `/redoc` y `/openapi.json` quedan abiertos en producción

- **Evidencia**: `test_la_documentacion_de_la_api_se_cierra_en_produccion` (xfail): con `ENTORNO=produccion`, `/docs` responde 200.
- **Propuesta**: apagarlos cuando `ENTORNO` no sea `desarrollo` ni `pruebas`. El cliente de la web se genera con `python -m app.openapi`, no por HTTP, así que no se afecta.

### H-04 · Bajo · El token de la cita queda en claro en `notificaciones.variables` hasta el envío

El mensaje de WhatsApp necesita el enlace completo, así que el token se guarda en claro en la bandeja hasta que el worker envía (o falla, o se cancela). Ahí se borra. La ventana máxima es la de los reintentos (1, 5 y 30 minutos).
- **Evidencia**: `test_el_token_de_la_cita_no_queda_en_claro_en_ninguna_tabla` (xfail). Es la única tabla donde aparece.
- **Esto contradice la regla de `CLAUDE.md`** «tokens solo como hash»: la decisión es suya, no la tomo yo.
- **Opciones**: (a) aceptarlo como excepción documentada, porque quien lea la base ya tiene los hashes y solo ganaría acceso a una cita; es mi recomendación; (b) cifrar el valor con una clave de la app (hoy `SECRETO_APP` solo aparece en `.env.example` y el código no la usa), con más piezas y más cosas que pueden fallar.

### H-06 · Bajo · Cambiar clave y correo no limitan los intentos de la «clave actual»

Con una sesión robada se puede adivinar la clave actual sin tope.
- **Evidencia**: `test_cambiar_clave_limita_los_intentos_de_la_clave_actual` (xfail): 8 intentos fallidos seguidos, todos 401.
- **Propuesta**: reutilizar `verificar_no_bloqueado` con tipo `cambiar_clave` por usuario.

### H-08 · Bajo · Pedir «Encontrar mi cita» con solo el celular invalida el enlace del cliente

Para poder reenviar el enlace con solo el hash guardado, el servidor lo rota. Quien conozca un celular puede dejar sin efecto el enlace que esa persona ya tenía (le llega uno nuevo por WhatsApp) y repetirlo hasta el límite (5 por 15 minutos, o 20 por hora).
- **Evidencia**: `test_un_tercero_no_puede_invalidar_el_enlace_de_un_cliente` (xfail).
- **Opciones**: (a) bajar el límite por celular a 3 por hora y 6 por día (mi recomendación: simple y limita la molestia); (b) enviar un código aparte en vez de rotar el enlace, que cambia el diseño.

### H-09 · Bajo · Hay tablas que solo crecen

`intentos_ingreso` solo se limpia cuando alguien ingresa bien (y solo sus filas); cada recuperación y cada «Encontrar mi cita» deja una fila más, y las sesiones, enlaces y tokens vencidos tampoco se purgan. No es una vulnerabilidad: es crecimiento sin tope bajo abuso.
- **Propuesta**: que el worker borre cada hora las filas vencidas (intentos de más de 24 h, sesiones, tokens de recuperación y enlaces vencidos).

## Riesgos aceptados (sin arreglo propuesto)

- **Bloqueo de cuenta por intentos fallidos.** Quien conozca un correo puede bloquear su ingreso 15 minutos con 5 intentos. Es el costo habitual del límite por correo. El límite por IP y el mensaje único acotan el daño.
- **El token de la cita va en la URL de «Confirmada» y de «Mi cita».** Es lo que promete el diseño («enlace firmado»). Dura hasta el día siguiente a la cita y el celular nunca aparece en la URL.

## Para la Fase 11 (despliegue)

HTTPS y HSTS; CSP y cabeceras de la web; IP real detrás del proxy (H-07); proveedor de correo (H-01); copias de seguridad (10.4) y alertas.
