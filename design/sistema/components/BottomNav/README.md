Barra de navegación inferior de cuatro elementos, con icono y etiqueta siempre visibles.

Quien lo usa aporta `active` (id del elemento activo), `onSelect(id)` y, si cambia las secciones, `items` (por defecto Hoy, Semana, Clientes, Mi horario con ids `today`, `week`, `clients`, `schedule`).

- Queda fija al pie; el elemento activo lleva fondo `surface-clay-tint`, texto `brand-deep` y `aria-current="page"`.
- Cada elemento mide al menos 56px de alto.
- Hazlo así: máximo cuatro elementos y etiquetas de una o dos palabras.
- Evítalo: ocultar las etiquetas o mostrar solo iconos.
