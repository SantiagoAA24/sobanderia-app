Tarjeta terracota con los datos de la cita ya confirmada: hora grande, fecha completa y con quién.

Quien lo usa aporta `time`, `meridiem`, `title` (la fecha: "Viernes 13 de noviembre"), opcionalmente `detail` ("Con Carlos · Sesión de 30 minutos") y `label` (por defecto "Su cita").

- Es el momento terracota de la pantalla de confirmación; en la agenda del sobandero ese lugar lo ocupa `NextAppointmentCard`. No pongas las dos en la misma pantalla.
- No lleva botones: las acciones ("Agregar al calendario", "Cambiar o cancelar la cita") van debajo, como `Button`.
- Hazlo así: justo debajo del título de confirmación.
- Evítalo: añadir el valor de la consulta u otros datos que no se hayan dado en el agendamiento.
