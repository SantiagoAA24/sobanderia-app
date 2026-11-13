# Sobandería — Guía de pantallas, componentes y mensajes

Nov 12, 2026 · @Santiago Acevedo

## Resumen

La app deja que el cliente agende en cuatro pasos desde el celular, sin crear cuenta, y le da a cada sobandero un panel para ver su día, su semana y su horario. Hay 53 pantallas diseñadas, todas con un mismo sistema de diseño (dirección A, «Cálido y cercano»: fondo crema, un solo acento terracota, Fraunces para títulos y Nunito Sans para texto).

Principios que el código debe respetar:

- Un solo momento terracota por pantalla: la siguiente cita en el panel del sobandero, la tarjeta de confirmación en el flujo del cliente.
- Botones y filas tocables de al menos 48 px; texto con contraste mínimo 4.5:1; foco visible de 3 px.
- Trato de «usted», frases cortas y una sola acción principal por pantalla.
- Sin sombras, degradados ni emojis. El valor de la consulta no aparece en la app.
- Cada campo lleva etiqueta visible; los errores dicen qué hacer, no solo qué falló.

Diseño navegable: [Flujo del cliente y panel del sobandero](https://claude.ai/artifact/AK4w4gDChXPVKXHMFsdVWM) · Componentes y tokens: [Sistema de diseño](https://claude.ai/artifact/PkCyCWcNPfTt2fSnNFZgvK).

## Pantallas

Son 53 pantallas de 390 × 844 px en once grupos. Los nombres de archivo son los del lienzo.

### Cliente: agendar (5)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Paso 1 · Elegir sobandero (`Main`) | Elegir con quién, o el «primer turno disponible» | Paso 2 |
| Paso 2 · Elegir día (`Paso2-Dia`) | Un día con cupos; los días sin cupos salen apagados | Paso 3, Paso 1 |
| Paso 3 · Elegir hora (`Paso3-Hora`) | Cuadrícula de horas libres, mañana y tarde | Paso 4, Paso 2 |
| Paso 4 · Sus datos (`Paso4-Datos`) | Resumen, nombre, celular y consentimiento de datos | Cita confirmada, Paso 3 |
| Cita confirmada (`Confirmada`) | Hora grande en terracota y aviso de WhatsApp | Gestionar mi cita |

### Cliente: cuando algo no sale como se espera (5)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Paso 4 con errores (`Paso4-Errores`) | Celular incompleto y política sin aceptar | Cita confirmada |
| Paso 3 sin horas libres (`Sin-horas`) | Explica que no hay horas y ofrece otra salida | Paso 2, Paso 1 |
| Gestionar mi cita (`Gestionar`) | Cambiar día u hora, o cancelar | Paso 2, Cancelar |
| Cancelar mi cita (`Cancelar-cliente`) | Confirmación; la acción principal es conservar la cita | Confirmada, Cita cancelada |
| Cita cancelada (`Cancelada`) | Cierra y ofrece agendar otra | Paso 1 |

### Sobandero: día a día (5)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Hoy (`Hoy`) | Siguiente cita en terracota y las del día | Detalle de la cita, Bloquear horas |
| Detalle de la cita (`Cita`) | Datos, llamar, WhatsApp, marcar atendida, cancelar | Hoy |
| Semana (`Semana`) | Tira de siete días y citas del día elegido | Detalle de la cita, Día sin citas |
| Mi horario (`Horario`) | Franjas por día y duración de cada cita | Horario de un día |
| Bloquear horas (`Bloquear`) | Día, desde, hasta y motivo opcional | Hoy |

### Sobandero: clientes, citas manuales y horario (5)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Clientes (`Clientes`) | Buscar por nombre o celular | Ficha del cliente |
| Ficha del cliente (`Cliente`) | Datos, próxima cita e historial | Nueva cita, Detalle de la cita |
| Nueva cita (`Nueva-cita`) | Agendar a quien llamó por teléfono | Hoy |
| Horario del lunes (`Horario-dia`) | Si atiende ese día y sus franjas | Mi horario |
| Día sin citas (`Dia-vacio`) | Estado vacío con las dos acciones habituales | Bloquear horas |

La barra inferior del sobandero (Hoy, Semana, Clientes, Mi horario) está en las cinco pantallas principales; las de detalle usan «Atrás».

### Ingreso con correo y clave (4)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Ingreso (`Ingreso`) | Correo y clave con botón «Mostrar»; el cliente que solo agenda no necesita cuenta | Hoy, Recuperar clave, Paso 1 |
| Clave incorrecta (`Ingreso-error`) | El mensaje bajo el campo dice qué hacer | Hoy |
| Recuperar clave (`Olvide-clave`) | Pide el correo y envía un enlace | Enlace enviado, Ingreso |
| Enlace enviado (`Clave-enviada`) | Dice a qué correo llegó y qué hacer si no aparece | Ingreso |

### Estados y cancelación del sobandero (5)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Hora ocupada (`Hora-ocupada`) | Alguien tomó la hora mientras el cliente llenaba sus datos; ofrece otras | Paso 4, Paso 3 |
| Cargando (`Cargando`) | Bloques de carga con el texto «Buscando horas libres…» | — |
| Sin conexión (`Sin-conexion`) | Explica y ofrece reintentar o llamar | Paso 3 |
| Cancelar cita, sobandero (`Cancelar-sobandero`) | Confirma y avisa al cliente por WhatsApp | Detalle de la cita, Cita cancelada |
| Cita cancelada, sobandero (`Cita-cancelada`) | Dice que la hora quedó libre y ofrece darle otra | Hoy, Nueva cita |

### Administrador (5)

La barra inferior del administrador tiene tres elementos: Hoy, Sobanderos y Agenda.

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Resumen (`Admin-Hoy`) | Total del día y resumen por sobandero | Ficha del sobandero |
| Sobanderos (`Admin-Sobanderos`) | Lista con días y duración de cada uno | Ficha del sobandero, Nuevo sobandero |
| Ficha del sobandero (`Admin-Sobandero`) | Activar o desactivar, correo, horario, duración y enlace para cambiar la clave | Mi horario, Sobanderos |
| Nuevo sobandero (`Admin-Nuevo`) | Nombre, correo y clave temporal | Sobanderos |
| Agenda de todos (`Admin-Agenda`) | Citas del día de los cuatro sobanderos | — |

En el prototipo, «Entrar» lleva al panel del sobandero; en la app real el tipo de cuenta decide si se abre ese panel o el del administrador.

### Primer ingreso, perfil y baja de un sobandero (6)

| Pantalla | Para qué sirve | Lleva a |
| --- | --- | --- |
| Clave nueva (`Cambiar-clave`) | Primer ingreso: reemplaza la clave temporal; un solo campo con «Mostrar» | Hoy |
| Clave muy corta (`Cambiar-clave-error`) | Pide al menos 8 caracteres | Hoy |
| Mi perfil (`Perfil`) | Nombre, correo, cambiar clave y cerrar sesión; se abre desde el avatar de Hoy | Cambiar correo, Cambiar clave, Hoy |
| Cambiar correo (`Perfil-correo`) | Correo nuevo y clave actual para confirmar | Mi perfil |
| Cambiar clave (`Perfil-clave`) | Clave actual y clave nueva | Mi perfil |
| Dar de baja (`Admin-Baja`) | El administrador elige qué pasa con las citas próximas; el historial se conserva | Ficha del sobandero, Sobanderos |

La pantalla de clave nueva es la que se abre después del primer ingreso con una clave temporal; en el prototipo no está enlazada desde «Entrar».

### Cliente: inicio y encontrar mi cita (4)

| Pantalla | Qué muestra | Lleva a |
| --- | --- | --- |
| Inicio (`Inicio`) | Bienvenida, horario y teléfono del local, y dos acciones: agendar o ya tengo una cita | Agendar, Encontrar mi cita, Instalar la app |
| Encontrar mi cita (`Encontrar-cita`) | El cliente escribe su celular y recibe por WhatsApp el enlace a su cita | Enlace enviado |
| Enlace enviado (`Enlace-enviado-cliente`) | Aviso de que revise su WhatsApp; responde igual exista o no la cita | Inicio |
| Instalar la app (`Instalar-app`) | Pasos para agregar la PWA a la pantalla de inicio en iPhone y nota para Android | Inicio |

### Sobandero y administrador: ajustes (5)

| Pantalla | Qué muestra | Lleva a |
| --- | --- | --- |
| Cambiar la hora (`Reprogramar`) | Nuevo día y hora de una cita, con casilla para avisar por WhatsApp | Hoy |
| No asistió (`No-asistio`) | Confirmación para marcar la inasistencia; queda en el historial y no se avisa al cliente | Hoy, Cita |
| Duración de la cita (`Duracion`) | 20, 30, 45 o 60 minutos; aplica solo a citas nuevas | Ficha del sobandero |
| Resumen semanal (`Admin-Reporte`) | Atendidas, no asistidas y canceladas, en total y por sobandero | Resumen del administrador |
| Datos del negocio (`Admin-Negocio`) | Nombre, dirección, teléfono y mensaje de bienvenida | Resumen del administrador |

### Enlaces vencidos, sesión vencida y página no encontrada (4)

| Pantalla | Qué muestra | Lleva a |
| --- | --- | --- |
| Enlace vencido (`Enlace-vencido`) | El enlace de WhatsApp ya no sirve; ofrece pedir uno nuevo | Encontrar mi cita, Inicio |
| Sesión vencida (`Sesion-vencida`) | Aviso de que la sesión terminó por inactividad; las citas siguen igual | Ingreso |
| Clave cambiada (`Clave-cambiada`) | Confirmación tras cambiar la clave; se avisa por correo | Mi perfil |
| Página no encontrada (`No-encontrada`) | Enlace incompleto o inexistente | Inicio |

## Componentes

El sistema tiene 21 componentes en React 18, publicados con tipos de TypeScript y colores, tamaños y espacios como variables CSS que salen de `tokens.json`. Cada uno tiene README y vista previa en el [sistema de diseño](https://claude.ai/artifact/PkCyCWcNPfTt2fSnNFZgvK).

| Componente | Para qué sirve | Propiedades principales |
| --- | --- | --- |
| `Icon` | Iconos de trazo: phone, chat, plus, check, x, calendar-check, calendar-week, users, clock | `name`, `size` |
| `Button` | Acción principal o secundaria | `variant` (solid, outline, onBrand), `size`, `icon`, `onClick`, `disabled` |
| `IconButton` | Acción con solo icono, con etiqueta accesible | `icon`, `label`, `onClick` |
| `AppointmentRow` | Fila de una cita: hora, nombre, duración y llamar | `time`, `meridiem`, `name`, `duration`, `onCall` |
| `NextAppointmentCard` | Siguiente cita en terracota, con llamar y WhatsApp | `time`, `meridiem`, `name`, `detail`, `countdown`, `onCall`, `onChat` |
| `StatusNote` | Nota corta de estado, p. ej. «2 citas atendidas hoy» | `icon`, texto |
| `ScreenHeader` | Fecha, título y avatar de las pantallas con barra inferior | `date`, `title`, `initial` |
| `BottomNav` | Navegación del sobandero, siempre con etiqueta | `items`, `active`, `onSelect` |
| `StepHeader` | «Atrás», «Paso X de 4» y barra de progreso | `step`, `total`, `onBack`, `showBack` |
| `OptionRow` | Fila grande para elegir o avanzar | `title`, `caption`, `initial`, `icon`, `trailing` (chevron, radio, none), `selected`, `highlight`, `disabled`, `onClick` |
| `TimeSlot` | Botón de una hora libre | `time`, `meridiem`, `selected`, `onClick` |
| `TextField` | Campo con etiqueta visible, ayuda y error | `label`, `value`, `defaultValue`, `helper`, `error`, `type`, `inputMode`, `autoComplete`, `onChange` |
| `CheckboxField` | Casilla con frase y enlace, p. ej. consentimiento | `label`, `linkText`, `checked`, `error`, `onChange` |
| `SummaryCard` | Resumen de una cita en filas de icono y texto | `items` (`icon`, `text`), `label` |
| `ConfirmationCard` | Cita confirmada: hora grande, fecha y con quién | `time`, `meridiem`, `title`, `detail`, `label` |

Los seis componentes siguientes se añadieron para ingreso, estados y administración; reemplazan lo que antes estaba hecho a mano.

| Componente | Para qué sirve | Propiedades principales |
| --- | --- | --- |
| `BackHeader` | Botón «Atrás» de las pantallas de detalle | `label`, `onBack` |
| `DayChip` | Día de la semana en la tira de Semana | `day`, `date`, `selected`, `label`, `onClick` |
| `EmptyState` | Bloque que explica por qué no hay contenido y qué hacer | `title`, `text` |
| `Switch` | Interruptor con etiqueta, p. ej. «Recibe citas» | `label`, `checked`, `defaultChecked`, `onChange` |
| `PasswordField` | Clave con botón «Mostrar» u «Ocultar» y error | `label`, `value`, `helper`, `error`, `autoComplete`, `onChange` |
| `Skeleton` | Bloque de carga; va con un texto visible | `width`, `height` |

Siguen hechos a mano el círculo con icono de las pantallas de cierre (cita confirmada, cancelada, enlace enviado) y el enlace «¿Olvidó su clave?». Si se repiten en el código, conviene convertirlos en componentes.

## Mensajes de WhatsApp

Son cinco plantillas de categoría utilidad (transaccionales, sin promociones) con el mismo tono de la app: «usted», una idea por mensaje y sin emojis. Las plantillas se envían por la API de WhatsApp Business y Meta debe aprobarlas antes de usarlas.

Variables comunes: `{{1}}` nombre del cliente · `{{2}}` sobandero · `{{3}}` día («viernes 13 de noviembre») · `{{4}}` hora («10:30 a. m.»). El enlace de cada botón lleva un código único de la cita, para que el cliente la gestione sin iniciar sesión.

| Plantilla | Cuándo se envía | Botón |
| --- | --- | --- |
| `cita_confirmada` | Al terminar el Paso 4 y al guardar una cita manual | Enlace: «Gestionar mi cita» |
| `recordatorio_cita` | El día anterior a las 6:00 p. m. | Respuesta rápida: «Sí, asistiré» y «Necesito cambiarla» |
| `cita_cambiada` | Cuando el cliente o el sobandero cambian la hora | Enlace: «Gestionar mi cita» |
| `cita_cancelada` | Cuando el cliente cancela (confirma que se anuló) | Enlace: «Agendar otra cita» |
| `cita_cancelada_sobandero` | Cuando el sobandero cancela una cita | Enlace: «Elegir otra hora» |

### cita\_confirmada

```markdown
Hola, {{1}}. Su cita quedó agendada.

{{3}} a las {{4}}
Con {{2}} · 30 minutos

Si no puede asistir, avísenos con tiempo.
```

### recordatorio\_cita

```markdown
Hola, {{1}}. Le recordamos su cita de mañana.

{{3}} a las {{4}}
Con {{2}}

¿Podrá asistir?
```

### cita\_cambiada

```markdown
Hola, {{1}}. Su cita se cambió.

Nueva hora: {{3}} a las {{4}}
Con {{2}}
```

### cita\_cancelada

```markdown
Hola, {{1}}. Su cita del {{3}} a las {{4}} fue cancelada.

Cuando quiera, puede agendar otra.
```

### cita\_cancelada\_sobandero

```markdown
Hola, {{1}}. {{2}} no podrá atenderle el {{3}} a las {{4}}. Lamentamos el inconveniente.

Puede elegir otra hora cuando quiera.
```

### Respuestas dentro de la ventana de 24 horas

Cuando el cliente toca un botón del recordatorio se abre una ventana de 24 horas en la que se puede escribir sin plantilla.

| Si toca | La app responde |
| --- | --- |
| Sí, asistiré | Gracias, {{1}}. Lo esperamos. |
| Necesito cambiarla | Con gusto. Elija otro día u hora aquí: \[enlace para gestionar la cita\] |
| Cualquier otro texto | Gracias por escribirnos. Para cambiar o cancelar su cita, entre aquí: \[enlace para gestionar la cita\]. Si prefiere, llámenos. |

Las reglas que usan estas plantillas, según la documentación de los proveedores: un mensaje que la empresa inicia fuera de la ventana de 24 horas solo puede ser una plantilla aprobada; una plantilla lleva botones de respuesta rápida (hasta tres) o de enlace, pero no ambos; el texto de cada botón tiene un máximo de 25 caracteres; y cada variable necesita un valor de ejemplo al enviarla a revisión. Fuentes: [Chakra: plantillas de WhatsApp](https://help.chakrahq.com/learning-centre/whatsapp-business-api/message-template-basics), [Genesys: plantillas](https://docs.genesys.com/Documentation/ESDA/9.0.0/ESMgr/WA_MessageTemplate), [Telnyx: plantillas](https://support.telnyx.com/en/articles/13986483).

## Notas para el código

Estas notas salen del diseño y de la propuesta técnica inicial; ajusta lo que cambie al construir.

### Estructura sugerida

- PWA móvil con React, TypeScript y Vite; los 15 componentes se llevan casi tal cual desde el sistema de diseño.
- API en FastAPI y base de datos PostgreSQL. Una restricción de exclusión sobre el rango de tiempo de cada sobandero impide que dos citas se pisen, aunque dos clientes elijan la misma hora a la vez.
- Fechas guardadas en UTC y mostradas en la zona de Bogotá.
- El cliente no tiene cuenta: gestiona su cita con un enlace con código único que llega por WhatsApp. El sobandero y el administrador inician sesión con correo y clave.

### Reglas de negocio que el diseño ya supone

- Cada sobandero tiene su propio horario y su propia duración de cita (30 minutos por defecto).
- «Primer turno disponible» es la hora libre más cercana entre los cuatro sobanderos.
- Los días sin cupos aparecen apagados y sin poder elegirse.
- Bloquear horas no cancela las citas ya agendadas en ese rango; el sobandero las ve y decide.
- Una cita pasa por cinco estados: agendada, atendida, no asistió, cancelada por el cliente y cancelada por el sobandero. Cancelar libera la hora.
- El valor de la consulta no se guarda ni se muestra.

Cambiar la hora de una cita:

- Si el cliente cambia su cita desde «Gestionar», la cita vieja se libera solo cuando la nueva queda confirmada; si la hora nueva se ocupa, conserva la vieja.
- Si el sobandero cambia la hora, el cliente recibe la plantilla cita\_cambiada solo si la casilla de avisar está marcada.
- Marcar «no asistió» no avisa al cliente y queda en su historial.

### Ingreso y roles

- Hay dos roles con cuenta: sobandero y administrador. El cliente no tiene cuenta.
- El administrador crea a cada sobandero con una clave temporal que este debe cambiar en su primer ingreso, y puede desactivarlo sin borrar su historial.
- Claves guardadas con un algoritmo de hash lento (argon2 o bcrypt), mínimo ocho caracteres y límite de intentos fallidos.
- El enlace de recuperación es de un solo uso y vence a las pocas horas. La pantalla de recuperar clave responde lo mismo exista o no el correo, para no revelar quién tiene cuenta.
- La sesión dura semanas en el celular, para que nadie ingrese cada mañana.

### Datos personales

Se piden solo nombre y celular, con una casilla de consentimiento que enlaza a la política. Guarda la fecha y la versión de la política aceptada por cada persona. No pidas el motivo de la consulta ni datos de salud: si se necesitaran, tendrían un tratamiento más estricto bajo la Ley 1581 de 2012. Esto no es asesoría legal; conviene que un abogado revise la política y el texto del consentimiento.

### WhatsApp

Hace falta una cuenta de WhatsApp Business Platform (directa con Meta o por un proveedor), verificar el negocio y enviar las cinco plantillas a revisión antes del lanzamiento. El recordatorio del día anterior se programa en el servidor, no en el celular del cliente. El aviso de nueva cita al sobandero puede ser una notificación de la PWA.

## Pendientes de diseño

- [x] Editar la duración de la cita (hoy solo se muestra)
- [x] Aviso de «clave cambiada» tras guardar en el perfil
- [ ] Carga animada que respete «reducir movimiento» (hoy es estática)
- [ ] Texto de la política de datos y del consentimiento, revisado por un abogado
- [ ] Enviar las cinco plantillas de WhatsApp a revisión de Meta
