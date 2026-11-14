# Sobandería — Revisión de seguridad (Fase 10.2)

Revisión del 14 de noviembre de 2026 sobre la rama de trabajo, endpoint por endpoint. Cada fila de la tabla se comprueba contra el código: `tests/test_seguridad_rutas.py` falla si falta un endpoint, si sobra uno o si la columna «Quién» no coincide con las dependencias reales de la ruta.

Estado: **0 hallazgos abiertos.** Se encontraron 9 (2 altos, 3 medios, 4 bajos): 8 se arreglaron y cada arreglo tiene su prueba; el noveno (H-04) es una excepción aceptada y documentada. Quedan tareas de despliegue para la Fase 11 (ver el final).

## Cómo leer la tabla

- **Quién**: «Público» no pide nada; «Enlace de cita» exige el token de 256 bits de la URL; «Cualquier sesión» exige cookie válida; «Sobandero» y «Administrador» exigen además ese rol. Un administrador solo entra a `/yo/*` si tiene perfil de sobandero.
- **CSRF**: la ruta exige la cabecera `X-Sobanderia: 1` en POST, PUT, PATCH y DELETE (las lecturas no).
- **Pruebas**: `R` es `tests/test_seguridad_rutas.py`, que recorre las 49 rutas reales: sin sesión da 401, sin cabecera da 403, un rol equivocado da 403 y con clave temporal pendiente da 403. `A` es `tests/test_seguridad_abuso.py` y `L` es `tests/test_seguridad_limites.py` (topes, correo, IP real y limpieza). Una prueba nombrada es la específica de esa ruta.
- **Límite**: tope de intentos por correo, celular (guardado como hash), usuario o IP. Lo tienen el ingreso, recuperar clave, «Encontrar mi cita», reservar y la «clave actual» de los cambios de clave y correo. La IP es la real detrás del proxy cuando `PROXY_CONFIABLE` está configurado.

## Tabla de endpoints

| Endpoint | Quién | CSRF | Límite | Qué expone o protege | Pruebas |
| --- | --- | --- | --- | --- | --- |
| `GET /salud` | Público | — | — | Solo `{"estado":"ok"}`. | `A` cabeceras y CORS |
| `GET /publico/negocio` | Público | — | — | Nombre, dirección, teléfono y bienvenida del negocio (datos que ya son públicos). | `R` |
| `GET /publico/sobanderos` | Público | — | — | Nombre, duración y próximo cupo de quienes reciben citas. Sin correo ni identificador de usuario. | `A` sin celulares |
| `GET /publico/sobanderos/{sobandero_id}/dias` | Público | — | — | Días con horas libres. | `R` |
| `GET /publico/sobanderos/{sobandero_id}/horas` | Público | — | — | Horas libres de un día, calculadas por el servidor. | `A` |
| `POST /publico/citas` | Público | Sí | 20 reservas por IP por hora (429) y 2 citas agendadas por venir por celular (409 `limite_citas`) | Crea cliente y cita; la restricción de la base decide la hora (409 `hora_ocupada`). Exige aceptar el tratamiento de datos. Devuelve el token una sola vez. | `L` topes por celular y por IP; `A` |
| `POST /publico/mi-cita/enlace` | Público | Sí | 3 por celular (hash) por hora, 6 por día, y 20 por IP cada 15 min | Siempre 202 con el mismo cuerpo, exista o no la cita. **Rota el enlace vigente** (riesgo reducido, H-08). | `A` igualdad, límites, no guarda el celular; `L` tope diario |
| `GET /mi-cita/{token}` | Enlace de cita | — | — | La cita sin celular. 410 idéntico si el enlace no existe o venció. | `A` enlace inventado = vencido, sin celular |
| `POST /mi-cita/{token}/reprogramar` | Enlace de cita | Sí | — | Crea la nueva y libera la vieja en una transacción; solo citas agendadas y futuras. | `R` CSRF |
| `POST /mi-cita/{token}/cancelar` | Enlace de cita | Sí | — | Cancela y avisa al sobandero; 409 si ya no se puede. | `R` CSRF |
| `POST /auth/ingreso` | Público | Sí | 5 fallos por correo y 20 por IP cada 15 min (429 con `Retry-After`) | Mensaje único «Correo o clave incorrectos»; verifica contra un hash falso si el correo no existe. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` fuera de desarrollo. | `A` enumeración, límites, cookie |
| `POST /auth/salida` | Público | Sí | — | Borra la fila de sesión del token que traiga; el token robado deja de servir. | `A` `test_cerrar_sesion_borra_la_cookie_y_la_fila` |
| `GET /auth/yo` | Cualquier sesión (aun con clave temporal) | — | — | Nombre, rol y si debe cambiar la clave. | `R` |
| `POST /auth/cambiar-clave` | Cualquier sesión (aun con clave temporal) | Sí | 5 fallos de la clave actual por usuario cada 15 min (429), compartido con el perfil | Pide la clave actual; cierra las demás sesiones y avisa por correo. | `L` límite de la clave actual; `A` cierra las demás sesiones |
| `POST /auth/recuperar` | Público | Sí | 5 por correo y 20 por IP cada 15 min | Misma respuesta exista, esté inactivo o no exista el correo, y aunque el correo falle al enviarse. Enlace de un solo uso, vence en 2 h; fuera de desarrollo nunca queda en el registro. | `A` enumeración, límite, hash; `L` correo |
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
| `PATCH /yo/perfil` | Sobandero | Sí | Igual que `cambiar-clave` (la «clave actual» del cambio de correo) | Cambiar el correo pide la clave actual y avisa al correo anterior. | `R` CSRF; `L` límite |
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
| Claves con argon2id; tokens de sesión, cita y recuperación solo como hash (con la excepción aceptada H-04) | Cumple | `A` |
| CORS cerrado al dominio de la app, con cabecera propia permitida y sin comodines | Cumple | `A` |
| Cookie `HttpOnly`, `SameSite=Lax`, `Secure` fuera de desarrollo | Cumple | `A` |
| Errores de validación no devuelven lo que escribió la persona | Cumple | `A` |
| Registros sin celulares completos, sin tokens de cita ni de sesión, sin claves, y fuera de desarrollo sin el enlace de recuperación | Cumple | `A` |
| Cabeceras de seguridad de la API (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cache-Control: no-store`) | Cumple | `A` |
| Cabeceras y CSP de la web: una sola definición (`apps/web/cabeceras.ts`), aplicada en `vite preview`, copiada a `deploy/Caddyfile.cabeceras`; los recorridos de Playwright fallan ante cualquier violación de la CSP | Cumple | `src/cabeceras.test.ts` y Playwright |
| Documentación de la API (`/docs`, `/redoc`, `/openapi.json`) cerrada fuera de desarrollo y pruebas | Cumple | `A` |
| Límite por IP con la IP real detrás de un proxy de confianza; sin proxy configurado, `X-Forwarded-For` no se cree | Cumple | `L` |
| Filas vencidas (intentos, sesiones, enlaces, tokens de recuperación) se borran cada hora desde el worker | Cumple | `L` |
| La app no arranca en producción con configuración de desarrollo | Cumple | `test_config_produccion.py` |
| HTTPS obligatorio | Pendiente de despliegue (Fase 11) | — |

## Hallazgos resueltos

Los nueve se encontraron el 14 de noviembre de 2026. Cada uno se escribió primero como prueba `xfail(strict=True)` que fallaba; al arreglarlo, la prueba pasó a ser una prueba normal.

| # | Gravedad | Hallazgo | Qué se hizo | Prueba |
| --- | --- | --- | --- | --- |
| H-01 | Alto | El correo de recuperación nunca salía y su enlace quedaba en el registro | `CorreoSmtp` (cualquier proveedor SMTP, con TLS; un fallo no se propaga para no delatar qué cuentas existen). `CorreoFalso` solo escribe el cuerpo en desarrollo y pruebas. Producción exige `CORREO_PROVEEDOR=smtp` con `SMTP_HOST` y `CORREO_DESDE`. | `L` correo, `A` registro de producción, `test_config_produccion.py` |
| H-05 | Alto | Reservar no tenía límite | Máximo 2 citas agendadas por venir por celular (409 `limite_citas`; las canceladas, atendidas y pasadas no cuentan; el sobandero en el local no tiene tope) y 20 reservas por IP por hora (429). Ambos en variables de entorno. | `L` topes |
| H-02 | Medio | Faltaban las cabeceras de seguridad | Middleware en la API y una definición única para la web, con CSP sin scripts en línea. | `A`, `src/cabeceras.test.ts`, Playwright |
| H-07 | Medio | El límite por IP usaba la IP del proxy | `PROXY_CONFIABLE` (IPs o redes): solo entonces se lee `X-Forwarded-For`, de derecha a izquierda, y se toma la primera IP que no es del proxy. | `L` IP, `A` proxy |
| H-03 | Medio | `/docs`, `/redoc` y `/openapi.json` abiertos | `crear_app(entorno)` los apaga fuera de desarrollo y pruebas; el contrato sigue saliendo de `python -m app.openapi`. | `A` documentación |
| H-06 | Bajo | La «clave actual» no tenía límite | 5 fallos por usuario cada 15 minutos, compartidos entre cambiar clave y cambiar correo; acertar borra los fallos. | `L` clave actual |
| H-08 | Bajo | «Encontrar mi cita» invalidaba el enlace del cliente | **Riesgo reducido, no eliminado**: rotar el enlace es lo que permite reenviarlo con solo el hash guardado. El tope bajó a 3 por celular por hora y 6 por día. | `A` rota y limita, `L` tope diario |
| H-09 | Bajo | Había tablas que solo crecían | `mantenimiento.purgar` y el worker la corren cada hora: intentos de más de 48 h, sesiones, tokens de recuperación y enlaces vencidos. | `L` limpieza |
| H-04 | Bajo | El token de la cita queda en claro en `notificaciones.variables` hasta el envío | **Excepción aceptada** (decisión de la persona responsable del proyecto, anotada en `CLAUDE.md`): el mensaje de WhatsApp necesita el enlace completo. El worker lo borra al enviar, al fallar y al cancelar, y no aparece en ninguna otra tabla. | `A` `test_el_token_de_la_cita_solo_esta_en_claro_en_la_bandeja`, `test_bandeja.py` |

## Riesgos aceptados

- **Bloqueo de cuenta por intentos fallidos.** Quien conozca un correo puede bloquear su ingreso 15 minutos con 5 intentos. Es el costo habitual del límite por correo. El límite por IP y el mensaje único acotan el daño.
- **H-04, el token en claro en la bandeja** (ver arriba): decidido, con la ventana acotada a los reintentos del worker.
- **H-08, el enlace se rota al pedirlo:** un tercero que conozca el celular puede invalidarlo hasta 3 veces por hora. El cliente recibe uno nuevo por WhatsApp.
- **El token de la cita va en la URL de «Confirmada» y de «Mi cita».** Es lo que promete el diseño («enlace firmado»). Dura hasta el día siguiente a la cita y el celular nunca aparece en la URL.

## Para la Fase 11 (despliegue)

Lo que ya está en el código y solo falta configurar o instalar donde se despliegue:

- **Correo:** `CORREO_PROVEEDOR=smtp`, `SMTP_HOST`, `SMTP_PUERTO`, `SMTP_USUARIO`, `SMTP_CLAVE`, `CORREO_DESDE`. Probar un envío real a un buzón propio antes del piloto (no se puede hacer desde el repositorio). Sin esto la app no arranca.
- **IP real:** `PROXY_CONFIABLE` con la dirección o red del proxy (Caddy o el ingreso de Azure). Sin ella, todos los clientes compartirían el límite por IP.
- **Web:** `import cabeceras_web` con `deploy/Caddyfile.cabeceras` (incluye HSTS), o las mismas cabeceras en el hosting elegido. HTTPS obligatorio.
- **Topes:** `CITAS_MAX_POR_CELULAR`, `RESERVAS_MAX_IP`, `ENLACE_MAX_HORA` y `ENLACE_MAX_DIA` tienen valores por defecto razonables; ajustar con el piloto. Un local con Wi-Fi compartido hace que muchos clientes salgan con la misma IP: si el límite por IP estorba, subir `RESERVAS_MAX_IP`.
- Copias de seguridad programadas y fuera del servidor (`docs/RESPALDO.md`) y alertas.
