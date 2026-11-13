Sistema de diseño de la app de citas de la sobandería: una pantalla móvil, cálida y muy clara, pensada para sobanderos y para clientes adultos que agendan desde el celular.

## Fundamentos de contenido

- Escribe en español neutro y cercano, con frases cortas y verbos de acción: "Nueva cita", "Bloquear horas", "Llamar", "Más tarde hoy".
- El público es mayoritariamente adulto: sin anglicismos ni abreviaturas técnicas. Cada botón dice con palabras qué hace; nunca solo un icono (excepto `IconButton`, que siempre lleva `label` para lectores de pantalla).
- Las horas van en formato de 12 horas con "a. m." o "p. m." separado en su propio elemento (`9:30` + `a. m.`). Las duraciones, como "30 min"; la sesión completa, "Sesión de 30 minutos". La fecha lleva el día de la semana: "Jueves 12 de noviembre".
- Saluda con el nombre y la franja del día: "Buenos días, Carlos".
- Sin emojis ni signos de exclamación. Confirma con hechos: "2 citas atendidas hoy", "En 10 min".
- El valor de la consulta no se muestra: cada sobandero lo maneja por fuera de la app.

## Fundamentos visuales

- **Fondo y superficies.** Toda pantalla va sobre `surface-100` (crema). Las filas y la barra inferior son `surface-raised` (blanco) con borde de 1px `border`. Nada de sombras ni degradados: la separación la dan el borde y el espacio.
- **Un solo momento terracota.** `brand` rellena una única tarjeta por pantalla: `NextAppointmentCard` en la agenda del sobandero, `ConfirmationCard` en la confirmación del cliente. Todo lo demás es tinta (`ink`) y terracota oscuro (`brand-deep`) en iconos y estados activos.
- **Acción principal en tinta.** El botón principal es `Button` `solid` (relleno `ink`, texto `surface-100`); la acción secundaria, `outline`. Sobre la tarjeta terracota, los botones son `onBrand`.
- **Tipografía.** `Fraunces` (`display-*`) para horas y títulos; `Nunito Sans` (`title-lg`, `section-title`, `body-lg`, `body`, `label`, `caption`, `micro`) para todo lo demás. Ningún texto baja de `micro` (13px). Los dos tipos se cargan de Google Fonts con pesos 400, 600 y 700 (Fraunces 600 y 700).
- **Espaciado.** Margen lateral de pantalla `space-20`; entre bloques `space-16`; entre filas y entre botones lado a lado `space-10`; relleno de la tarjeta destacada `space-20`.
- **Formas.** Filas y botones `lg`: `radius-lg`; tarjeta destacada: `radius-xl`; botones `md`: `radius-md`; barra inferior: `radius-sm`; círculos (avatar, botón de icono): `radius-round`; píldoras: `radius-pill`.
- **Tamaño táctil.** Todo control mide al menos 48px de alto: botones 52 o 56px, botones de icono 48px, elementos de la barra inferior 56px.
- **Foco.** Anillo sólido de 3px `focus-ring` con 2px de separación; sobre la tarjeta terracota, el anillo es `on-brand`.
- **Pantalla.** Diseño para 390px de ancho. Orden de arriba abajo: `ScreenHeader`, `NextAppointmentCard`, lista de `AppointmentRow` bajo un `section-title`, `StatusNote`, par de botones `Button` (`solid` + `outline`) y `BottomNav` fijo abajo con cuatro elementos y etiqueta siempre visible.
- **Movimiento.** Ninguno por defecto.

## Iconografía

- Iconos de trazo, 24×24, 2px de grosor, extremos redondeados, en `currentColor`, dibujados por `Icon`. Tamaño 22px dentro de botones y 24px en la barra inferior.
- Conjunto actual: `phone`, `chat` (WhatsApp), `plus`, `check`, `x`, `calendar-check` (Hoy), `calendar-week` (Semana), `users` (Clientes), `clock` (Mi horario). Son dibujos propios del sistema, no una librería externa.
- Nunca uses emojis como iconos. Un icono acompaña a una palabra; no la reemplaza.

## Estados

- Atendida: `StatusNote` con `check` en `success`. Cancelada o no asistió: `x` y la palabra, en `ink-muted`. Cada estado lleva palabra e icono, nunca solo color.

## Accesibilidad

- Texto a 4.5:1 como mínimo sobre el fondo que su nota indica; `brand` como texto sobre `surface-100` solo a partir de 18px o en negrita.
- Usa `button` y `a` reales; el botón de solo icono siempre lleva `label`.
- La barra inferior marca el elemento activo con `aria-current="page"`.

## Logo

No hay logo todavía. El nombre "Sobandería" se escribe en `display-lg`, color `ink`. No dibujes ni sustituyas una marca.

## Flujo de agendamiento (cliente)

Pantallas de 390px que se leen de arriba abajo: `StepHeader` (paso y progreso), título, `SummaryCard` (resumen, antes de pedir datos), lista de `OptionRow` (sobandero o día; `chevron` para avanzar, `radio` para elegir), cuadrícula de `TimeSlot` de tres columnas, `TextField` con etiqueta visible (con `error` si hace falta), `CheckboxField` para el consentimiento y, al final, `ConfirmationCard` con los botones de acción debajo. Se habla de «usted» y con frases cortas.

## Ingreso, estados y administración

Ingreso con correo y clave: `TextField` (correo) y `PasswordField`, con el error debajo del campo y la acción principal al final. Para estados sin contenido o sin conexión usa `EmptyState`; mientras carga, `Skeleton` junto a un texto visible. En el panel del sobandero y del administrador, `BackHeader` para volver, `DayChip` para elegir el día y `Switch` para activar o desactivar (atiende, recibe citas).
