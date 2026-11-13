Botón vertical de un día de la semana, con la inicial arriba y el número abajo.

Quien lo usa aporta `day` («J»), `date` (12), `selected`, `label` accesible completo («Jueves 12») y `onClick`.

- Siete en una cuadrícula `repeat(7, minmax(0, 1fr))` con 2px de separación; cada uno mide al menos 64px de alto.
- El día elegido usa `surface-clay-tint` y borde `brand-deep` de 2px, igual que `OptionRow` y `TimeSlot`.
- Hazlo así: siempre con `label`, porque la inicial sola («M» de martes y miércoles) no se entiende con un lector de pantalla.
