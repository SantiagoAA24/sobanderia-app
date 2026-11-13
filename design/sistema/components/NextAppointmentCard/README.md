Tarjeta terracota con la siguiente cita del día: hora grande, cliente y botones para llamar o escribir por WhatsApp.

Quien lo usa aporta `time`, `meridiem`, `name`, opcionalmente `detail` ("Sesión de 30 minutos"), `countdown` ("En 10 min"), `label` (por defecto "Siguiente cita"), `onCall` y `onChat`.

- Es el único bloque terracota de la pantalla; va justo debajo del `ScreenHeader`.
- Los dos botones son `Button` `onBrand` de tamaño `md`, con la misma anchura.
- Hazlo así: una sola cita; cuando no hay siguiente cita, no dibujes la tarjeta.
- Evítalo: poner dos tarjetas terracota en una pantalla, o más de dos acciones dentro de la tarjeta.
