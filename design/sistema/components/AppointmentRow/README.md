Fila de la agenda con la hora, el nombre del cliente, la duración y un botón para llamarlo.

Quien lo usa aporta `time` ("10:30"), `meridiem` ("a. m."), `name`, opcionalmente `duration` ("30 min" por defecto) y `onCall`.

- Va en una lista vertical con `space-10` entre filas, bajo un encabezado `section-title` como "Más tarde hoy".
- La hora usa `display-md` y el "a. m." va debajo, en `ink-muted`.
- Hazlo así: nombre completo del cliente, tal como se agendó.
- Evítalo: mostrar el valor de la consulta, o filas distintas con alturas distintas.
