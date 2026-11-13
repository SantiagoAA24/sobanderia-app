Botón de acción con texto, de 52 o 56px de alto y esquinas redondeadas.

Quien lo usa aporta el texto (`children`), la acción (`onClick`) y, si quiere, un `icon`.

- `variant="solid"`: acción principal de la pantalla (por ejemplo "Nueva cita"). Uno por pantalla.
- `variant="outline"`: acción secundaria (por ejemplo "Bloquear horas"). Se coloca al lado o debajo del principal.
- `variant="onBrand"`: solo dentro de la tarjeta terracota (`NextAppointmentCard`); es blanco con texto `brand-deep`.
- `size="lg"` (56px) para pantalla; `size="md"` (52px) sobre la tarjeta destacada.

Hazlo así: texto corto con verbo ("Llamar", "Nueva cita"); botones lado a lado con `space-10` y `flex: 1`.
Evítalo: botones sin texto (usa `IconButton`), más de un `solid` por pantalla, color terracota de relleno fuera de la tarjeta destacada.
