Fila grande y tocable para elegir una opción de una lista: un sobandero, un día.

Quien lo usa aporta `title`, opcionalmente `caption`, un avatar (`initial`) o un `icon` a la izquierda, `trailing` (`chevron` para pasar a otra pantalla, `radio` para elegir una entre varias), `selected` y `onClick`.

- Con `trailing="chevron"` la fila lleva a la siguiente pantalla (elegir sobandero). `highlight` la resalta sin marcarla como elegida, por ejemplo "Primer turno disponible".
- Con `trailing="radio"` y `selected` la fila queda en `surface-clay-tint` con borde `brand-deep` de 2px y un check. Una sola elegida por lista.
- `disabled` pinta la fila en `surface-sand`, sin radio, para días sin cupos; la caption dice por qué ("Sin cupos").
- Mide al menos 60px (76px con avatar o icono). Separa las filas con `space-10`.
- Hazlo así: un título de una línea y una caption corta con el dato que ayuda a decidir.
- Evítalo: más de seis filas visibles sin agruparlas, o mezclar `chevron` y `radio` en la misma lista.
