Cabecera de cada paso del agendamiento: botón «Atrás», «Paso X de 4» y una barra de progreso de segmentos.

Quien lo usa aporta `step` (1 a `total`, por defecto 4) y `onBack`. En el paso 1 no hay a dónde volver y se muestra la marca «Sobandería» en lugar de «Atrás» (`showBack` lo cambia).

- El botón «Atrás» mide 48px de alto y va en `brand-deep`.
- La barra rellena los segmentos hechos con `brand-deep` y deja el resto en `surface-avatar`; el progreso también se anuncia como texto.
- Hazlo así: úsala en todas las pantallas del flujo, justo sobre el título `display-lg`.
- Evítalo: más de cinco pasos; si el flujo crece, conviene agrupar pantallas.
