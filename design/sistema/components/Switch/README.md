Interruptor con etiqueta para activar o desactivar algo, como «Atiendo los lunes» o «Recibe citas».

Quien lo usa aporta `label`, `checked` y `onChange` (o `defaultChecked`).

- Es un `input type="checkbox"` con `role="switch"`, así que funciona con teclado y lector de pantalla.
- Fila de 64px con la etiqueta a la izquierda; el interruptor de 56 × 32px a la derecha. Encendido: pista `brand-deep` y botón a la derecha; apagado: pista `ink-muted` y botón a la izquierda.
- Hazlo así: etiqueta en afirmativo («Recibe citas»), para que encendido signifique sí.
- Evítalo: usarlo para acciones inmediatas con efectos grandes; para eso va un `Button` con confirmación.
