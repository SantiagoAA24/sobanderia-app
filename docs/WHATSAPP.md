# WhatsApp: plantillas, webhook y puesta en marcha

Guía para registrar las plantillas en Meta y conectar la app a la WhatsApp Cloud API. Los textos salen de `docs/GUIA.md`; aquí están **numerados como Meta los exige** y con los ejemplos que pide la revisión.

## Cómo funciona

1. Cada cambio de una cita escribe una fila en `notificaciones` dentro de la misma transacción.
2. El worker (`python -m app.worker`) toma una fila a la vez con `FOR UPDATE SKIP LOCKED`, así que se pueden correr varios workers sin que un mensaje salga dos veces.
3. Si Meta falla (red, error 5xx o límite 429), la fila se reintenta a los 1, 5 y 30 minutos. Al cuarto fallo queda `fallida`. Un rechazo de Meta (error 4xx) queda `fallida` de inmediato.
4. El administrador ve las fallidas en **Mensajes** (`GET /admin/mensajes?estado=fallida`) y las reenvía (`POST /admin/mensajes/{id}/reenviar`). El número de fallidas viene en `GET /admin/resumen` como `mensajes_fallidos`.
5. Meta responde por el webhook `/webhooks/whatsapp`: estados de entrega (`delivered`, `read`, `failed`) y respuestas de los clientes.

Con `PROVEEDOR_WHATSAPP=falso` (el valor por defecto) nada sale a internet: cada mensaje se escribe en el registro del worker con el celular enmascarado (`300 *** 4567`) y sin el código del enlace.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `PROVEEDOR_WHATSAPP` | `falso` (desarrollo y pruebas) o `cloudapi` (envío real) |
| `WHATSAPP_TOKEN` | Token de acceso permanente de un usuario del sistema de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Id del número de WhatsApp Business (no es el número) |
| `WHATSAPP_APP_SECRET` | Secreto de la app de Meta; firma el webhook. Sin él, el webhook rechaza todo |
| `WHATSAPP_VERIFY_TOKEN` | Texto que usted inventa y escribe también en Meta al registrar el webhook |
| `WHATSAPP_VERSION_API` | Versión de la Graph API (por defecto `v21.0`) |
| `ORIGEN_WEB` | Dirección pública de la app, sin barra final (por ejemplo `https://citas.ejemplo.co`); se usa en las respuestas del webhook |

Ninguno va al repositorio: solo `.env` (fuera de git) o los secretos del servidor.

## Las seis plantillas

Todas con **categoría Utilidad**, **idioma Español (`es`)** y sin emojis. Meta exige variables consecutivas (`{{1}}`, `{{2}}`…), por eso `cita_cancelada` y `enlace_cita` no usan la misma numeración que las demás. El orden en que la app envía las variables es exactamente el de cada tabla.

Los ejemplos de variables son los que se pegan en el formulario de Meta. `<dominio>` es el de la app. En todos los botones de enlace, Meta pide una URL de ejemplo.

### 1. `cita_confirmada`

Cuándo: al terminar el Paso 4 y al guardar una cita manual.

```text
Hola, {{1}}. Su cita quedó agendada.

{{3}} a las {{4}}
Con {{2}} · 30 minutos

Si no puede asistir, avísenos con tiempo.
```

| Variable | Contenido | Ejemplo |
| --- | --- | --- |
| `{{1}}` | Nombre del cliente | Ana María |
| `{{2}}` | Sobandero | Carlos |
| `{{3}}` | Día | viernes 13 de noviembre |
| `{{4}}` | Hora | 10:30 a. m. |

Botón: **URL dinámica**, texto «Gestionar mi cita», URL `https://<dominio>/mi-cita/{{1}}`, ejemplo del botón `abc123`.

### 2. `recordatorio_cita`

Cuándo: el día anterior a las 6:00 p. m. (hora de Bogotá). Se cancela si la cita cambia o se cancela.

```text
Hola, {{1}}. Le recordamos su cita de mañana.

{{3}} a las {{4}}
Con {{2}}

¿Podrá asistir?
```

Variables: las mismas cuatro, con la misma numeración que `cita_confirmada`.

Botones: **respuesta rápida** «Sí, asistiré» y **respuesta rápida** «Necesito cambiarla». La app manda en cada botón un valor (`asistire:<id>` y `cambiar:<id>`) que vuelve en el webhook.

### 3. `cita_cambiada`

Cuándo: el cliente o el sobandero cambian la hora (el sobandero, solo si marca avisar).

```text
Hola, {{1}}. Su cita se cambió.

Nueva hora: {{3}} a las {{4}}
Con {{2}}
```

Variables: las mismas cuatro. Botón: URL dinámica «Gestionar mi cita», igual que `cita_confirmada`.

### 4. `cita_cancelada`

Cuándo: el cliente cancela su cita (confirma que se anuló).

```text
Hola, {{1}}. Su cita del {{2}} a las {{3}} fue cancelada.

Cuando quiera, puede agendar otra.
```

| Variable | Contenido | Ejemplo |
| --- | --- | --- |
| `{{1}}` | Nombre del cliente | Ana María |
| `{{2}}` | Día | viernes 13 de noviembre |
| `{{3}}` | Hora | 10:30 a. m. |

Botón: **URL estática**, texto «Agendar otra cita», URL `https://<dominio>/agendar`.

### 5. `cita_cancelada_sobandero`

Cuándo: el sobandero cancela una cita, o el administrador lo da de baja cancelando sus citas.

```text
Hola, {{1}}. {{2}} no podrá atenderle el {{3}} a las {{4}}. Lamentamos el inconveniente.

Puede elegir otra hora cuando quiera.
```

| Variable | Contenido | Ejemplo |
| --- | --- | --- |
| `{{1}}` | Nombre del cliente | Ana María |
| `{{2}}` | Sobandero | Carlos |
| `{{3}}` | Día | viernes 13 de noviembre |
| `{{4}}` | Hora | 10:30 a. m. |

Botón: **URL estática**, texto «Elegir otra hora», URL `https://<dominio>/agendar`.

### 6. `enlace_cita`

Cuándo: el cliente pide su enlace en «Encontrar mi cita». Es nueva: reutilizar `cita_confirmada` decía «quedó agendada» en un reenvío.

```text
Hola, {{1}}. Aquí está el enlace para gestionar su cita del {{2}} a las {{3}}.
```

| Variable | Contenido | Ejemplo |
| --- | --- | --- |
| `{{1}}` | Nombre del cliente | Ana María |
| `{{2}}` | Día | viernes 13 de noviembre |
| `{{3}}` | Hora | 10:30 a. m. |

Botón: URL dinámica «Gestionar mi cita», igual que `cita_confirmada`.

### Reglas de Meta que ya se cumplen

- El cuerpo no empieza ni termina con una variable.
- Una plantilla lleva botones de respuesta rápida **o** de enlace, no ambos.
- El texto de cada botón tiene menos de 25 caracteres.
- Las variables no llevan saltos de línea.

### Aviso sobre «30 minutos»

El cuerpo de `cita_confirmada` dice «30 minutos» fijo, pero cada sobandero puede tener 20, 30, 45 o 60. Antes de enviarla a Meta hay que decidir si se quita esa frase o si pasa a ser una variable más (`{{5}}`). No se cambió el texto aprobado en `docs/GUIA.md`.

## Respuestas dentro de la ventana de 24 horas

Cuando el cliente toca un botón o escribe, se abre una ventana de 24 horas en la que la app responde con texto libre (sin plantilla):

| Si el cliente | La app responde |
| --- | --- |
| Toca «Sí, asistiré» | Gracias, {nombre}. Lo esperamos. |
| Toca «Necesito cambiarla» | Con gusto. Elija otro día u hora aquí: {enlace nuevo de la cita} |
| Escribe cualquier otro texto | Gracias por escribirnos. Para cambiar o cancelar su cita, entre aquí: {enlace}. Si prefiere, llámenos. |

Cada vez que se entrega un enlace se crea uno nuevo y el anterior deja de servir (un solo enlace por cita; en la base solo queda su hash). Quien no tiene una cita próxima recibe la dirección de la app en vez del enlace. Una respuesta solo se atiende si el número que escribe es el del cliente de esa cita. «Sí, asistiré» hoy solo agradece: no cambia el estado de la cita.

## Registrar el webhook en Meta

1. En la app de Meta, producto **WhatsApp > Configuración > Webhook**.
2. URL de devolución de llamada: `https://<dominio-de-la-api>/webhooks/whatsapp`.
3. Token de verificación: el mismo valor de `WHATSAPP_VERIFY_TOKEN`.
4. Suscribirse al campo **messages** (incluye los estados de entrega y las respuestas).
5. El **secreto de la app** (Configuración de la app > Básica) va en `WHATSAPP_APP_SECRET`. Cada llamada de Meta trae `X-Hub-Signature-256`; sin firma válida la API responde 403.

## Lista para salir

1. Verificar el negocio en Meta y registrar el número de WhatsApp Business.
2. Enviar las seis plantillas a revisión (la aprobación tarda; es lo primero).
3. Crear un usuario del sistema con token permanente y cargar las variables de entorno.
4. Registrar el webhook y confirmar que Meta lo verifica.
5. Con `PROVEEDOR_WHATSAPP=cloudapi` y un número de prueba, recorrer el ciclo: agendar, reprogramar, esperar el recordatorio, cancelar, pedir el enlace y tocar los botones.
6. Dejar un worker corriendo (`python -m app.worker`) y una alerta si deja de enviar o si hay mensajes `fallida`.
